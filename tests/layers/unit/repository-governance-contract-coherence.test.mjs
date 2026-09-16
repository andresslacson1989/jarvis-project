import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

function section(text, startHeading, endHeading) {
  const start = text.indexOf(startHeading);
  assert.notEqual(start, -1, `missing section ${startHeading}`);
  const tail = text.slice(start);
  const end = tail.indexOf(endHeading, startHeading.length);
  assert.notEqual(end, -1, `missing section terminator ${endHeading}`);
  return tail.slice(0, end);
}

function assertGithubOnlyGovernance(text, label) {
  assert.match(text, /server-side (?:branch protection|protection)|ruleset/i, `${label} must retain server protection when available`);
  assert.match(text, /COMPENSATING_CONTROLS/, `${label} must retain the hosting fallback`);
  assert.match(text, /exact candidate/i, `${label} must retain exact-candidate CI`);
  assert.match(text, /live [`']?master[`']? tip/i, `${label} must retain authoritative-tip validation`);
  assert.match(text, /non-force/i, `${label} must retain non-force integration`);
  assert.match(text, /GITHUB_ACTIONS/, `${label} must name GitHub Actions`);
  assert.match(text, /GitLab (?:is )?(?:repository )?mirror-only/i, `${label} must make GitLab mirror-only`);
  assert.match(text, /LocalCI[\s\S]*?(?:cannot|shall not|no result from it can)[\s\S]*?(?:satisfy|substitute)/i, `${label} must make LocalCI non-authoritative`);
  assert.doesNotMatch(text, /equal alternatives|GITHUB_ACTIONS` or `LOCALCI`/i, `${label} must not retain LocalCI equivalence`);
}

test("Release Profile uses GitHub Actions as the sole mandatory CI authority", () => {
  const profile = read("docs/JARVIS-V1-RELEASE-PROFILE.md");
  const canonical = JSON.parse(read("packages/schemas/src/canonical/v1/jarvis-v1.0.8.contract-values.json"));
  assert.match(profile, new RegExp(`\\*\\*Profile Version:\\*\\*\\s*${canonical.releaseProfileVersion.replaceAll(".", "\\.")}\\b`));
  assert.match(profile, new RegExp(`docs/JARVIS-CONTRACT-MANIFEST-v${canonical.contractSuiteVersion.replaceAll(".", "\\.")}\\.md`));
  assertGithubOnlyGovernance(section(profile, "# RP-17 — REPOSITORY GOVERNANCE GATE", "# RP-18 — PRODUCTION-COMPLETE GATE"), "Release Profile §17");
});

test("J00 and J05 reject LocalCI or GitLab as CI authority", () => {
  const j00 = read("docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md");
  const j05 = read("docs/implementation/JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md");
  assertGithubOnlyGovernance(section(j00, "## J00-CODE-28 — STATIC / CI GATES", "## J00-CODE-29 — DEPENDENCIES AND THIRD-PARTY ASSETS"), "J00-CODE-28");
  assertGithubOnlyGovernance(section(j05, "## J05-VER-33 — REPOSITORY / CI GOVERNANCE QUALIFICATION", "## J05-VER-34 — SOAK / STABILITY"), "J05-VER-33");
});
