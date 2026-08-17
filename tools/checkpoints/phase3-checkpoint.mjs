import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const REQUIRED_ROWS = Object.freeze([
  "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9",
  "3.10", "3.11", "3.12", "3.14", "3.15", "3.16", "3.17", "3.18",
]);

function violation(code, path, detail) {
  return Object.freeze({ code, path, detail });
}

function matrixRowStatus(matrix, id) {
  const escaped = id.replace(".", "\\.");
  const match = String(matrix).match(
    new RegExp(`^\\| ↳ \\*\\*${escaped}\\*\\*[^\\n]*\\| \\*\\*([^*]+)\\*\\* \\|`, "m"),
  );
  return match?.[1] ?? null;
}

function parseArguments(argv) {
  let evidencePath = resolve(ROOT, "target/qualification/evidence-3-18-backup.json");
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--evidence") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--evidence requires a path");
      evidencePath = resolve(value);
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return { evidencePath };
}

export async function validatePhase3Checkpoint({ matrix, evidence }) {
  const violations = [];
  for (const id of REQUIRED_ROWS) {
    if (matrixRowStatus(matrix, id) !== "VERIFIED") {
      violations.push(violation(
        "PHASE3_CHILD_NOT_VERIFIED",
        "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md",
        `${id} must be VERIFIED before the Section 3 checkpoint can pass`,
      ));
    }
  }

  if (matrixRowStatus(matrix, "3.13") !== "DEFERRED") {
    violations.push(violation(
      "PHASE3_OPTIONAL_SLOT_STATUS",
      "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md",
      "3.13 must remain DEFERRED unless the optional passphrase slot is enabled and qualified",
    ));
  }

  if (evidence?.status !== "PASS" || evidence?.artifactQualification !== "PACKAGED_CORE_RUNTIME") {
    violations.push(violation(
      "PHASE3_PACKAGED_EVIDENCE_STATUS",
      "target/qualification/evidence-3-18-backup.json",
      "packaged Core backup qualification must report PASS",
    ));
  }

  const drill = evidence?.restoreDrill;
  for (const [name, value] of Object.entries({
    wrongRecoveryFactorRejected: drill?.wrongRecoveryFactorRejected,
    cleanProfileRestored: drill?.cleanProfileRestored,
    freshDbDekCommitted: drill?.freshDbDekCommitted,
    recoveryMarkerWritten: drill?.recoveryMarkerWritten,
    integrationCredentialsReauthRequired: drill?.integrationCredentialsReauthRequired,
  })) {
    if (value !== true) {
      violations.push(violation(
        "PHASE3_RESTORE_DRILL",
        "target/qualification/evidence-3-18-backup.json",
        `${name} must be true`,
      ));
    }
  }

  if (
    evidence?.recoverySecretFile !== "EXTERNAL_INPUT_NOT_RECORDED" ||
    evidence?.secretExported !== false ||
    drill?.secretExported !== false ||
    (evidence && "stdout" in evidence && evidence.stdout !== "") ||
    (evidence && "stderr" in evidence && evidence.stderr !== "")
  ) {
    violations.push(violation(
      "PHASE3_SECRET_FREE_EVIDENCE",
      "target/qualification/evidence-3-18-backup.json",
      "recovery-secret path/value and diagnostic output must remain excluded from evidence",
    ));
  }

  if (evidence?.tufShape !== "PASS" || typeof evidence?.tufProfile !== "string" || evidence.tufProfile.length === 0) {
    violations.push(violation(
      "PHASE3_TUF_BINDING",
      "target/qualification/evidence-3-18-backup.json",
      "packaged evidence must retain a passing, identified TUF profile",
    ));
  }

  return violations;
}

export async function loadPhase3Snapshot({ root = ROOT, evidencePath } = {}) {
  const read = (path) => readFile(resolve(root, path), "utf8");
  const resolvedEvidence = resolve(evidencePath ?? "target/qualification/evidence-3-18-backup.json");
  if (!existsSync(resolvedEvidence)) throw new Error(`${resolvedEvidence} is missing`);
  return {
    matrix: await read("docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md"),
    evidence: JSON.parse(await readFile(resolvedEvidence, "utf8")),
  };
}

async function main() {
  const { evidencePath } = parseArguments(process.argv.slice(2));
  const violations = await validatePhase3Checkpoint(await loadPhase3Snapshot({ evidencePath }));
  if (violations.length > 0) {
    console.error(JSON.stringify({ checkpoint: "3.CP", status: "FAIL", violations }, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ checkpoint: "3.CP", status: "PASS" }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(`[phase3-checkpoint] FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
