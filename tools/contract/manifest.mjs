import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { CANONICAL_VALUES_PATH, MANIFEST_PATH, readCanonical, stablePretty, violation } from "./lib.mjs";

const COMPONENT_KEY_BY_FILE = Object.freeze({
  "JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md": "scopeGovernanceCoding",
  "JARVIS-01-RUNTIME-PLATFORM-PROTOCOL-CONTRACT.md": "runtimePlatformProtocol",
  "JARVIS-02-DATA-STATE-BACKUP-CONTRACT.md": "dataStateBackup",
  "JARVIS-03-SECURITY-TRUST-CONTRACT.md": "securityTrust",
  "JARVIS-04-OPERATIONS-INTEGRATIONS-UX-CONTRACT.md": "operationsIntegrationsUx",
  "JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md": "verificationRelease",
  "JARVIS-V1-RELEASE-PROFILE.md": "releaseProfile",
});

const TEXT_EXTENSIONS = new Set([".json", ".md", ".mjs", ".ts", ".tsx", ".js", ".jsx", ".yml", ".yaml", ".toml", ".sh", ".ps1", ".txt"]);
const DECISION_RECORD_REFERENCE_EXEMPTIONS = new Set([
  "tools/contract/manifest.mjs",
  "tools/checkpoints/phase0-checkpoint-profile.json",
  "tests/layers/unit/contract-drift.test.mjs",
  "tests/layers/unit/phase0-checkpoint.test.mjs",
  // The owner goal is non-authoritative enforcement text and must name the prohibited paths it governs.
  "docs/implementation/JARVIS-DEVELOPER-EXECUTION-GOAL.md",
  // This non-authoritative audit aid inventories retired source paths so the audit is reproducible.
  "docs/implementation/JARVIS-CONTRACT-CONSOLIDATION-AUDIT-FINDINGS.md",
]);
const ADR_REFERENCE_PATTERN = /(?:^|[-_.\s/\\])adr(?:\.[A-Za-z0-9]+|[-_ ](?:[A-Za-z0-9][A-Za-z0-9._-]*)?\.[A-Za-z0-9]+|[-_ ]?\d+(?:[-_.\s]|$))/i;
const DECISION_RECORD_FILENAME_PATTERN = /(?:^|[-_. ])decision[-_ ]?records?(?:[-_. ]|$)/i;
const MATRIX_PATH = "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md";
const MATRIX_REFERENCE_PATH = "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX-REFERENCE.md";
const IMPLEMENTATION_PLAN_PATH = "docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md";
const CLAUSE_ID_PATTERN = /\b(?:MAN|RP|J0[0-5]-(?:SCOPE|GOV|CODE|PLAT|RT|PROTO|DATA|BACKUP|SEC|POLICY|SUPPLY|OPS|UI|VER))-[0-9]+[A-Z]?\b/g;
const CLAUSE_HEADING_PATTERN = /^#{1,3}\s+((?:MAN|RP|J0[0-5]-(?:SCOPE|GOV|CODE|PLAT|RT|PROTO|DATA|BACKUP|SEC|POLICY|SUPPLY|OPS|UI|VER))-[0-9]+[A-Z]?)\b/gm;
const CLAUSE_RANGE_PATTERN = /\b((?:MAN|RP|J0[0-5]-(?:SCOPE|GOV|CODE|PLAT|RT|PROTO|DATA|BACKUP|SEC|POLICY|SUPPLY|OPS|UI|VER)))-(\d+)\s*[–-]\s*(?:\1-)?(\d+)\b/g;
const MATRIX_ROW_ID_PATTERN = /\*\*((?:\d+A?)(?:\.\d+|\.CP))\*\*/g;
const COVERAGE_INDEX_SOURCES = [
  "`MAN-01`–`MAN-10`", "`J00-SCOPE-*`, `J00-GOV-*`, `J00-CODE-*`", "`J01-PLAT-*`", "`J01-RT-*`", "`J01-PROTO-*`",
  "`J02-DATA-*`", "`J02-BACKUP-*`", "`J03-SEC-*`", "`J03-POLICY-*`", "`J03-SUPPLY-*`", "`J04-OPS-*`", "`J04-UI-*`",
  "`J05-VER-*`", "`RP-01`–`RP-19`", "`PLAN` (non-normative)",
];
const COVERAGE_INDEX_SHA256 = "7e6939a478d31552fff16104f11d5e360b983c5316b9dae0b7c2a0719c7e2063";
const REQUIRED_ROW_OWNER_SETS = new Map([
  ["3A.6", ["RP-11", "J05-VER-30", "J05-VER-31"]],
  ["3A.CP", ["RP-11", "J05-VER-30", "J05-VER-31"]],
  ["6.CP", ["J01-PROTO-11", "J02-DATA-20", "J03-SEC-16", "J03-POLICY-15", "J05-VER-16A"]],
  ["8.6", ["RP-06", "J01-RT-18", "J01-PROTO-16"]],
  ["8.CP", ["J01-RT-18", "J05-VER-18"]],
  ["10.5", ["J01-RT-19", "J04-OPS-05", "J05-VER-04"]],
  ["12.CP", ["J03-SUPPLY-17", "J05-VER-26"]],
  ["15.CP", ["RP-11", "J01-RT-26", "J05-VER-30"]],
  ["16.CP", ["RP-11", "J01-RT-26", "J05-VER-30"]],
  ["17.CP", ["J02-DATA-18", "J04-OPS-09", "J04-OPS-10", "J03-SEC-29", "J03-SEC-30", "J05-VER-29"]],
  ["19.CP", ["J05-VER-39", "RP-18"]],
]);
const CENTRAL_RELEASE_GATES = [
  ["Contract Manifest + Release Profile conformance", "19.1, 19.26"],
  ["Reproducible build/toolchain", "19.2"],
  ["Protected-authoritative-branch / CI governance", "19.2"],
  ["Static / architecture analysis", "19.2"],
  ["Platform portability / composition / import boundary", "19.2"],
  ["Unit tests", "19.2 complete normal CI plus owning feature qualification rows"],
  ["Property / state-machine tests", "19.2 plus 4.16, 5.13, 10.10, 19.13"],
  ["Protocol/schema cross-language", "19.3"],
  ["Mission Control UI identity/adaptive/accessibility", "19.4"],
  ["Tauri/WebView security", "19.5"],
  ["Windows named-pipe principal/bootstrap", "19.6"],
  ["KDF/session/recovery profile", "19.7"],
  ["PermissionEngine/approval safety", "19.8"],
  ["Prompt-injection/content-authority", "19.8"],
  ["Provider setup/version/health/platform/sandbox", "19.9"],
  ["Tool contract/TOCTOU", "19.10"],
  ["Persistence/SQLite-WAL/SQLCipher", "19.11"],
  ["Encrypted local/portable backup restore", "19.12"],
  ["Migration", "19.11, 19.21"],
  ["Crash/recovery/uncertain-side-effect", "19.13"],
  ["Windows Job Object/process-tree containment", "19.6"],
  ["Exact budget/quota/accounting", "19.14"],
  ["Module/catalog/supply-chain/update/platform", "19.15"],
  ["Local filesystem/Git integration", "19.16"],
  ["Exact GitHub V1 capability matrix", "19.16"],
  ["Exact Proxmox VE V1 capability matrix", "19.17"],
  ["Voice qualification", "19.18"],
  ["Event/automation security/dedup", "19.19"],
  ["Performance/latency", "19.14"],
  ["Resource-pressure", "19.14"],
  ["Clean install with no usable system Node", "19.20"],
  ["Previous-production upgrade/rollback", "19.21"],
  ["Signed installer/update verification", "19.1 creation/freeze + 19.25 final identity verification"],
  ["SBOM/license/provenance/release manifest", "19.25"],
  ["Soak/stability", "19.23"],
  ["V1 production user journeys", "19.22"],
];
const SPECIALIZED_RELEASE_GATES = [
  ["`JARVIS_BACKUP_V1` exact crypto/golden/tamper/order/truncation/bounds + signed-RC disaster restore", "19.12"],
  ["Project-policy candidate/enrollment/hash-change/nested/revoke/worker-mutation trust conformance", "19.8"],
  ["TUF bootstrap/threshold/root rotation/revocation/expiry/rollback/freeze/mix-and-match/delegation + cumulative signing", "19.15"],
  ["Exact SQLite embedded-build WAL-fix evidence and snapshot/re-key mechanism", "19.11"],
  ["Early voice feasibility evidence compared with final production implementation", "19.18"],
  ["Repository protection and contract/profile drift safeguards", "19.2"],
];

function extension(path) {
  const name = basename(path);
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index).toLowerCase();
}

export function validateTrackedDecisionRecordPaths(paths) {
  const violations = [];
  for (const path of [...paths].sort((a, b) => a.localeCompare(b, "en"))) {
    const normalizedPath = path.replaceAll("\\", "/");
    const segments = normalizedPath.split("/");
    if (segments.some((segment) => /^(?:adr|adrs|decision|decisions|history)$/i.test(segment))) {
      violations.push(violation("MANIFEST_DECISION_RECORD_PATH", path, "tracked ADR/decision/history directories are prohibited, including nested and case variants"));
    }
    const name = segments.at(-1) ?? "";
    if (ADR_REFERENCE_PATTERN.test(normalizedPath) || DECISION_RECORD_FILENAME_PATTERN.test(name)) {
      violations.push(violation("MANIFEST_DECISION_RECORD_FILENAME", path, "tracked ADR-like or decision-like filenames are prohibited"));
    }
  }
  return violations;
}

export function hasForbiddenDecisionRecordReference(text) {
  const value = String(text);
  return ADR_REFERENCE_PATTERN.test(value) ||
    /(?:^|[\s`"'(])docs[\\/](?:adr|adrs|decision|decisions|history)(?=$|[\\/\s`"')])/im.test(value) ||
    /(?:^|[\s`"'(])(?:[A-Za-z0-9_.-]+[\\/])+[A-Za-z0-9_.-]*decision[-_ ]?record[A-Za-z0-9_.-]*\.[A-Za-z0-9]+(?=$|[\s`"')])/im.test(value) ||
    /(?:^|[\s`"'(])(?:[A-Za-z0-9_.-]+[-_])*(?:decision[-_ ]?record)(?:[-_][A-Za-z0-9_.-]+)*(?:\.[A-Za-z0-9]+)(?=$|[\s`"')])/im.test(value);
}

function trackedPaths(rootDir) {
  try {
    return execFileSync("git", ["ls-files", "-z"], { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\0")
      .filter(Boolean)
      .map((path) => path.replaceAll("\\", "/"));
  } catch {
    return null;
  }
}

function basename(path) {
  return path.split("/").at(-1);
}

export function parseManifestRows(text) {
  const rows = [];
  for (const match of text.matchAll(/^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*`[^`]+`\s*\|\s*([0-9]+\.[0-9]+\.[0-9]+)\s*\|/gm)) {
    rows.push({ index: Number(match[1]), path: match[2], revision: match[3] });
  }
  return rows;
}

export function componentKeyForPath(path) {
  return COMPONENT_KEY_BY_FILE[basename(path)] ?? null;
}

export function componentHeaderRevision(text) {
  const head = text.slice(0, 1200);
  return (
    head.match(/\*\*Version:\*\*\s*([0-9]+\.[0-9]+\.[0-9]+)/)?.[1] ??
    head.match(/\*\*Profile Version:\*\*\s*([0-9]+\.[0-9]+\.[0-9]+)/)?.[1] ??
    head.match(/\*\*Contract Version:\*\*\s*([0-9]+\.[0-9]+\.[0-9]+)/)?.[1] ??
    head.match(/\*\*Contract Suite Version:\*\*\s*([0-9]+\.[0-9]+\.[0-9]+)/)?.[1] ??
    null
  );
}

export function componentFooterRevision(text) {
  return [...text.matchAll(/\*\*END[^\n]*v([0-9]+\.[0-9]+\.[0-9]+)\*\*/g)].at(-1)?.[1] ?? null;
}

function uniqueMatches(text, pattern) {
  return [...new Set([...String(text).matchAll(pattern)].map((match) => match[0]))];
}

function duplicateMatrixTraceabilityReferences(text) {
  const duplicates = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (!/^\| (?:↳ |\*\*SECTION)/.test(line)) continue;
    const cells = line.split("|");
    const traceability = cells[4] ?? "";
    const refs = [...traceability.matchAll(CLAUSE_ID_PATTERN)].map((match) => match[0]);
    const repeated = [...new Set(refs.filter((ref, index) => refs.indexOf(ref) !== index))];
    if (repeated.length > 0) duplicates.push(`${cells[1]?.trim() ?? "<unknown row>"}: ${repeated.join(", ")}`);
  }
  return duplicates;
}

function markdownTableRows(section) {
  return String(section).split(/\r?\n/)
    .filter((line) => /^\|/.test(line) && !/^\|\s*(?:---|#)/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => !["Current normative source", "Central release gate", "Specialized cumulative gate"].includes(cells[0]));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function validateMatrixTraceabilityTexts(canonical, activeContractTexts, matrix, reference, plan) {
  const violations = [];
  const definedClauses = new Set([...activeContractTexts.join("\n").matchAll(CLAUSE_HEADING_PATTERN)].map((match) => match[1]));
  const revisionValues = Object.values(canonical.contractComponentRevisions);
  const commonRevision = new Set(revisionValues).size === 1 && revisionValues[0] === canonical.releaseProfileVersion ? revisionValues[0] : null;
  const revisionMarker = commonRevision === null ? null : `J00–J05 and Release Profile ${commonRevision}`;

  for (const [path, text] of [[MATRIX_PATH, matrix], [MATRIX_REFERENCE_PATH, reference], [IMPLEMENTATION_PLAN_PATH, plan]]) {
    if (!String(text).includes(`v${canonical.contractSuiteVersion}`)) {
      violations.push(violation("MATRIX_SUITE_IDENTITY_DRIFT", path, `must identify suite v${canonical.contractSuiteVersion}`));
    }
    if (revisionMarker === null || !String(text).includes(revisionMarker)) {
      violations.push(violation("MATRIX_COMPONENT_REVISION_DRIFT", path, `must identify ${revisionMarker ?? "the complete canonical component revision set"}`));
    }
    for (const ref of uniqueMatches(text, CLAUSE_ID_PATTERN)) {
      if (!definedClauses.has(ref)) violations.push(violation("MATRIX_UNRESOLVED_CLAUSE", path, `${ref} is not an active clause`));
    }
    for (const match of String(text).matchAll(CLAUSE_RANGE_PATTERN)) {
      const start = Number(match[2]);
      const end = Number(match[3]);
      if (start > end) {
        violations.push(violation("MATRIX_INVALID_CLAUSE_RANGE", path, `${match[0]} is reversed`));
        continue;
      }
      for (let value = start; value <= end; value += 1) {
        const ref = `${match[1]}-${String(value).padStart(match[2].length, "0")}`;
        if (!definedClauses.has(ref)) violations.push(violation("MATRIX_UNRESOLVED_CLAUSE_RANGE_MEMBER", path, `${match[0]} includes missing ${ref}`));
      }
    }
    if (/\bMAN-[0-9]+\.[0-9]+\b/.test(text)) {
      violations.push(violation("MATRIX_RETIRED_MANIFEST_SUBSECTION", path, "manifest subsection notation does not resolve to an active MAN clause"));
    }
  }

  for (const [path, text] of [[MATRIX_PATH, matrix], [MATRIX_REFERENCE_PATH, reference]]) {
    for (const detail of duplicateMatrixTraceabilityReferences(text)) {
      violations.push(violation("MATRIX_DUPLICATE_CLAUSE_REFERENCE", path, detail));
    }
  }

  for (const line of String(reference).split(/\r?\n/).filter((value) => /^\| ↳ \*\*/.test(value))) {
    const cells = line.split("|");
    const row = cells[1]?.trim() ?? "<unknown row>";
    const traceability = cells[4] ?? "";
    const owners = new Set([...traceability.matchAll(CLAUSE_ID_PATTERN)].map((match) => match[0]));
    if (owners.size === 0) {
      violations.push(violation("MATRIX_ROW_MISSING_NORMATIVE_OWNER", MATRIX_REFERENCE_PATH, `${row} has no direct active-contract owner`));
    }
    const rowId = row.match(/\*\*((?:\d+A?)(?:\.\d+|\.CP))\*\*/)?.[1];
    const requiredOwners = REQUIRED_ROW_OWNER_SETS.get(rowId);
    const missingOwners = requiredOwners?.filter((owner) => !owners.has(owner)) ?? [];
    if (missingOwners.length > 0) {
      violations.push(violation("MATRIX_ROW_OWNER_MAPPING_DRIFT", MATRIX_REFERENCE_PATH, `${rowId} is missing reviewed owner(s): ${missingOwners.join(", ")}`));
    }
  }

  const liveIds = [...String(matrix).matchAll(MATRIX_ROW_ID_PATTERN)].map((match) => match[1]);
  const referenceIds = [...String(reference).matchAll(MATRIX_ROW_ID_PATTERN)].map((match) => match[1]);
  for (const [path, ids] of [[MATRIX_PATH, liveIds], [MATRIX_REFERENCE_PATH, referenceIds]]) {
    const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    if (duplicates.length > 0) violations.push(violation("MATRIX_DUPLICATE_ROW_ID", path, duplicates.join(", ")));
  }
  const referenceSet = new Set(referenceIds);
  const missingLiveRows = [...new Set(liveIds.filter((id) => !referenceSet.has(id)))];
  if (missingLiveRows.length > 0) violations.push(violation("MATRIX_LIVE_ROW_MISSING_FROM_REFERENCE", MATRIX_PATH, missingLiveRows.join(", ")));

  const planSections = new Set([...String(plan).matchAll(/^#\s+(\d+)(?:\.|\s)/gm)].map((match) => Number(match[1])));
  for (const [path, text] of [[MATRIX_PATH, matrix], [MATRIX_REFERENCE_PATH, reference]]) {
    for (const match of String(text).matchAll(/\bPLAN §{1,2}([0-9]+(?:\s*,\s*[0-9]+)*)/g)) {
      for (const value of match[1].split(",").map((part) => Number(part.trim()))) {
        if (!planSections.has(value)) violations.push(violation("MATRIX_UNRESOLVED_PLAN_SECTION", path, `PLAN §${value} does not exist`));
      }
    }
  }

  const coverageSection = String(reference).match(/## Contract coverage index([\s\S]*?)## Central release-gate mapping/)?.[1] ?? "";
  const coverageRows = markdownTableRows(coverageSection);
  const coverageSources = coverageRows.map((cells) => cells[0]);
  if (coverageSources.length !== COVERAGE_INDEX_SOURCES.length || COVERAGE_INDEX_SOURCES.some((source, index) => coverageSources[index] !== source)) {
    violations.push(violation("MATRIX_COVERAGE_FAMILY_MISSING", MATRIX_REFERENCE_PATH, `expected exact ordered coverage sources: ${COVERAGE_INDEX_SOURCES.join(", ")}`));
  }
  for (const cells of coverageRows) {
    if (!cells[1]) violations.push(violation("MATRIX_COVERAGE_OWNER_MISSING", MATRIX_REFERENCE_PATH, `${cells[0] ?? "<unknown source>"} has no ownership mapping`));
  }
  if (sha256(JSON.stringify(coverageRows)) !== COVERAGE_INDEX_SHA256) {
    violations.push(violation("MATRIX_COVERAGE_MAPPING_DRIFT", MATRIX_REFERENCE_PATH, "coverage ownership text differs from the reviewed active-suite mapping"));
  }

  const centralGateSection = String(reference).match(/## Central release-gate mapping([\s\S]*?)### Specialized cumulative gates/)?.[1] ?? "";
  const centralGateRows = markdownTableRows(centralGateSection);
  if (centralGateRows.length !== CENTRAL_RELEASE_GATES.length || centralGateRows.some((cells, index) => Number(cells[0]) !== index + 1 || cells[1] !== CENTRAL_RELEASE_GATES[index][0] || cells[2] !== CENTRAL_RELEASE_GATES[index][1])) {
    violations.push(violation("MATRIX_CENTRAL_GATE_MAPPING_DRIFT", MATRIX_REFERENCE_PATH, "central gate number, name, or final owner differs from the reviewed J05-VER-06 mapping"));
  }

  const specializedGateSection = String(reference).match(/### Specialized cumulative gates([\s\S]*?)## Explicit V1 non-goals/)?.[1] ?? "";
  const specializedGateRows = markdownTableRows(specializedGateSection);
  if (specializedGateRows.length !== SPECIALIZED_RELEASE_GATES.length || specializedGateRows.some((cells, index) => cells[0] !== SPECIALIZED_RELEASE_GATES[index][0] || cells[1] !== SPECIALIZED_RELEASE_GATES[index][1])) {
    violations.push(violation("MATRIX_SPECIALIZED_GATE_MAPPING_DRIFT", MATRIX_REFERENCE_PATH, "specialized gate name or final owner differs from the reviewed active-contract mapping"));
  }

  return violations;
}

export async function validateContractManifest(rootDir) {
  const violations = [];
  const tracked = trackedPaths(rootDir);
  if (tracked === null) {
    violations.push(violation("MANIFEST_TRACKED_TREE_UNAVAILABLE", rootDir, "tracked repository enumeration is required for decision-record enforcement"));
  } else {
    violations.push(...validateTrackedDecisionRecordPaths(tracked));
    for (const path of tracked) {
      if (DECISION_RECORD_REFERENCE_EXEMPTIONS.has(path) || !TEXT_EXTENSIONS.has(extension(path))) continue;
      const text = await readFile(resolve(rootDir, path), "utf8");
      if (hasForbiddenDecisionRecordReference(text)) {
        violations.push(violation("MANIFEST_DECISION_RECORD_REFERENCE", path, "tracked content must not reference deleted ADR/decision/history source paths"));
      }
    }
  }
  const { values: canonical } = await readCanonical(rootDir);
  const manifestText = await readFile(resolve(rootDir, MANIFEST_PATH), "utf8");
  const suiteVersion = manifestText.match(/\*\*Suite Version:\*\*\s*([0-9.]+)/)?.[1];
  if (suiteVersion !== canonical.contractSuiteVersion) {
    violations.push(violation("MANIFEST_SUITE_VERSION_DRIFT", MANIFEST_PATH, `expected ${canonical.contractSuiteVersion}, got ${suiteVersion ?? "<missing>"}`));
  }

  const rows = parseManifestRows(manifestText);
  const expectedKeys = Object.keys(canonical.contractComponentRevisions);
  if (rows.length !== expectedKeys.length) {
    violations.push(violation("MANIFEST_COMPONENT_COUNT", MANIFEST_PATH, `expected ${expectedKeys.length} active components, got ${rows.length}`));
  }

  const seenKeys = new Set();
  const components = [];
  const activeTexts = [manifestText];
  for (const row of rows) {
    const key = componentKeyForPath(row.path);
    if (!key || !(key in canonical.contractComponentRevisions)) {
      violations.push(violation("MANIFEST_UNKNOWN_COMPONENT", MANIFEST_PATH, `${row.path} has no canonical component identity`));
      continue;
    }
    if (seenKeys.has(key)) violations.push(violation("MANIFEST_DUPLICATE_COMPONENT", MANIFEST_PATH, `${key} appears more than once`));
    seenKeys.add(key);
    const expectedRevision = canonical.contractComponentRevisions[key];
    if (row.revision !== expectedRevision) {
      violations.push(violation("MANIFEST_COMPONENT_REVISION_DRIFT", MANIFEST_PATH, `${key} expected ${expectedRevision}, got ${row.revision}`));
    }
    const absolute = resolve(rootDir, row.path);
    if (!existsSync(absolute)) {
      violations.push(violation("MANIFEST_COMPONENT_MISSING", row.path, "listed normative component does not exist"));
      continue;
    }
    const content = await readFile(absolute, "utf8");
    activeTexts.push(content);
    const headerRevision = componentHeaderRevision(content);
    if (headerRevision !== expectedRevision) {
      violations.push(violation("MANIFEST_COMPONENT_HEADER_DRIFT", row.path, `expected internal revision ${expectedRevision}, got ${headerRevision ?? "<missing>"}`));
    }
    const footerRevision = componentFooterRevision(content);
    if (footerRevision !== expectedRevision) {
      violations.push(violation("MANIFEST_COMPONENT_FOOTER_DRIFT", row.path, `expected END marker revision ${expectedRevision}, got ${footerRevision ?? "<missing>"}`));
    }
    components.push({ index: row.index, key, path: row.path, revision: row.revision });
  }

  for (const key of expectedKeys) {
    if (!seenKeys.has(key)) violations.push(violation("MANIFEST_CANONICAL_COMPONENT_MISSING", MANIFEST_PATH, `${key} is absent from the active manifest`));
  }

  const releaseRow = components.find((item) => item.key === "releaseProfile");
  if (releaseRow?.revision !== canonical.releaseProfileVersion) {
    violations.push(violation("MANIFEST_RELEASE_PROFILE_VERSION", MANIFEST_PATH, `release profile must be ${canonical.releaseProfileVersion}`));
  }

  for (const path of ["AGENTS.md", "README.md"]) {
    if (existsSync(resolve(rootDir, path))) activeTexts.push(await readFile(resolve(rootDir, path), "utf8"));
  }
  if (activeTexts.some((text) => /docs\/(?:adr|decisions)\b|ADR-\d{2,}/i.test(text))) {
    violations.push(violation("MANIFEST_ADR_AUTHORITY_REFERENCE", MANIFEST_PATH, "active authority files must not cite ADR/decision-record source paths or identifiers"));
  }

  const referencePath = MATRIX_REFERENCE_PATH;
  const referenceAbsolute = resolve(rootDir, referencePath);
  if (existsSync(referenceAbsolute)) {
    const reference = await readFile(referenceAbsolute, "utf8");
    if (!reference.includes(`**Contract suite:** JARVIS v${canonical.contractSuiteVersion}`)) {
      violations.push(violation("MANIFEST_REFERENCE_SUITE_DRIFT", referencePath, `reference matrix must identify suite ${canonical.contractSuiteVersion}`));
    }
    const requiredReferencePaths = [
      `docs/JARVIS-CONTRACT-MANIFEST-v${canonical.contractSuiteVersion}.md`,
      "docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md",
      "docs/implementation/JARVIS-01-RUNTIME-PLATFORM-PROTOCOL-CONTRACT.md",
      "docs/implementation/JARVIS-02-DATA-STATE-BACKUP-CONTRACT.md",
      "docs/implementation/JARVIS-03-SECURITY-TRUST-CONTRACT.md",
      "docs/implementation/JARVIS-04-OPERATIONS-INTEGRATIONS-UX-CONTRACT.md",
      "docs/implementation/JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md",
    ];
    if (requiredReferencePaths.some((requiredPath) => !reference.includes(requiredPath))) {
      violations.push(violation("MANIFEST_REFERENCE_PATH_DRIFT", referencePath, "reference matrix must point to the active manifest and all six consolidated components"));
    }
    if (!reference.includes("Current status and execution authority exist only in `docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md`")) {
      violations.push(violation("MANIFEST_REFERENCE_ROLE_DRIFT", referencePath, "reference matrix must deny current status authority"));
    }
  }

  const matrixAbsolute = resolve(rootDir, MATRIX_PATH);
  const planAbsolute = resolve(rootDir, IMPLEMENTATION_PLAN_PATH);
  if (existsSync(matrixAbsolute) && existsSync(referenceAbsolute) && existsSync(planAbsolute)) {
    const [matrix, reference, plan] = await Promise.all([
      readFile(matrixAbsolute, "utf8"),
      readFile(referenceAbsolute, "utf8"),
      readFile(planAbsolute, "utf8"),
    ]);
    violations.push(...validateMatrixTraceabilityTexts(canonical, activeTexts, matrix, reference, plan));
  }

  return { canonical, components: components.sort((a, b) => a.index - b.index), violations };
}

export async function renderGeneratedArtifacts(rootDir) {
  const { raw, values, sha256 } = await readCanonical(rootDir);
  const json = stablePretty({
    _generated: {
      schemaVersion: 1,
      doNotEdit: true,
      source: CANONICAL_VALUES_PATH,
      sourceSha256: sha256,
      canonicalValuesId: values.canonicalValuesId,
    },
    values,
  });
  const tsValue = JSON.stringify(values, null, 2);
  const ts = `// GENERATED FILE — DO NOT EDIT.\n// Source: ${CANONICAL_VALUES_PATH}\n// Source SHA-256: ${sha256}\n\nexport const JARVIS_CANONICAL_CONTRACT_VALUES = ${tsValue} as const;\n\nexport type JarvisCanonicalContractValues = typeof JARVIS_CANONICAL_CONTRACT_VALUES;\n`;
  return { json, ts, sourceRaw: raw, sourceSha256: sha256 };
}
