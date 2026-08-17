import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_REPOSITORY = "andresslacson1989/jarvis-project";
const EXPECTED_BRANCH = "master";
const EXPECTED_CI = "local-phase0-checkpoint";
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

export function validateRepositoryGovernanceProfile(profile, { phase0ProfileExists = false, workflowExists = false } = {}) {
  const violations = [];
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return [violation("GOVERNANCE_PROFILE_INVALID", "profile must be an object")];
  }
  if (profile.schemaVersion !== 1) violations.push(violation("GOVERNANCE_PROFILE_VERSION", "schemaVersion must equal 1"));
  if (profile.provider !== "GITHUB") violations.push(violation("GOVERNANCE_PROVIDER", "provider must be GITHUB"));
  if (profile.repository !== EXPECTED_REPOSITORY) violations.push(violation("GOVERNANCE_REPOSITORY", `repository must be ${EXPECTED_REPOSITORY}`));
  if (profile.authoritativeBranch !== EXPECTED_BRANCH) violations.push(violation("GOVERNANCE_AUTHORITATIVE_BRANCH", `authoritativeBranch must be ${EXPECTED_BRANCH}`));
  if (profile.mandatoryCiContext !== EXPECTED_CI) violations.push(violation("GOVERNANCE_REQUIRED_CI_CONTEXT", `mandatoryCiContext must be ${EXPECTED_CI}`));
  if (!phase0ProfileExists) violations.push(violation("GOVERNANCE_LOCAL_CHECKPOINT_MISSING", "local Phase 0 checkpoint profile is required"));
  if (workflowExists) violations.push(violation("GOVERNANCE_GITHUB_ACTIONS_DISABLED", "local-only verification must not retain a GitHub Actions workflow"));
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
  }
  return violations;
}

async function main() {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const [profileRaw, implementationContract, verificationContract] = await Promise.all([
    readFile(resolve(root, "docs/implementation/governance/repository-governance-profile.json"), "utf8"),
    readFile(resolve(root, "docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.6.md"), "utf8"),
    readFile(resolve(root, "docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md"), "utf8"),
  ]);
  const profile = JSON.parse(profileRaw);
  const violations = [
    ...validateRepositoryGovernanceProfile(profile, {
      phase0ProfileExists: existsSync(resolve(root, "tools/checkpoints/phase0-checkpoint-profile.json")),
      workflowExists: existsSync(resolve(root, ".github/workflows/static-ci.yml")),
    }),
    ...validateGovernanceContractTexts(implementationContract, verificationContract),
  ];
  if (violations.length > 0) {
    for (const item of violations) console.error(`[repository-governance] ${item.code}: ${item.detail}`);
    process.exit(1);
  }
  console.log(`[repository-governance] PASS mode=${profile.governanceMode} required_ci=${profile.mandatoryCiContext}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
