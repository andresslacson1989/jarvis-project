import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { qualifyPackagedCore } from "./qualify-core-runtime.mjs";
import { verifyTufMetadataProfile } from "./verify-tuf-metadata-profile.mjs";

const execFileAsync = promisify(execFile);
const V1_NODE_VERSION = "24.18.0";
const TUF_PROFILE_VERSION = "1.0.35";
const RECOVERY_SECRET_BYTES = 32;

function usage() {
  return "Usage: node tools/release/qualify-backup-restore.mjs --release-root <absolute-core-runtime-root> --recovery-secret-file <absolute-32-byte-file> [--output <absolute-secret-free-evidence-file>]";
}

export function parseArguments(argv) {
  const values = new Map();
  const allowed = new Set(["--release-root", "--recovery-secret-file", "--output"]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error(`unexpected argument: ${argument}`);
    const [key, inlineValue] = argument.split("=", 2);
    if (!allowed.has(key)) throw new Error(`unknown argument: ${key}`);
    const value = inlineValue ?? argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${key}`);
    if (values.has(key)) throw new Error(`duplicate argument: ${key}`);
    values.set(key, value);
  }
  const releaseRoot = values.get("--release-root");
  const recoverySecretFile = values.get("--recovery-secret-file");
  if (!releaseRoot || !isAbsolute(releaseRoot) || !recoverySecretFile || !isAbsolute(recoverySecretFile)) {
    throw new Error(usage());
  }
  const output = values.get("--output");
  if (output !== undefined && !isAbsolute(output)) throw new Error("--output must be absolute");
  return {
    releaseRoot: resolve(releaseRoot),
    recoverySecretFile: resolve(recoverySecretFile),
    output: output === undefined ? undefined : resolve(output),
  };
}

function isCanonicalChild(root, candidate) {
  const child = relative(root, candidate);
  return (
    child.length > 0 &&
    !isAbsolute(child) &&
    child.split(/[\\/]/u).every((component) => component.length > 0 && component !== "..")
  );
}

async function requireRegularFile(path, label) {
  const information = await lstat(path).catch((error) => {
    throw new Error(`${label} is missing`, { cause: error });
  });
  if (information.isSymbolicLink() || !information.isFile()) {
    throw new Error(`${label} must be a regular, non-symbolic-link file`);
  }
  return realpath(path);
}

async function requireReleaseFile(root, relativePath, label) {
  const canonicalRoot = await realpath(root);
  const candidate = await requireRegularFile(resolve(root, relativePath), label);
  if (!isCanonicalChild(canonicalRoot, candidate)) throw new Error(`${label} must remain inside the release root`);
  return candidate;
}

async function validateCandidate(releaseRootInput) {
  const rootInformation = await lstat(releaseRootInput).catch((error) => {
    throw new Error("release root is missing", { cause: error });
  });
  if (rootInformation.isSymbolicLink() || !rootInformation.isDirectory()) {
    throw new Error("release root must be a regular, non-symbolic-link directory");
  }
  const releaseRoot = await realpath(releaseRootInput);
  const nodePath = await requireReleaseFile(releaseRoot, "runtime/node.exe", "release-owned node.exe");
  await requireReleaseFile(releaseRoot, "core/dist/persistence.js", "release-owned persistence module");
  await requireReleaseFile(releaseRoot, "core/dist/schema.js", "release-owned schema module");
  await requireReleaseFile(releaseRoot, "core/dist/backup-manifest.js", "release-owned backup manifest module");
  await requireReleaseFile(releaseRoot, "core/dist/backup-package.js", "release-owned backup package module");
  const metadataDirectory = await realpath(join(releaseRoot, "tuf", "metadata")).catch((error) => {
    throw new Error("release-owned TUF metadata directory is missing", { cause: error });
  });
  if (!isCanonicalChild(releaseRoot, metadataDirectory)) {
    throw new Error("release-owned TUF metadata must remain inside the release root");
  }
  const tufProfile = await verifyTufMetadataProfile({ metadataDirectory });
  if (tufProfile.profile !== TUF_PROFILE_VERSION || tufProfile.productionProfileShape !== "PASS") {
    throw new Error("release-owned TUF metadata did not pass the required production profile");
  }
  const manifestPath = await requireReleaseFile(releaseRoot, "runtime-manifest.json", "release runtime manifest");
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const manifestSha256 = createHash("sha256").update(manifestBytes).digest("hex");
  if (manifestSha256 !== tufProfile.target.sha256 || manifestBytes.length !== tufProfile.target.length) {
    throw new Error("TUF runtime-manifest target does not match the packaged runtime manifest");
  }
  if (
    manifest.nodeVersion !== V1_NODE_VERSION ||
    manifest.tufSpecVersion !== TUF_PROFILE_VERSION ||
    manifest.target !== "WINDOWS_FULL_HOST_X64" ||
    manifest.coreVersion !== tufProfile.target.releaseId ||
    manifest.sourceCommitSha !== tufProfile.target.sourceCommitSha ||
    manifest.releaseSequence !== tufProfile.target.releaseSequence ||
    manifest.securityEpoch !== tufProfile.target.securityEpoch
  ) {
    throw new Error("TUF release identity does not match the packaged runtime manifest");
  }
  const nodeVersionResult = await execFileAsync(nodePath, ["--version"], {
    cwd: releaseRoot,
    env: {},
    windowsHide: true,
    timeout: 10_000,
  });
  const nodeVersion = nodeVersionResult.stdout.trim();
  if (nodeVersion !== `v${V1_NODE_VERSION}`) throw new Error(`release-owned Node reported ${nodeVersion}`);
  return { releaseRoot, nodePath, tufProfile, manifest, manifestSha256 };
}

const RESTORE_DRILL_SCRIPT = String.raw`
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const releaseRoot = process.env.JARVIS_QUALIFICATION_RELEASE_ROOT;
const recoverySecretPath = process.env.JARVIS_QUALIFICATION_RECOVERY_SECRET_FILE;
if (!releaseRoot || !recoverySecretPath) throw new Error("qualification inputs are missing");

const [{ openCoreDatabase, exportSqlcipherSnapshot }, { applyCoreMigrations }, { buildBackupPayloadManifest }, { createAuthenticatedBackupPackage, restoreVerifiedPortableBackup, BackupPackageVerificationError }] = await Promise.all([
  import(pathToFileURL(join(releaseRoot, "core/dist/persistence.js")).href),
  import(pathToFileURL(join(releaseRoot, "core/dist/schema.js")).href),
  import(pathToFileURL(join(releaseRoot, "core/dist/backup-manifest.js")).href),
  import(pathToFileURL(join(releaseRoot, "core/dist/backup-package.js")).href),
]);

function buildSessionPasswordVerifier() {
  return {
    profileId: "session-password-v1",
    purpose: "SESSION_PASSWORD",
    algorithm: "ARGON2ID",
    version: 0x13,
    memoryKiB: 65536,
    iterations: 3,
    parallelism: 4,
    salt: Buffer.alloc(16, 0x51),
    verifier: Buffer.alloc(32, 0x52),
  };
}

const drillRoot = await mkdtemp(join(tmpdir(), "jarvis-backup-restore-drill-"));
let recoverySecret;
let live;
let cleanProfile;
let snapshotDbKey;
let backupDek;
let liveDbDek;
let snapshotBytes;
let newDbDek;
let protectedDbDek;
try {
  recoverySecret = await readFile(recoverySecretPath);
  if (recoverySecret.length !== 32) throw new Error("recovery secret must be exactly 32 bytes");
  const livePath = join(drillRoot, "live.db");
  const snapshotPath = join(drillRoot, "snapshot.db");
  snapshotDbKey = randomBytes(32);
  backupDek = randomBytes(32);
  liveDbDek = randomBytes(32);
  live = openCoreDatabase(livePath, { dbDek: liveDbDek });
  applyCoreMigrations(live, () => "2026-08-15T00:00:00.000Z");
  live.database.prepare("INSERT INTO authoritative_records(record_id, record_type, state_json, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run("disaster-drill-record", "TEST", "{\"state\":\"READY\"}", 1, "2026-08-15T00:00:00.000Z", "2026-08-15T00:00:00.000Z");
  live.database.prepare("INSERT INTO integration_accounts (integration_account_id, provider_id, account_label, credential_handle, state, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("disaster-drill-account", "provider-drill", "Private drill", "opaque-old-handle", "ACTIVE", 1, "2026-08-15T00:00:00.000Z", "2026-08-15T00:00:00.000Z");
  await exportSqlcipherSnapshot(live, snapshotPath, snapshotDbKey);
  live.close();
  live = undefined;

  snapshotBytes = await readFile(snapshotPath);
  const backupId = "0190d4b4-1b84-7a1e-8f20-000000000001";
  const createdAt = "2026-08-15T00:00:00.000Z";
  const manifest = buildBackupPayloadManifest({
    backupId,
    createdAt,
    protectionClass: "PORTABLE_STATE",
    jarvisVersion: process.env.JARVIS_QUALIFICATION_RELEASE_ID,
    protocolVersion: 1,
    schemaVersion: 1,
    snapshot: {
      logicalType: "SQLCIPHER_SNAPSHOT",
      path: "database/state.db",
      bytes: snapshotBytes.length.toString(10),
      sha256: createHash("sha256").update(snapshotBytes).digest("base64url"),
    },
    objects: [],
    keySlotProfiles: ["GENERATED_RECOVERY_V1"],
  });
  const builtPackage = createAuthenticatedBackupPackage({
    backupId,
    createdAt,
    protectionClass: "PORTABLE_STATE",
    manifestBytes: manifest.canonicalBytes,
    snapshotDbKey,
    backupDek,
    recoverySecret,
    slotId: "generated-recovery-disaster-drill",
    objects: [{ path: "database/state.db", data: snapshotBytes }],
  });

  const wrongFactorDestination = join(drillRoot, "wrong-factor.db");
  let wrongFactorRejected = false;
  try {
    await restoreVerifiedPortableBackup({
      descriptor: builtPackage.descriptorBytes,
      chunks: builtPackage.chunks,
      generatedRecoverySlot: builtPackage.generatedRecoverySlot,
      recoverySecret: Buffer.alloc(32, 0x44),
      noncePrefix: builtPackage.noncePrefix,
      destinationPath: wrongFactorDestination,
      maintenanceLockPath: join(drillRoot, "wrong-factor.maintenance.lock"),
      recoveryMarkerPath: join(drillRoot, "wrong-factor.marker"),
      sessionPasswordVerifier: buildSessionPasswordVerifier(),
      protectNewDbDek: async () => { throw new Error("wrong factor reached DB_DEK protection"); },
      newDbDek: randomBytes(32),
      now: "2026-08-15T00:01:00.000Z",
    });
  } catch (error) {
    wrongFactorRejected = error instanceof BackupPackageVerificationError && error.code === "BACKUP_PACKAGE_SLOT_INVALID";
  }
  if (!wrongFactorRejected) throw new Error("wrong recovery factor was not rejected before restore");
  let wrongFactorDestinationMissing = false;
  try {
    await readFile(wrongFactorDestination);
  } catch (error) {
    if (error?.code === "ENOENT") wrongFactorDestinationMissing = true;
    else throw error;
  }
  if (!wrongFactorDestinationMissing) throw new Error("wrong-factor restore created a destination");

  const destinationPath = join(drillRoot, "clean-profile.db");
  newDbDek = randomBytes(32);
  let protectionCommitted = false;
  const restored = await restoreVerifiedPortableBackup({
    descriptor: builtPackage.descriptorBytes,
    chunks: builtPackage.chunks,
    generatedRecoverySlot: builtPackage.generatedRecoverySlot,
    recoverySecret,
    noncePrefix: builtPackage.noncePrefix,
    destinationPath,
    maintenanceLockPath: join(drillRoot, "maintenance.lock"),
    recoveryMarkerPath: join(drillRoot, "recovery-required.marker"),
    sessionPasswordVerifier: buildSessionPasswordVerifier(),
    protectNewDbDek: async (dbDek) => {
      protectedDbDek = Buffer.from(dbDek);
      return {
        handle: "private-drill-secure-storage-handle",
        commit: async () => { protectionCommitted = true; },
        abort: async () => undefined,
      };
    },
    newDbDek,
    now: "2026-08-15T00:02:00.000Z",
  });
  if (!protectedDbDek?.equals(newDbDek)) throw new Error("restore did not stage the fresh DB_DEK");
  if (!protectionCommitted) throw new Error("restore did not commit the fresh DB_DEK protection lease");
  if (restored.affectedIntegrationAccountIds.length !== 1 || restored.affectedIntegrationAccountIds[0] !== "disaster-drill-account") {
    throw new Error("restore did not reconcile the integration account");
  }
  const marker = await readFile(join(drillRoot, "recovery-required.marker"), "utf8");
  if (marker !== "JARVIS_RECOVERY_REQUIRED_V1\n") throw new Error("restore recovery marker is incorrect");
  cleanProfile = openCoreDatabase(destinationPath, { dbDek: newDbDek });
  const record = cleanProfile.database.prepare("SELECT record_id FROM authoritative_records WHERE record_id = ?").get("disaster-drill-record");
  const integration = cleanProfile.database.prepare("SELECT credential_handle, state FROM integration_accounts WHERE integration_account_id = ?").get("disaster-drill-account");
  if (record?.record_id !== "disaster-drill-record") throw new Error("restored authoritative record is missing");
  if (integration?.credential_handle !== null || integration?.state !== "REAUTH_REQUIRED") throw new Error("restored integration account was not moved to REAUTH_REQUIRED");
  console.log(JSON.stringify({
    status: "PASS",
    wrongRecoveryFactorRejected: true,
    cleanProfileRestored: true,
    freshDbDekCommitted: true,
    recoveryMarkerWritten: true,
    integrationCredentialsReauthRequired: true,
    recoverySecretBytes: 32,
    secretExported: false,
  }));
} finally {
  cleanProfile?.close();
  live?.close();
  recoverySecret?.fill(0);
  snapshotDbKey?.fill(0);
  backupDek?.fill(0);
  liveDbDek?.fill(0);
  snapshotBytes?.fill(0);
  newDbDek?.fill(0);
  protectedDbDek?.fill(0);
  await rm(drillRoot, { recursive: true, force: true });
}
`;

async function runRestoreDrill(candidate, recoverySecretFile) {
  const output = await execFileAsync(candidate.nodePath, ["--input-type=module", "--eval", RESTORE_DRILL_SCRIPT], {
    cwd: candidate.releaseRoot,
    env: {
      JARVIS_QUALIFICATION_RELEASE_ROOT: candidate.releaseRoot,
      JARVIS_QUALIFICATION_RELEASE_ID: candidate.manifest.coreVersion,
      JARVIS_QUALIFICATION_RECOVERY_SECRET_FILE: recoverySecretFile,
    },
    windowsHide: true,
    maxBuffer: 64 * 1024,
    timeout: 30_000,
  });
  if (output.stderr.trim()) throw new Error(`restore drill wrote unexpected stderr: ${output.stderr.trim()}`);
  const lines = output.stdout.trim().split(/\r?\n/u).filter(Boolean);
  if (lines.length !== 1) throw new Error("restore drill returned unexpected output");
  let result;
  try {
    result = JSON.parse(lines[0]);
  } catch (error) {
    throw new Error("restore drill returned invalid evidence JSON", { cause: error });
  }
  if (result.status !== "PASS") throw new Error("restore drill did not pass");
  return result;
}

export async function qualifyBackupRestore({ releaseRoot, recoverySecretFile, output }) {
  const candidate = await validateCandidate(releaseRoot);
  const secretPath = await requireRegularFile(recoverySecretFile, "recovery secret file");
  if (isCanonicalChild(candidate.releaseRoot, secretPath)) {
    throw new Error("recovery secret file must be outside the release root");
  }
  const secret = await readFile(secretPath);
  if (secret.length !== RECOVERY_SECRET_BYTES) throw new Error("recovery secret file must contain exactly 32 bytes");
  secret.fill(0);
  const coreQualification = await qualifyPackagedCore({
    releaseRoot: candidate.releaseRoot,
    requireProductionTufProfile: true,
  });
  const drill = await runRestoreDrill(candidate, secretPath);
  const evidence = {
    status: "PASS",
    artifactQualification: "PACKAGED_CORE_RUNTIME",
    sourceCommitSha: candidate.manifest.sourceCommitSha,
    releaseId: candidate.manifest.coreVersion,
    releaseSequence: candidate.manifest.releaseSequence,
    securityEpoch: candidate.manifest.securityEpoch,
    tufProfile: candidate.tufProfile.profile,
    tufShape: candidate.tufProfile.productionProfileShape,
    keyCustodyEvidence: candidate.tufProfile.keyCustodyEvidence,
    targetPath: candidate.tufProfile.target.path,
    targetSha256: candidate.tufProfile.target.sha256,
    coreRuntimeQualification: {
      authenticatedCoreTransport: coreQualification.authenticatedCoreTransport,
      controlledStop: coreQualification.controlledStop,
    },
    restoreDrill: drill,
    recoverySecretFile: "EXTERNAL_INPUT_NOT_RECORDED",
    secretExported: false,
  };
  if (output) {
    await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
  }
  return evidence;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await qualifyBackupRestore(parseArguments(process.argv.slice(2)));
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(`[backup-restore-qualification] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
