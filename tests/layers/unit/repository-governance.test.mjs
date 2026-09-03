import test from "node:test";
import assert from "node:assert/strict";
import {
  validateGovernanceContractTexts,
  validateRepositoryGovernanceProfile,
} from "../../../tools/ci/check-repository-governance.mjs";

const fallbackProfile = Object.freeze({
  schemaVersion: 2,
  governanceMode: "COMPENSATING_CONTROLS",
  provider: "GITHUB",
  repository: "andresslacson1989/jarvis-project",
  authoritativeBranch: "master",
  serverSideProtection: {
    available: false,
    active: false,
    reason: "HOSTING_PLAN_LIMITATION",
    observedHttpStatus: 403,
  },
  mandatoryCi: {
    pipelineIdentity: "static-ci",
    eligibleAuthorityTypes: ["GITHUB_ACTIONS", "LOCALCI"],
    selectedAuthority: {
      type: "LOCALCI",
      instanceIdentity: "CT107",
      pipelineProfile: "smoke",
      repositoryPipeline: ".localci/ci.sh",
      qualificationStatus: "QUALIFIED",
      latestEvidence: {
        jobId: "job-1",
        resolvedCommit: "5b862c6bf6b45becdf7ef0cb56eb903f865e05e2",
        status: "SUCCEEDED",
      },
    },
    commonControls: {
      exactResolvedCommitRequired: true,
      completePipelineRequired: true,
      pinnedFrozenInputs: true,
      leastPrivilegeAuthentication: true,
      isolatedExecution: true,
      controlPlaneSecretsExcluded: true,
      timeoutsCancellationCleanup: true,
      idempotentSubmission: true,
      durableAuditableEvidence: true,
    },
    localCiControls: {
      authenticatedTls: true,
      nonAdministratorApiClient: true,
      repositoryProfileRefAllowlist: true,
      serverSideRevisionResolution: true,
      rootlessJobIsolation: true,
      arbitraryExecutionSurfacesDenied: true,
      controlledUpgradeAndClock: true,
      evidenceRetentionExport: true,
      cancellationRecoveryTested: true,
    },
  },
  controls: {
    temporaryImplementationBranches: true,
    candidateCiRequired: true,
    liveAuthoritativeTipRevalidation: true,
    reconcileUnexpectedMovement: true,
    nonForceIntegrationOnly: true,
    postIntegrationVerification: true,
  },
  residualRisk: "OUT_OF_BAND_ADMIN_FORCE_PUSH_OR_DELETION_NOT_SERVER_BLOCKED",
  serverModeRequiredWhenAvailable: true,
});

function clone(value) {
  return structuredClone(value);
}

function codes(profile, workflow = "jobs:\n  static-ci:\n    name: static-ci\n", localCiScript = "#!/bin/sh\nset -Eeuo pipefail\n") {
  return validateRepositoryGovernanceProfile(profile, workflow, localCiScript).map((item) => item.code);
}

test("0.13 compensating governance profile is accepted only for unavailable server protection", () => {
  assert.deepEqual(codes(clone(fallbackProfile)), []);
});

for (const [name, mutate, expected] of [
  ["available protection cannot select fallback", (p) => { p.serverSideProtection.available = true; }, "GOVERNANCE_FALLBACK_REQUIRES_UNAVAILABLE_PROTECTION"],
  ["fallback cannot claim active server protection", (p) => { p.serverSideProtection.active = true; }, "GOVERNANCE_FALLBACK_CANNOT_CLAIM_ACTIVE_PROTECTION"],
  ["hosting limitation must be explicit", (p) => { p.serverSideProtection.reason = "UNKNOWN"; }, "GOVERNANCE_HOSTING_LIMITATION_REQUIRED"],
  ["observed denial must be recorded", (p) => { p.serverSideProtection.observedHttpStatus = 200; }, "GOVERNANCE_HOSTING_OBSERVATION_REQUIRED"],
  ["candidate CI cannot be disabled", (p) => { p.controls.candidateCiRequired = false; }, "GOVERNANCE_COMPENSATING_CONTROL_DISABLED"],
  ["live-tip revalidation cannot be disabled", (p) => { p.controls.liveAuthoritativeTipRevalidation = false; }, "GOVERNANCE_COMPENSATING_CONTROL_DISABLED"],
  ["stale movement reconciliation cannot be disabled", (p) => { p.controls.reconcileUnexpectedMovement = false; }, "GOVERNANCE_COMPENSATING_CONTROL_DISABLED"],
  ["non-force integration cannot be disabled", (p) => { p.controls.nonForceIntegrationOnly = false; }, "GOVERNANCE_COMPENSATING_CONTROL_DISABLED"],
  ["post-integration verification cannot be disabled", (p) => { p.controls.postIntegrationVerification = false; }, "GOVERNANCE_COMPENSATING_CONTROL_DISABLED"],
  ["residual risk cannot be hidden", (p) => { p.residualRisk = "NONE"; }, "GOVERNANCE_RESIDUAL_RISK_REQUIRED"],
  ["server protection must become mandatory when available", (p) => { p.serverModeRequiredWhenAvailable = false; }, "GOVERNANCE_SERVER_MODE_REENABLE_REQUIRED"],
  ["required CI context cannot drift", (p) => { p.mandatoryCi.pipelineIdentity = "something-else"; }, "GOVERNANCE_REQUIRED_CI_CONTEXT"],
  ["eligible authority set cannot drift", (p) => { p.mandatoryCi.eligibleAuthorityTypes = ["LOCALCI"]; }, "GOVERNANCE_CI_AUTHORITY_SET"],
  ["selected authority must be qualified", (p) => { p.mandatoryCi.selectedAuthority.qualificationStatus = "DEMO"; }, "GOVERNANCE_CI_AUTHORITY_UNQUALIFIED"],
  ["LocalCI exact-SHA evidence is mandatory", (p) => { p.mandatoryCi.selectedAuthority.latestEvidence.resolvedCommit = "bad"; }, "GOVERNANCE_LOCALCI_EVIDENCE_INVALID"],
  ["LocalCI isolation controls cannot be disabled", (p) => { p.mandatoryCi.localCiControls.rootlessJobIsolation = false; }, "GOVERNANCE_LOCALCI_CONTROL_DISABLED"],
]) {
  test(name, () => {
    const profile = clone(fallbackProfile);
    mutate(profile);
    assert.ok(codes(profile).includes(expected));
  });
}

test("workflow must expose the exact static-ci check identity", () => {
  const profile = clone(fallbackProfile);
  profile.mandatoryCi.selectedAuthority = {
    type: "GITHUB_ACTIONS",
    qualificationStatus: "QUALIFIED",
  };
  assert.ok(codes(profile, "jobs:\n  build:\n    name: build\n").includes("GOVERNANCE_CI_WORKFLOW_MISMATCH"));
});

test("qualified LocalCI does not require a GitHub Actions workflow result", () => {
  assert.deepEqual(codes(clone(fallbackProfile), "jobs:\n  build:\n    name: build\n"), []);
});

test("LocalCI repository pipeline must fail closed", () => {
  assert.ok(codes(clone(fallbackProfile), undefined, "#!/bin/sh\necho unsafe\n").includes("GOVERNANCE_LOCALCI_PIPELINE_MISSING"));
});

test("server-enforced mode requires all effective server controls", () => {
  const profile = clone(fallbackProfile);
  profile.governanceMode = "SERVER_ENFORCED";
  profile.serverSideProtection = {
    available: true,
    active: true,
    forcePushBlocked: true,
    deletionBlocked: true,
    administratorsCovered: true,
    strictRequiredChecks: true,
    bypassNarrowAndAuditable: true,
  };
  delete profile.residualRisk;
  assert.deepEqual(codes(profile), []);
  profile.serverSideProtection.forcePushBlocked = false;
  assert.ok(codes(profile).includes("GOVERNANCE_SERVER_CONTROL_MISSING"));
});

test("contract text validation accepts compensating governance with equal qualified CI authorities", () => {
  const implementationContract = `
    When the hosting provider/account does not expose server-side branch protection/rulesets
    because of a plan limitation, normal implementation integration SHALL instead use
    compensating governance and uses non-force integration/ref updates only.
    GITHUB_ACTIONS and LOCALCI are qualified equal alternatives.
  `;
  const verificationContract = `
    If server-side branch protection/rulesets are unavailable, the gate MAY pass in
    COMPENSATING_CONTROLS mode and authoritative integration uses a non-force update only.
    GITHUB_ACTIONS and LOCALCI are qualified equal alternatives.
  `;
  assert.deepEqual(validateGovernanceContractTexts(implementationContract, verificationContract), []);
});

test("contract text validation still fails closed when compensating governance semantics are absent", () => {
  const implementationContract = `
    server-side branch protection is preferred.
    authoritative integration uses non-force updates.
  `;
  const verificationContract = `
    COMPENSATING_CONTROLS remains available when server-side branch protection is unavailable.
    authoritative integration uses non-force updates.
  `;
  const result = validateGovernanceContractTexts(implementationContract, verificationContract);
  assert.ok(result.some((item) => item.code === "GOVERNANCE_CONTRACT_MODE_MISSING"));
});
