import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_REPOSITORY = "andresslacson1989/jarvis-project";
const EXPECTED_REPOSITORY_ID = 1330469646;
const EXPECTED_BRANCH = "master";
const EXPECTED_CI = "static-ci";
const EXPECTED_STATUS_CHECK_APP_ID = 15368;
const EXPECTED_SERVER_RESIDUAL_RISK = "SERVER_ENFORCED_PROTECTION_ACTIVE";
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

function validateServerEnforcedProtection(profile, server) {
  const violations = [];
  if (profile.repositoryVisibility !== "PUBLIC") violations.push(violation("GOVERNANCE_REPOSITORY_VISIBILITY", "SERVER_ENFORCED governance requires the observed repository visibility to be PUBLIC"));
  if (server.available !== true || server.active !== true) violations.push(violation("GOVERNANCE_SERVER_PROTECTION_STATE", "SERVER_ENFORCED governance requires available and active server-side protection"));

  const requiredStatusChecks = server.requiredStatusChecks ?? {};
  if (JSON.stringify(requiredStatusChecks.contexts) !== JSON.stringify([EXPECTED_CI]) || requiredStatusChecks.strict !== true) {
    violations.push(violation("GOVERNANCE_SERVER_REQUIRED_CHECKS", "server protection must require strict static-ci status checks and no other current context"));
  }
  if (server.requiredApprovingReviews !== 1) violations.push(violation("GOVERNANCE_SERVER_REQUIRED_REVIEW", "server protection must require one approving pull-request review"));
  if (server.enforceAdministrators !== true) violations.push(violation("GOVERNANCE_SERVER_ADMIN_ENFORCEMENT", "server protection must enforce the required controls for administrators"));
  if (server.allowForcePushes !== false) violations.push(violation("GOVERNANCE_SERVER_FORCE_PUSH", "server protection must disallow force pushes"));
  if (server.allowDeletions !== false) violations.push(violation("GOVERNANCE_SERVER_DELETION", "server protection must disallow branch deletion"));
  if (server.requiredConversationResolution !== true) violations.push(violation("GOVERNANCE_SERVER_CONVERSATION_RESOLUTION", "server protection must require conversation resolution"));
  if (server.restrictions !== null) violations.push(violation("GOVERNANCE_SERVER_RESTRICTIONS", "current branch restrictions must be recorded exactly as the observed GitHub configuration"));

  const observation = server.observation ?? {};
  const observationValid =
    observation.source === "AUTHENTICATED_GITHUB_API" &&
    /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(String(observation.observedAt ?? "")) &&
    observation.repository === EXPECTED_REPOSITORY &&
    observation.repositoryId === EXPECTED_REPOSITORY_ID &&
    observation.repositoryVisibility === "public" &&
    observation.defaultBranch === EXPECTED_BRANCH &&
    observation.protectedBranch === EXPECTED_BRANCH &&
    observation.ref === "refs/heads/master" &&
    observation.endpoint === "GET https://api.github.com/repos/andresslacson1989/jarvis-project/branches/master/protection" &&
    observation.evidenceIdentity === "github-api:repo-1330469646:refs/heads/master:protection:static-ci:app-15368" &&
    observation.requiredStatusCheckAppId === EXPECTED_STATUS_CHECK_APP_ID;
  if (!observationValid) violations.push(violation("GOVERNANCE_SERVER_OBSERVATION_INVALID", "current server-protection facts must retain the authenticated GitHub API observation identity and exact master protection target"));

  if (profile.residualRisk !== EXPECTED_SERVER_RESIDUAL_RISK) violations.push(violation("GOVERNANCE_SERVER_RESIDUAL_RISK", "SERVER_ENFORCED governance must record active protection rather than the fallback residual risk"));
  if ("controls" in profile) violations.push(violation("GOVERNANCE_STALE_CURRENT_CONTROLS", "fallback controls must not remain as current fields after transition to SERVER_ENFORCED governance"));
  for (const key of ["reason", "observationSource", "observedHttpStatus", "observedMessage"]) {
    if (key in server) violations.push(violation("GOVERNANCE_STALE_CURRENT_PROTECTION_FIELDS", `${key} is a stale fallback field and must be retained only under historicalTransition`));
  }

  const transition = profile.historicalTransition ?? {};
  if (
    transition.notCurrent !== true ||
    transition.previousGovernanceMode !== "COMPENSATING_CONTROLS" ||
    transition.previousRepositoryVisibility !== "PRIVATE" ||
    transition.previousServerSideProtection?.available !== false ||
    transition.previousServerSideProtection?.active !== false ||
    transition.previousServerSideProtection?.reason !== "HOSTING_PLAN_LIMITATION" ||
    transition.previousServerSideProtection?.observedHttpStatus !== 403 ||
    transition.previousControls?.temporaryImplementationBranches !== true ||
    transition.previousControls?.candidateCiRequired !== true ||
    transition.previousControls?.liveAuthoritativeTipRevalidation !== true ||
    transition.previousControls?.reconcileUnexpectedMovement !== true ||
    transition.previousControls?.nonForceIntegrationOnly !== true ||
    transition.previousControls?.postIntegrationVerification !== true ||
    transition.previousResidualRisk !== EXPECTED_RESIDUAL_RISK
  ) {
    violations.push(violation("GOVERNANCE_HISTORICAL_TRANSITION_INVALID", "the prior compensating-control record must be explicitly labeled non-current and kept under historicalTransition"));
  }
  return violations;
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
  } else if (profile.governanceMode === "SERVER_ENFORCED") {
    violations.push(...validateServerEnforcedProtection(profile, server));
  } else {
    violations.push(violation("GOVERNANCE_MODE_INVALID", "governanceMode must be SERVER_ENFORCED or COMPENSATING_CONTROLS"));
  }
  if (profile.serverModeRequiredWhenAvailable !== true) violations.push(violation("GOVERNANCE_SERVER_MODE_REENABLE_REQUIRED", "server mode must become mandatory when hosting capability becomes available"));
  return violations;
}

export function validateRepositoryGovernanceDocumentation(profile, documentationText) {
  const violations = [];
  const text = String(documentationText ?? "").replace(/\r\n/g, "\n");
  const historicalHeading = "## Historical transition — non-current";
  const historicalIndex = text.indexOf(historicalHeading);
  const current = historicalIndex >= 0 ? text.slice(0, historicalIndex) : text;

  if (!text.includes("## Current effective mode")) violations.push(violation("GOVERNANCE_DOCUMENT_CURRENT_SECTION_MISSING", "MASTER-PROTECTION.md must contain a current effective-mode section"));
  if (historicalIndex < 0) violations.push(violation("GOVERNANCE_DOCUMENT_HISTORY_BOUNDARY_MISSING", "MASTER-PROTECTION.md must place prior governance facts under a historical non-current heading"));

  if (profile?.governanceMode === "SERVER_ENFORCED") {
    const requiredCurrentText = [
      /SERVER_ENFORCED/,
      /public repository/i,
      /authoritative branch.*master/i,
      /static-ci/i,
      /one approving (?:pull-request )?review/i,
      /administrator/i,
      /force pushes?.*blocked|force pushes?.*disallowed|force pushes?.*not allowed/i,
      /deletions?.*blocked|deletions?.*disallowed|deletions?.*not allowed/i,
      /conversation resolution/i,
      /AUTHENTICATED_GITHUB_API/,
      /EXACT_GITHUB_ACTIONS_RUN_NOT_RECORDED/,
      /repository-governance-profile\.json/,
    ];
    for (const pattern of requiredCurrentText) {
      if (!pattern.test(current)) violations.push(violation("GOVERNANCE_DOCUMENT_CURRENT_FACT_MISSING", `MASTER-PROTECTION.md current section must contain ${pattern}`));
    }
    for (const pattern of [/COMPENSATING_CONTROLS/i, /HTTP\s*403/i, /private repository/i, /not protected/i, /OUT_OF_BAND_ADMIN_FORCE_PUSH_OR_DELETION_NOT_SERVER_BLOCKED/]) {
      if (pattern.test(current)) violations.push(violation("GOVERNANCE_DOCUMENT_STALE_CURRENT_FACT", `MASTER-PROTECTION.md current section contains stale fallback fact ${pattern}`));
    }
  }
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
  const [profileRaw, workflow, implementationContract, verificationContract, masterProtection] = await Promise.all([
    readFile(resolve(root, "docs/implementation/governance/repository-governance-profile.json"), "utf8"),
    readFile(resolve(root, ".github/workflows/static-ci.yml"), "utf8"),
    readFile(resolve(root, "docs/implementation/JARVIS-00-SCOPE-GOVERNANCE-CODING-CONTRACT.md"), "utf8"),
    readFile(resolve(root, "docs/implementation/JARVIS-05-VERIFICATION-RELEASE-CONTRACT.md"), "utf8"),
    readFile(resolve(root, "docs/implementation/governance/MASTER-PROTECTION.md"), "utf8"),
  ]);
  const profile = JSON.parse(profileRaw);
  const violations = [
    ...validateRepositoryGovernanceProfile(profile, workflow),
    ...validateRepositoryGovernanceDocumentation(profile, masterProtection),
    ...validateGovernanceContractTexts(implementationContract, verificationContract),
  ];
  if (violations.length > 0) {
    for (const item of violations) console.error(`[repository-governance] ${item.code}: ${item.detail}`);
    process.exit(1);
  }
  console.log(`[repository-governance] PASS mode=${profile.governanceMode} required_ci=${profile.mandatoryCi.pipelineIdentity} authority=GITHUB_ACTIONS`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
