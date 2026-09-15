import { existsSync } from "node:fs";
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
  return head.match(/\*\*(?:Contract Suite Version|Profile Version|Contract Version|Version):\*\*\s*([0-9]+\.[0-9]+\.[0-9]+)/)?.[1] ?? null;
}

export function componentFooterRevision(text) {
  return [...text.matchAll(/\*\*END[^\n]*v([0-9]+\.[0-9]+\.[0-9]+)\*\*/g)].at(-1)?.[1] ?? null;
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

  const referencePath = "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX-REFERENCE.md";
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
