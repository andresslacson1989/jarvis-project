import { readFile, lstat, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Metadata, MetadataKind } from "@tufjs/models";

export const TUF_PROFILE_VERSION = "1.0.35";
export const DEFAULT_TARGET_PATH = "runtime-manifest.json";
export const ROLLBACK_POLICY = "CURRENT_TRUSTED_TARGETS_ONLY";

const MAX_VALIDITY_DAYS = Object.freeze({
  root: 365,
  targets: 90,
  snapshot: 30,
  timestamp: 7,
});

export class TufMetadataProfileError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "TufMetadataProfileError";
  }
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TufMetadataProfileError(`${label} must be a non-empty string`);
  }
  return value;
}

function requireSha256(value, label) {
  const sha256 = requireString(value, label).toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(sha256)) {
    throw new TufMetadataProfileError(`${label} must be a SHA-256 digest`);
  }
  return sha256;
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TufMetadataProfileError(`${label} must be a positive safe integer`);
  }
  return value;
}

function requireRole(role, roleName, keyMap, minimumKeyCount, minimumThreshold) {
  if (!role || !Array.isArray(role.keyIDs)) {
    throw new TufMetadataProfileError(`${roleName} role is missing key IDs`);
  }
  const keyIDs = [...role.keyIDs];
  if (new Set(keyIDs).size !== keyIDs.length) {
    throw new TufMetadataProfileError(`${roleName} role contains duplicate key IDs`);
  }
  if (keyIDs.length < minimumKeyCount) {
    throw new TufMetadataProfileError(`${roleName} role requires at least ${minimumKeyCount} keys`);
  }
  if (!Number.isSafeInteger(role.threshold) || role.threshold < minimumThreshold || role.threshold > keyIDs.length) {
    throw new TufMetadataProfileError(`${roleName} role threshold is below the required profile`);
  }
  for (const keyID of keyIDs) {
    const key = keyMap[keyID];
    if (!key || key.keyType !== "ed25519" || key.scheme !== "ed25519") {
      throw new TufMetadataProfileError(`${roleName} role contains an invalid Ed25519 key`);
    }
    const publicKey = key.keyVal?.public;
    if (typeof publicKey !== "string" || !/^[0-9a-f]{64}$/iu.test(publicKey)) {
      throw new TufMetadataProfileError(`${roleName} role contains an invalid public key`);
    }
  }
  return { keyIDs, threshold: role.threshold };
}

function requireDistinctRoleKeys(roles) {
  const seen = new Map();
  for (const [roleName, role] of Object.entries(roles)) {
    for (const keyID of role.keyIDs) {
      const previous = seen.get(keyID);
      if (previous) {
        throw new TufMetadataProfileError(`TUF key ${keyID} is reused by ${previous} and ${roleName}`);
      }
      seen.set(keyID, roleName);
    }
  }
}

function requireValidity(metadata, roleName, now) {
  const expires = new Date(metadata.signed.expires);
  if (!Number.isFinite(expires.getTime())) {
    throw new TufMetadataProfileError(`${roleName} metadata expiration is invalid`);
  }
  if (expires.getTime() <= now.getTime()) {
    throw new TufMetadataProfileError(`${roleName} metadata is expired`);
  }
  const maximum = MAX_VALIDITY_DAYS[roleName] * 24 * 60 * 60 * 1000;
  if (expires.getTime() - now.getTime() > maximum) {
    throw new TufMetadataProfileError(`${roleName} metadata exceeds the maximum validity period`);
  }
}

async function readMetadata(metadataDirectory, name, kind) {
  const path = join(metadataDirectory, name);
  let information;
  try {
    information = await lstat(path);
  } catch (error) {
    throw new TufMetadataProfileError(`TUF metadata ${name} is missing`, { cause: error });
  }
  if (information.isSymbolicLink() || !information.isFile()) {
    throw new TufMetadataProfileError(`TUF metadata ${name} must be a regular file`);
  }
  let bytes;
  try {
    bytes = await readFile(path);
    return { bytes, metadata: Metadata.fromJSON(kind, JSON.parse(bytes.toString("utf8"))) };
  } catch (error) {
    if (error instanceof TufMetadataProfileError) throw error;
    throw new TufMetadataProfileError(`TUF metadata ${name} is invalid`, { cause: error });
  }
}

function requireMetaFile(metaFile, expectedMetadata, name, bytes) {
  if (!metaFile || metaFile.version !== expectedMetadata.signed.version || metaFile.length !== bytes.length) {
    throw new TufMetadataProfileError(`${name} metadata reference does not match the authorized file`);
  }
  if (requireSha256(metaFile.hashes?.sha256, `${name} metadata hash`) !== digest(bytes)) {
    throw new TufMetadataProfileError(`${name} metadata hash does not match the authorized file`);
  }
}

function requireTargetCustom(target, targetPath) {
  const custom = target?.unrecognizedFields?.custom;
  if (!custom || typeof custom !== "object" || Array.isArray(custom)) {
    throw new TufMetadataProfileError(`TUF target ${targetPath} is missing custom release identity`);
  }
  for (const field of [
    "tufSpecVersion",
    "releaseId",
    "jarvisVersion",
    "platform",
    "runtimeRole",
    "architecture",
    "sourceCommitSha",
    "rollbackPolicy",
  ]) {
    requireString(custom[field], `TUF target ${targetPath} custom.${field}`);
  }
  if (custom.tufSpecVersion !== TUF_PROFILE_VERSION) {
    throw new TufMetadataProfileError(`TUF target ${targetPath} uses an unsupported profile`);
  }
  requirePositiveInteger(custom.releaseSequence, `TUF target ${targetPath} custom.releaseSequence`);
  requirePositiveInteger(custom.securityEpoch, `TUF target ${targetPath} custom.securityEpoch`);
  requireSha256(custom.artifactSha256, `TUF target ${targetPath} custom.artifactSha256`);
  if (custom.rollbackPolicy !== ROLLBACK_POLICY) {
    throw new TufMetadataProfileError(`TUF target ${targetPath} uses an unsupported rollback policy`);
  }
  if (custom.platform !== "WINDOWS" || custom.runtimeRole !== "FULL_HOST" || custom.architecture !== "x64") {
    throw new TufMetadataProfileError(`TUF target ${targetPath} is not the Windows x64 FULL_HOST target`);
  }
  return custom;
}

/**
 * Validate the structural production TUF profile without ever handling private
 * keys. This proves metadata shape, threshold separation, signatures, expiry,
 * references, and target identity. Key storage location/device custody remains
 * an external release-security evidence gate and is intentionally reported as
 * unproven by this function.
 */
export async function verifyTufMetadataProfile({
  metadataDirectory: metadataDirectoryInput,
  targetPath = DEFAULT_TARGET_PATH,
  now = new Date(),
}) {
  if (typeof metadataDirectoryInput !== "string" || metadataDirectoryInput.length === 0) {
    throw new TufMetadataProfileError("metadataDirectory is required");
  }
  const metadataDirectory = resolve(metadataDirectoryInput);
  const metadataRoot = await realpath(metadataDirectory).catch((error) => {
    throw new TufMetadataProfileError("TUF metadata directory is missing", { cause: error });
  });
  const rootResult = await readMetadata(metadataRoot, "root.json", MetadataKind.Root);
  const targetsResult = await readMetadata(metadataRoot, "targets.json", MetadataKind.Targets);
  const snapshotResult = await readMetadata(metadataRoot, "snapshot.json", MetadataKind.Snapshot);
  const timestampResult = await readMetadata(metadataRoot, "timestamp.json", MetadataKind.Timestamp);
  const root = rootResult.metadata;
  const targets = targetsResult.metadata;
  const snapshot = snapshotResult.metadata;
  const timestamp = timestampResult.metadata;
  const referenceTime = new Date(now);
  if (!Number.isFinite(referenceTime.getTime())) throw new TufMetadataProfileError("reference time is invalid");

  for (const [roleName, metadata] of Object.entries({ root, targets, snapshot, timestamp })) {
    if (metadata.signed.specVersion !== TUF_PROFILE_VERSION) {
      throw new TufMetadataProfileError(`${roleName} metadata uses an unsupported TUF profile`);
    }
    requireValidity(metadata, roleName, referenceTime);
  }
  if (root.signed.consistentSnapshot !== true) {
    throw new TufMetadataProfileError("TUF consistent_snapshot must be enabled");
  }

  const rootRoles = root.signed.roles;
  const rootRole = requireRole(rootRoles.root, "root", root.signed.keys, 3, 2);
  const targetsRole = requireRole(rootRoles.targets, "targets", root.signed.keys, 3, 2);
  const snapshotRole = requireRole(rootRoles.snapshot, "snapshot", root.signed.keys, 1, 1);
  const timestampRole = requireRole(rootRoles.timestamp, "timestamp", root.signed.keys, 1, 1);
  const topLevelRoles = { root: rootRole, targets: targetsRole, snapshot: snapshotRole, timestamp: timestampRole };
  requireDistinctRoleKeys(topLevelRoles);

  const delegations = targets.signed.delegations;
  const modulesRole = delegations?.roles?.modules;
  if (!modulesRole) throw new TufMetadataProfileError("modules delegated targets role is missing");
  const modules = requireRole(modulesRole, "modules", delegations.keys, 3, 2);
  if (!Array.isArray(modulesRole.paths) || modulesRole.paths.length !== 1 || modulesRole.paths[0] !== "modules/*") {
    throw new TufMetadataProfileError("modules delegation is not path-scoped to modules/*");
  }
  requireDistinctRoleKeys({ ...topLevelRoles, modules });

  try {
    root.verifyDelegate("root", root);
    root.verifyDelegate("targets", targets);
    root.verifyDelegate("snapshot", snapshot);
    root.verifyDelegate("timestamp", timestamp);
  } catch (error) {
    throw new TufMetadataProfileError("TUF metadata signature threshold verification failed", { cause: error });
  }
  requireMetaFile(snapshot.signed.meta["targets.json"], targets, "targets.json", targetsResult.bytes);
  requireMetaFile(timestamp.signed.snapshotMeta, snapshot, "snapshot.json", snapshotResult.bytes);

  const target = targets.signed.targets[targetPath];
  if (!target) throw new TufMetadataProfileError(`TUF target ${targetPath} is missing`);
  const custom = requireTargetCustom(target, targetPath);
  return {
    profile: TUF_PROFILE_VERSION,
    productionProfileShape: "PASS",
    keyCustodyEvidence: "EXTERNAL_REQUIRED",
    roles: {
      root: rootRole,
      targets: targetsRole,
      snapshot: snapshotRole,
      timestamp: timestampRole,
      modules,
    },
    target: {
      path: targetPath,
      length: target.length,
      sha256: requireSha256(target.hashes?.sha256, `${targetPath} hash`),
      releaseId: custom.releaseId,
      sourceCommitSha: custom.sourceCommitSha,
      releaseSequence: custom.releaseSequence,
      securityEpoch: custom.securityEpoch,
    },
  };
}

function parseArguments(argv) {
  const values = new Map();
  const allowed = new Set(["--metadata-dir", "--target"]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new TufMetadataProfileError(`unexpected argument: ${argument}`);
    const [key, inlineValue] = argument.split("=", 2);
    if (!allowed.has(key)) throw new TufMetadataProfileError(`unknown argument: ${key}`);
    const value = inlineValue ?? argv[++index];
    if (!value || value.startsWith("--")) throw new TufMetadataProfileError(`missing value for ${key}`);
    values.set(key, value);
  }
  if (!values.has("--metadata-dir")) throw new TufMetadataProfileError("--metadata-dir is required");
  return { metadataDirectory: values.get("--metadata-dir"), targetPath: values.get("--target") ?? DEFAULT_TARGET_PATH };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await verifyTufMetadataProfile(parseArguments(process.argv.slice(2)));
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(`[tuf-profile] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
