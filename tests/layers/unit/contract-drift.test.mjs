import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const required = [
  "tools/contract/lib.mjs",
  "tools/contract/manifest.mjs",
  "tools/contract/generate-contract-artifacts.mjs",
  "tools/contract/check-manifest.mjs",
  "tools/contract/check-drift.mjs",
  "generated/contract/jarvis-v1.0.8.contract-values.generated.json",
];

test("0.12 contract reproducibility artifacts exist", () => {
  for (const path of required) {
    assert.ok(existsSync(resolve(root, path)), `missing required 0.12 artifact: ${path}`);
  }
});

test("0.12 package and CI gates are wired", () => {
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  for (const name of ["contract:generate", "contract:check-generated", "contract:check-manifest", "contract:check-drift", "contract:check"]) {
    assert.equal(typeof pkg.scripts?.[name], "string", `missing script ${name}`);
  }
  const tsconfig = JSON.parse(readFileSync(resolve(root, "tsconfig.json"), "utf8"));
  assert.ok(tsconfig.include?.includes("generated/**/*.ts"), "generated TypeScript must be part of strict typecheck/build");
  const workflow = readFileSync(resolve(root, ".github/workflows/static-ci.yml"), "utf8");
  assert.match(workflow, /pnpm contract:check-generated/);
  assert.match(workflow, /pnpm contract:check-manifest/);
  assert.match(workflow, /pnpm contract:check-drift/);
});

import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { checkContractDriftFromTexts } from "../../../tools/contract/check-drift.mjs";
import { checkGeneratedArtifacts, writeGeneratedArtifacts } from "../../../tools/contract/generate-contract-artifacts.mjs";
import { hasForbiddenDecisionRecordReference, validateContractManifest, validateTrackedDecisionRecordPaths } from "../../../tools/contract/manifest.mjs";

test("tracked ADR/decision/history paths are rejected globally, including nested case variants", () => {
  const violations = validateTrackedDecisionRecordPaths([
    "docs/architecture/ADR-099.md",
    "docs/Architecture/Decisions/note.md",
    "docs/HISTORY/previous.md",
  ]);
  const codes = violations.map(({ code }) => code);
  assert.ok(codes.includes("MANIFEST_DECISION_RECORD_PATH"));
  assert.ok(codes.includes("MANIFEST_DECISION_RECORD_FILENAME"));
});

test("tracked content cannot cite deleted ADR, decision, or history source paths", () => {
  assert.equal(hasForbiddenDecisionRecordReference("See ADR-099"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See ADR_099"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See adr-099"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See docs/architecture/ADR-099.md"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See docs/adr/ADR-099.md"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See docs/DECISIONS/legacy.md"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See docs/history/legacy.md"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See archive/renamed-decision-record.md"), true);
  assert.equal(hasForbiddenDecisionRecordReference("ADR/decision-record material is prohibited by policy."), false);
});

const canonical = JSON.parse(readFileSync(resolve(root, "packages/schemas/src/canonical/v1/jarvis-v1.0.8.contract-values.json"), "utf8"));

function union(name, values) {
  return `type ${name} =\n${values.map((value) => `  | '${value}'`).join("\n")};\n`;
}

function humanFixture(values = canonical) {
  const githubMandatory = values.githubCapabilities.mandatory.join("\n");
  const proxmoxMandatory = values.proxmoxCapabilities.mandatory.join("\n");
  const proxmoxOptional = values.proxmoxCapabilities.optional.join("\n");
  const fixture = {
    manifest: `# Manifest\n**Suite Version:** ${values.contractSuiteVersion}\n`,
    releaseProfile: `# Profile\n**Profile Version:** ${values.releaseProfileVersion}\nInitial production target:\n\n\`\`\`text\nPlatformFamily: ${values.v1RuntimeTarget.platform}\nRuntimeRole:    ${values.v1RuntimeTarget.runtimeRole}\nOperating system: ${values.v1RuntimeTarget.operatingSystem}\nMinimum normal release baseline: ${values.v1RuntimeTarget.minimumReleaseBaseline}\nCPU architecture: x86-64 (${values.v1RuntimeTarget.architecture})\n\`\`\`\n## 9.1 GitHub V1 capability matrix\nThe following capability families are mandatory for V1 Production Complete:\n\n\`\`\`text\n${githubMandatory}\n\`\`\`\n${values.githubCapabilities.optional[0]} MAY be supported and qualified but does not block V1 Production Complete.\n## 9.2 Proxmox VE V1 capability matrix\nThe following capabilities are mandatory for V1 Production Complete:\n\n\`\`\`text\n${proxmoxMandatory}\n\`\`\`\nThe following remain modeled but do not block V1 Production Complete:\n\n\`\`\`text\n${proxmoxOptional}\n\`\`\`\n# RP-17 — REPOSITORY GOVERNANCE GATE\nThe mandatory ${values.ciAuthorities.pipelineIdentity} pipeline requires GITHUB_ACTIONS. GitLab is repository mirror-only. LocalCI may run compatibility tooling but cannot satisfy this gate. The selected qualified ${values.ciAuthorities.selectedType} authority is active.\n# RP-18 — PRODUCTION-COMPLETE GATE\n---\n`,
    portability: `Canonical runtime roles are:\n\n\`\`\`text\n${values.runtimeRoles.join("\n")}\n\`\`\`\n`,
    protocol: `**Protocol Major:** ${values.protocolMajor}\n${union("PlatformFamily", values.platformFamilies)}${union("RuntimeRole", values.runtimeRoles)}\ninterface Argon2idProfile { algorithm: 'ARGON2ID'; version: 0x13; parallelism: 4; }\n\`\`\`text\nmemoryKiB  >= ${values.kdf.sessionAndPortableRecoveryFloor.memoryKiB}\niterations >= ${values.kdf.sessionAndPortableRecoveryFloor.iterations}\nparallelism = ${values.kdf.sessionAndPortableRecoveryFloor.parallelism}\nsaltBytes  >= ${values.kdf.sessionAndPortableRecoveryFloor.saltBytes}\noutputBytes >= ${values.kdf.sessionAndPortableRecoveryFloor.outputBytes}\n\`\`\`\n${union("ProviderSetupState", values.providerSetupStates)}${union("ModuleExecutionClass", values.moduleExecutionClasses)}${union("GitHubCapability", [...values.githubCapabilities.mandatory, ...values.githubCapabilities.optional])}${union("ProxmoxCapability", [...values.proxmoxCapabilities.mandatory, ...values.proxmoxCapabilities.optional])}\nConfiguration domains are typed/versioned and include at least startup, session security, voice, providers, privacy, permissions, budgets, projects, modules, integrations, notifications, retention, updates, platform backend profile, and developer mode. Normal configuration never accepts raw secrets.\n---\ninterface CanonicalActionDescriptorV1 { domain: '${values.approvalCanonicalization.actionDescriptorDomain}'; descriptorVersion: ${values.approvalCanonicalization.descriptorVersion}; }\ninterface ApprovalRequest { actionDigestAlgorithm: 'SHA-256'; actionDigestEncoding: '${values.approvalCanonicalization.digestEncoding}'; }\nRFC 8785 JCS canonical JSON\n→ SHA-256\n→ base64url without padding\n`,
    backup: `The first production format is:\n\n\`\`\`text\nformatId: ${values.backup.formatId}\nformatVersion: ${values.backup.formatVersion}\nouterAead: ${values.backup.outerAead}\nchunkSizeBytes: ${values.backup.chunkSizeBytes}\nmaxPlaintextBytes: ${values.backup.maxPlaintextBytes}\nchunkTagBytes: ${values.backup.chunkTagBytes}\nchunkNonceBytes: ${values.backup.chunkNonceBytes}\nhash: ${values.backup.hash}\ncanonicalMetadata: ${values.backup.canonicalMetadata}\n\`\`\`\nfresh SnapshotDBKey (${values.backup.snapshotDbKeyBits} random bits per backup)\nfresh BackupDEK (${values.backup.backupDekBits} random bits per backup)\nprotectionClass: 'LOCAL_RECOVERY' | 'PORTABLE_STATE';\nV1 SHALL allow at most ${values.backup.maxKeySlots} key slots and a total unencrypted descriptor/key-slot metadata area of ${values.backup.maxUnencryptedMetadataBytes / 1024} KiB.\nnoncePrefix: base64url-no-pad, exactly ${values.backup.noncePrefixBytes} random bytes\nEvery production PORTABLE_STATE backup SHALL contain at least one '${values.backup.mandatoryPortableSlot}' key slot backed by a JARVIS-generated ${values.backup.generatedRecoverySecretBits}-bit recovery secret.\n${values.backup.generatedRecoveryPrefix}<base64url-no-pad of exactly ${values.backup.generatedRecoverySecretBits / 8} random bytes>\nA ${values.backup.optionalPortableSlot} slot MAY be added.\ngenerate a fresh random ${values.backup.wrapNonceBytes * 8}-bit AES-GCM wrap nonce\naccept at least ${values.backup.portableBackupPassphraseAcceptedCodePointsAtLeast} Unicode code points;\nrequire at least ${values.backup.portableBackupPassphraseMinimumCodePoints} Unicode code points\nuse a fresh random salt of at least ${values.kdf.portableBackupPassphraseFloor.saltBytes} bytes per slot.\n\`\`\`text\nmemoryKiB  >= ${values.kdf.portableBackupPassphraseFloor.memoryKiB}\niterations >= ${values.kdf.portableBackupPassphraseFloor.iterations}\nparallelism = ${values.kdf.portableBackupPassphraseFloor.parallelism}\noutputBytes >= ${values.kdf.portableBackupPassphraseFloor.outputBytes}\n\`\`\`\n`,
    supplyChain: `The initial production trust-metadata profile SHALL implement TUF specification **${values.supplyChain.tufSpecVersion}** semantics.\n\`consistent_snapshot\` SHALL be enabled.\n\`\`\`text\nkeytype: ${values.supplyChain.keyType}\nscheme:  ${values.supplyChain.scheme}\n\`\`\`\nroot:      ${values.supplyChain.roles.root.threshold}-of-${values.supplyChain.roles.root.keyCount}, offline\ntargets:   ${values.supplyChain.roles.targets.threshold}-of-${values.supplyChain.roles.targets.keyCount}, offline/release-signing only\nsnapshot:  ${values.supplyChain.roles.snapshot.minimumThreshold}-of-${values.supplyChain.roles.snapshot.minimumKeyCount} or stronger, offline/release-signing only\ntimestamp: ${values.supplyChain.roles.timestamp.minimumThreshold}-of-${values.supplyChain.roles.timestamp.minimumKeyCount} or stronger, online automation permitted\nmodules delegated targets role: ${values.supplyChain.roles.modules.threshold}-of-${values.supplyChain.roles.modules.keyCount}, offline/release-signing only\ntimestamp: <= ${values.supplyChain.maximumValidityDays.timestamp} days\nsnapshot:  <= ${values.supplyChain.maximumValidityDays.snapshot} days\ntargets:   <= ${values.supplyChain.maximumValidityDays.targets} days\nroot:      <= ${values.supplyChain.maximumValidityDays.root} days\n`,
  };
  fixture.protocol += "\n## J01-RT-26A\ntts.started tts.audio_chunk tts.completed tts.stopped tts.error exact speaker/TTS render reference double-talk handling noise suppression gain control sample rates Provider Supervisor safe half-duplex fallback\n## J01-RT-27\n";
  return fixture;
}

test("clean human-readable contract fixture matches canonical values", () => {
  assert.deepEqual(checkContractDriftFromTexts(canonical, humanFixture()), []);
});

test("clean CRLF human-readable contract fixture matches canonical values", () => {
  const crlf = Object.fromEntries(Object.entries(humanFixture()).map(([key, value]) => [key, value.replaceAll("\n", "\r\n")]));
  assert.deepEqual(checkContractDriftFromTexts(canonical, crlf), []);
});

for (const [name, mutate, expectedCode] of [
  ["runtime target", (docs) => { docs.releaseProfile = docs.releaseProfile.replace("x64)", "ARM64)"); }, "DRIFT_V1_RUNTIME_TARGET"],
  ["GitHub capability", (docs) => { docs.releaseProfile = docs.releaseProfile.replace("GITHUB_CHECKS_READ\n", ""); }, "DRIFT_GITHUB_MANDATORY_CAPABILITIES"],
  ["KDF floor", (docs) => { docs.protocol = docs.protocol.replace("memoryKiB  >= 65536", "memoryKiB  >= 32768"); }, "DRIFT_KDF_SESSION_FLOOR"],
  ["backup format", (docs) => { docs.backup = docs.backup.replace("chunkSizeBytes: 4194304", "chunkSizeBytes: 1"); }, "DRIFT_BACKUP_FORMAT"],
  ["TUF profile", (docs) => { docs.supplyChain = docs.supplyChain.replace("1.0.35", "1.0.34"); }, "DRIFT_TUF_SPEC"],
  ["approval digest", (docs) => { docs.protocol = docs.protocol.replaceAll("SHA-256", "SHA-1"); }, "DRIFT_APPROVAL_CANONICALIZATION"],
  ["configuration domain", (docs) => { docs.protocol = docs.protocol.replace(", retention", ""); }, "DRIFT_CONFIGURATION_DOMAINS"],
  ["provider setup", (docs) => { docs.protocol = docs.protocol.replace("  | 'REPAIR_REQUIRED'\n", ""); }, "DRIFT_PROVIDER_SETUP_STATES"],
  ["module class", (docs) => { docs.protocol = docs.protocol.replace("EXTERNAL_MANAGED", "EXTERNAL_REMOVED"); }, "DRIFT_MODULE_EXECUTION_CLASSES"],
  ["CI authority", (docs) => { docs.releaseProfile = docs.releaseProfile.replaceAll("GITHUB_ACTIONS", "REMOVED_CI"); }, "DRIFT_CI_AUTHORITY_TYPES"],
  ["TTS/AEC contract", (docs) => { docs.protocol = docs.protocol.replace("double-talk handling", "removed capability"); }, "DRIFT_TTS_AEC_CONTRACT"],
]) {
  test(`human-readable ${name} drift is rejected`, () => {
    const docs = humanFixture();
    mutate(docs);
    const found = checkContractDriftFromTexts(canonical, docs).map((item) => item.code);
    assert.ok(found.includes(expectedCode), `expected ${expectedCode}; got ${found.join(", ")}`);
  });
}

const componentPaths = [
  ["scopeGovernanceCoding", "docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md", "Contract Suite Version"],
  ["runtimePlatformProtocol", "docs/implementation/JARVIS-01-RUNTIME-PLATFORM-PROTOCOL-CONTRACT.md", "Contract Suite Version"],
  ["dataStateBackup", "docs/implementation/JARVIS-02-DATA-STATE-BACKUP-CONTRACT.md", "Contract Suite Version"],
  ["securityTrust", "docs/implementation/JARVIS-03-SECURITY-TRUST-CONTRACT.md", "Contract Suite Version"],
  ["operationsIntegrationsUx", "docs/implementation/JARVIS-04-OPERATIONS-INTEGRATIONS-UX-CONTRACT.md", "Contract Suite Version"],
  ["verificationRelease", "docs/implementation/JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md", "Contract Suite Version"],
  ["releaseProfile", "docs/JARVIS-V1-RELEASE-PROFILE.md", "Profile Version"],
];

async function manifestFixture() {
  const dir = await mkdtemp(resolve(tmpdir(), "jarvis-manifest-"));
  await mkdir(resolve(dir, "packages/schemas/src/canonical/v1"), { recursive: true });
  await writeFile(resolve(dir, "packages/schemas/src/canonical/v1/jarvis-v1.0.8.contract-values.json"), `${JSON.stringify(canonical)}\n`);
  const rows = [];
  let index = 1;
  for (const [key, path, label] of componentPaths) {
    await mkdir(dirname(resolve(dir, path)), { recursive: true });
    await writeFile(resolve(dir, path), `# Component\n**${label}:** ${canonical.contractComponentRevisions[key]}\n\n**END — COMPONENT v${canonical.contractComponentRevisions[key]}**\n`);
    rows.push(`| ${index} | \`${path}\` | \`${key}\` | ${canonical.contractComponentRevisions[key]} | role |`);
    index += 1;
  }
  const manifest = `# Manifest\n**Suite Version:** ${canonical.contractSuiteVersion}\n\n| # | Document | Component | Current component revision | Role |\n|---|---|---|---:|---|\n${rows.join("\n")}\n`;
  await writeFile(resolve(dir, "docs/JARVIS-CONTRACT-MANIFEST-v1.0.8.md"), manifest);
  execFileSync("git", ["init", "--quiet"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["add", "."], { cwd: dir, stdio: "ignore" });
  return dir;
}

test("manifest validator proves all canonical components, files, rows, and internal revisions", async () => {
  const dir = await manifestFixture();
  const result = await validateContractManifest(dir);
  assert.equal(result.components.length, 7);
  assert.deepEqual(result.violations, []);
});

test("manifest validation scans only tracked repository content end to end", async () => {
  const dir = await manifestFixture();
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "test@example.invalid"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "Manifest Test"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["add", "."], { cwd: dir, stdio: "ignore" });

    const forbiddenPath = resolve(dir, "docs/architecture/ADR-099.md");
    await mkdir(dirname(forbiddenPath), { recursive: true });
    await writeFile(forbiddenPath, "forbidden tracked decision material\n");
    execFileSync("git", ["add", "docs/architecture/ADR-099.md"], { cwd: dir, stdio: "ignore" });
    assert.match(execFileSync("git", ["ls-files"], { cwd: dir, encoding: "utf8" }), /docs\/architecture\/ADR-099\.md/);
    let result = await validateContractManifest(dir);
    assert.ok(result.violations.some(({ code }) => code === "MANIFEST_DECISION_RECORD_FILENAME"));

    await rm(forbiddenPath);
    const cleanReference = resolve(dir, "docs/architecture/notes.md");
    await writeFile(cleanReference, "See ADR_099 for the historical decision.\n");
    execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore" });
    result = await validateContractManifest(dir);
    assert.ok(result.violations.some(({ code }) => code === "MANIFEST_DECISION_RECORD_REFERENCE"));

    await writeFile(cleanReference, "This clean tracked note has no historical source reference.\n");
    execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore" });
    result = await validateContractManifest(dir);
    assert.deepEqual(result.violations, []);

    const untrackedForbiddenPath = resolve(dir, "docs/architecture/ADR-100.md");
    await writeFile(untrackedForbiddenPath, "untracked forbidden material\n");
    result = await validateContractManifest(dir);
    assert.deepEqual(result.violations, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("manifest revision/header drift is rejected", async () => {
  const dir = await manifestFixture();
  const manifestPath = resolve(dir, "docs/JARVIS-CONTRACT-MANIFEST-v1.0.8.md");
  const text = await readFile(manifestPath, "utf8");
  await writeFile(manifestPath, text.replace("| 1 | `docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md` | `scopeGovernanceCoding` | 1.0.8 |", "| 1 | `docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md` | `scopeGovernanceCoding` | 9.9.9 |"));
  const result = await validateContractManifest(dir);
  assert.ok(result.violations.some((item) => item.code === "MANIFEST_COMPONENT_REVISION_DRIFT"));
});

test("manifest component footer drift is rejected", async () => {
  const dir = await manifestFixture();
  const componentPath = resolve(dir, "docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md");
  const text = await readFile(componentPath, "utf8");
  await writeFile(componentPath, text.replace("END — COMPONENT v1.0.8", "END — COMPONENT v1.0.6"));
  const result = await validateContractManifest(dir);
  assert.ok(result.violations.some((item) => item.code === "MANIFEST_COMPONENT_FOOTER_DRIFT"));
});

test("active matrix reference suite, paths, and non-status role are enforced", async () => {
  const dir = await manifestFixture();
  const referencePath = resolve(dir, "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX-REFERENCE.md");
  await mkdir(dirname(referencePath), { recursive: true });
  await writeFile(referencePath, "**Contract suite:** JARVIS v1.0.6\n`docs/JARVIS-CONTRACT-MANIFEST-v1.0.6.md`\n`docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md`\n`docs/implementation/JARVIS-01-RUNTIME-PLATFORM-PROTOCOL-CONTRACT.md`\n`docs/implementation/JARVIS-02-DATA-STATE-BACKUP-CONTRACT.md`\n`docs/implementation/JARVIS-03-SECURITY-TRUST-CONTRACT.md`\n`docs/implementation/JARVIS-04-OPERATIONS-INTEGRATIONS-UX-CONTRACT.md`\n`docs/implementation/JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md`\n");
  const result = await validateContractManifest(dir);
  const codes = result.violations.map((item) => item.code);
  assert.ok(codes.includes("MANIFEST_REFERENCE_SUITE_DRIFT"));
  assert.ok(codes.includes("MANIFEST_REFERENCE_PATH_DRIFT"));
  assert.ok(codes.includes("MANIFEST_REFERENCE_ROLE_DRIFT"));
});

test("generated artifacts are deterministic and stale bytes fail closed", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "jarvis-generated-"));
  await mkdir(resolve(dir, "packages/schemas/src/canonical/v1"), { recursive: true });
  await writeFile(resolve(dir, "packages/schemas/src/canonical/v1/jarvis-v1.0.8.contract-values.json"), `${JSON.stringify(canonical)}\n`);
  const first = await writeGeneratedArtifacts(dir);
  const second = await writeGeneratedArtifacts(dir);
  assert.equal(first.json, second.json);
  assert.equal(first.ts, second.ts);
  assert.deepEqual((await checkGeneratedArtifacts(dir)).stale, []);
  const generated = resolve(dir, "generated/contract/jarvis-v1.0.8.contract-values.generated.json");
  await writeFile(generated, `${await readFile(generated, "utf8")} `);
  assert.deepEqual((await checkGeneratedArtifacts(dir)).stale.map((item) => item.reason), ["STALE"]);
});
