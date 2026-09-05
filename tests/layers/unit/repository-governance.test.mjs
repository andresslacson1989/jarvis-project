import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateGovernanceContractTexts,
  validateRepositoryGovernanceProfile,
} from "../../../tools/ci/check-repository-governance.mjs";
import { GATES } from "../../../tools/ci/generate-evidence.mjs";

const qualifiedLocalCiScript = readFileSync(new URL("../../../.localci/ci.sh", import.meta.url), "utf8");

const fallbackProfile = Object.freeze({
  schemaVersion: 3,
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
      pipelineProfile: "tauri2418",
      repositoryPipeline: ".localci/ci.sh",
      qualificationStatus: "QUALIFIED",
      submissionContract: { pipelineProfile: "tauri2418", fullRefRequired: true, requestedCommitOptional: true, idempotencyKeyRequired: true, serverResolutionAttestationRequired: true },
      qualificationEvidence: {
        authority: { type: "LOCALCI", instanceIdentity: "CT107", jobId: "job-1", pipelineIdentity: "static-ci", pipelineVersion: "tauri2418-windows-v1" },
        requestedRevision: { ref: "refs/heads/codex/example", requestedCommit: "5b862c6bf6b45becdf7ef0cb56eb903f865e05e2", expectedCommit: "5b862c6bf6b45becdf7ef0cb56eb903f865e05e2", resolvedCommit: "5b862c6bf6b45becdf7ef0cb56eb903f865e05e2" },
        observedCheckout: { sha: "5b862c6bf6b45becdf7ef0cb56eb903f865e05e2", remote: "https://github.com/andresslacson1989/jarvis-project.git", ref: "refs/heads/codex/example" },
        serverResolution: { repository: "andresslacson1989/jarvis-project", ref: "refs/heads/codex/example", commit: "5b862c6bf6b45becdf7ef0cb56eb903f865e05e2", attestationId: "resolution-1" },
        submission: { pipelineProfile: "tauri2418", idempotencyKey: "manual-test-unique-001" },
        timestamps: { queuedAt: "2026-09-04T00:00:00Z", startedAt: "2026-09-04T00:00:01Z", finishedAt: "2026-09-04T00:01:00Z" },
        gateResults: GATES.map((gate) => ({ gate, status: "PASSED" })),
        runner: { os: "Windows", arch: "X64" },
        terminalStatus: "SUCCEEDED",
        logs: { sha256: "a".repeat(64), exportIdentity: "logs-export-1" },
        artifacts: { indexSha256: "b".repeat(64), exportIdentity: "artifacts-export-1" },
        cancellationRecovery: { status: "PASSED", evidenceIdentity: "cancel-recovery-1" },
      },
    },
    commonRequirements: {
      exactResolvedCommitRequired: "REQUIRED",
      completePipelineRequired: "REQUIRED",
      pinnedFrozenInputs: "REQUIRED",
      leastPrivilegeAuthentication: "REQUIRED",
      isolatedExecution: "REQUIRED",
      controlPlaneSecretsExcluded: "REQUIRED",
      timeoutsCancellationCleanup: "REQUIRED",
      idempotentSubmission: "REQUIRED",
      durableAuditableEvidence: "REQUIRED",
    },
    localCiRequirements: {
      authenticatedTls: "REQUIRED",
      nonAdministratorApiClient: "REQUIRED",
      repositoryProfileRefAllowlist: "REQUIRED",
      serverSideRevisionResolution: "REQUIRED",
      rootlessJobIsolation: "REQUIRED",
      arbitraryExecutionSurfacesDenied: "REQUIRED",
      controlledUpgradeAndClock: "REQUIRED",
      evidenceRetentionExport: "REQUIRED",
      cancellationRecoveryTested: "REQUIRED",
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

function codes(profile, workflow = "jobs:\n  static-ci:\n    name: static-ci\n", localCiScript = qualifiedLocalCiScript) {
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
  ["selected authority status must be valid", (p) => { p.mandatoryCi.selectedAuthority.qualificationStatus = "DEMO"; }, "GOVERNANCE_CI_AUTHORITY_STATUS_INVALID"],
  ["LocalCI exact-SHA evidence is mandatory", (p) => { p.mandatoryCi.selectedAuthority.qualificationEvidence.requestedRevision.resolvedCommit = "bad"; }, "GOVERNANCE_LOCALCI_EVIDENCE_INVALID"],
  ["LocalCI isolation requirements cannot be weakened", (p) => { p.mandatoryCi.localCiRequirements.rootlessJobIsolation = "OPTIONAL"; }, "GOVERNANCE_LOCALCI_REQUIREMENT_MISSING"],
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

test("LocalCI VERIFYING state is accepted only with explicit blockers and is not qualification", () => {
  const profile = clone(fallbackProfile);
  profile.mandatoryCi.selectedAuthority.qualificationStatus = "VERIFYING";
  profile.mandatoryCi.selectedAuthority.lastObservedRun = { jobId: "job-1", status: "SUCCEEDED" };
  profile.mandatoryCi.selectedAuthority.qualificationBlockers = ["WINDOWS_WORKER_REQUIRED"];
  assert.deepEqual(codes(profile), []);
  delete profile.mandatoryCi.selectedAuthority.qualificationBlockers;
  assert.ok(codes(profile).includes("GOVERNANCE_LOCALCI_QUALIFICATION_STATE_INVALID"));
});

test("LocalCI repository pipeline must fail closed", () => {
  assert.ok(codes(clone(fallbackProfile), undefined, "#!/bin/sh\necho unsafe\n").includes("GOVERNANCE_LOCALCI_PIPELINE_MISSING"));
});

test("LocalCI repository pipeline rejects omission of every mandatory gate", () => {
  for (const gate of GATES) {
    const mutated = qualifiedLocalCiScript.replace(new RegExp(`^run_gate ${gate.replaceAll("-", "\\-")} .*$`, "m"), "");
    assert.ok(codes(clone(fallbackProfile), undefined, mutated).includes("GOVERNANCE_LOCALCI_PIPELINE_INCOMPLETE"), `omitting ${gate} must fail closed`);
  }
});

test("LocalCI repository pipeline rejects command or argument weakening", () => {
  for (const mutation of [
    ["pnpm install --frozen-lockfile --ignore-scripts", "true"],
    ["cargo check --locked --workspace --target x86_64-pc-windows-msvc", "cargo check --workspace"],
    ["pnpm --dir apps/desktop tauri build --no-bundle --target x86_64-pc-windows-msvc --ci", "true"],
  ]) {
    const mutated = qualifiedLocalCiScript.replace(mutation[0], mutation[1]);
    assert.ok(codes(clone(fallbackProfile), undefined, mutated).includes("GOVERNANCE_LOCALCI_PIPELINE_COMMAND_MISMATCH"));
  }
});

test("LocalCI worker qualification rejects Linux/WSL spoofing and accepts native Windows", () => {
  const workerScript = readFileSync(new URL("../../../.localci/worker-qualification.sh", import.meta.url), "utf8");
  assert.match(workerScript, /observed_uname/);
  assert.match(workerScript, /attested_os.*Windows/);
  assert.match(workerScript, /attested_arch.*X64/);
  assert.match(workerScript, /MINGW\|MSYS\|CYGWIN/);
  assert.doesNotMatch(workerScript, /Windows_NT:\*\|/);
});

test("LocalCI submission contract cannot omit replay or server-resolution controls", () => {
  const profile = clone(fallbackProfile);
  profile.mandatoryCi.selectedAuthority.submissionContract.idempotencyKeyRequired = false;
  assert.ok(codes(profile).includes("GOVERNANCE_LOCALCI_SUBMISSION_CONTRACT"));
});

test("operational governance documentation cannot claim LocalCI qualification while profile is VERIFYING", () => {
  const document = readFileSync(new URL("../../../docs/implementation/governance/MASTER-PROTECTION.md", import.meta.url), "utf8");
  assert.match(document, /Selected CI authority:\*\* `GITHUB_ACTIONS` \(VERIFYING; exact candidate rerun pending\)/);
  assert.doesNotMatch(document, /Selected CI authority:\*\* `LOCALCI` \(qualified JARVIS repository-CI scope\)/);
  assert.match(document, /v1\.0\.7 exception/);
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
