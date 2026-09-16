import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  assert.match(workflow, /- name: Contract suite validation\s+run: pnpm contract:check/);
  assert.doesNotMatch(workflow, /run: pnpm contract:check-generated/);
  assert.doesNotMatch(workflow, /run: pnpm contract:check-manifest/);
  assert.doesNotMatch(workflow, /run: pnpm contract:check-drift/);
});

import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { checkContractDriftFromTexts } from "../../../tools/contract/check-drift.mjs";
import { checkGeneratedArtifacts, writeGeneratedArtifacts } from "../../../tools/contract/generate-contract-artifacts.mjs";
import { hasForbiddenDecisionRecordReference, validateContractManifest, validateMatrixTraceabilityTexts, validateTrackedDecisionRecordPaths } from "../../../tools/contract/manifest.mjs";

test("tracked ADR/decision/history paths are rejected globally, including nested case variants", () => {
  const prohibitedFilenamePaths = [
    "archive/ADR.md",
    "archive/ADR-example.md",
    "archive/ADR-099.md",
    "archive/ADR_099",
    "archive/ADR099",
    "archive/ADR 099",
    "archive/ADR.099",
    "docs/architecture/ADR-099.md",
    "docs\\architecture\\ADR-099.md",
    "docs\\architecture\\ADR.md",
    "notes/renamed-decision-record.md",
    "archive\\decision-record.md",
  ];
  const prohibitedDirectoryPaths = [
    "docs/Architecture/Decisions/note.md",
    "docs/HISTORY/previous.md",
    "docs\\history\\previous.md",
  ];
  const violations = validateTrackedDecisionRecordPaths([
    ...prohibitedFilenamePaths,
    ...prohibitedDirectoryPaths,
  ]);
  const codes = violations.map(({ code }) => code);
  assert.ok(codes.includes("MANIFEST_DECISION_RECORD_PATH"));
  const filenameViolations = violations.filter(({ code }) => code === "MANIFEST_DECISION_RECORD_FILENAME");
  assert.equal(filenameViolations.length, prohibitedFilenamePaths.length);
  for (const path of prohibitedFilenamePaths) {
    assert.ok(filenameViolations.some((item) => item.path === path), "expected filename rejection for " + path);
  }
  for (const path of prohibitedDirectoryPaths) {
    assert.ok(violations.some((item) => item.code === "MANIFEST_DECISION_RECORD_PATH" && item.path === path), "expected directory rejection for " + path);
  }
});

test("tracked content cannot cite deleted ADR, decision, or history source paths", () => {
  assert.equal(hasForbiddenDecisionRecordReference("See ADR.md"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See ADR-example.md"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See ADR-099"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See ADR-099.md"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See ADR_099"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See ADR099"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See ADR 099"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See ADR.099"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See adr-099"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See docs/architecture/ADR-099.md"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See docs\\architecture\\ADR-099.md"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See docs\\architecture\\ADR.md"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See docs/adr/ADR-099.md"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See docs/DECISIONS/legacy.md"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See docs/history/legacy.md"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See archive/renamed-decision-record.md"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See archive/renamed-DecisionRecord.md"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See archive\\decision-record.md"), true);
  assert.equal(hasForbiddenDecisionRecordReference("See archive\\renamed-DecisionRecord.md"), true);
  assert.equal(hasForbiddenDecisionRecordReference("ADRs are prohibited by policy; ADR/decision-record material is prohibited by policy."), false);
});

test("the non-authoritative owner goals preserve the prohibited ADR rule", async () => {
  const goalPaths = [
    "docs/implementation/JARVIS-DEVELOPER-EXECUTION-GOAL.md",
    "docs/implementation/JARVIS-CONTRACT-SIMPLIFICATION-REMEDIATION-GOAL.md",
  ];
  for (const path of goalPaths) {
    const goal = readFileSync(resolve(root, path), "utf8");
    assert.match(goal, /ADRs.*prohibited/i);
    assert.equal(hasForbiddenDecisionRecordReference(goal), false);
  }
  const result = await validateContractManifest(root);
  for (const path of goalPaths) {
    assert.equal(result.violations.some(({ code, path: violationPath }) => code === "MANIFEST_DECISION_RECORD_REFERENCE" && violationPath === path), false);
  }
  assert.equal(result.violations.some(({ code }) => code === "MANIFEST_ADR_AUTHORITY_REFERENCE"), false);
});

test("the non-authoritative consolidation findings aid may inventory retired paths without weakening tracked-source rejection", async () => {
  const findings = readFileSync(resolve(root, "docs/implementation/JARVIS-CONTRACT-CONSOLIDATION-AUDIT-FINDINGS.md"), "utf8");
  assert.match(findings, /docs\/decisions\//);
  assert.match(findings, /non-normative audit aid/i);
  assert.equal(hasForbiddenDecisionRecordReference(findings), true);
  const result = await validateContractManifest(root);
  assert.equal(result.violations.some(({ code, path }) => code === "MANIFEST_DECISION_RECORD_REFERENCE" && path === "docs/implementation/JARVIS-CONTRACT-CONSOLIDATION-AUDIT-FINDINGS.md"), false);
  const temporary = await manifestFixture();
  try {
    const findingsPath = "docs/implementation/JARVIS-CONTRACT-CONSOLIDATION-AUDIT-FINDINGS.md";
    await writeFile(resolve(temporary, findingsPath), findings);
    execFileSync("git", ["add", findingsPath], { cwd: temporary });
    const fixtureResult = await validateContractManifest(temporary);
    assert.equal(fixtureResult.violations.some(({ code, path }) => code === "MANIFEST_DECISION_RECORD_REFERENCE" && path === findingsPath), false);

    const trackedPath = "docs/implementation/unrelated-audit-note.md";
    await writeFile(resolve(temporary, trackedPath), "See docs/decisions/retired.md\n");
    execFileSync("git", ["add", trackedPath], { cwd: temporary });
    const rejectedResult = await validateContractManifest(temporary);
    assert.ok(rejectedResult.violations.some(({ code, path }) => code === "MANIFEST_DECISION_RECORD_REFERENCE" && path === trackedPath));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("provider state vocabulary has one J01 protocol owner", () => {
  const runtime = readFileSync(resolve(root, "docs/implementation/JARVIS-01-RUNTIME-PLATFORM-PROTOCOL-CONTRACT.md"), "utf8");
  const data = readFileSync(resolve(root, "docs/implementation/JARVIS-02-DATA-STATE-BACKUP-CONTRACT.md"), "utf8");
  const runtimeSection = runtime.slice(runtime.indexOf("## J01-RT-14"), runtime.indexOf("## J01-RT-15"));
  const protocolSection = runtime.slice(runtime.indexOf("## J01-PROTO-19"), runtime.indexOf("## J01-PROTO-20"));
  const persistenceSection = data.slice(data.indexOf("## J02-DATA-22"), data.indexOf("## J02-DATA-23"));
  assert.match(runtimeSection, /J01-PROTO-19 is the sole canonical definition of `ProviderSetupState`, `ProviderCompatibilityState`, and `ProviderHealth`/);
  assert.doesNotMatch(runtimeSection, /NOT_REQUIRED\s*\/\s*SETUP_REQUIRED/);
  assert.match(protocolSection, /type ProviderSetupState/);
  assert.match(protocolSection, /type ProviderCompatibilityState/);
  assert.match(protocolSection, /type ProviderHealth/);
  assert.match(persistenceSection, /J01-PROTO-19` is the sole canonical definition/);
  assert.doesNotMatch(persistenceSection, /NOT_REQUIRED\s*\r?\nSETUP_REQUIRED/);
});

test("canonical protocol vocabularies are referenced rather than relisted by persistence and operations", () => {
  const data = readFileSync(resolve(root, "docs/implementation/JARVIS-02-DATA-STATE-BACKUP-CONTRACT.md"), "utf8");
  const security = readFileSync(resolve(root, "docs/implementation/JARVIS-03-SECURITY-TRUST-CONTRACT.md"), "utf8");
  const operations = readFileSync(resolve(root, "docs/implementation/JARVIS-04-OPERATIONS-INTEGRATIONS-UX-CONTRACT.md"), "utf8");
  for (const [start, end, owner, forbidden] of [
    ["## J02-DATA-09", "## J02-DATA-10", "J01-PROTO-13", /CREATED\s*\r?\nPLANNING/],
    ["## J02-DATA-10", "## J02-DATA-11", "J01-PROTO-13", /WAITING_FOR_DEPENDENCY\s*\r?\nQUEUED/],
    ["## J02-DATA-11", "## J02-DATA-12", "J01-PROTO-13", /CHECKPOINTING\s*\r?\nWAITING_FOR_APPROVAL/],
    ["## J02-DATA-12", "## J02-DATA-13", "J01-PROTO-11", /PROJECT_WORKSPACE\s*\r?\nINTEGRATION/],
    ["## J02-DATA-14", "## J02-DATA-15", "J01-PROTO-18", /PENDING\s*\r?\nAPPROVED/],
    ["## J02-DATA-24", "## J02-DATA-25", "J01-PROTO-22", /RESERVED\s*\r?\nSETTLED/],
  ]) {
    const section = data.slice(data.indexOf(start), data.indexOf(end));
    assert.match(section, new RegExp(owner));
    assert.doesNotMatch(section, forbidden);
  }
  const notificationSection = operations.slice(operations.indexOf("## J04-OPS-10"), operations.indexOf("## J04-OPS-11"));
  assert.match(notificationSection, /J01-PROTO-24/);
  assert.doesNotMatch(notificationSection, /CRITICAL\s*\r?\nIMPORTANT\s*\r?\nNORMAL\s*\r?\nLOW_VALUE/);
  const modulePersistence = data.slice(data.indexOf("## J02-DATA-25"), data.indexOf("## J02-DATA-26"));
  const moduleOperations = operations.slice(operations.indexOf("## J04-OPS-15"), operations.indexOf("## J04-OPS-16"));
  assert.match(modulePersistence, /canonically defined by J04-OPS-15/);
  assert.match(moduleOperations, /sole canonical owner/);
  const moneyPersistence = data.slice(data.indexOf("## J02-DATA-04"), data.indexOf("## J02-DATA-05"));
  assert.match(moneyPersistence, /sole canonical `MoneyAmount` definition in J01-PROTO-05/);
  assert.doesNotMatch(moneyPersistence, /interface MoneyAmount/);
  const quotaPersistence = data.slice(data.indexOf("## J02-DATA-23"), data.indexOf("## J02-DATA-24"));
  assert.match(quotaPersistence, /canonical `ProviderQuotaSource` provenance defined by J01-PROTO-22/);
  assert.doesNotMatch(quotaPersistence, /PROVIDER_REPORTED\s*\r?\nJARVIS_CALCULATED/);
  const dataPolicySecurity = security.slice(security.indexOf("## J03-SEC-08"), security.indexOf("## J03-SEC-09"));
  assert.match(dataPolicySecurity, /J01-PROTO-04 is the sole canonical definition/);
  assert.doesNotMatch(dataPolicySecurity, /DataSensitivity:\s+PUBLIC/);
  const riskSecurity = security.slice(security.indexOf("## J03-SEC-14"), security.indexOf("## J03-SEC-15"));
  assert.match(riskSecurity, /J01-PROTO-16 is the sole canonical definition of `RiskClass`/);
  const approvalSecurity = security.slice(security.indexOf("## J03-SEC-17"), security.indexOf("## J03-SEC-18"));
  assert.match(approvalSecurity, /sole canonical approval digest pipeline and rejection rules are defined by J01-PROTO-18\/J01-PROTO-25/);
  assert.doesNotMatch(approvalSecurity, /schema validation\s*\r?\n→ RFC 8785 JCS/);
});

test("repository governance retains one normative ordered local preflight owner", () => {
  const scope = readFileSync(resolve(root, "docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md"), "utf8");
  const releaseProfile = readFileSync(resolve(root, "docs/JARVIS-V1-RELEASE-PROFILE.md"), "utf8");
  const governance = scope.slice(scope.indexOf("## J00-GOV-28"), scope.indexOf("## J00-GOV-29"));
  const profileGate = releaseProfile.slice(releaseProfile.indexOf("# RP-17"), releaseProfile.indexOf("# RP-18"));
  assert.match(governance, /Before any authorized candidate publication/);
  assert.match(governance, /relevant targeted checks; the normal local test profile; then applicable contract, schema\/generated-output, governance, security, provenance, architecture, format, strict-type, build, and platform checks/);
  assert.match(governance, /supplementary evidence only, cannot qualify CI or a release, and cannot replace exact-candidate GitHub Actions verification/);
  assert.match(profileGate, /J00-GOV-28 owns the ordered local pre-publication preflight/);
});

test("backup and SQLite owners retain explicit qualification and key-separation safeguards", () => {
  const data = readFileSync(resolve(root, "docs/implementation/JARVIS-02-DATA-STATE-BACKUP-CONTRACT.md"), "utf8");
  const database = data.slice(data.indexOf("## J02-DATA-02"), data.indexOf("## J02-DATA-03"));
  const hierarchy = data.slice(data.indexOf("## J02-BACKUP-03"), data.indexOf("## J02-BACKUP-04"));
  const localRecovery = data.slice(data.indexOf("## J02-BACKUP-10"), data.indexOf("## J02-BACKUP-11"));
  const qualification = data.slice(data.indexOf("## J02-BACKUP-14"), data.indexOf("## J02-BACKUP-15"));
  assert.match(database, /SQLite `3\.51\.3` is the first known upstream release containing the WAL-reset fix/);
  assert.match(database, /numeric `>= 3\.51\.3` comparison alone SHALL NOT establish qualification/);
  assert.match(database, /binding becomes `SUPPORTED` only after J05-VER-20 proves the exact packaged build/);
  assert.match(hierarchy, /`BackupDEK` SHALL never be the live `DB_DEK`[\s\S]*deterministic backup-metadata derivative[\s\S]*long-lived global backup key/);
  assert.match(localRecovery, /Every `LOCAL_RECOVERY` package[\s\S]*SHALL contain[\s\S]*suitable for unattended same-profile local restore/);
  assert.match(qualification, /labeled portable only after verification proves that its non-DPAPI generated-recovery slot can unlock its `BackupDEK`/);
});

test("repository governance qualification retains complete negative and interruption evidence", () => {
  const verification = readFileSync(resolve(root, "docs/implementation/JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md"), "utf8");
  const governance = verification.slice(verification.indexOf("## J05-VER-33"), verification.indexOf("## J05-VER-34"));
  assert.match(governance, /reject exact-SHA mismatch, unapproved repository\/profile\/ref, malformed or duplicate submissions, and incomplete\/failed-step aggregation/);
  assert.match(governance, /bounded timeout\/cancellation\/cleanup\/idempotency, credential non-exposure, prohibited host\/control-plane access, durable evidence integrity\/retention/);
  assert.match(governance, /recovery after runner\/control-plane interruption/);
});

test("provider qualification retains its complete conformance dimensions", () => {
  const verification = readFileSync(resolve(root, "docs/implementation/JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md"), "utf8");
  const provider = verification.slice(verification.indexOf("## J05-VER-17"), verification.indexOf("## J05-VER-18"));
  for (const dimension of [
    "exact distribution, adapter, provider, platform, and runtime-role identity",
    "setup/repair policy and state",
    "capabilities/locality/resources",
    "structured and invalid output",
    "timeout/cancellation",
    "process crash",
    "quota/rate-limit/unavailable mapping",
    "sanitized errors",
    "supervisor ownership/restart",
    "approved fallback",
    "unsupported version/platform behavior",
  ]) assert.match(provider, new RegExp(dimension.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
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
    supplyChain: `memory: >= ${values.kdf.sessionAndPortableRecoveryFloor.memoryKiB} KiB\npasses: >= ${values.kdf.sessionAndPortableRecoveryFloor.iterations}\nparallelism: ${values.kdf.sessionAndPortableRecoveryFloor.parallelism}\nsalt: >= ${values.kdf.sessionAndPortableRecoveryFloor.saltBytes} cryptographically random bytes\noutput: >= ${values.kdf.sessionAndPortableRecoveryFloor.outputBytes} bytes\nThe initial production trust-metadata profile SHALL implement TUF specification **${values.supplyChain.tufSpecVersion}** semantics.\n\`consistent_snapshot\` SHALL be enabled.\n\`\`\`text\nkeytype: ${values.supplyChain.keyType}\nscheme:  ${values.supplyChain.scheme}\n\`\`\`\nroot:      ${values.supplyChain.roles.root.threshold}-of-${values.supplyChain.roles.root.keyCount}, offline\ntargets:   ${values.supplyChain.roles.targets.threshold}-of-${values.supplyChain.roles.targets.keyCount}, offline/release-signing only\nsnapshot:  ${values.supplyChain.roles.snapshot.minimumThreshold}-of-${values.supplyChain.roles.snapshot.minimumKeyCount} or stronger, offline/release-signing only\ntimestamp: ${values.supplyChain.roles.timestamp.minimumThreshold}-of-${values.supplyChain.roles.timestamp.minimumKeyCount} or stronger, online automation permitted\nmodules delegated targets role: ${values.supplyChain.roles.modules.threshold}-of-${values.supplyChain.roles.modules.keyCount}, offline/release-signing only\ntimestamp: <= ${values.supplyChain.maximumValidityDays.timestamp} days\nsnapshot:  <= ${values.supplyChain.maximumValidityDays.snapshot} days\ntargets:   <= ${values.supplyChain.maximumValidityDays.targets} days\nroot:      <= ${values.supplyChain.maximumValidityDays.root} days\n`,
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
  ["KDF floor", (docs) => { docs.supplyChain = docs.supplyChain.replace("memory: >= 65536", "memory: >= 32768"); }, "DRIFT_KDF_SESSION_FLOOR"],
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

    await writeFile(cleanReference, "See docs\\architecture\\ADR.md for the historical decision.\n");
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
  await writeFile(manifestPath, text.replace("| 1 | `docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md` | `scopeGovernanceCoding` | 1.0.9 |", "| 1 | `docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md` | `scopeGovernanceCoding` | 9.9.9 |"));
  const result = await validateContractManifest(dir);
  assert.ok(result.violations.some((item) => item.code === "MANIFEST_COMPONENT_REVISION_DRIFT"));
});

test("manifest component footer drift is rejected", async () => {
  const dir = await manifestFixture();
  const componentPath = resolve(dir, "docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md");
  const text = await readFile(componentPath, "utf8");
  await writeFile(componentPath, text.replace("END — COMPONENT v1.0.9", "END — COMPONENT v1.0.6"));
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

test("matrix and plan traceability resolve against the active revision set and fail closed on drift", () => {
  const authorityPaths = [
    "docs/JARVIS-CONTRACT-MANIFEST-v1.0.8.md",
    "docs/JARVIS-V1-RELEASE-PROFILE.md",
    ...componentPaths.slice(0, 6).map(([, path]) => path),
  ];
  const activeTexts = authorityPaths.map((path) => readFileSync(resolve(root, path), "utf8"));
  const matrix = readFileSync(resolve(root, "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md"), "utf8");
  const reference = readFileSync(resolve(root, "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX-REFERENCE.md"), "utf8");
  const plan = readFileSync(resolve(root, "docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md"), "utf8");
  const codes = (matrixText, referenceText, planText) => validateMatrixTraceabilityTexts(canonical, activeTexts, matrixText, referenceText, planText).map(({ code }) => code);

  assert.deepEqual(codes(matrix, reference, plan), []);
  assert.ok(codes(matrix.replace("J00–J05 and Release Profile 1.0.9", "J00–J05 and Release Profile 9.9.9"), reference, plan).includes("MATRIX_COMPONENT_REVISION_DRIFT"));
  assert.ok(codes(matrix, reference.replace("J05-VER-39; RP-18", "J05-VER-99; RP-18"), plan).includes("MATRIX_UNRESOLVED_CLAUSE"));
  assert.ok(codes(matrix, reference.replace("J01-RT-02–J01-RT-05", "J01-RT-02–J01-RT-99"), plan).includes("MATRIX_UNRESOLVED_CLAUSE_RANGE_MEMBER"));
  assert.ok(codes(matrix, reference.replace("PLAN §3; J01-RT-02", "PLAN §99; J01-RT-02"), plan).includes("MATRIX_UNRESOLVED_PLAN_SECTION"));
  assert.ok(codes(matrix, reference.replace("J03-POLICY-07", "J03-POLICY-07; MAN-04.2"), plan).includes("MATRIX_RETIRED_MANIFEST_SUBSECTION"));
  assert.ok(codes(matrix, reference.replace("J01-RT-03, J01-RT-06", "J01-RT-03; J01-RT-03, J01-RT-06"), plan).includes("MATRIX_DUPLICATE_CLAUSE_REFERENCE"));
  assert.ok(codes(matrix, reference.replace("| ↳ **1.5**", "| ↳ **1.2**"), plan).includes("MATRIX_DUPLICATE_ROW_ID"));
  assert.ok(codes(matrix, reference.replace("PLAN §10 first tools; RP-06; J01-RT-18; J01-PROTO-16", "PLAN §10 first tools"), plan).includes("MATRIX_ROW_MISSING_NORMATIVE_OWNER"));
  assert.ok(codes(matrix, reference.replace("PLAN §19 Exit; J02-DATA-18; J04-OPS-09–J04-OPS-10", "PLAN §19 Exit; J04-OPS-09–J04-OPS-10"), plan).includes("MATRIX_ROW_OWNER_MAPPING_DRIFT"));
  assert.ok(codes(matrix, reference.replace("| `J03-POLICY-*`", "| `REMOVED-POLICY-*`"), plan).includes("MATRIX_COVERAGE_FAMILY_MISSING"));
  assert.ok(codes(matrix, reference.replace(/^\| `J01-RT-\*` \|.*$/m, "| `J01-RT-*` |  |"), plan).includes("MATRIX_COVERAGE_OWNER_MISSING"));
  assert.ok(codes(matrix, reference.replace("Sections 3–14 and applicable recovery/update/release gates", "Sections 3–13 and applicable recovery/update/release gates"), plan).includes("MATRIX_COVERAGE_MAPPING_DRIFT"));
  assert.ok(codes(matrix, reference.replace("| 36 | V1 production user journeys", "| 37 | V1 production user journeys"), plan).includes("MATRIX_CENTRAL_GATE_MAPPING_DRIFT"));
  assert.ok(codes(matrix, reference.replace("| 27 | Voice qualification | 19.18 |", "| 27 | Voice qualification | 19.17 |"), plan).includes("MATRIX_CENTRAL_GATE_MAPPING_DRIFT"));
  assert.ok(codes(matrix, reference.replace("| Early voice feasibility evidence compared with final production implementation | 19.18 |", "| Early voice feasibility evidence compared with final production implementation | 19.17 |"), plan).includes("MATRIX_SPECIALIZED_GATE_MAPPING_DRIFT"));
});

test("matrix protected fields, plan order, and historical identities match the reconciliation baseline", () => {
  const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const protectedRows = (text) => text
    .split(/\r?\n/)
    .filter((line) => /^\| (?:↳ |\*\*SECTION)/.test(line))
    .map((line) => {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      return [cells[0], cells[1], cells[2], cells[4], cells[5], cells[6]];
    });
  const matrix = readFileSync(resolve(root, "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md"), "utf8");
  const reference = readFileSync(resolve(root, "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX-REFERENCE.md"), "utf8");
  const plan = readFileSync(resolve(root, "docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md"), "utf8");
  const planOrder = [...plan.matchAll(/^#{1,6}\s+.*(?:Phase|Checkpoint|Implementation Workflow|Future|Governing Principles).*$/gmi)].map((match) => match[0]);
  const reconciliationHead = "e07d0326dde59c0157d70669d97c3eba165b13d8";
  const historicalIdentities = [...new Set([...`${matrix}\n${reference}\n${plan}`.matchAll(/\b[0-9a-f]{40}\b|\b\d{11}\b/g)].map((match) => match[0]))]
    .filter((value) => value !== reconciliationHead)
    .sort();

  assert.equal(digest(protectedRows(matrix)), "2799113e3c5868dc8c16494ac904985a277d584d9b1a01a285035622193920d8");
  assert.equal(digest(protectedRows(reference)), "8bef39bc27ed2fbd258352f6d6bfaa6af4a76611715068a97cc1b1834db992da");
  assert.equal(digest(planOrder), "06ced9964892d15bcafd470ca8774731fdc556b6773fb0d105efe34ba956134e");
  assert.equal(digest(historicalIdentities), "e47f0db554072390cde21209d6b777bd0e23b97317f22ea90bd88a323d983228");

  assert.notEqual(digest(protectedRows(matrix.replace("**IN PROGRESS**", "**VERIFIED**"))), digest(protectedRows(matrix)));
  assert.notEqual(digest(protectedRows(reference.replace("**NOT STARTED**", "**VERIFIED**"))), digest(protectedRows(reference)));
  assert.notEqual(digest([...plan.replace("PHASE 1", "PHASE 99").matchAll(/^#{1,6}\s+.*(?:Phase|Checkpoint|Implementation Workflow|Future|Governing Principles).*$/gmi)].map((match) => match[0])), digest(planOrder));
  assert.notEqual(digest(historicalIdentities.filter((value) => value !== historicalIdentities[0])), digest(historicalIdentities));
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
