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

for (const [name, mutate, expected] of [
  ["LocalCI cannot become eligible", (value) => { value.mandatoryCi.eligibleAuthorityTypes.push("LOCALCI"); }, "GOVERNANCE_CI_AUTHORITY_SET"],
  ["LocalCI cannot become selected", (value) => { value.mandatoryCi.selectedAuthority.type = "LOCALCI"; }, "GOVERNANCE_CI_AUTHORITY_INVALID"],
  ["GitLab must remain mirror-only", (value) => { value.mandatoryCi.gitlabRole = "CI_AUTHORITY"; }, "GOVERNANCE_GITLAB_ROLE"],
  ["LocalCI role cannot gain CI qualification", (value) => { value.mandatoryCi.localCiRole = "QUALIFIED_CI"; }, "GOVERNANCE_LOCALCI_ROLE"],
  ["historical baseline must identify its suite scope", (value) => { value.mandatoryCi.selectedAuthority.authorityCapabilityBaseline.contractSuiteVersion = "1.0.8"; }, "GOVERNANCE_HISTORICAL_BASELINE_SCOPE_INVALID"],
  ["historical candidate SHA must remain immutable", (value) => { value.mandatoryCi.selectedAuthority.authorityCapabilityBaseline.lastObservedRun.candidateSha = "not-a-sha"; }, "GOVERNANCE_HISTORICAL_CANDIDATE_EVIDENCE_INVALID"],
  ["historical master SHA must remain immutable", (value) => { value.mandatoryCi.selectedAuthority.authorityCapabilityBaseline.authoritativeMasterVerification.commitSha = "not-a-sha"; }, "GOVERNANCE_HISTORICAL_MASTER_EVIDENCE_INVALID"],
  ["current v1.0.8 evidence cannot inherit the historical suite", (value) => { value.mandatoryCi.selectedAuthority.currentCandidateEvidence.contractSuiteVersion = "1.0.7"; }, "GOVERNANCE_CURRENT_CANDIDATE_SCOPE_INVALID"],
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
