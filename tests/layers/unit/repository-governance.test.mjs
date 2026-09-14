import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateGovernanceContractTexts, validateRepositoryGovernanceProfile } from "../../../tools/ci/check-repository-governance.mjs";

const profile = JSON.parse(readFileSync(new URL("../../../docs/implementation/governance/repository-governance-profile.json", import.meta.url), "utf8"));
const workflow = readFileSync(new URL("../../../.github/workflows/static-ci.yml", import.meta.url), "utf8");
const clone = (value) => JSON.parse(JSON.stringify(value));
const codes = (value) => validateRepositoryGovernanceProfile(value, workflow).map((item) => item.code);

test("checked-in governance profile selects GitHub Actions only", () => {
  assert.deepEqual(codes(profile), []);
  assert.deepEqual(profile.mandatoryCi.eligibleAuthorityTypes, ["GITHUB_ACTIONS"]);
  assert.equal(profile.mandatoryCi.selectedAuthority.type, "GITHUB_ACTIONS");
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
]) {
  test(name, () => assert.ok(codes((() => { const value = clone(profile); mutate(value); return value; })()).includes(expected)));
}

test("contract text rejects residual LocalCI equivalence", () => {
  const implementation = "COMPENSATING_CONTROLS server-side branch protection non-force GITHUB_ACTIONS and LOCALCI are equal alternatives.";
  const verification = "COMPENSATING_CONTROLS server-side protection non-force GITHUB_ACTIONS and LOCALCI are equal alternatives.";
  assert.ok(validateGovernanceContractTexts(implementation, verification).some((item) => item.code === "GOVERNANCE_LOCALCI_EQUIVALENCE"));
});
