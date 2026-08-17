import type { UtcTimestamp } from "./common.js";
import type { ToolAdapter, ToolManifest, ToolRequest } from "./tool.js";
import { validateToolManifest } from "./tool-runtime.mjs";

export type GitReadOperation = "STATUS" | "BRANCH" | "DIFF" | "LOG";
export type GitPathState = "CLEAN" | "ADDED" | "MODIFIED" | "DELETED" | "RENAMED" | "COPIED" | "UNMERGED" | "UNTRACKED" | "TYPE_CHANGED" | "IGNORED" | "UNKNOWN";

export interface GitStatusInput {
  readonly operation: "STATUS";
  readonly projectId: string;
  readonly workspaceId: string;
  readonly maxEntries: number;
}

export interface GitBranchInput {
  readonly operation: "BRANCH";
  readonly projectId: string;
  readonly workspaceId: string;
}

export interface GitDiffInput {
  readonly operation: "DIFF";
  readonly projectId: string;
  readonly workspaceId: string;
  readonly maxBytes: number;
}

export interface GitLogInput {
  readonly operation: "LOG";
  readonly projectId: string;
  readonly workspaceId: string;
  readonly maxEntries: number;
  readonly maxBytes: number;
}

export type GitReadInput = GitStatusInput | GitBranchInput | GitDiffInput | GitLogInput;

export interface GitStatusEntry {
  readonly path: string;
  readonly indexState: GitPathState;
  readonly worktreeState: GitPathState;
}

export interface GitStatusOutput {
  readonly operation: "STATUS";
  readonly projectId: string;
  readonly workspaceId: string;
  readonly workspaceIdentity: string;
  readonly repositoryIdentity: string;
  readonly branch: string;
  readonly headCommit: string;
  readonly entries: readonly GitStatusEntry[];
  readonly truncated: boolean;
  readonly observedAt: UtcTimestamp;
}

export interface GitBranchOutput {
  readonly operation: "BRANCH";
  readonly projectId: string;
  readonly workspaceId: string;
  readonly workspaceIdentity: string;
  readonly repositoryIdentity: string;
  readonly branch: string;
  readonly headCommit: string;
  readonly upstream: string;
  readonly ahead: number;
  readonly behind: number;
  readonly observedAt: UtcTimestamp;
}

export interface GitDiffOutput {
  readonly operation: "DIFF";
  readonly projectId: string;
  readonly workspaceId: string;
  readonly workspaceIdentity: string;
  readonly repositoryIdentity: string;
  readonly patch: string;
  readonly bytes: number;
  readonly truncated: boolean;
  readonly observedAt: UtcTimestamp;
}

export interface GitLogEntry {
  readonly commit: string;
  readonly author: string;
  readonly authoredAt: UtcTimestamp;
  readonly subject: string;
}

export interface GitLogOutput {
  readonly operation: "LOG";
  readonly projectId: string;
  readonly workspaceId: string;
  readonly workspaceIdentity: string;
  readonly repositoryIdentity: string;
  readonly entries: readonly GitLogEntry[];
  readonly bytes: number;
  readonly truncated: boolean;
  readonly observedAt: UtcTimestamp;
}

export type GitReadOutput = GitStatusOutput | GitBranchOutput | GitDiffOutput | GitLogOutput;

export interface PlatformGitReadBoundary {
  readStatus(input: GitStatusInput, signal?: AbortSignal): Promise<GitStatusOutput>;
  readBranch(input: GitBranchInput, signal?: AbortSignal): Promise<GitBranchOutput>;
  readDiff(input: GitDiffInput, signal?: AbortSignal): Promise<GitDiffOutput>;
  readLog(input: GitLogInput, signal?: AbortSignal): Promise<GitLogOutput>;
}

export class ToolGitValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolGitValidationError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ToolGitValidationError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) throw new ToolGitValidationError("Git record contains unsupported or missing fields");
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value)) throw new ToolGitValidationError(`${label} is invalid`);
  return value;
}

function text(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength || value.includes("\0")) throw new ToolGitValidationError(`${label} is invalid`);
  return value;
}

function timestamp(value: unknown, label: string): string {
  const result = text(value, label, 64);
  if (Number.isNaN(Date.parse(result))) throw new ToolGitValidationError(`${label} must be an ISO timestamp`);
  return result;
}

function commit(value: unknown, label: string): string {
  if (value === "UNBORN") return value;
  if (typeof value !== "string" || !/^[a-f0-9]{40,64}$/u.test(value)) throw new ToolGitValidationError(`${label} is invalid`);
  return value;
}

function relativePath(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 4096 || value.includes("\0") || /^[A-Za-z]:[\\/]/u.test(value) || value.startsWith("\\\\") || value.split(/[\\/]/u).includes("..")) throw new ToolGitValidationError("Git path must remain inside the resolved workspace");
  return value;
}

function pathState(value: unknown, label: string): GitPathState {
  const states: readonly GitPathState[] = ["CLEAN", "ADDED", "MODIFIED", "DELETED", "RENAMED", "COPIED", "UNMERGED", "UNTRACKED", "TYPE_CHANGED", "IGNORED", "UNKNOWN"];
  if (typeof value !== "string" || !states.includes(value as GitPathState)) throw new ToolGitValidationError(`${label} is invalid`);
  return value as GitPathState;
}

function baseInput(input: Record<string, unknown>): { projectId: string; workspaceId: string } {
  return { projectId: id(input.projectId, "projectId"), workspaceId: id(input.workspaceId, "workspaceId") };
}

export function validateGitReadInput(value: unknown): GitReadInput {
  const input = record(value, "Git request");
  const base = baseInput(input);
  if (input.operation === "STATUS") {
    exactKeys(input, ["operation", "projectId", "workspaceId", "maxEntries"]);
    if (!Number.isSafeInteger(input.maxEntries) || (input.maxEntries as number) < 1 || (input.maxEntries as number) > 4096) throw new ToolGitValidationError("maxEntries is invalid");
    return Object.freeze({ operation: "STATUS", ...base, maxEntries: input.maxEntries as number });
  }
  if (input.operation === "BRANCH") {
    exactKeys(input, ["operation", "projectId", "workspaceId"]);
    return Object.freeze({ operation: "BRANCH", ...base });
  }
  if (input.operation === "DIFF") {
    exactKeys(input, ["operation", "projectId", "workspaceId", "maxBytes"]);
    if (!Number.isSafeInteger(input.maxBytes) || (input.maxBytes as number) < 1 || (input.maxBytes as number) > 4_194_304) throw new ToolGitValidationError("maxBytes is invalid");
    return Object.freeze({ operation: "DIFF", ...base, maxBytes: input.maxBytes as number });
  }
  if (input.operation === "LOG") {
    exactKeys(input, ["operation", "projectId", "workspaceId", "maxEntries", "maxBytes"]);
    if (!Number.isSafeInteger(input.maxEntries) || (input.maxEntries as number) < 1 || (input.maxEntries as number) > 1000) throw new ToolGitValidationError("maxEntries is invalid");
    if (!Number.isSafeInteger(input.maxBytes) || (input.maxBytes as number) < 1 || (input.maxBytes as number) > 1_048_576) throw new ToolGitValidationError("maxBytes is invalid");
    return Object.freeze({ operation: "LOG", ...base, maxEntries: input.maxEntries as number, maxBytes: input.maxBytes as number });
  }
  throw new ToolGitValidationError("Git operation is invalid");
}

function validateIdentityFields(input: Record<string, unknown>): { projectId: string; workspaceId: string; workspaceIdentity: string; repositoryIdentity: string } {
  return {
    projectId: id(input.projectId, "projectId"),
    workspaceId: id(input.workspaceId, "workspaceId"),
    workspaceIdentity: id(input.workspaceIdentity, "workspaceIdentity"),
    repositoryIdentity: id(input.repositoryIdentity, "repositoryIdentity"),
  };
}

export function validateGitReadOutput(value: unknown): GitReadOutput {
  const input = record(value, "Git output");
  const identity = validateIdentityFields(input);
  if (input.operation === "STATUS") {
    exactKeys(input, ["operation", "projectId", "workspaceId", "workspaceIdentity", "repositoryIdentity", "branch", "headCommit", "entries", "truncated", "observedAt"]);
    if (!Array.isArray(input.entries) || input.entries.length > 4096) throw new ToolGitValidationError("status entries are invalid");
    const entries = input.entries.map((entry) => {
      const item = record(entry, "Git status entry");
      exactKeys(item, ["path", "indexState", "worktreeState"]);
      return Object.freeze({ path: relativePath(item.path), indexState: pathState(item.indexState, "indexState"), worktreeState: pathState(item.worktreeState, "worktreeState") });
    });
    if (typeof input.truncated !== "boolean") throw new ToolGitValidationError("status truncated is invalid");
    return Object.freeze({ operation: "STATUS", ...identity, branch: text(input.branch, "branch", 1024), headCommit: commit(input.headCommit, "headCommit"), entries: Object.freeze(entries), truncated: input.truncated, observedAt: timestamp(input.observedAt, "observedAt") });
  }
  if (input.operation === "BRANCH") {
    exactKeys(input, ["operation", "projectId", "workspaceId", "workspaceIdentity", "repositoryIdentity", "branch", "headCommit", "upstream", "ahead", "behind", "observedAt"]);
    if (!Number.isSafeInteger(input.ahead) || (input.ahead as number) < 0 || !Number.isSafeInteger(input.behind) || (input.behind as number) < 0) throw new ToolGitValidationError("branch divergence is invalid");
    return Object.freeze({ operation: "BRANCH", ...identity, branch: text(input.branch, "branch", 1024), headCommit: commit(input.headCommit, "headCommit"), upstream: text(input.upstream, "upstream", 1024), ahead: input.ahead as number, behind: input.behind as number, observedAt: timestamp(input.observedAt, "observedAt") });
  }
  if (input.operation === "DIFF") {
    exactKeys(input, ["operation", "projectId", "workspaceId", "workspaceIdentity", "repositoryIdentity", "patch", "bytes", "truncated", "observedAt"]);
    if (typeof input.patch !== "string" || input.patch.length > 4_194_304 || input.patch.includes("\0")) throw new ToolGitValidationError("patch is invalid");
    const patch = input.patch;
    if (!Number.isSafeInteger(input.bytes) || (input.bytes as number) < 0 || (input.bytes as number) > 4_194_304 || new TextEncoder().encode(patch).byteLength !== input.bytes) throw new ToolGitValidationError("diff bytes are invalid");
    if (typeof input.truncated !== "boolean") throw new ToolGitValidationError("diff truncated is invalid");
    return Object.freeze({ operation: "DIFF", ...identity, patch, bytes: input.bytes as number, truncated: input.truncated, observedAt: timestamp(input.observedAt, "observedAt") });
  }
  if (input.operation === "LOG") {
    exactKeys(input, ["operation", "projectId", "workspaceId", "workspaceIdentity", "repositoryIdentity", "entries", "bytes", "truncated", "observedAt"]);
    if (!Array.isArray(input.entries) || input.entries.length > 1000) throw new ToolGitValidationError("log entries are invalid");
    const entries = input.entries.map((entry) => {
      const item = record(entry, "Git log entry");
      exactKeys(item, ["commit", "author", "authoredAt", "subject"]);
      return Object.freeze({ commit: commit(item.commit, "commit"), author: text(item.author, "author", 256), authoredAt: timestamp(item.authoredAt, "authoredAt"), subject: text(item.subject, "subject", 1024) });
    });
    if (!Number.isSafeInteger(input.bytes) || (input.bytes as number) < 0 || (input.bytes as number) > 1_048_576 || typeof input.truncated !== "boolean") throw new ToolGitValidationError("log bounds are invalid");
    return Object.freeze({ operation: "LOG", ...identity, entries: Object.freeze(entries), bytes: input.bytes as number, truncated: input.truncated, observedAt: timestamp(input.observedAt, "observedAt") });
  }
  throw new ToolGitValidationError("Git output operation is invalid");
}

const GIT_PRECONDITION = { checkId: "git-workspace-resolved", kind: "STATE_QUERY", verifierId: "canonical-git-workspace", parametersSchemaId: "jarvis.schema.tool-git.request.v1", required: true, onUnknown: "FAIL" } as const;

function gitManifest(toolId: string, operation: string, description: string): ToolManifest {
  return validateToolManifest({
    toolId,
    version: 1,
    description,
    inputSchemaId: "jarvis.schema.tool-git.request.v1",
    outputSchemaId: "jarvis.schema.tool-git.response.v1",
    baselineRisk: "LOW",
    sideEffectClass: "READ_ONLY",
    reversible: true,
    requiredPermissionIds: ["workspace.git.read"],
    allowedEnvironments: ["WINDOWS_FULL_HOST"],
    allowedScopeKinds: ["PROJECT_WORKSPACE"],
    secretCapabilities: [],
    networkRequired: false,
    requiredPlatformCapabilities: ["git.workspace.read", "filesystem.workspace.read"],
    platformCompatibility: [{ platform: "WINDOWS", runtimeRoles: ["FULL_HOST"], architecture: ["x64"] }],
    idempotency: "IDEMPOTENT",
    preconditions: [GIT_PRECONDITION],
    postconditions: [],
    preemptionPolicy: "PREEMPTIBLE",
  });
}

export const GIT_STATUS_TOOL_MANIFEST = gitManifest("jarvis.git.status", "STATUS", "Read bounded Git workspace status through the canonical platform path/process boundary.");
export const GIT_BRANCH_TOOL_MANIFEST = gitManifest("jarvis.git.branch", "BRANCH", "Read the current Git branch and exact repository/workspace identity through the platform boundary.");
export const GIT_DIFF_TOOL_MANIFEST = gitManifest("jarvis.git.diff", "DIFF", "Read a bounded Git diff through the canonical platform process boundary.");
export const GIT_LOG_TOOL_MANIFEST = gitManifest("jarvis.git.log", "LOG", "Read bounded Git history through the canonical platform process boundary.");

export function createGitReadAdapter(boundary: PlatformGitReadBoundary, operation: GitReadOperation): ToolAdapter {
  const manifest = operation === "STATUS" ? GIT_STATUS_TOOL_MANIFEST : operation === "BRANCH" ? GIT_BRANCH_TOOL_MANIFEST : operation === "DIFF" ? GIT_DIFF_TOOL_MANIFEST : GIT_LOG_TOOL_MANIFEST;
  return Object.freeze({
    toolId: manifest.toolId,
    toolVersion: manifest.version,
    async execute(request: ToolRequest, _manifest: ToolManifest, signal?: AbortSignal): Promise<Readonly<Record<string, unknown>>> {
      const input = validateGitReadInput(request.arguments);
      if (input.operation !== operation) throw new ToolGitValidationError("Git adapter operation does not match request");
      const output = operation === "STATUS" ? await boundary.readStatus(input as GitStatusInput, signal) : operation === "BRANCH" ? await boundary.readBranch(input as GitBranchInput, signal) : operation === "DIFF" ? await boundary.readDiff(input as GitDiffInput, signal) : await boundary.readLog(input as GitLogInput, signal);
      return validateGitReadOutput(output) as unknown as Readonly<Record<string, unknown>>;
    },
  });
}
