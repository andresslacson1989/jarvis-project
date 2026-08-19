import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isMain, printViolations, violation } from "./lib.mjs";

const TARGET = "x86_64-pc-windows-msvc";
const AUDIT_TOOL = Object.freeze({ name: "cargo-audit", version: "0.22.2" });
const ALLOWED_WARNING_KINDS = new Set(["notice", "unmaintained", "unsound", "yanked"]);
const DISPOSITIONS = Object.freeze({
  REVIEWED_WINDOWS_TRANSITIVE_INFORMATIONAL: "REVIEWED_WINDOWS_TRANSITIVE_INFORMATIONAL",
  WINDOWS_TARGET_UNRESOLVED: "WINDOWS_TARGET_UNRESOLVED",
});

function compareAscii(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function warningKey(kind, advisoryId, packageName, packageVersion) {
  return `${kind}|${advisoryId}|${packageName}|${packageVersion}`;
}

function packageKey(name, version) {
  return `${name}@${version}`;
}

function stringValue(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeLiveWarnings(auditReport, violations) {
  const warnings = auditReport?.warnings;
  if (!warnings || typeof warnings !== "object" || Array.isArray(warnings)) {
    violations.push(
      violation("RUSTSEC_WARNINGS_INVALID", "", "cargo-audit JSON must contain a warnings object"),
    );
    return [];
  }

  const records = [];
  const seen = new Set();

  for (const kind of Object.keys(warnings).sort(compareAscii)) {
    if (!ALLOWED_WARNING_KINDS.has(kind)) {
      violations.push(
        violation("RUSTSEC_WARNING_KIND_UNKNOWN", "", `unexpected RustSec warning kind ${kind}`),
      );
      continue;
    }

    const entries = warnings[kind];
    if (!Array.isArray(entries)) {
      violations.push(
        violation("RUSTSEC_WARNINGS_INVALID", "", `RustSec warning kind ${kind} must be an array`),
      );
      continue;
    }

    for (const entry of entries) {
      const advisoryId = stringValue(entry?.advisory?.id);
      const packageName = stringValue(entry?.package?.name);
      const packageVersion = stringValue(entry?.package?.version);
      if (!advisoryId || !packageName || !packageVersion) {
        violations.push(
          violation(
            "RUSTSEC_WARNING_INVALID",
            "",
            `RustSec ${kind} warning must contain advisory.id and package name/version`,
          ),
        );
        continue;
      }
      if (entry.kind !== undefined && entry.kind !== kind) {
        violations.push(
          violation(
            "RUSTSEC_WARNING_KIND_MISMATCH",
            "",
            `${advisoryId} is grouped under ${kind} but reports kind ${entry.kind}`,
          ),
        );
        continue;
      }

      const key = warningKey(kind, advisoryId, packageName, packageVersion);
      if (seen.has(key)) {
        violations.push(
          violation("RUSTSEC_WARNING_DUPLICATE", "", `duplicate RustSec warning ${key}`),
        );
        continue;
      }
      seen.add(key);
      records.push(Object.freeze({ key, kind, advisoryId, packageName, packageVersion }));
    }
  }

  return records.sort((a, b) => compareAscii(a.key, b.key));
}

function validateVulnerabilities(auditReport, violations) {
  const vulnerabilities = auditReport?.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== "object" || Array.isArray(vulnerabilities)) {
    violations.push(
      violation(
        "RUSTSEC_VULNERABILITIES_INVALID",
        "",
        "cargo-audit JSON must contain a vulnerabilities object",
      ),
    );
    return;
  }

  const list = Array.isArray(vulnerabilities.list) ? vulnerabilities.list : null;
  const count = Number.isInteger(vulnerabilities.count) ? vulnerabilities.count : null;
  const found = typeof vulnerabilities.found === "boolean" ? vulnerabilities.found : null;
  if (list === null || count === null || found === null) {
    violations.push(
      violation(
        "RUSTSEC_VULNERABILITIES_INVALID",
        "",
        "vulnerabilities must contain boolean found, integer count, and array list",
      ),
    );
    return;
  }

  if (count !== list.length || found !== (list.length > 0)) {
    violations.push(
      violation(
        "RUSTSEC_VULNERABILITIES_INCONSISTENT",
        "",
        `vulnerability summary is inconsistent: found=${found} count=${count} list=${list.length}`,
      ),
    );
  }

  if (list.length > 0) {
    violations.push(
      violation(
        "RUSTSEC_VULNERABILITY_FOUND",
        "",
        `cargo-audit reported ${list.length} vulnerability finding(s)`,
      ),
    );
  }
}

function resolvedWindowsPackages(cargoMetadata, violations) {
  if (
    !cargoMetadata ||
    typeof cargoMetadata !== "object" ||
    cargoMetadata.version !== 1 ||
    !Array.isArray(cargoMetadata.packages) ||
    !cargoMetadata.resolve ||
    !Array.isArray(cargoMetadata.resolve.nodes)
  ) {
    violations.push(
      violation(
        "RUSTSEC_CARGO_METADATA_INVALID",
        "",
        "Cargo metadata must be format version 1 with packages and resolve.nodes",
      ),
    );
    return new Set();
  }

  const packagesById = new Map();
  for (const pkg of cargoMetadata.packages) {
    const id = stringValue(pkg?.id);
    const name = stringValue(pkg?.name);
    const version = stringValue(pkg?.version);
    if (!id || !name || !version) {
      violations.push(
        violation(
          "RUSTSEC_CARGO_METADATA_INVALID",
          "",
          "every Cargo metadata package must contain id, name, and version",
        ),
      );
      continue;
    }
    packagesById.set(id, { name, version });
  }

  const resolved = new Set();
  for (const node of cargoMetadata.resolve.nodes) {
    const id = stringValue(node?.id);
    if (!id || !packagesById.has(id)) {
      violations.push(
        violation(
          "RUSTSEC_CARGO_METADATA_INVALID",
          "",
          `resolved Cargo node ${id ?? "<missing>"} does not identify a known package`,
        ),
      );
      continue;
    }
    const pkg = packagesById.get(id);
    resolved.add(packageKey(pkg.name, pkg.version));
  }
  return resolved;
}

function normalizeReview(review, violations) {
  if (!review || typeof review !== "object" || Array.isArray(review)) {
    violations.push(
      violation("RUSTSEC_REVIEW_INVALID", "", "RustSec advisory review must be a JSON object"),
    );
    return [];
  }
  if (review.schemaVersion !== 1) {
    violations.push(
      violation(
        "RUSTSEC_REVIEW_SCHEMA",
        "",
        `expected RustSec review schemaVersion 1, got ${review.schemaVersion ?? "<missing>"}`,
      ),
    );
  }
  if (review.target !== TARGET) {
    violations.push(
      violation(
        "RUSTSEC_REVIEW_TARGET",
        "",
        `expected review target ${TARGET}, got ${review.target ?? "<missing>"}`,
      ),
    );
  }
  if (
    review.auditTool?.name !== AUDIT_TOOL.name ||
    review.auditTool?.version !== AUDIT_TOOL.version
  ) {
    violations.push(
      violation(
        "RUSTSEC_REVIEW_TOOL",
        "",
        `expected ${AUDIT_TOOL.name} ${AUDIT_TOOL.version} review identity`,
      ),
    );
  }
  if (!Array.isArray(review.warnings)) {
    violations.push(
      violation("RUSTSEC_REVIEW_INVALID", "", "RustSec review warnings must be an array"),
    );
    return [];
  }

  const records = [];
  const seen = new Set();
  let previousKey = null;

  for (const entry of review.warnings) {
    const kind = stringValue(entry?.kind);
    const advisoryId = stringValue(entry?.advisoryId);
    const packageName = stringValue(entry?.package?.name);
    const packageVersion = stringValue(entry?.package?.version);
    const disposition = stringValue(entry?.disposition);
    const rationale = stringValue(entry?.rationale);
    const windowsResolved =
      typeof entry?.windowsResolved === "boolean" ? entry.windowsResolved : null;

    if (
      !kind ||
      !ALLOWED_WARNING_KINDS.has(kind) ||
      !advisoryId ||
      !packageName ||
      !packageVersion ||
      windowsResolved === null ||
      !disposition ||
      !Object.values(DISPOSITIONS).includes(disposition) ||
      !rationale ||
      rationale.length < 20
    ) {
      violations.push(
        violation(
          "RUSTSEC_REVIEW_ENTRY_INVALID",
          "",
          "each review entry must contain a known kind, advisory/package identity, boolean windowsResolved, supported disposition, and substantive rationale",
        ),
      );
      continue;
    }

    const key = warningKey(kind, advisoryId, packageName, packageVersion);
    if (seen.has(key)) {
      violations.push(
        violation("RUSTSEC_REVIEW_DUPLICATE", "", `duplicate reviewed warning ${key}`),
      );
      continue;
    }
    if (previousKey !== null && compareAscii(previousKey, key) >= 0) {
      violations.push(
        violation(
          "RUSTSEC_REVIEW_ORDER",
          "",
          `review warnings must be strictly ASCII-sorted; ${key} follows ${previousKey}`,
        ),
      );
    }
    previousKey = key;
    seen.add(key);
    records.push(
      Object.freeze({
        key,
        kind,
        advisoryId,
        packageName,
        packageVersion,
        windowsResolved,
        disposition,
        rationale,
      }),
    );
  }

  return records;
}

export function checkRustsecAdvisories({ auditReport, cargoMetadata, review }) {
  const violations = [];
  validateVulnerabilities(auditReport, violations);
  const liveWarnings = normalizeLiveWarnings(auditReport, violations);
  const windowsPackages = resolvedWindowsPackages(cargoMetadata, violations);
  const reviewedWarnings = normalizeReview(review, violations);

  const liveByKey = new Map(liveWarnings.map((entry) => [entry.key, entry]));
  const reviewByKey = new Map(reviewedWarnings.map((entry) => [entry.key, entry]));

  for (const live of liveWarnings) {
    if (!reviewByKey.has(live.key)) {
      violations.push(
        violation(
          "RUSTSEC_WARNING_UNREVIEWED",
          "",
          `live RustSec warning ${live.key} has no checked review disposition`,
        ),
      );
    }
  }
  for (const reviewed of reviewedWarnings) {
    if (!liveByKey.has(reviewed.key)) {
      violations.push(
        violation(
          "RUSTSEC_REVIEW_STALE",
          "",
          `checked RustSec warning ${reviewed.key} is absent from the live advisory result`,
        ),
      );
    }
  }

  let windowsResolvedCount = 0;
  for (const reviewed of reviewedWarnings) {
    if (!liveByKey.has(reviewed.key)) continue;
    const actualResolved = windowsPackages.has(
      packageKey(reviewed.packageName, reviewed.packageVersion),
    );
    if (actualResolved) windowsResolvedCount += 1;

    if (actualResolved !== reviewed.windowsResolved) {
      violations.push(
        violation(
          "RUSTSEC_REACHABILITY_DRIFT",
          "",
          `${reviewed.key} windowsResolved review=${reviewed.windowsResolved} actual=${actualResolved}`,
        ),
      );
      continue;
    }

    if (!actualResolved) {
      if (reviewed.disposition !== DISPOSITIONS.WINDOWS_TARGET_UNRESOLVED) {
        violations.push(
          violation(
            "RUSTSEC_REVIEW_DISPOSITION_INVALID",
            "",
            `${reviewed.key} is outside the Windows target-resolved graph and must use ${DISPOSITIONS.WINDOWS_TARGET_UNRESOLVED}`,
          ),
        );
      }
      continue;
    }

    if (reviewed.kind === "unsound") {
      violations.push(
        violation(
          "RUSTSEC_REACHABLE_UNSOUND",
          "",
          `${reviewed.key} is an unsound advisory in the Windows target-resolved dependency graph`,
        ),
      );
      continue;
    }

    if (reviewed.kind !== "unmaintained") {
      violations.push(
        violation(
          "RUSTSEC_REACHABLE_WARNING_UNSUPPORTED",
          "",
          `${reviewed.key} is a ${reviewed.kind} warning in the Windows target-resolved dependency graph`,
        ),
      );
      continue;
    }

    if (
      reviewed.disposition !==
      DISPOSITIONS.REVIEWED_WINDOWS_TRANSITIVE_INFORMATIONAL
    ) {
      violations.push(
        violation(
          "RUSTSEC_REVIEW_DISPOSITION_INVALID",
          "",
          `${reviewed.key} is Windows target-resolved and must use ${DISPOSITIONS.REVIEWED_WINDOWS_TRANSITIVE_INFORMATIONAL}`,
        ),
      );
    }
  }

  return Object.freeze({
    violations,
    summary: Object.freeze({
      warnings: liveWarnings.length,
      windowsResolved: windowsResolvedCount,
      windowsUnresolved: liveWarnings.length - windowsResolvedCount,
    }),
  });
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

if (isMain(import.meta.url)) {
  const [auditPath, metadataPath, reviewPath] = process.argv.slice(2);
  if (!auditPath || !metadataPath || !reviewPath) {
    console.error(
      "usage: node tools/ci/check-rustsec-advisories.mjs <cargo-audit.json> <cargo-metadata.json> <review.json>",
    );
    process.exitCode = 2;
  } else {
    try {
      const result = checkRustsecAdvisories({
        auditReport: await readJson(auditPath),
        cargoMetadata: await readJson(metadataPath),
        review: await readJson(reviewPath),
      });
      if (result.violations.length > 0) {
        printViolations("rustsec-review", result.violations);
        process.exitCode = 1;
      } else {
        console.log(
          `[rustsec-review] PASS warnings=${result.summary.warnings} windowsResolved=${result.summary.windowsResolved} windowsUnresolved=${result.summary.windowsUnresolved}`,
        );
      }
    } catch (error) {
      console.error(`[rustsec-review] RUSTSEC_REVIEW_EXECUTION_FAILED: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
