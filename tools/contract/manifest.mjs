import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CANONICAL_VALUES_PATH, MANIFEST_PATH, readCanonical, stablePretty, violation } from "./lib.mjs";

const COMPONENT_KEY_BY_FILE = Object.freeze({
  "JARVIS-IMPLEMENTATION-CONTRACT-v1.0.6.md": "implementationContract",
  "JARVIS-V1-RELEASE-PROFILE.md": "releaseProfile",
  "JARVIS-PLATFORM-PORTABILITY-CONTRACT.md": "platformPortability",
  "JARVIS-RUNTIME-CONTRACT.md": "runtime",
  "JARVIS-PROTOCOL-SCHEMA-CONTRACT.md": "protocolSchema",
  "JARVIS-DATA-STATE-CONTRACT.md": "dataState",
  "JARVIS-SECURITY-HARDENING-CONTRACT.md": "securityHardening",
  "JARVIS-BACKUP-CRYPTOGRAPHY-CONTRACT.md": "backupCryptography",
  "JARVIS-PROJECT-POLICY-TRUST-CONTRACT.md": "projectPolicyTrust",
  "JARVIS-SUPPLY-CHAIN-TRUST-CONTRACT.md": "supplyChainTrust",
  "JARVIS-CODING-STANDARDS-CONTRACT.md": "codingStandards",
  "JARVIS-OPERATIONS-UX-GOVERNANCE-CONTRACT.md": "operationsUxGovernance",
  "JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md": "uiIdentityDesignSystem",
  "JARVIS-VERIFICATION-RELEASE-CONTRACT.md": "verificationRelease",
  "JARVIS-IMPLEMENTATION-PLAN.md": "implementationPlan",
});

function basename(path) {
  return path.split("/").at(-1);
}

export function parseManifestRows(text) {
  const rows = [];
  for (const match of text.matchAll(/^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|\s*([0-9]+\.[0-9]+\.[0-9]+)\s*\|/gm)) {
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

export async function validateContractManifest(rootDir) {
  const violations = [];
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
    const headerRevision = componentHeaderRevision(content);
    if (headerRevision !== expectedRevision) {
      violations.push(violation("MANIFEST_COMPONENT_HEADER_DRIFT", row.path, `expected internal revision ${expectedRevision}, got ${headerRevision ?? "<missing>"}`));
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
