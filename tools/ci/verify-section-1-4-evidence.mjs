import { readFile } from "node:fs/promises";
import { isMain } from "./lib.mjs";

const SCOPES = new Set([
  "SECTION_1_4_WINDOWS_TAURI_SINGLE_INSTANCE_QUALIFICATION",
  "SECTION_1_4_WINDOWS_NATIVE_QUALIFICATION",
]);
const AUTHORITY_KEYS = [
  "type",
  "repository",
  "ref",
  "headRef",
  "workflow",
  "runId",
  "runAttempt",
  "job",
];
const RUNNER_KEYS = ["os", "arch", "image"];
const OBSERVED_KEYS = [
  "checkoutSha",
  "treeSha",
  "remote",
  "checkoutRelationship",
  "worktreeClean",
  "identityError",
];

function fail(message) {
  throw new Error(`Section 1.4 evidence rejected: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, name) {
  if (!isObject(value)) fail(`${name} must be an object`);
  return value;
}

function requireString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${name} must be a non-empty string`);
  }
  return value;
}

function requireNullableString(value, name) {
  if (value !== null && (typeof value !== "string" || value.length === 0)) {
    fail(`${name} must be a non-empty string or null`);
  }
}

function requireExactKeys(value, keys, name) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${name} fields do not match the common evidence schema`);
  }
}

function isSha(value, length) {
  return typeof value === "string" && new RegExp(`^[0-9a-f]{${length}}$`).test(value);
}

function requireSha(value, name, length = 40) {
  if (!isSha(value, length)) fail(`${name} must be a lowercase ${length}-hex digest`);
}

function requireTimestamp(value, name) {
  requireString(value, name);
  if (!Number.isFinite(Date.parse(value))) fail(`${name} must be an ISO timestamp`);
}

function validateCommonIdentity(evidence, { authoritative, expectedCandidateSha }) {
  if (evidence.schemaVersion !== 2) fail("schemaVersion must be 2");
  if (!SCOPES.has(evidence.scope)) fail("scope is not a Section 1.4 evidence scope");

  const mode = requireString(evidence.evidenceMode, "evidenceMode");
  const allowedModes = new Set(["AUTHORITATIVE_GITHUB_ACTIONS", "SUPPORTING_LOCAL"]);
  if (!allowedModes.has(mode)) fail(`unsupported evidenceMode ${mode}`);

  const authority = requireObject(evidence.authority, "authority");
  const runner = requireObject(evidence.runner, "runner");
  const observed = requireObject(evidence.observed, "observed");
  requireExactKeys(authority, AUTHORITY_KEYS, "authority");
  requireExactKeys(runner, RUNNER_KEYS, "runner");
  requireExactKeys(observed, OBSERVED_KEYS, "observed");

  requireSha(evidence.candidateSha, "candidateSha");
  if (expectedCandidateSha !== null && evidence.candidateSha !== expectedCandidateSha) {
    fail(`candidateSha does not match the expected candidate ${expectedCandidateSha}`);
  }
  requireTimestamp(evidence.startedAt, "startedAt");
  requireTimestamp(evidence.finishedAt, "finishedAt");
  if (Date.parse(evidence.finishedAt) < Date.parse(evidence.startedAt)) {
    fail("finishedAt precedes startedAt");
  }
  if (typeof evidence.forcedCleanup !== "boolean") fail("forcedCleanup must be boolean");

  requireNullableString(observed.checkoutSha, "observed.checkoutSha");
  requireNullableString(observed.treeSha, "observed.treeSha");
  requireNullableString(observed.remote, "observed.remote");
  requireString(observed.checkoutRelationship, "observed.checkoutRelationship");
  if (typeof observed.worktreeClean !== "boolean" && observed.worktreeClean !== null) {
    fail("observed.worktreeClean must be boolean or null");
  }
  requireNullableString(observed.identityError, "observed.identityError");

  if (authoritative) {
    if (mode !== "AUTHORITATIVE_GITHUB_ACTIONS") {
      fail("supporting evidence cannot be accepted as authoritative");
    }
    if (authority.type !== "GITHUB_ACTIONS") fail("authoritative authority.type must be GITHUB_ACTIONS");
    for (const key of ["repository", "ref", "workflow", "runId", "runAttempt", "job"]) {
      requireString(authority[key], `authority.${key}`);
    }
    requireNullableString(authority.headRef, "authority.headRef");
    for (const key of ["os", "arch"]) requireString(runner[key], `runner.${key}`);
    requireNullableString(runner.image, "runner.image");
    requireSha(observed.checkoutSha, "observed.checkoutSha");
    requireSha(observed.treeSha, "observed.treeSha", 40);
    requireString(observed.remote, "observed.remote");
    if (observed.worktreeClean !== true) fail("authoritative worktree must be clean");
    if (!["EXACT_CHECKOUT", "PR_HEAD_ANCESTOR_OF_MERGE_CHECKOUT"].includes(observed.checkoutRelationship)) {
      fail("authoritative checkout relationship is not proven");
    }
    if (observed.checkoutRelationship === "EXACT_CHECKOUT" && observed.checkoutSha !== evidence.candidateSha) {
      fail("EXACT_CHECKOUT evidence has a different checkout SHA");
    }
    if (authority.repository.includes("/") === false) fail("authority.repository must be owner/name");
    if (!/^refs\/(heads\/.+|pull\/[0-9]+\/merge)$/.test(authority.ref)) {
      fail("authority.ref is not a supported full Git ref");
    }
    const normalizedRemote = observed.remote.toLowerCase().replace(/\.git$/, "");
    const normalizedRepository = authority.repository.toLowerCase();
    if (!normalizedRemote.endsWith(`/${normalizedRepository}`) && !normalizedRemote.endsWith(`:${normalizedRepository}`)) {
      fail("observed.remote does not identify authority.repository");
    }
  } else {
    if (mode !== "SUPPORTING_LOCAL") fail("non-authoritative validation requires SUPPORTING_LOCAL evidence");
    for (const key of AUTHORITY_KEYS) {
      if (authority[key] !== null) fail(`supporting authority.${key} must be null`);
    }
    if (observed.checkoutSha !== null) requireSha(observed.checkoutSha, "observed.checkoutSha");
    if (observed.treeSha !== null) requireSha(observed.treeSha, "observed.treeSha");
    if (observed.checkoutRelationship !== "SUPPORTING_LOCAL") {
      fail("supporting checkout relationship must be SUPPORTING_LOCAL");
    }
  }

  const expectedStatus = authoritative ? new Set(["PASS", "FAIL"]) : new Set(["SUPPORTING_PASS", "SUPPORTING_FAIL"]);
  if (!expectedStatus.has(evidence.status)) fail(`status ${evidence.status} is inconsistent with evidence authority`);
  if (evidence.status.endsWith("PASS") && evidence.failure !== null) fail("passing evidence cannot contain failure");
  if (evidence.status.endsWith("FAIL")) requireString(evidence.failure, "failure");
}

function validateTauriEvidence(evidence) {
  if (typeof evidence.executableSha256 !== "string" || !/^[0-9a-f]{64}$/.test(evidence.executableSha256)) {
    fail("Tauri evidence must contain an executable SHA-256");
  }
  const second = requireObject(evidence.second, "second");
  if (!Number.isInteger(second.pid) || second.pid < 0) fail("second.pid must be a non-negative process identifier");
  if (evidence.status.endsWith("PASS")) {
    if (second.pid <= 0) fail("passing Tauri evidence requires a second process identifier");
    for (const key of ["ownerInitial", "ownerHidden", "ownerFinal"]) {
      if (!isObject(evidence[key])) fail(`passing Tauri evidence requires ${key}`);
    }
    if (second.exitCode !== 0) fail("passing Tauri evidence requires second.exitCode 0");
    if (evidence.forcedCleanup) fail("passing Tauri evidence cannot require forced cleanup");
  }
}

function validateNativeEvidence(evidence) {
  if (!Number.isInteger(evidence.manifestCount) || evidence.manifestCount <= 0) {
    fail("native evidence must contain a positive manifestCount");
  }
  if (!Array.isArray(evidence.tests)) fail("native evidence tests must be an array");
  if (!Array.isArray(evidence.missingTests) || !Array.isArray(evidence.unexpectedTests)) {
    fail("native evidence missingTests and unexpectedTests must be arrays");
  }
  if (typeof evidence.logSha256 !== "string" || !/^[0-9a-f]{64}$/.test(evidence.logSha256)) {
    fail("native evidence must contain a log SHA-256");
  }
  if (evidence.status.endsWith("PASS")) {
    if (evidence.exitCode !== 0) fail("passing native evidence requires exitCode 0");
    if (evidence.observedCount !== evidence.manifestCount) fail("native evidence observedCount is incomplete");
    if (evidence.tests.length !== evidence.manifestCount) fail("native evidence test records are incomplete");
    if (evidence.missingTests.length !== 0 || evidence.unexpectedTests.length !== 0) {
      fail("passing native evidence cannot omit or add tests");
    }
    if (evidence.manifestError !== null) fail("passing native evidence cannot contain a manifest error");
    for (const test of evidence.tests) {
      if (!isObject(test) || test.result !== "OK" || typeof test.test_id !== "string" || typeof test.criterion !== "string") {
        fail("passing native evidence contains an incomplete test record");
      }
    }
  }
}

export function validateSection14Evidence(evidence, options = {}) {
  const authoritative = options.authoritative === true;
  const expectedCandidateSha = options.expectedCandidateSha ?? null;
  if (expectedCandidateSha !== null) requireSha(expectedCandidateSha, "expectedCandidateSha");
  requireObject(evidence, "evidence");
  validateCommonIdentity(evidence, { authoritative, expectedCandidateSha });
  if (evidence.scope === "SECTION_1_4_WINDOWS_TAURI_SINGLE_INSTANCE_QUALIFICATION") {
    validateTauriEvidence(evidence);
  } else {
    validateNativeEvidence(evidence);
  }
  return Object.freeze({
    scope: evidence.scope,
    status: evidence.status,
    evidenceMode: evidence.evidenceMode,
    candidateSha: evidence.candidateSha,
  });
}

async function main() {
  const [, , evidencePath, ...args] = process.argv;
  if (!evidencePath) throw new Error("usage: verify-section-1-4-evidence.mjs <evidence.json> [--authoritative] [--expected-candidate <sha>]");
  const authoritative = args.includes("--authoritative");
  const expectedIndex = args.indexOf("--expected-candidate");
  const expectedCandidateSha = expectedIndex >= 0 ? args[expectedIndex + 1] : null;
  if (expectedIndex >= 0 && !expectedCandidateSha) throw new Error("--expected-candidate requires a SHA");
  const text = await readFile(evidencePath, "utf8");
  const evidence = JSON.parse(text);
  const result = validateSection14Evidence(evidence, { authoritative, expectedCandidateSha });
  console.log(`[section-1-4-evidence] ${JSON.stringify(result)}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
