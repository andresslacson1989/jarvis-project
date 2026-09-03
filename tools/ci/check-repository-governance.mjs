import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GATES } from "./generate-evidence.mjs";

const EXPECTED_REPOSITORY = "andresslacson1989/jarvis-project";
const EXPECTED_BRANCH = "master";
const EXPECTED_CI = "static-ci";
const ELIGIBLE_CI_AUTHORITIES = Object.freeze(["GITHUB_ACTIONS", "LOCALCI"]);
const REQUIRED_COMMON_CI_CONTROLS = Object.freeze([
  "exactResolvedCommitRequired",
  "completePipelineRequired",
  "pinnedFrozenInputs",
  "leastPrivilegeAuthentication",
  "isolatedExecution",
  "controlPlaneSecretsExcluded",
  "timeoutsCancellationCleanup",
  "idempotentSubmission",
  "durableAuditableEvidence",
]);
const REQUIRED_LOCALCI_CONTROLS = Object.freeze([
  "authenticatedTls",
  "nonAdministratorApiClient",
  "repositoryProfileRefAllowlist",
  "serverSideRevisionResolution",
  "rootlessJobIsolation",
  "arbitraryExecutionSurfacesDenied",
  "controlledUpgradeAndClock",
  "evidenceRetentionExport",
  "cancellationRecoveryTested",
]);
const EXPECTED_RESIDUAL_RISK = "OUT_OF_BAND_ADMIN_FORCE_PUSH_OR_DELETION_NOT_SERVER_BLOCKED";
const REQUIRED_COMPENSATING_CONTROLS = Object.freeze([
  "temporaryImplementationBranches",
  "candidateCiRequired",
  "liveAuthoritativeTipRevalidation",
  "reconcileUnexpectedMovement",
  "nonForceIntegrationOnly",
  "postIntegrationVerification",
]);
const REQUIRED_SERVER_CONTROLS = Object.freeze([
  "forcePushBlocked",
  "deletionBlocked",
  "administratorsCovered",
  "strictRequiredChecks",
  "bypassNarrowAndAuditable",
]);

function violation(code, detail) {
  return Object.freeze({ code, detail });
}

function workflowHasStaticCi(workflowText) {
  return /^\s{2}static-ci:\s*$/m.test(workflowText) && /^\s{4}name:\s*static-ci\s*$/m.test(workflowText);
}

export function validateRepositoryGovernanceProfile(profile, workflowText, localCiScript = "") {
  const violations = [];
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return [violation("GOVERNANCE_PROFILE_INVALID", "profile must be an object")];
  }
  if (profile.schemaVersion !== 3) violations.push(violation("GOVERNANCE_PROFILE_VERSION", "schemaVersion must equal 3"));
  if (profile.provider !== "GITHUB") violations.push(violation("GOVERNANCE_PROVIDER", "provider must be GITHUB"));
  if (profile.repository !== EXPECTED_REPOSITORY) violations.push(violation("GOVERNANCE_REPOSITORY", `repository must be ${EXPECTED_REPOSITORY}`));
  if (profile.authoritativeBranch !== EXPECTED_BRANCH) violations.push(violation("GOVERNANCE_AUTHORITATIVE_BRANCH", `authoritativeBranch must be ${EXPECTED_BRANCH}`));
  const mandatoryCi = profile.mandatoryCi ?? {};
  if (mandatoryCi.pipelineIdentity !== EXPECTED_CI) violations.push(violation("GOVERNANCE_REQUIRED_CI_CONTEXT", `mandatoryCi.pipelineIdentity must be ${EXPECTED_CI}`));
  if (JSON.stringify(mandatoryCi.eligibleAuthorityTypes) !== JSON.stringify(ELIGIBLE_CI_AUTHORITIES)) {
    violations.push(violation("GOVERNANCE_CI_AUTHORITY_SET", "eligibleAuthorityTypes must be exactly GITHUB_ACTIONS and LOCALCI"));
  }
  for (const control of REQUIRED_COMMON_CI_CONTROLS) {
    if (mandatoryCi.commonRequirements?.[control] !== "REQUIRED") violations.push(violation("GOVERNANCE_COMMON_CI_REQUIREMENT_MISSING", `${control} must be REQUIRED`));
  }
  const selected = mandatoryCi.selectedAuthority ?? {};
  if (!ELIGIBLE_CI_AUTHORITIES.includes(selected.type)) violations.push(violation("GOVERNANCE_CI_AUTHORITY_INVALID", "selected authority must be GITHUB_ACTIONS or LOCALCI"));
  if (selected.qualificationStatus !== "QUALIFIED") violations.push(violation("GOVERNANCE_CI_AUTHORITY_UNQUALIFIED", "selected authority must be QUALIFIED"));
  if (selected.type === "GITHUB_ACTIONS" && !workflowHasStaticCi(String(workflowText ?? ""))) {
    violations.push(violation("GOVERNANCE_CI_WORKFLOW_MISMATCH", "selected GitHub Actions workflow must expose job id/name static-ci"));
  }
  if (selected.type === "LOCALCI") {
    if (selected.instanceIdentity !== "CT107" || selected.pipelineProfile !== "tauri2418" || selected.repositoryPipeline !== ".localci/ci.sh") {
      violations.push(violation("GOVERNANCE_LOCALCI_IDENTITY", "selected LocalCI identity/profile/pipeline must match the qualified profile"));
    }
    const localCiText = String(localCiScript);
    if (!localCiText.includes("set -Eeuo pipefail")) violations.push(violation("GOVERNANCE_LOCALCI_PIPELINE_MISSING", "qualified LocalCI repository pipeline must fail closed"));
    const declaredGates = [...localCiText.matchAll(/^run_gate\s+([a-z0-9-]+)\s+/gm)].map((match) => match[1]).filter((gate) => gate !== "static-ci-evidence");
    if (JSON.stringify(declaredGates) !== JSON.stringify(GATES)) {
      violations.push(violation("GOVERNANCE_LOCALCI_PIPELINE_INCOMPLETE", "LocalCI pipeline must declare every mandatory gate exactly once and in canonical order"));
    }
    for (const marker of ["LOCALCI_EXPECTED_COMMIT", "LOCALCI_RESOLVED_COMMIT", "LOCALCI_JOB_ID", "native Windows worker", "JARVIS_CI_GATE_RESULTS_PATH"]) {
      if (!localCiText.includes(marker)) violations.push(violation("GOVERNANCE_LOCALCI_PIPELINE_METADATA_MISSING", `LocalCI pipeline is missing ${marker}`));
    }
    for (const control of REQUIRED_LOCALCI_CONTROLS) {
      if (mandatoryCi.localCiRequirements?.[control] !== "REQUIRED") violations.push(violation("GOVERNANCE_LOCALCI_REQUIREMENT_MISSING", `${control} must be REQUIRED`));
    }
    const evidence = selected.qualificationEvidence ?? {};
    const timestamps = [evidence.queuedAt, evidence.startedAt, evidence.finishedAt];
    const evidenceGates = Array.isArray(evidence.gateResults) ? evidence.gateResults.map((item) => item?.gate) : [];
    if (evidence.authorityType !== "LOCALCI" || evidence.instanceIdentity !== selected.instanceIdentity || evidence.pipelineIdentity !== EXPECTED_CI || !String(evidence.pipelineVersion ?? "") || !String(evidence.requestedRef ?? "").startsWith("refs/") || !/^[0-9a-f]{40}$/.test(String(evidence.expectedCommit ?? "")) || evidence.expectedCommit !== evidence.resolvedCommit || evidence.terminalStatus !== "SUCCEEDED" || !String(evidence.jobId ?? "") || timestamps.some((value) => !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(String(value ?? ""))) || JSON.stringify(evidenceGates) !== JSON.stringify(GATES) || evidence.gateResults?.some((item) => item?.status !== "PASSED") || !/^[0-9a-f]{64}$/.test(String(evidence.logs?.sha256 ?? "")) || !String(evidence.logs?.exportIdentity ?? "") || !/^[0-9a-f]{64}$/.test(String(evidence.artifacts?.indexSha256 ?? "")) || !String(evidence.artifacts?.exportIdentity ?? "") || evidence.cancellationRecovery?.status !== "PASSED" || !String(evidence.cancellationRecovery?.evidenceIdentity ?? "")) {
      violations.push(violation("GOVERNANCE_LOCALCI_EVIDENCE_INVALID", "LocalCI qualification requires successful exact-SHA job evidence"));
    }
  }
  if (profile.serverModeRequiredWhenAvailable !== true) violations.push(violation("GOVERNANCE_SERVER_MODE_REENABLE_REQUIRED", "server mode must become mandatory when hosting capability becomes available"));

  const server = profile.serverSideProtection ?? {};
  if (profile.governanceMode === "COMPENSATING_CONTROLS") {
    if (server.available !== false) violations.push(violation("GOVERNANCE_FALLBACK_REQUIRES_UNAVAILABLE_PROTECTION", "fallback requires verified server-side protection availability=false"));
    if (server.active !== false) violations.push(violation("GOVERNANCE_FALLBACK_CANNOT_CLAIM_ACTIVE_PROTECTION", "fallback must not claim active server protection"));
    if (server.reason !== "HOSTING_PLAN_LIMITATION") violations.push(violation("GOVERNANCE_HOSTING_LIMITATION_REQUIRED", "fallback reason must be HOSTING_PLAN_LIMITATION"));
    if (server.observedHttpStatus !== 403) violations.push(violation("GOVERNANCE_HOSTING_OBSERVATION_REQUIRED", "fallback must preserve the observed HTTP 403 hosting denial"));
    for (const control of REQUIRED_COMPENSATING_CONTROLS) {
      if (profile.controls?.[control] !== true) violations.push(violation("GOVERNANCE_COMPENSATING_CONTROL_DISABLED", `${control} must be true`));
    }
    if (profile.residualRisk !== EXPECTED_RESIDUAL_RISK) violations.push(violation("GOVERNANCE_RESIDUAL_RISK_REQUIRED", "fallback must explicitly preserve the server-side residual risk"));
  } else if (profile.governanceMode === "SERVER_ENFORCED") {
    if (server.available !== true || server.active !== true) violations.push(violation("GOVERNANCE_SERVER_MODE_NOT_ACTIVE", "server mode requires available=true and active=true"));
    for (const control of REQUIRED_SERVER_CONTROLS) {
      if (server[control] !== true) violations.push(violation("GOVERNANCE_SERVER_CONTROL_MISSING", `${control} must be true in SERVER_ENFORCED mode`));
    }
  } else {
    violations.push(violation("GOVERNANCE_MODE_INVALID", "governanceMode must be SERVER_ENFORCED or COMPENSATING_CONTROLS"));
  }

  return violations;
}

export function validateGovernanceContractTexts(implementationContract, verificationContract) {
  const violations = [];
  for (const [name, text] of [["implementation contract", implementationContract], ["verification contract", verificationContract]]) {
    const contractText = String(text);
    const hasCompensatingGovernance =
      contractText.includes("COMPENSATING_CONTROLS") ||
      /\bcompensating (?:governance|mode)\b/i.test(contractText);
    if (!hasCompensatingGovernance) violations.push(violation("GOVERNANCE_CONTRACT_MODE_MISSING", `${name} must define compensating governance semantics`));
    if (!contractText.includes("server-side branch protection") && !contractText.includes("server-side protection")) violations.push(violation("GOVERNANCE_SERVER_REQUIREMENT_MISSING", `${name} must retain server-side protection when available`));
    if (!contractText.includes("non-force")) violations.push(violation("GOVERNANCE_NON_FORCE_REQUIREMENT_MISSING", `${name} must require non-force integration in fallback mode`));
    if (!contractText.includes("GITHUB_ACTIONS") || !contractText.includes("LOCALCI")) violations.push(violation("GOVERNANCE_CI_AUTHORITY_EQUIVALENCE_MISSING", `${name} must define both qualified CI authority types`));
  }
  return violations;
}

async function main() {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const [profileRaw, workflow, implementationContract, verificationContract, localCiScript] = await Promise.all([
    readFile(resolve(root, "docs/implementation/governance/repository-governance-profile.json"), "utf8"),
    readFile(resolve(root, ".github/workflows/static-ci.yml"), "utf8"),
    readFile(resolve(root, "docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.7.md"), "utf8"),
    readFile(resolve(root, "docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md"), "utf8"),
    readFile(resolve(root, ".localci/ci.sh"), "utf8"),
  ]);
  const profile = JSON.parse(profileRaw);
  const violations = [
    ...validateRepositoryGovernanceProfile(profile, workflow, localCiScript),
    ...validateGovernanceContractTexts(implementationContract, verificationContract),
  ];
  if (violations.length > 0) {
    for (const item of violations) console.error(`[repository-governance] ${item.code}: ${item.detail}`);
    process.exit(1);
  }
  console.log(`[repository-governance] PASS mode=${profile.governanceMode} required_ci=${profile.mandatoryCi.pipelineIdentity} authority=${profile.mandatoryCi.selectedAuthority.type}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
