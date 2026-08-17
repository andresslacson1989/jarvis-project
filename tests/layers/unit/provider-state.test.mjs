import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { advanceProviderSetupState, describeProviderSetupState, evaluateProviderDistributionCompatibility, getProviderRoleProfile, selectProviderForRole, validateIntegrationAccount, validateModuleManifest, validateProxmoxConnection, validateProviderAdapterContract, validateProviderAdapterEvent, validateProviderAdapterResult, validateProviderDistributionIdentity, validateProviderProfile, validateProviderQualificationRecord, validateProviderRoutingRequest, validateProviderSetupRecord, validateProviderSetupStartRequest } from "../../../packages/protocol/src/provider-runtime.mts";
import { applyCoreMigrations, CoreSchemaError, CoreStateRepository } from "../../../services/core/src/schema.ts";
import { openCoreDatabase } from "../../../services/core/src/persistence.ts";
import { admitPersistedProviderWorkspaceEngineeringRequest, createProviderAdapterRegistry, routePersistedProviderForRole, routePersistedProviderForRoleWithAdmission } from "../../../services/core/src/provider-routing.ts";
import { validateProviderWorkspaceEngineeringRequest } from "../../../packages/protocol/src/provider-workspace-runtime.mts";

const TEST_DB_DEK = Buffer.alloc(32, 0x42);
const now = "2026-08-15T00:00:00.000Z";
const passingPreAllowFacts = {
  PLATFORM_CAPABILITY: { state: "PASS", reasonCode: "PLATFORM_CAPABILITY_READY" },
  PROVIDER_SETUP: { state: "PASS", reasonCode: "PROVIDER_SETUP_READY" },
  INTEGRITY: { state: "PASS", reasonCode: "INTEGRITY_VERIFIED" },
  PROJECT_POLICY_TRUST: { state: "NOT_APPLICABLE", reasonCode: "NO_PROJECT_POLICY_SCOPE" },
  SUPPLY_CHAIN_TRUST: { state: "NOT_APPLICABLE", reasonCode: "NO_UPDATE_OR_MODULE_SCOPE" },
  LOCALITY: { state: "PASS", reasonCode: "LOCALITY_COMPLIANT" },
  BUDGET: { state: "PASS", reasonCode: "BUDGET_AVAILABLE" },
  RESOURCE: { state: "PASS", reasonCode: "RESOURCES_AVAILABLE" },
  PRECONDITION: { state: "PASS", reasonCode: "PRECONDITIONS_MATCH" },
};
const allowedPermission = {
  decisionId: "permission-routing-1",
  outcome: "ALLOW",
  contextualRisk: "LOW",
  reasonCodes: ["CURRENT_INSTRUCTION"],
  matchedPolicyIds: [],
  matchedPrecedentIds: [],
  decidedAt: now,
  policyVersion: 1,
};

async function withDatabase(testBody) {
  const root = join(tmpdir(), `jarvis-provider-${process.pid}-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  const connection = openCoreDatabase(join(root, "state.db"), { dbDek: TEST_DB_DEK });
  try { await testBody(connection, new CoreStateRepository(connection)); } finally { connection.close(); await rm(root, { recursive: true, force: true }); }
}

const profile = {
  providerId: "provider-1",
  adapterType: "LOCAL_MODEL",
  adapterVersion: "adapter-1",
  providerVersion: "runtime-1",
  modelId: "model-1",
  platform: { platform: "WINDOWS", runtimeRole: "FULL_HOST", architecture: "x64", backendProfileId: "windows-v1" },
  setup: "SETUP_REQUIRED",
  compatibility: "COMPATIBLE",
  capabilities: { coding: true, toolUse: true, locality: "LOCAL" },
  costClass: "FREE",
  latencyClass: "LOW",
  health: "READY",
};

const policy = {
  providerId: "provider-1",
  adapterVersion: "adapter-1",
  platformCompatibility: [{ platform: "WINDOWS", runtimeRoles: ["FULL_HOST"], architecture: ["x64"] }],
  acceptedVersions: [{ kind: "EXACT", version: "runtime-1" }],
  requiredCapabilities: ["coding"],
  conformanceProfileId: "conformance-1",
};

test("provider/module/integration/Proxmox validators preserve separate qualification and trust fields", () => {
  assert.equal(validateProviderProfile(profile).setup, "SETUP_REQUIRED");
  assert.throws(() => validateIntegrationAccount({ integrationId: "github", accountId: "account-1", displayName: "GitHub", credentialHandle: "raw-token", enabledCapabilities: [], grantedScopes: [], status: "CONNECTED", unexpected: true }));
  assert.throws(() => validateProxmoxConnection({ connectionId: "pve-1", displayName: "PVE", endpoint: "http://192.168.99.77:8006", credentialHandle: "cred-1", tlsTrust: { mode: "SYSTEM_CA" }, environmentId: "env-1", enabledCapabilities: ["PROXMOX_READ"], status: "CONNECTED" }));
  assert.throws(() => validateModuleManifest({ moduleId: "module-1", version: "1.0.0", displayName: "External", publisher: "test", source: "local", executionClass: "EXTERNAL_MANAGED", compatibility: { jarvis: "1", platforms: [] }, capabilities: [], requestedPermissions: [], networkBehavior: [], healthCheck: { kind: "PROCESS_READY", timeoutMs: 0 }, integrity: { sha256: "0".repeat(64), catalogEntryId: "catalog-1", catalogSignature: "sig", catalogKeyId: "key-1" }, lifecycle: { activationBoundary: "SAFE_BOUNDARY", rollbackSupported: true, retainsPreviousVersion: true } }));
});

test("provider support claims fail closed without setup and qualification evidence", () => {
  assert.throws(() => validateProviderSetupRecord({ providerId: "provider-1", distributionId: "dist-1", adapterVersion: "adapter-1", state: "SETUP_READY" }), /SETUP_READY requires verification/u);
  assert.throws(() => validateProviderQualificationRecord({ providerId: "provider-1", distributionId: "dist-1", state: "QUALIFIED" }), /QUALIFIED requires verification/u);
});

test("provider adapter contract separates lifecycle, execution modes, capabilities, cancellation, and bounded timeouts", () => {
  const adapter = validateProviderAdapterContract({
    providerId: "provider-1",
    adapterType: "CODEX_WINDOWS",
    adapterVersion: "adapter-1",
    executionModes: ["ONE_SHOT", "STREAMING", "RESUMABLE"],
    lifecycleStates: ["DISCOVERED", "STARTING", "READY", "DEGRADED", "STOPPING", "STOPPED", "FAILED"],
    capabilities: [{ capabilityId: "structured-output", executionModes: ["ONE_SHOT", "STREAMING"], locality: "LOCAL", supportsCancellation: true, supportsResumption: false }],
    startupTimeoutMs: 10_000,
    executionTimeoutMs: 120_000,
    cancellation: "COOPERATIVE_THEN_FORCE",
  });
  assert.deepEqual(adapter.executionModes, ["ONE_SHOT", "STREAMING", "RESUMABLE"]);
  assert.equal(adapter.capabilities[0].supportsCancellation, true);
  assert.throws(() => validateProviderAdapterContract({ ...adapter, capabilities: [{ ...adapter.capabilities[0], executionModes: ["PERSISTENT"] }] }), /not supported/u);
  assert.throws(() => validateProviderAdapterContract({ ...adapter, executionTimeoutMs: 0 }), /timeout/u);
});

test("provider distribution identity is exact, platform-bound, and fail-closed against an explicit release policy", () => {
  const identity = {
    providerId: "provider-1",
    distributionId: "codex-windows-private",
    adapterVersion: "adapter-1",
    interfaceId: "codex-structured-v1",
    platform: { platform: "WINDOWS", runtimeRole: "FULL_HOST", architecture: "x64", backendProfileId: "windows-v1" },
    osVersion: "windows-11-25H2",
    providerVersion: "1.2.3",
    executable: { kind: "MAIN_EXECUTABLE", fileName: "codex.exe", canonicalPath: { platform: "WINDOWS", value: "C:\\Program Files\\JARVIS\\codex.exe" }, sha256: "a".repeat(64), fileVersion: "1.2.3" },
    setupHelper: { kind: "SETUP_HELPER", fileName: "codex-setup.exe", canonicalPath: { platform: "WINDOWS", value: "C:\\Program Files\\JARVIS\\codex-setup.exe" }, sha256: "b".repeat(64), fileVersion: "1.2.3" },
    discoveredAt: now,
  };
  const policyWithIdentity = {
    ...policy,
    acceptedVersions: [{ kind: "RANGE", range: ">=1.2.0 <2.0.0" }],
    platformCompatibility: [{ platform: "WINDOWS", runtimeRoles: ["FULL_HOST"], architecture: ["x64"], osVersionRange: "windows-11-25H2" }],
    distributionPolicy: {
      distributionIds: ["codex-windows-private"],
      interfaceIds: ["codex-structured-v1"],
      executableFileNames: ["codex.exe"],
      executableSha256: ["a".repeat(64)],
      setupHelperFileNames: ["codex-setup.exe"],
      setupHelperSha256: ["b".repeat(64)],
    },
  };
  assert.equal(validateProviderDistributionIdentity(identity).executable.canonicalPath.platform, "WINDOWS");
  assert.equal(evaluateProviderDistributionCompatibility(identity, policyWithIdentity).state, "COMPATIBLE");
  assert.equal(evaluateProviderDistributionCompatibility({ ...identity, distributionId: "other-distribution" }, policyWithIdentity).reason, "DISTRIBUTION_UNSUPPORTED");
  assert.equal(evaluateProviderDistributionCompatibility({ ...identity, providerVersion: "2.1.0" }, policyWithIdentity).state, "VERSION_UNSUPPORTED");
  assert.equal(evaluateProviderDistributionCompatibility({ ...identity, executable: { ...identity.executable, sha256: "c".repeat(64) } }, policyWithIdentity).reason, "EXECUTABLE_UNSUPPORTED");
  assert.throws(() => validateProviderDistributionIdentity({ ...identity, executable: { ...identity.executable, canonicalPath: { platform: "LINUX", value: "/opt/codex" } } }), /platform does not match/u);
  assert.equal(evaluateProviderDistributionCompatibility(identity, policy).reason, "DISTRIBUTION_POLICY_MISSING");
});

test("provider adapter normalizes structured results and safe lifecycle errors without carrying raw provider output", () => {
  const sourceLabel = { domain: "jarvis.content-authority.label.v1", schemaVersion: 1, sourceType: "AI_OUTPUT", sourceId: "provider-1", authorityClass: "CONTENT_ONLY" };
  const result = validateProviderAdapterResult({
    domain: "jarvis.provider-result.v1",
    schemaVersion: 1,
    requestId: "request-1",
    providerId: "provider-1",
    distributionId: "codex-windows-private",
    adapterVersion: "adapter-1",
    executionMode: "ONE_SHOT",
    completedAt: now,
    output: { domain: "jarvis.ai-output.v1", schemaVersion: 1, outputId: "output-1", providerId: "provider-1", generatedAt: now, sourceLabel, items: [{ kind: "TEXT", text: "normalized" }] },
  });
  assert.equal(result.output.items[0].kind, "TEXT");
  const event = validateProviderAdapterEvent({ domain: "jarvis.provider-event.v1", schemaVersion: 1, eventId: "event-1", requestId: "request-1", providerId: "provider-1", sequence: 1, type: "FAILED", occurredAt: now, error: { code: "EXECUTION_TIMEOUT", retryable: true, safeMessage: "The provider did not finish before the bounded deadline.", providerCode: "TIMEOUT" } });
  assert.equal(event.error.code, "EXECUTION_TIMEOUT");
  assert.throws(() => validateProviderAdapterResult({ domain: "jarvis.provider-result.v1", schemaVersion: 1, requestId: "request-1", providerId: "provider-1", distributionId: "codex-windows-private", adapterVersion: "adapter-1", executionMode: "ONE_SHOT", completedAt: now, output: result.output, error: { code: "UNKNOWN", retryable: false, safeMessage: "not allowed" } }), /exactly one/u);
  assert.throws(() => validateProviderAdapterEvent({ ...event, safeMessage: "raw\nprovider detail" }), /control characters/u);
  assert.throws(() => validateProviderAdapterEvent({ ...event, type: "COMPLETED", error: { code: "UNKNOWN", retryable: false, safeMessage: "not allowed" } }), /only failed/u);
});

test("provider role routing is deterministic and enforces setup, qualification, capability, mode, and locality", () => {
  const candidate = {
    profile: { ...profile, setup: "SETUP_READY", capabilities: { naturalLanguage: true, structuredOutput: true, coding: true, toolUse: true, locality: "LOCAL" } },
    adapter: { providerId: "provider-1", adapterType: "CODEX_WINDOWS", adapterVersion: "adapter-1", executionModes: ["ONE_SHOT"], lifecycleStates: ["DISCOVERED", "STARTING", "READY", "FAILED"], capabilities: [
      { capabilityId: "naturalLanguage", executionModes: ["ONE_SHOT"], locality: "LOCAL", supportsCancellation: true, supportsResumption: false },
      { capabilityId: "structuredOutput", executionModes: ["ONE_SHOT"], locality: "LOCAL", supportsCancellation: true, supportsResumption: false },
    ], startupTimeoutMs: 10_000, executionTimeoutMs: 120_000, cancellation: "COOPERATIVE_ONLY" },
    setup: { providerId: "provider-1", distributionId: "dist-1", adapterVersion: "adapter-1", providerVersion: "runtime-1", state: "SETUP_READY", lastVerifiedAt: now, conformanceEvidenceRef: "evidence-setup-1" },
    qualification: { providerId: "provider-1", distributionId: "dist-1", providerVersion: "runtime-1", state: "QUALIFIED", evidenceRef: "evidence-1", verifiedAt: now },
  };
  const request = { domain: "jarvis.provider-routing-request.v1", schemaVersion: 1, requestId: "routing-1", role: "GENERALIST", platform: profile.platform, dataPolicy: { sensitivity: "PRIVATE", locality: "LOCAL_ONLY" } };
  assert.equal(getProviderRoleProfile("GENERALIST").maxIterations, 12);
  assert.equal(validateProviderRoutingRequest(request).role, "GENERALIST");
  const selected = selectProviderForRole(request, [candidate]);
  assert.deepEqual(selected, { domain: "jarvis.provider-routing-result.v1", schemaVersion: 1, requestId: "routing-1", role: "GENERALIST", outcome: "SELECTED", selectedProviderId: "provider-1", selectedExecutionMode: "ONE_SHOT", candidates: [{ providerId: "provider-1", eligible: true, rejectionCodes: [] }] });

  const cloudCandidate = { ...candidate, profile: { ...candidate.profile, capabilities: { ...candidate.profile.capabilities, locality: "CLOUD" } }, adapter: { ...candidate.adapter, capabilities: candidate.adapter.capabilities.map((item) => ({ ...item, locality: "CLOUD" })) } };
  const localOnly = selectProviderForRole(request, [cloudCandidate]);
  assert.equal(localOnly.outcome, "NO_MATCH");
  assert.ok(localOnly.candidates[0].rejectionCodes.includes("LOCALITY_NOT_ALLOWED"));

  const wrongPlatform = selectProviderForRole({ ...request, platform: { ...profile.platform, platform: "LINUX", backendProfileId: "linux-v1" } }, [candidate]);
  assert.equal(wrongPlatform.outcome, "NO_MATCH");
  assert.ok(wrongPlatform.candidates[0].rejectionCodes.includes("PLATFORM_NOT_SUPPORTED"));

  const unavailable = selectProviderForRole(request, [{ ...candidate, profile: { ...candidate.profile, health: "DEGRADED" }, setup: { ...candidate.setup, state: "SETUP_REQUIRED" } }]);
  assert.equal(unavailable.outcome, "NO_MATCH");
  assert.ok(unavailable.candidates[0].rejectionCodes.includes("SETUP_NOT_READY"));
  assert.ok(unavailable.candidates[0].rejectionCodes.includes("HEALTH_NOT_READY"));
  assert.throws(() => validateProviderRoutingRequest({ ...request, dataPolicy: { sensitivity: "PRIVATE", locality: "REMOTE" } }), /data locality/u);
});

test("Core-owned persisted provider records route only after explicit qualification", async () => {
  await withDatabase(async (_connection, repository) => {
    applyCoreMigrations(_connection);
    const codexProfile = { ...profile, providerId: "codex-cli", adapterType: "CODEX_CLI", adapterVersion: "1.0.0", providerVersion: "0.147.0", modelId: "default", setup: "SETUP_READY", capabilities: { naturalLanguage: true, structuredOutput: true, locality: "LOCAL" } };
    const codexPolicy = { ...policy, providerId: "codex-cli", adapterVersion: "1.0.0", requiredCapabilities: ["structuredOutput"], conformanceProfileId: "codex-cli-windows-v1" };
    const codexSetup = { providerId: "codex-cli", distributionId: "codex-cli-standalone-windows-x64-0.147.0", adapterVersion: "1.0.0", providerVersion: "0.147.0", state: "SETUP_READY", lastVerifiedAt: now, conformanceEvidenceRef: "evidence-codex-setup-1" };
    assert.deepEqual(repository.putProviderProfile(codexProfile, codexPolicy, now), { id: "codex-cli:default", version: 1 });
    assert.deepEqual(repository.putProviderSetupState(codexSetup, now), { id: "codex-cli", version: 1 });
    assert.deepEqual(repository.putProviderQualificationState({ providerId: "codex-cli", distributionId: codexSetup.distributionId, providerVersion: "0.147.0", state: "UNQUALIFIED" }, now), { id: "codex-cli", version: 1 });
    const request = { domain: "jarvis.provider-routing-request.v1", schemaVersion: 1, requestId: "routing-core-1", role: "GENERALIST", platform: codexProfile.platform, dataPolicy: { sensitivity: "PRIVATE", locality: "LOCAL_ONLY" } };
    const unqualified = routePersistedProviderForRole(repository, request);
    assert.equal(unqualified.outcome, "NO_MATCH");
    assert.ok(unqualified.candidates[0]?.rejectionCodes.includes("QUALIFICATION_NOT_READY"));
    assert.deepEqual(repository.putProviderQualificationState({ providerId: "codex-cli", distributionId: codexSetup.distributionId, providerVersion: "0.147.0", state: "QUALIFIED", evidenceRef: "evidence-codex-1", verifiedAt: now }, now), { id: "codex-cli", version: 2 });
    const qualified = routePersistedProviderForRole(repository, { ...request, requestId: "routing-core-2" });
    assert.equal(qualified.outcome, "SELECTED");
    assert.equal(qualified.selectedProviderId, "codex-cli");
    assert.equal(qualified.selectedExecutionMode, "ONE_SHOT");
  });
});

test("provider fallback cannot bypass permission or pre-ALLOW budget/platform gates", async () => {
  await withDatabase(async (_connection, repository) => {
    applyCoreMigrations(_connection);
    const codexProfile = { ...profile, providerId: "codex-cli", adapterType: "CODEX_CLI", adapterVersion: "1.0.0", providerVersion: "0.147.0", modelId: "default", setup: "SETUP_READY", capabilities: { naturalLanguage: true, structuredOutput: true, coding: true, toolUse: true, locality: "LOCAL" } };
    const codexPolicy = { ...policy, providerId: "codex-cli", adapterVersion: "1.0.0", requiredCapabilities: ["structuredOutput"], conformanceProfileId: "codex-cli-windows-v1" };
    const codexSetup = { providerId: "codex-cli", distributionId: "codex-cli-standalone-windows-x64-0.147.0", adapterVersion: "1.0.0", providerVersion: "0.147.0", state: "SETUP_READY", lastVerifiedAt: now, conformanceEvidenceRef: "evidence-codex-setup-1" };
    repository.putProviderProfile(codexProfile, codexPolicy, now);
    repository.putProviderSetupState(codexSetup, now);
    repository.putProviderQualificationState({ providerId: "codex-cli", distributionId: codexSetup.distributionId, providerVersion: "0.147.0", state: "QUALIFIED", evidenceRef: "evidence-codex-1", verifiedAt: now }, now);
    const request = { domain: "jarvis.provider-routing-request.v1", schemaVersion: 1, requestId: "routing-admission-1", role: "GENERALIST", platform: codexProfile.platform, dataPolicy: { sensitivity: "PRIVATE", locality: "LOCAL_ONLY" } };
    const admission = { permissionDecision: allowedPermission, preAllowGateFacts: passingPreAllowFacts };
    assert.equal(routePersistedProviderForRoleWithAdmission(repository, request, admission).outcome, "SELECTED");
    assert.throws(() => routePersistedProviderForRoleWithAdmission(repository, request, { ...admission, permissionDecision: { ...allowedPermission, outcome: "DENY" } }), /ALLOW permission/u);
    assert.throws(() => routePersistedProviderForRoleWithAdmission(repository, request, { ...admission, preAllowGateFacts: { ...passingPreAllowFacts, BUDGET: { state: "UNKNOWN", reasonCode: "BUDGET_UNAVAILABLE" } } }), /pre-ALLOW gate/u);
  });
});

test("Core adapter registry requires explicit unique validated registrations", () => {
  const firstAdapter = { providerId: "provider-1", adapterType: "CODEX_WINDOWS", adapterVersion: "adapter-1", executionModes: ["ONE_SHOT"], lifecycleStates: ["DISCOVERED", "STARTING", "READY", "FAILED"], capabilities: [
    { capabilityId: "naturalLanguage", executionModes: ["ONE_SHOT"], locality: "LOCAL", supportsCancellation: true, supportsResumption: false },
  ], startupTimeoutMs: 10_000, executionTimeoutMs: 120_000, cancellation: "COOPERATIVE_ONLY" };
  const secondAdapter = { ...firstAdapter, providerId: "provider-2" };
  const registry = createProviderAdapterRegistry([firstAdapter, secondAdapter]);
  assert.equal(registry.size, 2);
  assert.equal(registry.get("provider-2")?.providerId, "provider-2");
  assert.throws(() => createProviderAdapterRegistry([firstAdapter, firstAdapter]), /duplicate provider/u);
});

test("WORKSPACE_ENGINEERING request binds the exact workspace and preserves explicit network modes without secret expansion", () => {
  const request = {
    domain: "jarvis.provider-workspace-engineering-request.v1",
    schemaVersion: 1,
    requestId: "workspace-request-1",
    providerId: "codex-cli",
    projectId: "project-1",
    workspace: {
      workspaceId: "workspace-1",
      projectId: "project-1",
      displayName: "Jarvis worktree",
      kind: "WORKTREE",
      canonicalRoot: { platform: "WINDOWS", value: "C:\\Jarvis\\worktree-1" },
      worktreeIdentity: "git-worktree-1",
      branch: "codex/workspace-1",
      sourceCommit: "a".repeat(40),
    },
    dataPolicy: { sensitivity: "PRIVATE", locality: "LOCAL_ONLY" },
    networkMode: "ENABLED",
    environment: { allowedVariableNames: ["PATH", "TEMP"] },
    writeBoundary: "ASSIGNED_WORKSPACE_ONLY",
    readBoundary: "OUTSIDE_WORKSPACE_UNCLAIMED",
    externalActions: "JARVIS_TOOLS_ONLY",
  };
  assert.equal(validateProviderWorkspaceEngineeringRequest(request).networkMode, "ENABLED");
  assert.throws(() => validateProviderWorkspaceEngineeringRequest({ ...request, networkPolicyId: "policy-1" }), /cannot carry a policy identity/u);
  assert.equal(validateProviderWorkspaceEngineeringRequest({ ...request, networkMode: "DENIED" }).networkMode, "DENIED");
  assert.throws(() => validateProviderWorkspaceEngineeringRequest({ ...request, networkMode: "QUALIFIED_POLICY" }), /policy identity/u);
  assert.throws(() => validateProviderWorkspaceEngineeringRequest({ ...request, environment: { allowedVariableNames: ["JARVIS_API_TOKEN"] } }), /secret-bearing/u);
  assert.throws(() => validateProviderWorkspaceEngineeringRequest({ ...request, workspace: { ...request.workspace, projectId: "project-2" } }), /project identity/u);
});

test("Core workspace-engineering admission requires the persisted workspace and a qualified assigned provider", async () => {
  await withDatabase(async (_connection, repository) => {
    applyCoreMigrations(_connection);
    const workspace = {
      workspaceId: "workspace-1",
      projectId: "project-1",
      displayName: "Jarvis worktree",
      kind: "WORKTREE",
      canonicalRoot: { platform: "WINDOWS", value: "C:\\Jarvis\\worktree-1" },
      worktreeIdentity: "git-worktree-1",
      branch: "codex/workspace-1",
      sourceCommit: "a".repeat(40),
    };
    assert.deepEqual(repository.putProject({ projectId: "project-1", displayName: "Jarvis", canonicalRoot: { platform: "WINDOWS", value: "C:\\Jarvis" }, canonicalIdentity: "jarvis-project-1" }, now), { id: "project-1", version: 1 });
    assert.deepEqual(repository.putProjectWorkspace(workspace, now), { id: "workspace-1", version: 1 });
    const engineeringProfile = { ...profile, capabilities: { naturalLanguage: true, structuredOutput: true, coding: true, toolUse: true, locality: "LOCAL" }, setup: "SETUP_READY" };
    const engineeringPolicy = { ...policy, requiredCapabilities: ["coding", "toolUse"] };
    assert.deepEqual(repository.putProviderProfile(engineeringProfile, engineeringPolicy, now), { id: "provider-1:model-1", version: 1 });
    assert.deepEqual(repository.putProviderSetupState({ providerId: "provider-1", distributionId: "dist-1", adapterVersion: "adapter-1", providerVersion: "runtime-1", state: "SETUP_READY", lastVerifiedAt: now, conformanceEvidenceRef: "evidence-1" }, now), { id: "provider-1", version: 1 });
    assert.deepEqual(repository.putProviderQualificationState({ providerId: "provider-1", distributionId: "dist-1", providerVersion: "runtime-1", state: "QUALIFIED", evidenceRef: "evidence-1", verifiedAt: now }, now), { id: "provider-1", version: 1 });
    const adapter = { providerId: "provider-1", adapterType: "LOCAL_MODEL", adapterVersion: "adapter-1", executionModes: ["ONE_SHOT"], lifecycleStates: ["DISCOVERED", "STARTING", "READY", "FAILED"], capabilities: [
      { capabilityId: "naturalLanguage", executionModes: ["ONE_SHOT"], locality: "LOCAL", supportsCancellation: true, supportsResumption: false },
      { capabilityId: "structuredOutput", executionModes: ["ONE_SHOT"], locality: "LOCAL", supportsCancellation: true, supportsResumption: false },
      { capabilityId: "coding", executionModes: ["ONE_SHOT"], locality: "LOCAL", supportsCancellation: true, supportsResumption: false },
      { capabilityId: "toolUse", executionModes: ["ONE_SHOT"], locality: "LOCAL", supportsCancellation: true, supportsResumption: false },
    ], startupTimeoutMs: 10_000, executionTimeoutMs: 120_000, cancellation: "COOPERATIVE_ONLY" };
    const request = {
      domain: "jarvis.provider-workspace-engineering-request.v1",
      schemaVersion: 1,
      requestId: "workspace-request-1",
      providerId: "provider-1",
      projectId: "project-1",
      workspace,
      dataPolicy: { sensitivity: "PRIVATE", locality: "LOCAL_ONLY" },
      networkMode: "DENIED",
      environment: { allowedVariableNames: ["PATH", "TEMP"] },
      writeBoundary: "ASSIGNED_WORKSPACE_ONLY",
      readBoundary: "OUTSIDE_WORKSPACE_UNCLAIMED",
      externalActions: "JARVIS_TOOLS_ONLY",
    };
    const admitted = admitPersistedProviderWorkspaceEngineeringRequest(repository, request, createProviderAdapterRegistry([adapter]));
    assert.equal(admitted.request.workspace.canonicalRoot.value, "C:\\Jarvis\\worktree-1");
    assert.equal(admitted.routing.outcome, "SELECTED");
    assert.throws(() => admitPersistedProviderWorkspaceEngineeringRequest(repository, { ...request, workspace: { ...workspace, sourceCommit: "b".repeat(40) } }, createProviderAdapterRegistry([adapter])), /current Core-registered workspace/u);
    assert.throws(() => admitPersistedProviderWorkspaceEngineeringRequest(repository, { ...request, providerId: "unregistered-provider" }, createProviderAdapterRegistry([adapter])), /qualified and routable/u);
    assert.throws(() => admitPersistedProviderWorkspaceEngineeringRequest(repository, { ...request, providerId: "codex-cli", networkMode: "DENIED" }, createProviderAdapterRegistry([adapter])), /network-enabled mode/u);
  });
});

test("provider setup workflow requires explicit user start and never treats helper exit as readiness", () => {
  assert.deepEqual(advanceProviderSetupState("NOT_REQUIRED", "DISCOVERY_REQUIRES_SETUP"), { previousState: "NOT_REQUIRED", action: "DISCOVERY_REQUIRES_SETUP", nextState: "SETUP_REQUIRED", requiresAuthenticatedUser: false, readyVerified: false });
  assert.deepEqual(advanceProviderSetupState("SETUP_REQUIRED", "AUTHENTICATED_USER_START"), { previousState: "SETUP_REQUIRED", action: "AUTHENTICATED_USER_START", nextState: "SETUP_IN_PROGRESS", requiresAuthenticatedUser: true, readyVerified: false });
  assert.equal(advanceProviderSetupState("SETUP_IN_PROGRESS", "HELPER_EXITED").nextState, "SETUP_IN_PROGRESS");
  assert.equal(advanceProviderSetupState("SETUP_IN_PROGRESS", "SETUP_PROBE_PASSED").readyVerified, true);
  assert.equal(advanceProviderSetupState("SETUP_IN_PROGRESS", "CANCELLED").nextState, "SETUP_FAILED");
  assert.equal(describeProviderSetupState("REPAIR_REQUIRED").userActionRequired, true);
  assert.equal(describeProviderSetupState("SETUP_IN_PROGRESS").ready, false);
  assert.deepEqual(advanceProviderSetupState("SETUP_READY", "AUTHENTICATED_USER_START"), { previousState: "SETUP_READY", action: "AUTHENTICATED_USER_START", nextState: "SETUP_IN_PROGRESS", requiresAuthenticatedUser: true, readyVerified: false });
});

test("provider setup start requests carry identity only and require authenticated user action", () => {
  const request = validateProviderSetupStartRequest({ requestId: "request-1", providerId: "provider-1", distributionId: "dist-1", adapterVersion: "adapter-1", action: "AUTHENTICATED_USER_START" });
  assert.equal(request.action, "AUTHENTICATED_USER_START");
  assert.throws(() => validateProviderSetupStartRequest({ ...request, action: "HELPER_EXITED" }), /authenticated user action/u);
  assert.throws(() => validateProviderSetupStartRequest({ ...request, executablePath: "C:\\unsafe.exe" }), /unsupported or missing/u);
});

test("provider setup/qualification, module, integration, and Proxmox logical state persist with versioned records", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    assert.deepEqual(repository.putProviderProfile(profile, policy, now), { id: "provider-1:model-1", version: 1 });
    assert.deepEqual(repository.putProviderSetupState({ providerId: "provider-1", distributionId: "dist-1", adapterVersion: "adapter-1", providerVersion: "runtime-1", state: "SETUP_IN_PROGRESS", lastAttemptAt: now }, now), { id: "provider-1", version: 1 });
    assert.throws(() => repository.putProviderSetupState({ providerId: "provider-1", distributionId: "dist-1", adapterVersion: "adapter-2", providerVersion: "runtime-2", state: "SETUP_READY", lastVerifiedAt: now, conformanceEvidenceRef: "evidence-2" }, now), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT");
    assert.deepEqual(repository.putProviderSetupState({ providerId: "provider-1", distributionId: "dist-1", adapterVersion: "adapter-2", providerVersion: "runtime-2", state: "SETUP_REQUIRED" }, now), { id: "provider-1", version: 2 });
    assert.deepEqual(repository.putProviderQualificationState({ providerId: "provider-1", distributionId: "dist-1", providerVersion: "runtime-2", state: "QUALIFIED", evidenceRef: "evidence-1", verifiedAt: now }, now), { id: "provider-1", version: 1 });
    const moduleManifest = { moduleId: "module-1", version: "1.0.0", displayName: "External", publisher: "test", source: "local", executionClass: "EXTERNAL_MANAGED", compatibility: { jarvis: "1", platforms: [{ platform: "WINDOWS", runtimeRoles: ["FULL_HOST"] }] }, capabilities: ["read"], requestedPermissions: [], networkBehavior: [], healthCheck: { kind: "PROCESS_READY", timeoutMs: 1000 }, integrity: { sha256: "0".repeat(64), catalogEntryId: "catalog-1", catalogSignature: "sig", catalogKeyId: "key-1" }, lifecycle: { activationBoundary: "SAFE_BOUNDARY", rollbackSupported: true, retainsPreviousVersion: true } };
    assert.deepEqual(repository.putModuleManifest(moduleManifest, now), { id: "module-1", version: 1 });
    assert.deepEqual(repository.putIntegrationAccount({ integrationId: "github", accountId: "account-1", displayName: "GitHub", credentialHandle: "credential-handle-1", enabledCapabilities: ["GITHUB_REPOSITORY_READ"], grantedScopes: ["repo:read"], status: "REAUTH_REQUIRED", lastVerifiedAt: now }, now), { id: "account-1", version: 1 });
    assert.equal(connection.database.prepare("SELECT status FROM integration_account_state WHERE account_id = ?").get("account-1").status, "REAUTH_REQUIRED");
    assert.deepEqual(repository.putProxmoxConnection({ connectionId: "pve-1", displayName: "PVE", endpoint: "https://192.168.99.77:8006", credentialHandle: "credential-handle-pve", tlsTrust: { mode: "PINNED_SHA256", fingerprint: "a".repeat(64) }, environmentId: "env-1", enabledCapabilities: ["PROXMOX_READ"], allowedVmids: [100], status: "CONNECTED", lastVerifiedAt: now }, now), { id: "pve-1", version: 1 });
    assert.throws(() => repository.putProviderSetupState({ providerId: "missing", distributionId: "dist-1", adapterVersion: "adapter-1", state: "SETUP_REQUIRED" }, now), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID");
  });
});

test("provider status views expose independent support gates and explicit capabilities", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    repository.putProviderProfile(profile, policy, now);
    repository.putProviderSetupState({ providerId: "provider-1", distributionId: "dist-1", adapterVersion: "adapter-1", providerVersion: "runtime-1", state: "SETUP_REQUIRED" }, now);
    let view = repository.listProviderSetupStatusViews()[0];
    assert.equal(view.supportState, "SETUP_REQUIRED");
    assert.equal(view.capabilities.find((capability) => capability.capabilityId === "coding")?.supported, true);
    assert.equal(view.capabilities.find((capability) => capability.capabilityId === "vision")?.supported, false);
    repository.putProviderSetupState({ providerId: "provider-1", distributionId: "dist-1", adapterVersion: "adapter-1", providerVersion: "runtime-1", state: "SETUP_READY", lastVerifiedAt: now, conformanceEvidenceRef: "setup-evidence-1" }, now);
    view = repository.listProviderSetupStatusViews()[0];
    assert.equal(view.supportState, "QUALIFICATION_REQUIRED");
    repository.putProviderQualificationState({ providerId: "provider-1", distributionId: "dist-1", providerVersion: "runtime-1", state: "QUALIFIED", evidenceRef: "qualification-evidence-1", verifiedAt: now }, now);
    view = repository.listProviderSetupStatusViews()[0];
    assert.equal(view.supportState, "SUPPORTED");
    assert.equal(view.compatibility, "COMPATIBLE");
    assert.equal(view.health, "READY");
    assert.equal(view.locality, "LOCAL");
    assert.equal(view.qualificationState, "QUALIFIED");
  });
});

test("provider profile version changes atomically invalidate existing setup readiness", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    assert.deepEqual(repository.putProviderProfile(profile, policy, now), { id: "provider-1:model-1", version: 1 });
    assert.deepEqual(repository.putProviderSetupState({ providerId: "provider-1", distributionId: "dist-1", adapterVersion: "adapter-1", providerVersion: "runtime-1", state: "SETUP_READY", lastVerifiedAt: now, conformanceEvidenceRef: "evidence-1" }, now), { id: "provider-1", version: 1 });
    const updatedProfile = { ...profile, adapterVersion: "adapter-2", providerVersion: "runtime-2" };
    const updatedPolicy = { ...policy, adapterVersion: "adapter-2", acceptedVersions: [{ kind: "EXACT", version: "runtime-2" }] };
    assert.deepEqual(repository.putProviderProfile(updatedProfile, updatedPolicy, "2026-08-15T00:00:01.000Z"), { id: "provider-1:model-1", version: 2 });
    const row = connection.database.prepare("SELECT state, version, setup_json FROM provider_setup_state WHERE provider_id = ?").get("provider-1");
    assert.equal(row.state, "SETUP_REQUIRED");
    assert.equal(row.version, 2);
    assert.deepEqual(JSON.parse(row.setup_json), { providerId: "provider-1", distributionId: "dist-1", adapterVersion: "adapter-2", providerVersion: "runtime-2", state: "SETUP_REQUIRED", lastAttemptOutcome: "PROVIDER_UPDATED" });
  });
});

test("provider setup persistence enforces compare-and-set workflow transitions", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    assert.deepEqual(repository.putProviderProfile(profile, policy, now), { id: "provider-1:model-1", version: 1 });
    assert.deepEqual(repository.putProviderSetupState({ providerId: "provider-1", distributionId: "dist-1", adapterVersion: "adapter-1", providerVersion: "runtime-1", state: "SETUP_REQUIRED" }, now), { id: "provider-1", version: 1 });
    assert.deepEqual(repository.transitionProviderSetupState("provider-1", "AUTHENTICATED_USER_START", "2026-08-15T00:00:01.000Z", 1), { id: "provider-1", version: 2 });
    assert.deepEqual(repository.transitionProviderSetupState("provider-1", "SETUP_PROBE_FAILED", "2026-08-15T00:00:02.000Z", 2), { id: "provider-1", version: 3 });
    assert.throws(() => repository.transitionProviderSetupState("provider-1", "SETUP_PROBE_PASSED", "2026-08-15T00:00:03.000Z", 3), /transition is not permitted/u);
    assert.throws(() => repository.transitionProviderSetupState("provider-1", "AUTHENTICATED_USER_START", "2026-08-15T00:00:04.000Z", 1), /stale or missing/u);
    const row = connection.database.prepare("SELECT state, version, setup_json FROM provider_setup_state WHERE provider_id = ?").get("provider-1");
    assert.equal(row.state, "SETUP_FAILED");
    assert.equal(row.version, 3);
    assert.equal(JSON.parse(row.setup_json).sanitizedFailureReason, "setup did not complete successfully");
  });
});

test("provider setup persistence records repair and cancellation without readiness", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    assert.deepEqual(repository.putProviderProfile(profile, policy, now), { id: "provider-1:model-1", version: 1 });
    assert.deepEqual(repository.putProviderSetupState({ providerId: "provider-1", distributionId: "dist-1", adapterVersion: "adapter-1", providerVersion: "runtime-1", state: "REPAIR_REQUIRED" }, now), { id: "provider-1", version: 1 });
    assert.deepEqual(repository.transitionProviderSetupState("provider-1", "AUTHENTICATED_USER_START", "2026-08-15T00:00:01.000Z", 1), { id: "provider-1", version: 2 });
    assert.deepEqual(repository.transitionProviderSetupState("provider-1", "CANCELLED", "2026-08-15T00:00:02.000Z", 2), { id: "provider-1", version: 3 });
    let row = connection.database.prepare("SELECT state, version, setup_json FROM provider_setup_state WHERE provider_id = ?").get("provider-1");
    assert.equal(row.state, "SETUP_FAILED");
    assert.equal(row.version, 3);
    assert.equal(JSON.parse(row.setup_json).lastAttemptOutcome, "CANCELLED");
    assert.equal(JSON.parse(row.setup_json).sanitizedFailureReason, "setup did not complete successfully");

    assert.deepEqual(repository.putProviderSetupState({ providerId: "provider-1", distributionId: "dist-1", adapterVersion: "adapter-1", providerVersion: "runtime-1", state: "REPAIR_REQUIRED" }, "2026-08-15T00:00:03.000Z"), { id: "provider-1", version: 4 });
    assert.deepEqual(repository.transitionProviderSetupState("provider-1", "AUTHENTICATED_USER_START", "2026-08-15T00:00:04.000Z", 4), { id: "provider-1", version: 5 });
    assert.deepEqual(repository.transitionProviderSetupState("provider-1", "HELPER_EXITED", "2026-08-15T00:00:05.000Z", 5), { id: "provider-1", version: 6 });
    row = connection.database.prepare("SELECT state, version, setup_json FROM provider_setup_state WHERE provider_id = ?").get("provider-1");
    assert.equal(row.state, "SETUP_IN_PROGRESS");
    assert.equal(JSON.parse(row.setup_json).lastAttemptOutcome, "HELPER_EXITED");
    assert.notEqual(JSON.parse(row.setup_json).state, "SETUP_READY");
  });
});

test("any persisted provider profile or compatibility-policy change invalidates setup readiness", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    assert.deepEqual(repository.putProviderProfile(profile, policy, now), { id: "provider-1:model-1", version: 1 });
    assert.deepEqual(repository.putProviderSetupState({ providerId: "provider-1", distributionId: "dist-1", adapterVersion: "adapter-1", providerVersion: "runtime-1", state: "SETUP_READY", lastVerifiedAt: now, conformanceEvidenceRef: "evidence-1" }, now), { id: "provider-1", version: 1 });
    const changedPolicy = { ...policy, conformanceProfileId: "conformance-2" };
    assert.deepEqual(repository.putProviderProfile(profile, changedPolicy, "2026-08-15T00:00:01.000Z"), { id: "provider-1:model-1", version: 2 });
    const row = connection.database.prepare("SELECT state, version, setup_json FROM provider_setup_state WHERE provider_id = ?").get("provider-1");
    assert.equal(row.state, "SETUP_REQUIRED");
    assert.equal(row.version, 2);
    assert.deepEqual(JSON.parse(row.setup_json), { providerId: "provider-1", distributionId: "dist-1", adapterVersion: "adapter-1", providerVersion: "runtime-1", state: "SETUP_REQUIRED", lastAttemptOutcome: "PROVIDER_UPDATED" });
  });
});
