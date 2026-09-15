import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateGovernanceContractTexts,
  validateRepositoryGovernanceDocumentation,
  validateRepositoryGovernanceProfile,
} from "../../../tools/ci/check-repository-governance.mjs";

const profile = JSON.parse(readFileSync(new URL("../../../docs/implementation/governance/repository-governance-profile.json", import.meta.url), "utf8"));
const workflow = readFileSync(new URL("../../../.github/workflows/static-ci.yml", import.meta.url), "utf8");
const masterProtection = readFileSync(new URL("../../../docs/implementation/governance/MASTER-PROTECTION.md", import.meta.url), "utf8");
const clone = (value) => JSON.parse(JSON.stringify(value));
const codes = (value) => validateRepositoryGovernanceProfile(value, workflow).map((item) => item.code);
const recordedCandidateEvidence = {
  contractSuiteVersion: "1.0.8",
  status: "RECORDED",
  candidateSha: "a".repeat(40),
  repository: "andresslacson1989/jarvis-project",
  ref: "refs/pull/99/merge",
  workflow: ".github/workflows/static-ci.yml",
  job: "static-ci",
  runId: "123456",
  runAttempt: "1",
  startedAt: "2026-09-15T06:00:00Z",
  finishedAt: "2026-09-15T06:10:00Z",
  recordedAt: "2026-09-15T06:11:00Z",
  terminalResult: "SUCCESS",
  requiredChecksPassed: true,
  evidenceIdentity: "github-actions:repository=andresslacson1989/jarvis-project:ref=refs/pull/99/merge:workflow=.github/workflows/static-ci.yml:job=static-ci:runId=123456:runAttempt=1:sha-" + "a".repeat(40),
  artifactEvidenceIdentity: "github-actions-evidence:repository=andresslacson1989/jarvis-project:ref=refs/pull/99/merge:workflow=.github/workflows/static-ci.yml:job=static-ci:runId=123456:runAttempt=1:sha-" + "a".repeat(40),
};

test("checked-in governance profile selects GitHub Actions only", () => {
  assert.deepEqual(codes(profile), []);
  assert.deepEqual(profile.mandatoryCi.eligibleAuthorityTypes, ["GITHUB_ACTIONS"]);
  assert.equal(profile.mandatoryCi.selectedAuthority.type, "GITHUB_ACTIONS");
});

test("current governance profile records the authenticated server-enforced GitHub facts", () => {
  assert.equal(profile.governanceMode, "SERVER_ENFORCED");
  assert.equal(profile.repositoryVisibility, "PUBLIC");
  assert.equal(profile.serverSideProtection.requiredApprovingReviews, 1);
  assert.equal(profile.serverSideProtection.enforceAdministrators, true);
  assert.equal(profile.serverSideProtection.allowForcePushes, false);
  assert.equal(profile.serverSideProtection.allowDeletions, false);
  assert.equal(profile.serverSideProtection.requiredConversationResolution, true);
  assert.equal(profile.serverSideProtection.observation.source, "AUTHENTICATED_GITHUB_API");
  assert.deepEqual(validateRepositoryGovernanceDocumentation(profile, masterProtection), []);
});

test("current candidate evidence is exactly the approved NOT_RECORDED state", () => {
  const current = profile.mandatoryCi.selectedAuthority.currentCandidateEvidence;
  assert.deepEqual(current, {
    contractSuiteVersion: "1.0.8",
    status: "NOT_RECORDED",
    reason: "EXACT_GITHUB_ACTIONS_RUN_NOT_RECORDED",
  });
  assert.deepEqual(codes(profile), []);
});

for (const [name, mutate, expected] of [
  ["LocalCI cannot become eligible", (value) => { value.mandatoryCi.eligibleAuthorityTypes.push("LOCALCI"); }, "GOVERNANCE_CI_AUTHORITY_SET"],
  ["LocalCI cannot become selected", (value) => { value.mandatoryCi.selectedAuthority.type = "LOCALCI"; }, "GOVERNANCE_CI_AUTHORITY_INVALID"],
  ["GitLab must remain mirror-only", (value) => { value.mandatoryCi.gitlabRole = "CI_AUTHORITY"; }, "GOVERNANCE_GITLAB_ROLE"],
  ["LocalCI role cannot gain CI qualification", (value) => { value.mandatoryCi.localCiRole = "QUALIFIED_CI"; }, "GOVERNANCE_LOCALCI_ROLE"],
  ["historical baseline must identify its suite scope", (value) => { value.mandatoryCi.selectedAuthority.authorityCapabilityBaseline.contractSuiteVersion = "1.0.8"; }, "GOVERNANCE_HISTORICAL_BASELINE_SCOPE_INVALID"],
  ["historical candidate SHA must remain immutable", (value) => { value.mandatoryCi.selectedAuthority.authorityCapabilityBaseline.lastObservedRun.candidateSha = "not-a-sha"; }, "GOVERNANCE_HISTORICAL_CANDIDATE_EVIDENCE_INVALID"],
  ["historical master SHA must remain immutable", (value) => { value.mandatoryCi.selectedAuthority.authorityCapabilityBaseline.authoritativeMasterVerification.commitSha = "not-a-sha"; }, "GOVERNANCE_HISTORICAL_MASTER_EVIDENCE_INVALID"],
  ["current v1.0.8 evidence cannot inherit the historical suite", (value) => { value.mandatoryCi.selectedAuthority.currentCandidateEvidence.contractSuiteVersion = "1.0.7"; }, "GOVERNANCE_CURRENT_CANDIDATE_EVIDENCE_INVALID"],
  ["server governance requires the observed public repository", (value) => { value.repositoryVisibility = "PRIVATE"; }, "GOVERNANCE_REPOSITORY_VISIBILITY"],
  ["server protection cannot become unavailable in current mode", (value) => { value.serverSideProtection.active = false; }, "GOVERNANCE_SERVER_PROTECTION_STATE"],
  ["server protection must keep strict static-ci checks", (value) => { value.serverSideProtection.requiredStatusChecks.strict = false; }, "GOVERNANCE_SERVER_REQUIRED_CHECKS"],
  ["server protection must keep one approving review", (value) => { value.serverSideProtection.requiredApprovingReviews = 0; }, "GOVERNANCE_SERVER_REQUIRED_REVIEW"],
  ["server protection must cover administrators", (value) => { value.serverSideProtection.enforceAdministrators = false; }, "GOVERNANCE_SERVER_ADMIN_ENFORCEMENT"],
  ["server protection must block force pushes", (value) => { value.serverSideProtection.allowForcePushes = true; }, "GOVERNANCE_SERVER_FORCE_PUSH"],
  ["server protection must block deletions", (value) => { value.serverSideProtection.allowDeletions = true; }, "GOVERNANCE_SERVER_DELETION"],
  ["server protection must require conversation resolution", (value) => { value.serverSideProtection.requiredConversationResolution = false; }, "GOVERNANCE_SERVER_CONVERSATION_RESOLUTION"],
  ["server observation identity must remain exact", (value) => { value.serverSideProtection.observation.evidenceIdentity = "github-api:changed"; }, "GOVERNANCE_SERVER_OBSERVATION_INVALID"],
  ["server observation repository identity must remain exact", (value) => { value.serverSideProtection.observation.repositoryId = 1; }, "GOVERNANCE_SERVER_OBSERVATION_INVALID"],
  ["server observation protected ref must remain exact", (value) => { value.serverSideProtection.observation.ref = "refs/heads/feature"; }, "GOVERNANCE_SERVER_OBSERVATION_INVALID"],
  ["server observation timestamp must be explicit", (value) => { value.serverSideProtection.observation.observedAt = "stale"; }, "GOVERNANCE_SERVER_OBSERVATION_INVALID"],
  ["fallback controls cannot remain current after transition", (value) => { value.controls = { nonForceIntegrationOnly: true }; }, "GOVERNANCE_STALE_CURRENT_CONTROLS"],
  ["historical fallback transition must remain labeled", (value) => { value.historicalTransition.notCurrent = false; }, "GOVERNANCE_HISTORICAL_TRANSITION_INVALID"],
]) {
  test(name, () => assert.ok(codes((() => { const value = clone(profile); mutate(value); return value; })()).includes(expected)));
}

test("contract text rejects residual LocalCI equivalence", () => {
  const implementation = "COMPENSATING_CONTROLS server-side branch protection non-force GITHUB_ACTIONS and LOCALCI are equal alternatives.";
  const verification = "COMPENSATING_CONTROLS server-side protection non-force GITHUB_ACTIONS and LOCALCI are equal alternatives.";
  assert.ok(validateGovernanceContractTexts(implementation, verification).some((item) => item.code === "GOVERNANCE_LOCALCI_EQUIVALENCE"));
});

test("governance documentation rejects stale fallback facts in its current section", () => {
  const stale = masterProtection.replace("SERVER_ENFORCED", "COMPENSATING_CONTROLS");
  assert.ok(validateRepositoryGovernanceDocumentation(profile, stale).some((item) => item.code === "GOVERNANCE_DOCUMENT_STALE_CURRENT_FACT"));
  assert.ok(validateRepositoryGovernanceDocumentation(profile, masterProtection.replace("## Historical transition — non-current", "## Historical transition")).some((item) => item.code === "GOVERNANCE_DOCUMENT_HISTORY_BOUNDARY_MISSING"));
});

test("complete RECORDED candidate evidence is accepted and documented as current", () => {
  const future = clone(profile);
  future.mandatoryCi.selectedAuthority.currentCandidateEvidence = recordedCandidateEvidence;
  const recordedDocumentation = masterProtection.replace(
    "The current v1.0.8 candidate has no exact GitHub Actions run recorded under its immutable candidate SHA. `EXACT_GITHUB_ACTIONS_RUN_NOT_RECORDED` remains the truthful candidate-evidence state; this operational profile does not promote local checks or historical runs into current CI qualification.",
    `The current v1.0.8 candidate evidence is RECORDED: candidateSha=${recordedCandidateEvidence.candidateSha} repository=${recordedCandidateEvidence.repository} ref=${recordedCandidateEvidence.ref} workflow=${recordedCandidateEvidence.workflow} job=${recordedCandidateEvidence.job} runId=${recordedCandidateEvidence.runId} runAttempt=${recordedCandidateEvidence.runAttempt} evidenceIdentity=${recordedCandidateEvidence.evidenceIdentity} artifactEvidenceIdentity=${recordedCandidateEvidence.artifactEvidenceIdentity}.`,
  );
  assert.deepEqual(codes(future), []);
  assert.deepEqual(validateRepositoryGovernanceDocumentation(future, recordedDocumentation), []);
});

for (const [name, mutate] of [
  ["rejects a missing recorded field", (value) => { delete value.mandatoryCi.selectedAuthority.currentCandidateEvidence.candidateSha; }],
  ["rejects a mismatched candidate SHA", (value) => { value.mandatoryCi.selectedAuthority.currentCandidateEvidence.candidateSha = "b".repeat(40); }],
  ["rejects a wrong repository", (value) => { value.mandatoryCi.selectedAuthority.currentCandidateEvidence.repository = "attacker/example"; }],
  ["rejects a non-full recorded ref", (value) => { value.mandatoryCi.selectedAuthority.currentCandidateEvidence.ref = "feature"; }],
  ["rejects a missing workflow identity", (value) => { delete value.mandatoryCi.selectedAuthority.currentCandidateEvidence.workflow; }],
  ["rejects a missing run identity", (value) => { delete value.mandatoryCi.selectedAuthority.currentCandidateEvidence.runId; }],
  ["rejects a missing job identity", (value) => { delete value.mandatoryCi.selectedAuthority.currentCandidateEvidence.job; }],
  ["rejects an invalid timestamp", (value) => { value.mandatoryCi.selectedAuthority.currentCandidateEvidence.startedAt = "not-a-timestamp"; }],
  ["rejects a non-success terminal result", (value) => { value.mandatoryCi.selectedAuthority.currentCandidateEvidence.terminalResult = "FAILURE"; }],
  ["rejects missing required-check evidence", (value) => { delete value.mandatoryCi.selectedAuthority.currentCandidateEvidence.requiredChecksPassed; }],
  ["rejects a missing evidence identity", (value) => { delete value.mandatoryCi.selectedAuthority.currentCandidateEvidence.evidenceIdentity; }],
  ["rejects evidence identity not bound to the candidate", (value) => { value.mandatoryCi.selectedAuthority.currentCandidateEvidence.evidenceIdentity = "github-actions:run-123456"; }],
  ["rejects artifact evidence identity not bound to the candidate", (value) => { value.mandatoryCi.selectedAuthority.currentCandidateEvidence.artifactEvidenceIdentity = "artifact:unrelated"; }],
  ["rejects a retained NOT_RECORDED reason", (value) => { value.mandatoryCi.selectedAuthority.currentCandidateEvidence.reason = "EXACT_GITHUB_ACTIONS_RUN_NOT_RECORDED"; }],
  ["rejects reversed evidence timestamps", (value) => { value.mandatoryCi.selectedAuthority.currentCandidateEvidence.finishedAt = "2026-09-15T05:00:00Z"; }],
  ["rejects evidence recorded before completion", (value) => { value.mandatoryCi.selectedAuthority.currentCandidateEvidence.recordedAt = "2026-09-15T06:05:00Z"; }],
  ["rejects replayed evidence from a different run", (value) => { value.mandatoryCi.selectedAuthority.currentCandidateEvidence.runId = "999999"; }],
  ["rejects an unknown evidence status", (value) => { value.mandatoryCi.selectedAuthority.currentCandidateEvidence.status = "PENDING"; }],
  ["rejects unexpected fields in RECORDED state", (value) => { value.mandatoryCi.selectedAuthority.currentCandidateEvidence.unexpected = true; }],
]) {
  test(name, () => {
    const future = clone(profile);
    future.mandatoryCi.selectedAuthority.currentCandidateEvidence = clone(recordedCandidateEvidence);
    mutate(future);
    assert.ok(codes(future).includes("GOVERNANCE_CURRENT_CANDIDATE_EVIDENCE_INVALID"));
  });
}

test("incomplete NOT_RECORDED candidate evidence fails closed", () => {
  const incomplete = clone(profile);
  incomplete.mandatoryCi.selectedAuthority.currentCandidateEvidence.reason = "not yet verified";
  assert.ok(codes(incomplete).includes("GOVERNANCE_CURRENT_CANDIDATE_EVIDENCE_INVALID"));

  const unexpected = clone(profile);
  unexpected.mandatoryCi.selectedAuthority.currentCandidateEvidence.unexpected = true;
  assert.ok(codes(unexpected).includes("GOVERNANCE_CURRENT_CANDIDATE_EVIDENCE_INVALID"));

  const contradictory = clone(profile);
  contradictory.mandatoryCi.selectedAuthority.currentCandidateEvidence.candidateSha = "a".repeat(40);
  assert.ok(codes(contradictory).includes("GOVERNANCE_CURRENT_CANDIDATE_EVIDENCE_INVALID"));
});
