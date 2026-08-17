import { evaluateToolAdmission } from "../../../packages/policy/src/tool-admission.mjs";
import { createToolError, executeRegisteredTool, ToolRegistry, ToolSchemaRegistry, validateToolRequest } from "../../../packages/protocol/src/tool-runtime.mjs";
import type { ToolAdmissionDecision, ToolCriterionResult, ToolExecutionHooks, ToolManifest, ToolRequest, ToolResult } from "../../../packages/protocol/src/tool.ts";
import {
  createEngineeringExecutionAdapter,
  PROJECT_BUILD_TOOL_MANIFEST,
  PROJECT_TEST_TOOL_MANIFEST,
  validateEngineeringExecutionInput,
  validateEngineeringExecutionOutput,
  type PlatformEngineeringExecutionBoundary,
} from "../../../packages/protocol/src/tool-engineering.mjs";
import {
  createPlatformFilesystemAdapter,
  FILESYSTEM_READ_TOOL_MANIFEST,
  FILESYSTEM_WRITE_TOOL_MANIFEST,
  validateFilesystemToolInput,
  validateFilesystemToolOutput,
  type PlatformFilesystemBoundary,
} from "../../../packages/protocol/src/tool-filesystem.mjs";
import {
  createGitReadAdapter,
  GIT_BRANCH_TOOL_MANIFEST,
  GIT_DIFF_TOOL_MANIFEST,
  GIT_LOG_TOOL_MANIFEST,
  GIT_STATUS_TOOL_MANIFEST,
  validateGitReadInput,
  validateGitReadOutput,
  type PlatformGitReadBoundary,
} from "../../../packages/protocol/src/tool-git.mjs";
import {
  createPlatformOpenAdapter,
  OPEN_APPLICATION_PROJECT_FILE_TOOL_MANIFEST,
  validateOpenToolInput,
  validateOpenToolOutput,
  type PlatformOpenBoundary,
} from "../../../packages/protocol/src/tool-open.mjs";
import {
  createProjectSystemStatusAdapter,
  PROJECT_SYSTEM_STATUS_TOOL_MANIFEST,
  validateProjectSystemStatusInput,
  validateProjectSystemStatusOutput,
  type ProjectSystemStatusProvider,
} from "../../../packages/protocol/src/tool-status.mjs";
import type { CoreStateRepository } from "./schema.js";
import { createNativeToolPlatformBoundaries, type CoreNativeCapabilityClient } from "./native-capability.mjs";

export interface CoreToolExecutionAuditStore {
  recordToolExecutionAudit(result: ToolResult, manifest: ToolManifest): void;
}

export interface CoreToolExecutionContextProvider {
  readPermissionDecision(request: ToolRequest, manifest: ToolManifest): Promise<unknown>;
  readPreAllowGateFacts(request: ToolRequest, manifest: ToolManifest): Promise<unknown>;
  evaluatePreconditions?(request: ToolRequest, manifest: ToolManifest, input: Readonly<Record<string, unknown>>, signal?: AbortSignal): Promise<readonly ToolCriterionResult[]>;
  evaluatePostconditions?(request: ToolRequest, manifest: ToolManifest, output: Readonly<Record<string, unknown>>, signal?: AbortSignal): Promise<readonly ToolCriterionResult[]>;
}

export interface CoreToolRuntimeDependencies {
  readonly registry: ToolRegistry;
  readonly schemas: ToolSchemaRegistry;
  readonly auditStore: CoreToolExecutionAuditStore | Pick<CoreStateRepository, "recordToolExecutionAudit">;
  readonly context: CoreToolExecutionContextProvider;
}

export interface CoreToolPlatformBoundaries {
  readonly status: ProjectSystemStatusProvider;
  readonly open: PlatformOpenBoundary;
  readonly filesystem: PlatformFilesystemBoundary;
  readonly engineering: PlatformEngineeringExecutionBoundary;
  readonly git: PlatformGitReadBoundary;
}

export function createCoreToolRuntime(
  auditStore: CoreToolExecutionAuditStore | Pick<CoreStateRepository, "recordToolExecutionAudit">,
  boundaries: CoreToolPlatformBoundaries,
  context: CoreToolExecutionContextProvider,
): CoreToolRuntime {
  const registry = new ToolRegistry();
  const schemas = new ToolSchemaRegistry();
  registerCoreTools(registry, schemas, boundaries);
  return new CoreToolRuntime({ registry, schemas, auditStore, context });
}

/**
 * Composition-root placeholder for the native Windows capability channel.
 *
 * This is deliberately an unavailable boundary, not a fake adapter: the live
 * Core can be composed and exercise its real ToolExecutor without claiming
 * that a native filesystem, opener, Git, status, or engineering adapter is
 * ready before its authenticated host channel has been attached.
 */
export function createFailClosedCoreToolRuntime(
  auditStore: CoreToolExecutionAuditStore | Pick<CoreStateRepository, "recordToolExecutionAudit">,
): CoreToolRuntime {
  const unavailable = async (): Promise<never> => {
    throw new Error("CORE_NATIVE_PLATFORM_BOUNDARY_NOT_READY");
  };
  const boundaries: CoreToolPlatformBoundaries = {
    status: { readProjectStatus: unavailable, readSystemStatus: unavailable },
    open: { openApplication: unavailable, openProject: unavailable, openFile: unavailable },
    filesystem: { readText: unavailable, writeText: unavailable },
    engineering: { execute: unavailable },
    git: { readStatus: unavailable, readBranch: unavailable, readDiff: unavailable, readLog: unavailable },
  };
  return createCoreToolRuntime(auditStore, boundaries, {
      readPermissionDecision: async () => {
        throw new Error("CORE_TOOL_PERMISSION_CONTEXT_NOT_READY");
      },
      readPreAllowGateFacts: async () => {
        throw new Error("CORE_TOOL_PRE_ALLOW_CONTEXT_NOT_READY");
      },
  });
}

export function createNativeCoreToolRuntime(
  auditStore: CoreToolExecutionAuditStore | Pick<CoreStateRepository, "recordToolExecutionAudit">,
  client: CoreNativeCapabilityClient,
  context: CoreToolExecutionContextProvider,
): CoreToolRuntime {
  return createCoreToolRuntime(auditStore, createNativeToolPlatformBoundaries(client), context);
}

function registerSchema(schemas: ToolSchemaRegistry, schemaId: string, validator: (value: unknown) => Readonly<Record<string, unknown>>): void {
  schemas.register(schemaId, validator);
}

/** Register the complete current Section 8 tool set behind typed boundaries. */
export function registerCoreTools(registry: ToolRegistry, schemas: ToolSchemaRegistry, boundaries: CoreToolPlatformBoundaries): void {
  registerSchema(schemas, "jarvis.schema.tool-status.request.v1", validateProjectSystemStatusInput as unknown as (value: unknown) => Readonly<Record<string, unknown>>);
  registerSchema(schemas, "jarvis.schema.tool-status.response.v1", validateProjectSystemStatusOutput as unknown as (value: unknown) => Readonly<Record<string, unknown>>);
  registerSchema(schemas, "jarvis.schema.tool-open.request.v1", validateOpenToolInput as unknown as (value: unknown) => Readonly<Record<string, unknown>>);
  registerSchema(schemas, "jarvis.schema.tool-open.response.v1", validateOpenToolOutput as unknown as (value: unknown) => Readonly<Record<string, unknown>>);
  registerSchema(schemas, "jarvis.schema.tool-filesystem.request.v1", validateFilesystemToolInput as unknown as (value: unknown) => Readonly<Record<string, unknown>>);
  registerSchema(schemas, "jarvis.schema.tool-filesystem.response.v1", validateFilesystemToolOutput as unknown as (value: unknown) => Readonly<Record<string, unknown>>);
  registerSchema(schemas, "jarvis.schema.tool-engineering.request.v1", validateEngineeringExecutionInput as unknown as (value: unknown) => Readonly<Record<string, unknown>>);
  registerSchema(schemas, "jarvis.schema.tool-engineering.response.v1", validateEngineeringExecutionOutput as unknown as (value: unknown) => Readonly<Record<string, unknown>>);
  registerSchema(schemas, "jarvis.schema.tool-git.request.v1", validateGitReadInput as unknown as (value: unknown) => Readonly<Record<string, unknown>>);
  registerSchema(schemas, "jarvis.schema.tool-git.response.v1", validateGitReadOutput as unknown as (value: unknown) => Readonly<Record<string, unknown>>);

  registry.register(PROJECT_SYSTEM_STATUS_TOOL_MANIFEST, createProjectSystemStatusAdapter(boundaries.status));
  registry.register(OPEN_APPLICATION_PROJECT_FILE_TOOL_MANIFEST, createPlatformOpenAdapter(boundaries.open));
  registry.register(FILESYSTEM_READ_TOOL_MANIFEST, createPlatformFilesystemAdapter(boundaries.filesystem, "READ_TEXT"));
  registry.register(FILESYSTEM_WRITE_TOOL_MANIFEST, createPlatformFilesystemAdapter(boundaries.filesystem, "WRITE_TEXT"));
  registry.register(PROJECT_TEST_TOOL_MANIFEST, createEngineeringExecutionAdapter(boundaries.engineering, "TEST"));
  registry.register(PROJECT_BUILD_TOOL_MANIFEST, createEngineeringExecutionAdapter(boundaries.engineering, "BUILD"));
  registry.register(GIT_STATUS_TOOL_MANIFEST, createGitReadAdapter(boundaries.git, "STATUS"));
  registry.register(GIT_BRANCH_TOOL_MANIFEST, createGitReadAdapter(boundaries.git, "BRANCH"));
  registry.register(GIT_DIFF_TOOL_MANIFEST, createGitReadAdapter(boundaries.git, "DIFF"));
  registry.register(GIT_LOG_TOOL_MANIFEST, createGitReadAdapter(boundaries.git, "LOG"));
}

/**
 * Core-owned execution boundary. Renderer, provider, and platform adapters
 * receive no direct authority to execute a registered tool: every request
 * passes through typed manifest resolution, PermissionEngine admission,
 * pre/postcondition hooks, and durable audit recording here.
 */
export class CoreToolRuntime {
  private readonly dependencies: CoreToolRuntimeDependencies;

  constructor(dependencies: CoreToolRuntimeDependencies) {
    this.dependencies = dependencies;
  }

  async execute(requestValue: unknown, signal?: AbortSignal): Promise<ToolResult> {
    const request = validateToolRequest(requestValue);
    const hooks: ToolExecutionHooks = {
      admit: async (request, manifest): Promise<ToolAdmissionDecision> => {
        try {
          const [permissionDecision, preAllowFacts] = await Promise.all([
            this.dependencies.context.readPermissionDecision(request, manifest),
            this.dependencies.context.readPreAllowGateFacts(request, manifest),
          ]);
          return evaluateToolAdmission({ request, manifest, permissionDecision, preAllowFacts });
        } catch {
          return {
            outcome: "UNCERTAIN",
            error: createToolError("TOOL_ADMISSION_CONTEXT_UNAVAILABLE", "INTERNAL", "tool admission facts could not be verified", true, request.toolExecutionId),
          };
        }
      },
      evaluatePreconditions: async (request, manifest, input, executionSignal) => {
        if (this.dependencies.context.evaluatePreconditions === undefined) return [];
        return this.dependencies.context.evaluatePreconditions(request, manifest, input, executionSignal);
      },
      evaluatePostconditions: async (request, manifest, output, executionSignal) => {
        if (this.dependencies.context.evaluatePostconditions === undefined) return [];
        return this.dependencies.context.evaluatePostconditions(request, manifest, output, executionSignal);
      },
      recordAudit: async (result) => {
        const manifest = this.dependencies.registry.resolve(request.toolId, request.toolVersion);
        await Promise.resolve(this.dependencies.auditStore.recordToolExecutionAudit(result, manifest));
      },
    };
    return executeRegisteredTool(this.dependencies.registry, this.dependencies.schemas, requestValue, hooks, signal);
  }
}
