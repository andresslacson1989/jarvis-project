import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_REPOSITORY = "andresslacson1989/jarvis-project";
const EXPECTED_BRANCH = "master";
const EXPECTED_CI = "static-ci";
const EXPECTED_RESIDUAL_RISK = "OUT_OF_BAND_ADMIN_FORCE_PUSH_OR_DELETION_NOT_SERVER_BLOCKED";
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
const REQUIRED_COMPENSATING_CONTROLS = Object.freeze([
  "temporaryImplementationBranches",
  "candidateCiRequired",
  "liveAuthoritativeTipRevalidation",
  "reconcileUnexpectedMovement",
  "nonForceIntegrationOnly",
  "postIntegrationVerification",
]);

function violation(code, detail) {
  return Object.freeze({ code, detail });
}

function workflowHasStaticCi(workflowText) {
  return /^\s{2}static-ci:\s*$/m.test(workflowText) && /^\s{4}name:\s*static-ci\s*$/m.test(workflowText);
}

export function validateRepositoryGovernanceProfile(profile, workflowText) {
  const violations = [];
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return [violation("GOVERNANCE_PROFILE_INVALID", "profile must be an object")];
  if (profile.schemaVersion !== 4) violations.push(violation("GOVERNANCE_PROFILE_VERSION", "schemaVersion must equal 4"));
  if (profile.provider !== "GITHUB") violations.push(violation("GOVERNANCE_PROVIDER", "provider must be GITHUB"));
  if (profile.repository !== EXPECTED_REPOSITORY) violations.push(violation("GOVERNANCE_REPOSITORY", `repository must be ${EXPECTED_REPOSITORY}`));
  if (profile.authoritativeBranch !== EXPECTED_BRANCH) violations.push(violation("GOVERNANCE_AUTHORITATIVE_BRANCH", `authoritativeBranch must be ${EXPECTED_BRANCH}`));

  const mandatoryCi = profile.mandatoryCi ?? {};
  if (mandatoryCi.pipelineIdentity !== EXPECTED_CI) violations.push(violation("GOVERNANCE_REQUIRED_CI_CONTEXT", `mandatoryCi.pipelineIdentity must be ${EXPECTED_CI}`));
  if (JSON.stringify(mandatoryCi.eligibleAuthorityTypes) !== JSON.stringify(["GITHUB_ACTIONS"])) violations.push(violation("GOVERNANCE_CI_AUTHORITY_SET", "eligibleAuthorityTypes must be exactly GITHUB_ACTIONS"));
  if (mandatoryCi.selectedAuthority?.type !== "GITHUB_ACTIONS") violations.push(violation("GOVERNANCE_CI_AUTHORITY_INVALID", "selected authority must be GITHUB_ACTIONS"));
  if (mandatoryCi.selectedAuthority?.qualificationStatus !== "QUALIFIED_AUTHORITY_CAPABILITY_BASELINE") violations.push(violation("GOVERNANCE_CI_AUTHORITY_STATUS_INVALID", "GitHub Actions authority must distinguish its historical capability baseline from current-candidate evidence"));
  if (!workflowHasStaticCi(String(workflowText ?? ""))) violations.push(violation("GOVERNANCE_CI_WORKFLOW_MISMATCH", "GitHub Actions must expose job id/name static-ci"));
  for (const control of REQUIRED_COMMON_CI_CONTROLS) if (mandatoryCi.commonRequirements?.[control] !== "REQUIRED") violations.push(violation("GOVERNANCE_COMMON_CI_REQUIREMENT_MISSING", `${control} must be REQUIRED`));
  if (mandatoryCi.gitlabRole !== "REPOSITORY_MIRROR_ONLY") violations.push(violation("GOVERNANCE_GITLAB_ROLE", "GitLab must be repository mirror-only"));
  if (mandatoryCi.localCiRole !== "NON_AUTHORITATIVE_COMPATIBILITY_OR_SECURITY_TOOLING" || "localCiRequirements" in mandatoryCi) violations.push(violation("GOVERNANCE_LOCALCI_ROLE", "LocalCI must be non-authoritative tooling without a mandatory-CI qualification profile"));

  const selected = mandatoryCi.selectedAuthority ?? {};
  const baseline = selected.authorityCapabilityBaseline;
  const candidate = selected.currentCandidateEvidence;
  if (!baseline || baseline.status !== "QUALIFIED" || baseline.scope !== "HISTORICAL_AUTHORITY_CAPABILITY_BASELINE" || baseline.contractSuiteVersion !== "1.0.7" || baseline.doesNotQualifyCurrentSuite !== "1.0.8") {
    violations.push(violation("GOVERNANCE_HISTORICAL_BASELINE_SCOPE_INVALID", "GitHub Actions authority baseline must be explicitly historical v1.0.7 capability evidence that cannot qualify v1.0.8"));
  }
  const observed = baseline?.lastObservedRun;
  if (!observed || !/^[0-9a-f]{40}$/.test(String(observed.candidateSha ?? "")) || !/^[0-9]+$/.test(String(observed.runId ?? "")) || observed.status !== "SUCCESS" || observed.workflow !== ".github/workflows/static-ci.yml" || observed.job !== "static-ci") {
    violations.push(violation("GOVERNANCE_HISTORICAL_CANDIDATE_EVIDENCE_INVALID", "historical authority baseline must retain a complete exact candidate run identity"));
  }
  const revision = baseline?.evidenceRevisionValidation;
  if (!revision || !/^[0-9a-f]{40}$/.test(String(revision.commitSha ?? "")) || !/^[0-9]+$/.test(String(revision.runId ?? "")) || revision.status !== "SUCCESS") {
    violations.push(violation("GOVERNANCE_HISTORICAL_EVIDENCE_REVISION_INVALID", "historical authority baseline must retain its evidence-revision validation identity"));
  }
  const authoritative = baseline?.authoritativeMasterVerification;
  if (!authoritative || !/^[0-9a-f]{40}$/.test(String(authoritative.commitSha ?? "")) || !/^[0-9]+$/.test(String(authoritative.runId ?? "")) || authoritative.status !== "SUCCESS" || authoritative.ref !== "refs/heads/master" || !/^[0-9]+$/.test(String(authoritative.windowsJobId ?? "")) || !/^[0-9]+$/.test(String(authoritative.staticCiJobId ?? ""))) {
    violations.push(violation("GOVERNANCE_HISTORICAL_MASTER_EVIDENCE_INVALID", "historical authority baseline must retain its exact-master verification identity"));
  }
  if (!candidate || candidate.contractSuiteVersion !== "1.0.8" || candidate.status !== "NOT_RECORDED" || candidate.reason !== "EXACT_GITHUB_ACTIONS_RUN_NOT_RECORDED") {
    violations.push(violation("GOVERNANCE_CURRENT_CANDIDATE_SCOPE_INVALID", "v1.0.8 candidate evidence must be explicitly not recorded until its immutable candidate SHA has an exact GitHub Actions run"));
  }

  const server = profile.serverSideProtection ?? {};
  if (profile.governanceMode === "COMPENSATING_CONTROLS") {
    if (server.available !== false || server.active !== false || server.reason !== "HOSTING_PLAN_LIMITATION" || server.observedHttpStatus !== 403) violations.push(violation("GOVERNANCE_FALLBACK_REQUIRES_UNAVAILABLE_PROTECTION", "fallback requires the verified unavailable hosting-protection record"));
    for (const control of REQUIRED_COMPENSATING_CONTROLS) if (profile.controls?.[control] !== true) violations.push(violation("GOVERNANCE_COMPENSATING_CONTROL_DISABLED", `${control} must be true`));
    if (profile.residualRisk !== EXPECTED_RESIDUAL_RISK) violations.push(violation("GOVERNANCE_RESIDUAL_RISK_REQUIRED", "fallback must record the server-side residual risk"));
  } else if (profile.governanceMode !== "SERVER_ENFORCED") {
    violations.push(violation("GOVERNANCE_MODE_INVALID", "governanceMode must be SERVER_ENFORCED or COMPENSATING_CONTROLS"));
  }
  if (profile.serverModeRequiredWhenAvailable !== true) violations.push(violation("GOVERNANCE_SERVER_MODE_REENABLE_REQUIRED", "server mode must become mandatory when hosting capability becomes available"));
  return violations;
}

export function validateGovernanceContractTexts(implementationContract, verificationContract) {
  const violations = [];
  for (const [name, text] of [["implementation contract", implementationContract], ["verification contract", verificationContract]]) {
    const contract = String(text);
    if (!contract.includes("COMPENSATING_CONTROLS")) violations.push(violation("GOVERNANCE_CONTRACT_MODE_MISSING", `${name} must define compensating governance semantics`));
    if (!/server-side (?:branch protection|protection)|ruleset/i.test(contract)) violations.push(violation("GOVERNANCE_SERVER_REQUIREMENT_MISSING", `${name} must retain server protection when available`));
    if (!contract.includes("non-force")) violations.push(violation("GOVERNANCE_NON_FORCE_REQUIREMENT_MISSING", `${name} must require non-force integration`));
    if (!contract.includes("GITHUB_ACTIONS") || !/GitLab (?:is )?(?:repository )?mirror-only/i.test(contract) || !/LocalCI[\s\S]*?(?:cannot|shall not|no result from it can)[\s\S]*?(?:satisfy|substitute)/i.test(contract)) violations.push(violation("GOVERNANCE_GITHUB_ONLY_CONTRACT", `${name} must make GitHub Actions sole authority, GitLab mirror-only, and LocalCI non-authoritative`));
    if (/equal alternatives|qualified `LOCALCI` authority|GITHUB_ACTIONS` or `LOCALCI`/i.test(contract)) violations.push(violation("GOVERNANCE_LOCALCI_EQUIVALENCE", `${name} must not retain LocalCI authority equivalence`));
  }
  return violations;
}

async function main() {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const [profileRaw, workflow, implementationContract, verificationContract] = await Promise.all([
    readFile(resolve(root, "docs/implementation/governance/repository-governance-profile.json"), "utf8"),
    readFile(resolve(root, ".github/workflows/static-ci.yml"), "utf8"),
    readFile(resolve(root, "docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md"), "utf8"),
    readFile(resolve(root, "docs/implementation/JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md"), "utf8"),
  ]);
  const profile = JSON.parse(profileRaw);
  const violations = [...validateRepositoryGovernanceProfile(profile, workflow), ...validateGovernanceContractTexts(implementationContract, verificationContract)];
  if (violations.length > 0) {
    for (const item of violations) console.error(`[repository-governance] ${item.code}: ${item.detail}`);
    process.exit(1);
  }
  console.log(`[repository-governance] PASS mode=${profile.governanceMode} required_ci=${profile.mandatoryCi.pipelineIdentity} authority=GITHUB_ACTIONS`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
