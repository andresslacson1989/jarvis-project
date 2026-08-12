import test from "node:test";
import assert from "node:assert/strict";
import { validateRepositoryGovernanceProfile } from "../../../tools/ci/check-repository-governance.mjs";

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
  mandatoryCiContext: "static-ci",
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

function codes(profile, workflow = "jobs:\n  static-ci:\n    name: static-ci\n") {
  return validateRepositoryGovernanceProfile(profile, workflow).map((item) => item.code);
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

test("workflow must expose the exact static-ci check identity", () => {
  assert.ok(codes(clone(fallbackProfile), "jobs:\n  build:\n    name: build\n").includes("GOVERNANCE_CI_WORKFLOW_MISMATCH"));
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
