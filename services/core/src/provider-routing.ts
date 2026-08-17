import type {
  ProviderAdapterContract,
  ProviderRoutingRequestV1,
  ProviderRoutingResultV1,
} from "../../../packages/protocol/src/provider.js";
import { selectProviderForRole } from "../../../packages/protocol/src/provider-routing.mjs";
import { validateProviderAdapterContract } from "../../../packages/protocol/src/provider-runtime.mjs";
import { validateProviderWorkspaceEngineeringRequest } from "../../../packages/protocol/src/provider-workspace-runtime.mjs";
import { validatePermissionDecision } from "../../../packages/protocol/src/authority-runtime.mjs";
import { evaluatePreAllowGates } from "../../../packages/policy/src/pre-allow-gates.mjs";
import type { ProviderWorkspaceEngineeringRequestV1 } from "../../../packages/protocol/src/provider-workspace.js";
import type { ProjectWorkspaceRecord } from "../../../packages/protocol/src/project.js";
import { CODEX_CLI_ADAPTER_CONTRACT } from "../../../providers/ai/src/codex-cli-adapter.mjs";
import type { CoreStateRepository } from "./schema.js";

export class ProviderRoutingServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderRoutingServiceError";
  }
}

export type ProviderAdapterRegistry = ReadonlyMap<string, ProviderAdapterContract>;

export interface ProviderWorkspaceEngineeringAdmission {
  readonly request: ProviderWorkspaceEngineeringRequestV1;
  readonly routing: ProviderRoutingResultV1;
}

export interface ProviderRoutingAdmission {
  readonly permissionDecision: unknown;
  readonly preAllowGateFacts: unknown;
}

/**
 * Core owns the explicit adapter registry. Registration validates the adapter
 * contract and rejects duplicate provider identities; it never discovers or
 * trusts an adapter merely because a persisted profile names it.
 */
export function createProviderAdapterRegistry(adapters: readonly unknown[] = [CODEX_CLI_ADAPTER_CONTRACT]): ProviderAdapterRegistry {
  if (!Array.isArray(adapters) || adapters.length > 128) throw new ProviderRoutingServiceError("provider adapter registry is invalid");
  const registry = new Map<string, ProviderAdapterContract>();
  for (const value of adapters) {
    const adapter = validateProviderAdapterContract(value);
    if (registry.has(adapter.providerId)) throw new ProviderRoutingServiceError("provider adapter registry contains a duplicate provider");
    registry.set(adapter.providerId, adapter);
  }
  return registry;
}

const REGISTERED_ADAPTERS = createProviderAdapterRegistry();

/**
 * Builds routing candidates only from Core-owned persisted records and
 * explicitly registered adapter contracts. Missing qualification/setup state
 * is a no-match condition; it is never synthesized as ready or qualified.
 */
export function routePersistedProviderForRole(
  repository: Pick<CoreStateRepository, "listProviderProfiles" | "listProviderSetupStates" | "listProviderQualificationStates">,
  request: ProviderRoutingRequestV1,
  adapterRegistry: ProviderAdapterRegistry = REGISTERED_ADAPTERS,
): ProviderRoutingResultV1 {
  const setups = new Map(repository.listProviderSetupStates().map((setup) => [setup.providerId, setup]));
  const qualifications = new Map(repository.listProviderQualificationStates().map((qualification) => [qualification.providerId, qualification]));
  const candidates = repository.listProviderProfiles().flatMap(({ profile }) => {
    const adapter = adapterRegistry.get(profile.providerId);
    const setup = setups.get(profile.providerId);
    const qualification = qualifications.get(profile.providerId);
    if (adapter === undefined || setup === undefined || qualification === undefined) return [];
    return [{ profile, adapter, setup, qualification }];
  });
  return selectProviderForRole(request, candidates);
}

/**
 * The Core-owned route used before provider execution. Fallback is never a
 * permission or budget escape hatch: the caller must present the current
 * PermissionEngine ALLOW decision and a complete passing pre-ALLOW fact set.
 * Candidate-level setup, qualification, locality, capability, and platform
 * checks still run inside the typed selector.
 */
export function routePersistedProviderForRoleWithAdmission(
  repository: Pick<CoreStateRepository, "listProviderProfiles" | "listProviderSetupStates" | "listProviderQualificationStates">,
  request: ProviderRoutingRequestV1,
  admission: ProviderRoutingAdmission,
  adapterRegistry: ProviderAdapterRegistry = REGISTERED_ADAPTERS,
): ProviderRoutingResultV1 {
  const permission = validatePermissionDecision(admission.permissionDecision);
  if (permission.outcome !== "ALLOW") {
    throw new ProviderRoutingServiceError("provider routing requires an ALLOW permission decision");
  }
  const preAllow = evaluatePreAllowGates(admission.preAllowGateFacts);
  if (!preAllow.passed) {
    throw new ProviderRoutingServiceError(`provider routing pre-ALLOW gate failed: ${preAllow.failedGate ?? "UNKNOWN"}`);
  }
  return routePersistedProviderForRole(repository, request, adapterRegistry);
}

function sameWorkspace(left: ProjectWorkspaceRecord, right: ProjectWorkspaceRecord): boolean {
  return left.workspaceId === right.workspaceId
    && left.projectId === right.projectId
    && left.displayName === right.displayName
    && left.kind === right.kind
    && left.canonicalRoot.platform === right.canonicalRoot.platform
    && left.canonicalRoot.value === right.canonicalRoot.value
    && left.worktreeIdentity === right.worktreeIdentity
    && left.branch === right.branch
    && left.sourceCommit === right.sourceCommit;
}

/**
 * Admits a bounded engineering request only when its workspace is still the
 * exact Core-registered identity and its explicitly assigned provider is
 * routable for the software-engineer role. This is admission only; process,
 * filesystem, network, and environment enforcement remain provider/OS gates.
 */
export function admitPersistedProviderWorkspaceEngineeringRequest(
  repository: Pick<CoreStateRepository, "getProjectWorkspace" | "listProviderProfiles" | "listProviderSetupStates" | "listProviderQualificationStates">,
  value: unknown,
  adapterRegistry: ProviderAdapterRegistry = REGISTERED_ADAPTERS,
): ProviderWorkspaceEngineeringAdmission {
  const request = validateProviderWorkspaceEngineeringRequest(value);
  if (request.providerId === "codex-cli" && request.networkMode !== "ENABLED") {
    throw new ProviderRoutingServiceError("Codex WORKSPACE_ENGINEERING requests require network-enabled mode");
  }
  const storedWorkspace = repository.getProjectWorkspace(request.workspace.workspaceId);
  if (storedWorkspace === undefined || !sameWorkspace(storedWorkspace, request.workspace)) {
    throw new ProviderRoutingServiceError("assigned workspace is not the current Core-registered workspace");
  }
  const routingRequest: ProviderRoutingRequestV1 = {
    domain: "jarvis.provider-routing-request.v1",
    schemaVersion: 1,
    requestId: request.requestId,
    role: "SOFTWARE_ENGINEER",
    platform: { platform: "WINDOWS", runtimeRole: "FULL_HOST", architecture: "x64", backendProfileId: "windows-v1" },
    dataPolicy: request.dataPolicy,
    requiredCapabilities: ["coding", "toolUse"],
    allowedProviderIds: [request.providerId],
  };
  const routing = routePersistedProviderForRole(repository, routingRequest, adapterRegistry);
  if (routing.outcome !== "SELECTED" || routing.selectedProviderId !== request.providerId) {
    throw new ProviderRoutingServiceError("assigned provider is not qualified and routable for WORKSPACE_ENGINEERING");
  }
  return Object.freeze({ request, routing });
}
