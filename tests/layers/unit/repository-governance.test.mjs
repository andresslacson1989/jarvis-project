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
const codes = (value, currentCandidateSha) => validateRepositoryGovernanceProfile(value, workflow, { currentCandidateSha }).map((item) => item.code);
const recordedPredecessorEvidence = clone(profile.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence);

test("checked-in governance profile selects GitHub Actions only", () => {
  assert.deepEqual(codes(profile), []);
  assert.deepEqual(profile.mandatoryCi.eligibleAuthorityTypes, ["GITHUB_ACTIONS"]);
  assert.equal(profile.mandatoryCi.selectedAuthority.type, "GITHUB_ACTIONS");
  assert.match(workflow, /- name: Repository governance\s+env:\s+JARVIS_CANDIDATE_SHA:.*pull_request\.head\.sha[\s\S]*?run: pnpm governance:check/);
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

test("latest recorded evidence is the exact completed d447 predecessor and does not qualify its successor", () => {
  const current = profile.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence;
  assert.equal(current.status, "RECORDED");
  assert.equal(current.recordedCandidateRole, "LATEST_COMPLETED_PREDECESSOR");
  assert.equal(current.doesNotQualifySuccessor, true);
  assert.equal(current.candidateSha, "d447b89c7506281567f5ee2f8771fba91a8bdf1f");
  assert.equal(current.runId, "35184074308");
  assert.deepEqual(current.jobs.map(({ name, jobId }) => ({ name, jobId })), [
    { name: "windows-tauri-build", jobId: "105082244361" },
    { name: "static-ci", jobId: "105083793438" },
  ]);
  assert.deepEqual(current.artifacts.map(({ name, artifactId }) => ({ name, artifactId })), [
    { name: "jarvis-section-1-4-tauri-single-instance-evidence", artifactId: "10481224055" },
    { name: "jarvis-section-1-4-windows-native-evidence", artifactId: "10481019827" },
  ]);
  assert.deepEqual(codes(profile), []);
  assert.ok(codes(profile, current.candidateSha).includes("GOVERNANCE_RECORDED_PREDECESSOR_SELF_REFERENCE"));
  assert.deepEqual(codes(profile, "b".repeat(40)), []);
  assert.ok(codes(profile, "not-a-sha").includes("GOVERNANCE_CURRENT_CANDIDATE_SHA_INVALID"));
});

for (const [name, mutate, expected] of [
  ["LocalCI cannot become eligible", (value) => { value.mandatoryCi.eligibleAuthorityTypes.push("LOCALCI"); }, "GOVERNANCE_CI_AUTHORITY_SET"],
  ["LocalCI cannot become selected", (value) => { value.mandatoryCi.selectedAuthority.type = "LOCALCI"; }, "GOVERNANCE_CI_AUTHORITY_INVALID"],
  ["GitLab must remain mirror-only", (value) => { value.mandatoryCi.gitlabRole = "CI_AUTHORITY"; }, "GOVERNANCE_GITLAB_ROLE"],
  ["LocalCI role cannot gain CI qualification", (value) => { value.mandatoryCi.localCiRole = "QUALIFIED_CI"; }, "GOVERNANCE_LOCALCI_ROLE"],
  ["historical baseline must identify its suite scope", (value) => { value.mandatoryCi.selectedAuthority.authorityCapabilityBaseline.contractSuiteVersion = "1.0.8"; }, "GOVERNANCE_HISTORICAL_BASELINE_SCOPE_INVALID"],
  ["historical candidate SHA must remain immutable", (value) => { value.mandatoryCi.selectedAuthority.authorityCapabilityBaseline.lastObservedRun.candidateSha = "not-a-sha"; }, "GOVERNANCE_HISTORICAL_CANDIDATE_EVIDENCE_INVALID"],
  ["historical master SHA must remain immutable", (value) => { value.mandatoryCi.selectedAuthority.authorityCapabilityBaseline.authoritativeMasterVerification.commitSha = "not-a-sha"; }, "GOVERNANCE_HISTORICAL_MASTER_EVIDENCE_INVALID"],
  ["recorded v1.0.8 predecessor cannot inherit the historical suite", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.contractSuiteVersion = "1.0.7"; }, "GOVERNANCE_RECORDED_PREDECESSOR_EVIDENCE_INVALID"],
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

test("complete RECORDED predecessor evidence is accepted and documented without qualifying the successor", () => {
  assert.deepEqual(codes(profile), []);
  assert.deepEqual(validateRepositoryGovernanceDocumentation(profile, masterProtection), []);

  const missingBoundary = masterProtection.replace(
    "This predecessor record does not qualify the successor documentation commit, the current checkout, integration, Section 1.4, or release.",
    "This predecessor record is retained.",
  );
  assert.ok(validateRepositoryGovernanceDocumentation(profile, missingBoundary).some((item) => item.code === "GOVERNANCE_DOCUMENT_PREDECESSOR_BOUNDARY_MISSING"));

  const stale = masterProtection.replace("A successor is qualified only by its own external exact-head GitHub Actions checks/artifacts and independent audit handoff", "The current v1.0.8 candidate has no exact GitHub Actions run recorded");
  assert.ok(validateRepositoryGovernanceDocumentation(profile, stale).some((item) => item.code === "GOVERNANCE_DOCUMENT_STALE_CURRENT_FACT"));

  const missingRecordedTimestamp = masterProtection.replace(`recordedAt=${recordedPredecessorEvidence.recordedAt}`, "recordedAt=OMITTED");
  assert.ok(validateRepositoryGovernanceDocumentation(profile, missingRecordedTimestamp).some((item) => item.code === "GOVERNANCE_DOCUMENT_CURRENT_FACT_MISSING"));
});

for (const [name, mutate] of [
  ["rejects a missing recorded field", (value) => { delete value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.candidateSha; }],
  ["rejects a malformed candidate SHA", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.candidateSha = "not-a-sha"; }],
  ["rejects a different valid candidate SHA without exact identity rebinding", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.candidateSha = "b".repeat(40); }],
  ["rejects a wrong repository", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.repository = "attacker/example"; }],
  ["rejects a non-full recorded ref", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.ref = "feature"; }],
  ["rejects a mismatched head branch", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.headBranch = "other"; }],
  ["rejects a missing workflow identity", (value) => { delete value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.workflow; }],
  ["rejects a missing run identity", (value) => { delete value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.runId; }],
  ["rejects a wrong run attempt", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.runAttempt = "0"; }],
  ["rejects a missing job identity", (value) => { delete value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.job; }],
  ["rejects reordered required jobs", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.jobs.reverse(); }],
  ["rejects a failed required job", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.jobs[0].terminalResult = "FAILURE"; }],
  ["rejects an invalid timestamp", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.startedAt = "not-a-timestamp"; }],
  ["rejects a non-success terminal result", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.terminalResult = "FAILURE"; }],
  ["rejects missing required-check evidence", (value) => { delete value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.requiredChecksPassed; }],
  ["rejects a predecessor role that claims current authority", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.recordedCandidateRole = "CURRENT_CANDIDATE"; }],
  ["rejects a predecessor record that qualifies its successor", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.doesNotQualifySuccessor = false; }],
  ["rejects a missing evidence identity", (value) => { delete value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.evidenceIdentity; }],
  ["rejects evidence identity not bound to both jobs", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.evidenceIdentity = "github-actions:run-35184074308"; }],
  ["rejects artifact evidence identity not bound to artifacts", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.artifactEvidenceIdentity = "artifact:unrelated"; }],
  ["rejects an invalid artifact digest", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.artifacts[0].digest = "sha256:invalid"; }],
  ["rejects a missing artifact ID", (value) => { delete value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.artifacts[0].artifactId; }],
  ["rejects reversed evidence timestamps", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.finishedAt = "2026-09-17T04:00:00Z"; }],
  ["rejects evidence recorded before completion", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.recordedAt = "2026-09-17T05:10:00Z"; }],
  ["rejects replayed evidence from a different run", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.runId = "999999"; }],
  ["rejects a run ID that is only a substring of the recorded identity", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.runId = "3518407430"; }],
  ["rejects a job ID that is only a substring of the recorded identity", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.jobs[0].jobId = "10508224436"; }],
  ["rejects an artifact ID that is only a substring of the recorded identity", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.artifacts[0].artifactId = "1048122405"; }],
  ["rejects an unknown evidence status", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.status = "PENDING"; }],
  ["rejects unexpected fields in RECORDED state", (value) => { value.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence.unexpected = true; }],
]) {
  test(name, () => {
    const future = clone(profile);
    future.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence = clone(recordedPredecessorEvidence);
    mutate(future);
    assert.ok(codes(future).includes("GOVERNANCE_RECORDED_PREDECESSOR_EVIDENCE_INVALID"));
  });
}

test("missing or legacy ambiguous candidate evidence and weakened blockers fail closed", () => {
  const missing = clone(profile);
  delete missing.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence;
  assert.ok(codes(missing).includes("GOVERNANCE_RECORDED_PREDECESSOR_EVIDENCE_INVALID"));

  const legacy = clone(profile);
  legacy.mandatoryCi.selectedAuthority.currentCandidateEvidence = legacy.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence;
  delete legacy.mandatoryCi.selectedAuthority.latestRecordedCandidateEvidence;
  assert.ok(codes(legacy).includes("GOVERNANCE_LEGACY_CURRENT_CANDIDATE_EVIDENCE"));

  const weakened = clone(profile);
  weakened.mandatoryCi.selectedAuthority.qualificationBlockers = [];
  assert.ok(codes(weakened).includes("GOVERNANCE_QUALIFICATION_BLOCKERS_INVALID"));
});
