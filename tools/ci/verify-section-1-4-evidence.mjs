import { readFileSync } from "node:fs";
import { readFile as readFileAsync } from "node:fs/promises";
import { isMain } from "./lib.mjs";

const AUTHORITY_POLICY = JSON.parse(
  readFileSync(new URL("./section-1-4-authority-policy.json", import.meta.url), "utf8"),
);
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
const TOOLCHAIN_KEYS = ["rust", "cargo", "node", "pnpm"];
const TAURI_PROFILE_KEYS = [
  "executable",
  "feature",
  "dataRoot",
  "startupBoundSeconds",
  "activationBoundSeconds",
  "readinessGraceSeconds",
  "hideBoundSeconds",
];
const NATIVE_PROFILE_KEYS = ["cargoCommand", "features", "target", "testThreads"];
const CLEANUP_KEYS = ["attempted", "succeeded", "error"];
const SNAPSHOT_KEYS = [
  "pid",
  "handle",
  "title",
  "visible",
  "foregroundPid",
  "foregroundOwner",
  "running",
];
const SECOND_KEYS = ["pid", "exitCode"];
const DIAGNOSTICS_KEYS = ["ownerStderr", "secondStderr"];
const TEST_KEYS = ["test_id", "test_name", "criterion", "result"];
const COMMON_TOP_LEVEL_KEYS = [
  "schemaVersion",
  "scope",
  "status",
  "evidenceMode",
  "candidateSha",
  "authority",
  "runner",
  "observed",
  "toolchain",
  "profile",
  "startedAt",
  "finishedAt",
  "failure",
  "forcedCleanup",
];
const TAURI_TOP_LEVEL_KEYS = [
  ...COMMON_TOP_LEVEL_KEYS,
  "executableSha256",
  "cleanup",
  "ownerInitial",
  "ownerHidden",
  "second",
  "ownerFinal",
  "diagnostics",
];
const NATIVE_TOP_LEVEL_KEYS = [
  ...COMMON_TOP_LEVEL_KEYS,
  "exitCode",
  "manifestCount",
  "observedCount",
  "missingTests",
  "unexpectedTests",
  "manifestError",
  "logSha256",
  "tests",
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

function requireNullableText(value, name) {
  if (value !== null && typeof value !== "string") fail(`${name} must be a string or null`);
}

function requireExactKeys(value, keys, name) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${name} fields do not match the strict evidence schema`);
  }
}

function requireInteger(value, name, { minimum = null } = {}) {
  if (!Number.isInteger(value) || (minimum !== null && value < minimum)) {
    fail(`${name} must be an integer${minimum === null ? "" : ` >= ${minimum}`}`);
  }
}

function requireNullableInteger(value, name, { minimum = null } = {}) {
  if (value !== null) requireInteger(value, name, { minimum });
}

function requireArray(value, name) {
  if (!Array.isArray(value)) fail(`${name} must be an array`);
  return value;
}

function requireArrayOfStrings(value, name) {
  requireArray(value, name).forEach((item, index) => requireString(item, `${name}[${index}]`));
}

function isSha(value, length) {
  return typeof value === "string" && new RegExp(`^[0-9a-f]{${length}}$`).test(value);
}

function requireSha(value, name, length = 40) {
  if (!isSha(value, length)) fail(`${name} must be a lowercase ${length}-hex digest`);
}

function requireTimestamp(value, name) {
  requireString(value, name);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)) {
    fail(`${name} must be a strict UTC RFC3339 timestamp`);
  }
  if (!Number.isFinite(Date.parse(value))) fail(`${name} must be a valid UTC timestamp`);
}

function policyRepository() {
  if (AUTHORITY_POLICY.schemaVersion !== 1 || typeof AUTHORITY_POLICY.repository !== "string") {
    fail("authority policy is malformed");
  }
  return AUTHORITY_POLICY.repository;
}

function policyRemoteForms() {
  if (!Array.isArray(AUTHORITY_POLICY.remoteForms) || AUTHORITY_POLICY.remoteForms.length === 0) {
    fail("authority policy remote forms are malformed");
  }
  return AUTHORITY_POLICY.remoteForms;
}

function isValidHeadRef(value) {
  if (typeof value !== "string" || !new RegExp(AUTHORITY_POLICY.headRefPattern).test(value)) return false;
  return !value.includes("..") && !value.includes("//") && !value.includes("@{") &&
    !value.startsWith(".") && !value.endsWith(".") && !value.startsWith("/") && !value.endsWith("/");
}

function isAllowedPushRef(value) {
  if (!Array.isArray(AUTHORITY_POLICY.allowedPushRefs)) return false;
  return AUTHORITY_POLICY.allowedPushRefs.some((allowed) =>
    value === allowed || (allowed.endsWith("/") && value.startsWith(allowed) && isValidHeadRef(value.slice("refs/heads/".length))),
  );
}

function validateAuthorityRef(reference, headRef) {
  if (typeof reference !== "string") fail("authority.ref must be a string");
  const pullPattern = new RegExp(AUTHORITY_POLICY.pullRefPattern);
  if (pullPattern.test(reference)) {
    if (!isValidHeadRef(headRef)) fail("pull-request authority requires a valid non-empty headRef");
    return;
  }
  if (!isAllowedPushRef(reference)) fail("authority.ref is outside the approved push-ref policy");
  if (headRef !== null) fail("push-ref authority.headRef must be null");
}

function validateCleanup(value) {
  const cleanup = requireObject(value, "cleanup");
  requireExactKeys(cleanup, CLEANUP_KEYS, "cleanup");
  if (typeof cleanup.attempted !== "boolean" || typeof cleanup.succeeded !== "boolean") {
    fail("cleanup attempted and succeeded must be boolean");
  }
  requireNullableString(cleanup.error, "cleanup.error");
  if (cleanup.succeeded && (!cleanup.attempted || cleanup.error !== null)) {
    fail("successful cleanup must be attempted and have no error");
  }
  if (cleanup.attempted && !cleanup.succeeded && cleanup.error === null) {
    fail("failed cleanup must retain an error");
  }
}

function validateToolchain(value) {
  const toolchain = requireObject(value, "toolchain");
  requireExactKeys(toolchain, TOOLCHAIN_KEYS, "toolchain");
  for (const key of TOOLCHAIN_KEYS) requireString(toolchain[key], `toolchain.${key}`);
}

function validateProfile(value, scope) {
  const profile = requireObject(value, "profile");
  const keys = scope === "SECTION_1_4_WINDOWS_TAURI_SINGLE_INSTANCE_QUALIFICATION"
    ? TAURI_PROFILE_KEYS
    : NATIVE_PROFILE_KEYS;
  requireExactKeys(profile, keys, "profile");
  if (scope === "SECTION_1_4_WINDOWS_TAURI_SINGLE_INSTANCE_QUALIFICATION") {
    requireString(profile.executable, "profile.executable");
    if (profile.feature !== "test-support") fail("Tauri profile.feature must be test-support");
    requireString(profile.dataRoot, "profile.dataRoot");
    for (const key of ["startupBoundSeconds", "activationBoundSeconds", "readinessGraceSeconds", "hideBoundSeconds"]) {
      requireInteger(profile[key], `profile.${key}`, { minimum: 1 });
    }
  } else {
    requireString(profile.cargoCommand, "profile.cargoCommand");
    requireArrayOfStrings(profile.features, "profile.features");
    if (profile.features.length !== 1 || profile.features[0] !== "test-support") {
      fail("native profile.features must contain only test-support");
    }
    requireString(profile.target, "profile.target");
    requireInteger(profile.testThreads, "profile.testThreads", { minimum: 1 });
  }
}

function parseJsonStringEnd(text, start) {
  if (text[start] !== '"') fail("invalid JSON string");
  let index = start + 1;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code < 0x20) fail("JSON string contains a control character");
    if (text[index] === "\\") {
      index += 2;
      continue;
    }
    if (text[index] === '"') return index + 1;
    index += 1;
  }
  fail("unterminated JSON string");
}

function assertNoDuplicateJsonKeys(text) {
  let index = 0;
  const skipWhitespace = () => {
    while (/\s/.test(text[index] ?? "")) index += 1;
  };
  const parseString = () => {
    const start = index;
    index = parseJsonStringEnd(text, index);
    return JSON.parse(text.slice(start, index));
  };
  const parseValue = () => {
    skipWhitespace();
    const character = text[index];
    if (character === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      while (true) {
        skipWhitespace();
        const key = parseString();
        if (keys.has(key)) fail(`duplicate JSON object key ${key}`);
        keys.add(key);
        skipWhitespace();
        if (text[index] !== ":") fail("JSON object key is missing a colon");
        index += 1;
        parseValue();
        skipWhitespace();
        if (text[index] === "}") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("JSON object is missing a comma");
        index += 1;
      }
    }
    if (character === "[") {
      index += 1;
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      while (true) {
        parseValue();
        skipWhitespace();
        if (text[index] === "]") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("JSON array is missing a comma");
        index += 1;
      }
    }
    if (character === '"') {
      parseString();
      return;
    }
    if (text.startsWith("true", index)) {
      index += 4;
      return;
    }
    if (text.startsWith("false", index)) {
      index += 5;
      return;
    }
    if (text.startsWith("null", index)) {
      index += 4;
      return;
    }
    const number = text.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (number) {
      index += number[0].length;
      return;
    }
    fail("invalid JSON value");
  };

  parseValue();
  skipWhitespace();
  if (index !== text.length) fail("trailing JSON content");
}

function validateSnapshot(value, name) {
  if (value === null) return;
  const snapshot = requireObject(value, name);
  requireExactKeys(snapshot, SNAPSHOT_KEYS, name);
  requireInteger(snapshot.pid, `${name}.pid`, { minimum: 0 });
  requireString(snapshot.handle, `${name}.handle`);
  requireString(snapshot.title, `${name}.title`);
  for (const key of ["visible", "foregroundOwner", "running"]) {
    if (typeof snapshot[key] !== "boolean") fail(`${name}.${key} must be boolean`);
  }
  requireInteger(snapshot.foregroundPid, `${name}.foregroundPid`, { minimum: 0 });
}

function validateCommonIdentity(evidence, { authoritative, expectedCandidateSha }) {
  if (evidence.schemaVersion !== 2) fail("schemaVersion must be 2");
  if (!SCOPES.has(evidence.scope)) fail("scope is not a Section 1.4 evidence scope");
  requireExactKeys(
    evidence,
    evidence.scope === "SECTION_1_4_WINDOWS_TAURI_SINGLE_INSTANCE_QUALIFICATION"
      ? TAURI_TOP_LEVEL_KEYS
      : NATIVE_TOP_LEVEL_KEYS,
    "evidence",
  );

  const mode = requireString(evidence.evidenceMode, "evidenceMode");
  const allowedModes = new Set(["AUTHORITATIVE_GITHUB_ACTIONS", "SUPPORTING_LOCAL"]);
  if (!allowedModes.has(mode)) fail(`unsupported evidenceMode ${mode}`);

  const authority = requireObject(evidence.authority, "authority");
  const runner = requireObject(evidence.runner, "runner");
  const observed = requireObject(evidence.observed, "observed");
  requireExactKeys(authority, AUTHORITY_KEYS, "authority");
  requireExactKeys(runner, RUNNER_KEYS, "runner");
  requireExactKeys(observed, OBSERVED_KEYS, "observed");
  validateToolchain(evidence.toolchain);
  validateProfile(evidence.profile, evidence.scope);

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
  requireNullableString(evidence.failure, "failure");

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
    if (observed.identityError !== null) fail("authoritative evidence cannot contain identityError");
    if (observed.checkoutRelationship === "EXACT_CHECKOUT" && observed.checkoutSha !== evidence.candidateSha) {
      fail("EXACT_CHECKOUT evidence has a different checkout SHA");
    }
    if (!["EXACT_CHECKOUT", "PR_HEAD_ANCESTOR_OF_MERGE_CHECKOUT"].includes(observed.checkoutRelationship)) {
      fail("authoritative checkout relationship is not proven");
    }
    if (authority.repository.toLowerCase() !== policyRepository().toLowerCase()) {
      fail("authority.repository is not the approved repository");
    }
    validateAuthorityRef(authority.ref, authority.headRef);
    if (!policyRemoteForms().some((remote) => remote.toLowerCase() === observed.remote.toLowerCase())) {
      fail("observed.remote is not an approved GitHub remote form");
    }
    if (authority.ref.startsWith("refs/heads/") &&
        (observed.checkoutRelationship !== "EXACT_CHECKOUT" || observed.checkoutSha !== evidence.candidateSha)) {
      fail("push-ref evidence must prove an exact candidate checkout");
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
  validateCleanup(evidence.cleanup);
  if (typeof evidence.executableSha256 !== "string" || !/^[0-9a-f]{64}$/.test(evidence.executableSha256)) {
    fail("Tauri evidence must contain an executable SHA-256");
  }
  for (const key of ["ownerInitial", "ownerHidden", "ownerFinal"]) validateSnapshot(evidence[key], key);
  const second = requireObject(evidence.second, "second");
  requireExactKeys(second, SECOND_KEYS, "second");
  requireInteger(second.pid, "second.pid", { minimum: 0 });
  requireNullableInteger(second.exitCode, "second.exitCode");
  const diagnostics = requireObject(evidence.diagnostics, "diagnostics");
  requireExactKeys(diagnostics, DIAGNOSTICS_KEYS, "diagnostics");
  requireNullableText(diagnostics.ownerStderr, "diagnostics.ownerStderr");
  requireNullableText(diagnostics.secondStderr, "diagnostics.secondStderr");
  if (evidence.status.endsWith("PASS")) {
    if (second.pid <= 0) fail("passing Tauri evidence requires a second process identifier");
    for (const key of ["ownerInitial", "ownerHidden", "ownerFinal"]) {
      if (evidence[key] === null) fail(`passing Tauri evidence requires ${key}`);
    }
    if (second.exitCode !== 0) fail("passing Tauri evidence requires second.exitCode 0");
    if (evidence.forcedCleanup) fail("passing Tauri evidence cannot require forced cleanup");
    if (!evidence.cleanup.succeeded) fail("passing Tauri evidence requires successful cleanup");
  }
}

function validateNativeEvidence(evidence) {
  requireInteger(evidence.exitCode, "exitCode", { minimum: 0 });
  requireInteger(evidence.manifestCount, "manifestCount", { minimum: 1 });
  requireInteger(evidence.observedCount, "observedCount", { minimum: 0 });
  requireArrayOfStrings(evidence.missingTests, "missingTests");
  requireArrayOfStrings(evidence.unexpectedTests, "unexpectedTests");
  requireNullableString(evidence.manifestError, "manifestError");
  requireArray(evidence.tests).forEach((test, index) => {
    const record = requireObject(test, `tests[${index}]`);
    requireExactKeys(record, TEST_KEYS, `tests[${index}]`);
    for (const key of ["test_id", "test_name", "criterion", "result"]) {
      requireString(record[key], `tests[${index}].${key}`);
    }
    if (!["OK", "FAILED", "EXECUTED", "NOT_OBSERVED"].includes(record.result)) {
      fail(`tests[${index}].result is invalid`);
    }
  });
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
      if (test.result !== "OK") fail("passing native evidence contains a non-OK test record");
    }
  }
}

export function parseSection14Evidence(text) {
  if (typeof text !== "string") fail("evidence input must be text");
  assertNoDuplicateJsonKeys(text);
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`invalid JSON: ${error.message}`);
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
  const text = await readFileAsync(evidencePath, "utf8");
  const evidence = parseSection14Evidence(text);
  const result = validateSection14Evidence(evidence, { authoritative, expectedCandidateSha });
  console.log(`[section-1-4-evidence] ${JSON.stringify(result)}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
