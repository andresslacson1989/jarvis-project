import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function section(text, startHeading, endHeading) {
  const start = text.indexOf(startHeading);
  assert.notEqual(start, -1, `missing section ${startHeading}`);
  const tail = text.slice(start);
  const end = tail.indexOf(endHeading, startHeading.length);
  assert.notEqual(end, -1, `missing section terminator ${endHeading}`);
  return tail.slice(0, end);
}

function assertCapabilityAwareGovernance(text, label) {
  assert.match(text, /server-side (?:branch protection|protection)|ruleset/i, `${label} must retain server-side protection when available`);
  assert.match(text, /COMPENSATING_CONTROLS/, `${label} must name the qualified fallback mode`);
  assert.match(text, /hosting (?:plan|provider|account|platform)|plan or platform capability limitation/i, `${label} must bind fallback to verified hosting capability`);
  assert.match(text, /exact candidate/i, `${label} must require exact-candidate CI`);
  assert.match(text, /live [`']?master[`']? tip/i, `${label} must require fresh authoritative-tip validation`);
  assert.match(text, /non-force/i, `${label} must prohibit force integration`);
  assert.match(text, /post-integration/i, `${label} must require post-integration verification`);
  assert.match(text, /not (?:server-)?protected|not protected/i, `${label} must preserve truthful unprotected-branch reporting`);
  assert.match(text, /GITHUB_ACTIONS/, `${label} must name qualified GitHub Actions authority`);
  assert.match(text, /LOCALCI/, `${label} must name qualified LocalCI authority`);
}

test("Release Profile repository-governance gate matches the active hosting-capability-aware rule", () => {
  const profile = read("docs/JARVIS-V1-RELEASE-PROFILE.md");
  const governance = section(profile, "# 17. REPOSITORY GOVERNANCE GATE", "# 18. PRODUCTION-COMPLETE GATE");

  assert.match(profile, /\*\*Profile Version:\*\*\s*1\.0\.7\b/);
  assert.match(profile, /\*\*Governing contract:\*\*\s*`docs\/JARVIS-IMPLEMENTATION-CONTRACT-v1\.0\.7\.md`/);
  assertCapabilityAwareGovernance(governance, "Release Profile §17");
});

test("Coding Standards CI gate matches the active hosting-capability-aware rule", () => {
  const standards = read("docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md");
  const governance = section(standards, "# 28. STATIC / CI GATES", "# 29. DEPENDENCIES AND THIRD-PARTY ASSETS");

  assert.match(standards, /\*\*Normative Appendix to:\*\*\s*`docs\/JARVIS-IMPLEMENTATION-CONTRACT-v1\.0\.7\.md`/);
  assert.match(standards, /\*\*Version:\*\*\s*1\.0\.6\b/);
  assertCapabilityAwareGovernance(governance, "Coding Standards §28");
});
