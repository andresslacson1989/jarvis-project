import test from "node:test";
import assert from "node:assert/strict";
import {
  validateGovernanceContractTexts,
  validateRepositoryGovernanceProfile,
} from "../../../tools/ci/check-repository-governance.mjs";

const fallbackProfile = Object.freeze({
  schemaVersion: 1,
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
  mandatoryCiContext: "local-phase0-checkpoint",
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

function codes(profile, options = { phase0ProfileExists: true, workflowExists: false }) {
  return validateRepositoryGovernanceProfile(profile, options).map((item) => item.code);
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
  ["required CI context cannot drift", (p) => { p.mandatoryCiContext = "something-else"; }, "GOVERNANCE_REQUIRED_CI_CONTEXT"],
]) {
  test(name, () => {
    const profile = clone(fallbackProfile);
    mutate(profile);
    assert.ok(codes(profile).includes(expected));
  });
}

test("local-only governance requires the checkpoint and rejects a workflow", () => {
  assert.ok(codes(clone(fallbackProfile), { phase0ProfileExists: false, workflowExists: false }).includes("GOVERNANCE_LOCAL_CHECKPOINT_MISSING"));
  assert.ok(codes(clone(fallbackProfile), { phase0ProfileExists: true, workflowExists: true }).includes("GOVERNANCE_GITHUB_ACTIONS_DISABLED"));
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

test("contract text validation accepts the v1.0.6 compensating-governance wording without an internal profile token", () => {
  const implementationContract = `
    When the hosting provider/account does not expose server-side branch protection/rulesets
    because of a plan limitation, normal implementation integration SHALL instead use
    compensating governance and uses non-force integration/ref updates only.
  `;
  const verificationContract = `
    If server-side branch protection/rulesets are unavailable, the gate MAY pass in
    COMPENSATING_CONTROLS mode and authoritative integration uses a non-force update only.
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
