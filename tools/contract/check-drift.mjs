import { fileURLToPath } from "node:url";
import { extractFenceAfter, extractTypeUnion, isMain, printViolations, readCanonical, readUtf8, sameSet, violation, escapeRegex } from "./lib.mjs";

const DOCS = Object.freeze({
  manifest: "docs/JARVIS-CONTRACT-MANIFEST-v1.0.7.md",
  releaseProfile: "docs/JARVIS-V1-RELEASE-PROFILE.md",
  portability: "docs/implementation/JARVIS-PLATFORM-PORTABILITY-CONTRACT.md",
  protocol: "docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md",
  backup: "docs/implementation/JARVIS-BACKUP-CRYPTOGRAPHY-CONTRACT.md",
  supplyChain: "docs/implementation/JARVIS-SUPPLY-CHAIN-TRUST-CONTRACT.md",
});

function regexValue(text, regex) {
  return text.match(regex)?.[1] ?? null;
}

function colonBlock(block) {
  const values = {};
  for (const line of String(block ?? "").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z][A-Za-z0-9]*):\s*([^\s]+)\s*$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

function section(text, heading, nextHeading) {
  const start = text.indexOf(heading);
  if (start < 0) return "";
  const tail = text.slice(start);
  if (!nextHeading) return tail;
  const end = tail.indexOf(nextHeading, heading.length);
  return end < 0 ? tail : tail.slice(0, end);
}

function fenceTokens(text, marker) {
  const block = extractFenceAfter(text, marker);
  if (block === null) return [];
  return block.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^[A-Z][A-Z0-9_]+$/.test(line));
}

function expectSet(violations, code, path, actual, expected, label) {
  if (!sameSet(actual, expected)) {
    violations.push(violation(code, path, `${label} expected [${[...expected].sort().join(", ")}], got [${[...actual].sort().join(", ")}]`));
  }
}

function expectRegex(violations, code, path, text, regex, detail) {
  if (!regex.test(text)) violations.push(violation(code, path, detail));
}

function canonicalConfigPhrase(domain) {
  if (domain === "PLATFORM_BACKEND") return "platform backend profile";
  return domain.toLowerCase().replaceAll("_", " ");
}

export function checkContractDriftFromTexts(canonical, docs) {
  const violations = [];
  const manifest = docs.manifest ?? "";
  const releaseProfile = docs.releaseProfile ?? "";
  const portability = docs.portability ?? "";
  const protocol = docs.protocol ?? "";
  const backup = docs.backup ?? "";
  const supplyChain = docs.supplyChain ?? "";

  const suite = regexValue(manifest, /\*\*Suite Version:\*\*\s*([0-9.]+)/);
  if (suite !== canonical.contractSuiteVersion) violations.push(violation("DRIFT_SUITE_VERSION", DOCS.manifest, `expected ${canonical.contractSuiteVersion}, got ${suite ?? "<missing>"}`));
  const profileVersion = regexValue(releaseProfile, /\*\*Profile Version:\*\*\s*([0-9.]+)/);
  if (profileVersion !== canonical.releaseProfileVersion) violations.push(violation("DRIFT_RELEASE_PROFILE_VERSION", DOCS.releaseProfile, `expected ${canonical.releaseProfileVersion}, got ${profileVersion ?? "<missing>"}`));
  const protocolMajor = Number(regexValue(protocol, /\*\*Protocol Major:\*\*\s*(\d+)/));
  if (protocolMajor !== canonical.protocolMajor) violations.push(violation("DRIFT_PROTOCOL_MAJOR", DOCS.protocol, `expected ${canonical.protocolMajor}, got ${Number.isFinite(protocolMajor) ? protocolMajor : "<missing>"}`));

  expectSet(violations, "DRIFT_PLATFORM_FAMILIES", DOCS.protocol, extractTypeUnion(protocol, "PlatformFamily"), canonical.platformFamilies, "PlatformFamily");
  expectSet(violations, "DRIFT_RUNTIME_ROLES", DOCS.protocol, extractTypeUnion(protocol, "RuntimeRole"), canonical.runtimeRoles, "RuntimeRole");
  expectSet(violations, "DRIFT_PORTABILITY_RUNTIME_ROLES", DOCS.portability, fenceTokens(portability, "Canonical runtime roles are:"), canonical.runtimeRoles, "portability runtime roles");

  const target = canonical.v1RuntimeTarget;
  const targetBlock = extractFenceAfter(releaseProfile, "Initial production target:") ?? "";
  const targetPairs = Object.fromEntries([...targetBlock.matchAll(/^([^:\n]+):\s*(.+)$/gm)].map((match) => [match[1].trim(), match[2].trim()]));
  if (targetPairs.PlatformFamily !== target.platform || targetPairs.RuntimeRole !== target.runtimeRole || targetPairs["Operating system"] !== target.operatingSystem || targetPairs["Minimum normal release baseline"] !== target.minimumReleaseBaseline || !String(targetPairs["CPU architecture"] ?? "").includes(target.architecture)) {
    violations.push(violation("DRIFT_V1_RUNTIME_TARGET", DOCS.releaseProfile, "Windows V1 runtime target differs from canonical values"));
  }

  const configParagraph = section(protocol, "Configuration domains are typed/versioned", "---").toLowerCase();
  const missingDomains = canonical.configurationDomains.filter((domain) => !configParagraph.includes(canonicalConfigPhrase(domain)));
  if (missingDomains.length > 0) violations.push(violation("DRIFT_CONFIGURATION_DOMAINS", DOCS.protocol, `missing human-readable domains: ${missingDomains.join(", ")}`));

  expectSet(violations, "DRIFT_PROVIDER_SETUP_STATES", DOCS.protocol, extractTypeUnion(protocol, "ProviderSetupState"), canonical.providerSetupStates, "ProviderSetupState");
  expectSet(violations, "DRIFT_MODULE_EXECUTION_CLASSES", DOCS.protocol, extractTypeUnion(protocol, "ModuleExecutionClass"), canonical.moduleExecutionClasses, "ModuleExecutionClass");

  const governanceSection = section(releaseProfile, "# 17. REPOSITORY GOVERNANCE GATE", "# 18. PRODUCTION-COMPLETE GATE");
  for (const authority of canonical.ciAuthorities.eligibleTypes) {
    expectRegex(violations, "DRIFT_CI_AUTHORITY_TYPES", DOCS.releaseProfile, governanceSection, new RegExp(`\\b${escapeRegex(authority)}\\b`), `eligible CI authority ${authority} missing`);
  }
  expectRegex(violations, "DRIFT_SELECTED_CI_AUTHORITY", DOCS.releaseProfile, governanceSection, new RegExp(`qualified[^\\n]*${escapeRegex(canonical.ciAuthorities.selectedType)}`, "i"), `selected CI authority ${canonical.ciAuthorities.selectedType} missing`);
  expectRegex(violations, "DRIFT_CI_PIPELINE_IDENTITY", DOCS.releaseProfile, governanceSection, new RegExp(`\\b${escapeRegex(canonical.ciAuthorities.pipelineIdentity)}\\b`, "i"), `CI pipeline identity ${canonical.ciAuthorities.pipelineIdentity} missing`);

  const githubAll = [...canonical.githubCapabilities.mandatory, ...canonical.githubCapabilities.optional];
  expectSet(violations, "DRIFT_GITHUB_PROTOCOL_CAPABILITIES", DOCS.protocol, extractTypeUnion(protocol, "GitHubCapability"), githubAll, "GitHub protocol capabilities");
  const githubSection = section(releaseProfile, "## 9.1 GitHub V1 capability matrix", "## 9.2 Proxmox VE V1 capability matrix");
  expectSet(violations, "DRIFT_GITHUB_MANDATORY_CAPABILITIES", DOCS.releaseProfile, fenceTokens(githubSection, "The following capability families are mandatory for V1 Production Complete:"), canonical.githubCapabilities.mandatory, "GitHub mandatory capabilities");
  for (const capability of canonical.githubCapabilities.optional) {
    expectRegex(violations, "DRIFT_GITHUB_OPTIONAL_CAPABILITIES", DOCS.releaseProfile, githubSection, new RegExp(`\\b${escapeRegex(capability)}\\b[\\s\\S]*?MAY be supported`), `${capability} optional semantics missing`);
  }

  const proxmoxAll = [...canonical.proxmoxCapabilities.mandatory, ...canonical.proxmoxCapabilities.optional];
  expectSet(violations, "DRIFT_PROXMOX_PROTOCOL_CAPABILITIES", DOCS.protocol, extractTypeUnion(protocol, "ProxmoxCapability"), proxmoxAll, "Proxmox protocol capabilities");
  const proxmoxSection = section(releaseProfile, "## 9.2 Proxmox VE V1 capability matrix", "---");
  expectSet(violations, "DRIFT_PROXMOX_MANDATORY_CAPABILITIES", DOCS.releaseProfile, fenceTokens(proxmoxSection, "The following capabilities are mandatory for V1 Production Complete:"), canonical.proxmoxCapabilities.mandatory, "Proxmox mandatory capabilities");
  expectSet(violations, "DRIFT_PROXMOX_OPTIONAL_CAPABILITIES", DOCS.releaseProfile, fenceTokens(proxmoxSection, "The following remain modeled but do not block V1 Production Complete:"), canonical.proxmoxCapabilities.optional, "Proxmox optional capabilities");

  const sessionFloor = canonical.kdf.sessionAndPortableRecoveryFloor;
  expectRegex(violations, "DRIFT_KDF_ALGORITHM", DOCS.protocol, protocol, /algorithm:\s*'ARGON2ID'/, "Argon2id algorithm binding missing");
  expectRegex(violations, "DRIFT_KDF_VERSION", DOCS.protocol, protocol, new RegExp(`version:\\s*0x${canonical.kdf.version.toString(16)}`, "i"), `Argon2id version must be 0x${canonical.kdf.version.toString(16)}`);
  for (const [field, operator, value] of [["memoryKiB", ">=", sessionFloor.memoryKiB], ["iterations", ">=", sessionFloor.iterations], ["parallelism", "=", sessionFloor.parallelism], ["saltBytes", ">=", sessionFloor.saltBytes], ["outputBytes", ">=", sessionFloor.outputBytes]]) {
    expectRegex(violations, "DRIFT_KDF_SESSION_FLOOR", DOCS.protocol, protocol, new RegExp(`${field}\\s*${escapeRegex(operator)}\\s*${value}`), `${field} ${operator} ${value} missing from production KDF floor`);
  }

  const format = colonBlock(extractFenceAfter(backup, "The first production format is:"));
  for (const field of ["formatId", "formatVersion", "outerAead", "chunkSizeBytes", "maxPlaintextBytes", "chunkTagBytes", "chunkNonceBytes", "hash", "canonicalMetadata"]) {
    if (String(format[field]) !== String(canonical.backup[field])) violations.push(violation("DRIFT_BACKUP_FORMAT", DOCS.backup, `${field} expected ${canonical.backup[field]}, got ${format[field] ?? "<missing>"}`));
  }
  expectRegex(violations, "DRIFT_BACKUP_SNAPSHOT_KEY", DOCS.backup, backup, new RegExp(`SnapshotDBKey \\(${canonical.backup.snapshotDbKeyBits} random bits per backup\\)`), "SnapshotDBKey bit size drift");
  expectRegex(violations, "DRIFT_BACKUP_DEK", DOCS.backup, backup, new RegExp(`BackupDEK \\(${canonical.backup.backupDekBits} random bits per backup\\)`), "BackupDEK bit size drift");
  expectRegex(violations, "DRIFT_BACKUP_METADATA_BOUNDS", DOCS.backup, backup, new RegExp(`at most ${canonical.backup.maxKeySlots} key slots`), "backup key-slot bound drift");
  expectRegex(violations, "DRIFT_BACKUP_METADATA_BOUNDS", DOCS.backup, backup, new RegExp(`${canonical.backup.maxUnencryptedMetadataBytes / 1024} KiB`), "backup unencrypted metadata bound drift");
  for (const protection of canonical.backup.protectionClasses) expectRegex(violations, "DRIFT_BACKUP_PROTECTION_CLASSES", DOCS.backup, backup, new RegExp(`'${escapeRegex(protection)}'`), `backup protection class ${protection} missing`);
  expectRegex(violations, "DRIFT_BACKUP_GENERATED_RECOVERY", DOCS.backup, backup, new RegExp(`${canonical.backup.generatedRecoverySecretBits}-bit recovery secret`), "generated recovery secret strength drift");
  expectRegex(violations, "DRIFT_BACKUP_GENERATED_RECOVERY", DOCS.backup, backup, new RegExp(`${escapeRegex(canonical.backup.generatedRecoveryPrefix)}<base64url-no-pad of exactly ${canonical.backup.generatedRecoverySecretBits / 8} random bytes>`), "generated recovery representation drift");
  expectRegex(violations, "DRIFT_BACKUP_SLOT_TYPES", DOCS.backup, backup, new RegExp(`\\b${escapeRegex(canonical.backup.mandatoryPortableSlot)}\\b`), "mandatory portable slot drift");
  expectRegex(violations, "DRIFT_BACKUP_SLOT_TYPES", DOCS.backup, backup, new RegExp(`\\b${escapeRegex(canonical.backup.optionalPortableSlot)}\\b`), "optional portable slot drift");
  expectRegex(violations, "DRIFT_BACKUP_NONCE", DOCS.backup, backup, new RegExp(`exactly ${canonical.backup.noncePrefixBytes} random bytes`), "nonce prefix width drift");
  expectRegex(violations, "DRIFT_BACKUP_NONCE", DOCS.backup, backup, new RegExp(`${canonical.backup.wrapNonceBytes * 8}-bit AES-GCM wrap nonce`), "wrap nonce width drift");
  expectRegex(violations, "DRIFT_BACKUP_PASSPHRASE", DOCS.backup, backup, new RegExp(`require at least ${canonical.backup.portableBackupPassphraseMinimumCodePoints} Unicode code points`), "portable passphrase minimum drift");
  expectRegex(violations, "DRIFT_BACKUP_PASSPHRASE", DOCS.backup, backup, new RegExp(`accept at least ${canonical.backup.portableBackupPassphraseAcceptedCodePointsAtLeast} Unicode code points`), "portable passphrase accepted-length floor drift");
  const portableFloor = canonical.kdf.portableBackupPassphraseFloor;
  for (const [field, label, operator, value] of [["memoryKiB", "memoryKiB", ">=", portableFloor.memoryKiB], ["iterations", "iterations", ">=", portableFloor.iterations], ["parallelism", "parallelism", "=", portableFloor.parallelism], ["outputBytes", "outputBytes", ">=", portableFloor.outputBytes]]) {
    expectRegex(violations, "DRIFT_KDF_PORTABLE_FLOOR", DOCS.backup, backup, new RegExp(`${label}\\s*${escapeRegex(operator)}\\s*${value}`), `portable ${field} floor drift`);
  }
  expectRegex(violations, "DRIFT_KDF_PORTABLE_FLOOR", DOCS.backup, backup, new RegExp(`salt of at least ${portableFloor.saltBytes} bytes`), "portable salt floor drift");

  const supply = canonical.supplyChain;
  expectRegex(violations, "DRIFT_TUF_SPEC", DOCS.supplyChain, supplyChain, new RegExp(`TUF specification \\*\\*${escapeRegex(supply.tufSpecVersion)}\\*\\*`), "TUF semantic profile drift");
  expectRegex(violations, "DRIFT_TUF_CONSISTENT_SNAPSHOT", DOCS.supplyChain, supplyChain, /`consistent_snapshot` SHALL be enabled\./, "consistent_snapshot must remain enabled");
  expectRegex(violations, "DRIFT_TUF_KEY_PROFILE", DOCS.supplyChain, supplyChain, new RegExp(`keytype:\\s*${escapeRegex(supply.keyType)}[\\s\\S]*?scheme:\\s*${escapeRegex(supply.scheme)}`), "TUF key type/scheme drift");
  const fixedRoles = ["root", "targets", "modules"];
  for (const role of fixedRoles) {
    const data = supply.roles[role];
    const label = role === "modules" ? "modules delegated targets role" : role;
    expectRegex(violations, "DRIFT_TUF_ROLE_THRESHOLD", DOCS.supplyChain, supplyChain, new RegExp(`${escapeRegex(label)}[^\\n]*${data.threshold}-of-${data.keyCount}`, "i"), `${role} threshold/key-count drift`);
  }
  for (const role of ["snapshot", "timestamp"]) {
    const data = supply.roles[role];
    expectRegex(violations, "DRIFT_TUF_ROLE_THRESHOLD", DOCS.supplyChain, supplyChain, new RegExp(`${role}:\\s*${data.minimumThreshold}-of-${data.minimumKeyCount} or stronger`, "i"), `${role} minimum threshold drift`);
  }
  for (const [role, days] of Object.entries(supply.maximumValidityDays)) {
    expectRegex(violations, "DRIFT_TUF_VALIDITY", DOCS.supplyChain, supplyChain, new RegExp(`${role}:\\s*<=\\s*${days} days`, "i"), `${role} maximum validity drift`);
  }

  const approval = canonical.approvalCanonicalization;
  expectRegex(violations, "DRIFT_APPROVAL_CANONICALIZATION", DOCS.protocol, protocol, new RegExp(`domain:\\s*'${escapeRegex(approval.actionDescriptorDomain)}'`), "approval descriptor domain drift");
  expectRegex(violations, "DRIFT_APPROVAL_CANONICALIZATION", DOCS.protocol, protocol, new RegExp(`descriptorVersion:\\s*${approval.descriptorVersion}`), "approval descriptor version drift");
  expectRegex(violations, "DRIFT_APPROVAL_CANONICALIZATION", DOCS.protocol, protocol, new RegExp(escapeRegex(approval.canonicalization.replaceAll("_", " ")), "i"), "approval canonicalization drift");
  expectRegex(violations, "DRIFT_APPROVAL_CANONICALIZATION", DOCS.protocol, protocol, new RegExp(escapeRegex(approval.digest.replaceAll("_", "-")), "i"), "approval digest drift");
  expectRegex(violations, "DRIFT_APPROVAL_CANONICALIZATION", DOCS.protocol, protocol, new RegExp(escapeRegex(approval.digestEncoding), "i"), "approval digest encoding drift");

  return violations;
}

export async function checkContractDrift(rootDir) {
  const { values: canonical } = await readCanonical(rootDir);
  const docs = Object.fromEntries(await Promise.all(Object.entries(DOCS).map(async ([key, path]) => [key, await readUtf8(rootDir, path)])));
  return checkContractDriftFromTexts(canonical, docs);
}

if (isMain(import.meta.url)) {
  const rootDir = fileURLToPath(new URL("../..", import.meta.url));
  const violations = await checkContractDrift(rootDir);
  if (violations.length > 0) {
    printViolations("contract-drift", violations);
    process.exit(1);
  }
  console.log("[contract-drift] PASS");
}
