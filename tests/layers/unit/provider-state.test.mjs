import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { advanceProviderSetupState, describeProviderSetupState, evaluateProviderDistributionCompatibility, validateIntegrationAccount, validateModuleManifest, validateProxmoxConnection, validateProviderAdapterContract, validateProviderAdapterEvent, validateProviderAdapterResult, validateProviderDistributionIdentity, validateProviderProfile, validateProviderSetupStartRequest } from "../../../packages/protocol/src/provider-runtime.mts";
import { applyCoreMigrations, CoreSchemaError, CoreStateRepository } from "../../../services/core/src/schema.ts";
import { openCoreDatabase } from "../../../services/core/src/persistence.ts";

const TEST_DB_DEK = Buffer.alloc(32, 0x42);
const now = "2026-08-15T00:00:00.000Z";

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

test("provider setup workflow requires explicit user start and never treats helper exit as readiness", () => {
  assert.deepEqual(advanceProviderSetupState("NOT_REQUIRED", "DISCOVERY_REQUIRES_SETUP"), { previousState: "NOT_REQUIRED", action: "DISCOVERY_REQUIRES_SETUP", nextState: "SETUP_REQUIRED", requiresAuthenticatedUser: false, readyVerified: false });
  assert.deepEqual(advanceProviderSetupState("SETUP_REQUIRED", "AUTHENTICATED_USER_START"), { previousState: "SETUP_REQUIRED", action: "AUTHENTICATED_USER_START", nextState: "SETUP_IN_PROGRESS", requiresAuthenticatedUser: true, readyVerified: false });
  assert.equal(advanceProviderSetupState("SETUP_IN_PROGRESS", "HELPER_EXITED").nextState, "SETUP_IN_PROGRESS");
  assert.equal(advanceProviderSetupState("SETUP_IN_PROGRESS", "SETUP_PROBE_PASSED").readyVerified, true);
  assert.equal(advanceProviderSetupState("SETUP_IN_PROGRESS", "CANCELLED").nextState, "SETUP_FAILED");
  assert.equal(describeProviderSetupState("REPAIR_REQUIRED").userActionRequired, true);
  assert.equal(describeProviderSetupState("SETUP_IN_PROGRESS").ready, false);
  assert.throws(() => advanceProviderSetupState("SETUP_READY", "AUTHENTICATED_USER_START"), /requires setup or repair/u);
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
    assert.throws(() => repository.putProviderSetupState({ providerId: "provider-1", distributionId: "dist-1", adapterVersion: "adapter-2", providerVersion: "runtime-2", state: "SETUP_READY" }, now), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT");
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
