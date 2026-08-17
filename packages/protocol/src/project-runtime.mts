import { validatePlatformPathRef } from "./platform-runtime.mjs";
import type {
  ProjectAliasRecord,
  ProjectEnvironmentKind,
  ProjectEnvironmentRecord,
  ProjectRecord,
  ProjectWorkspaceKind,
  ProjectWorkspaceRecord,
} from "./project.ts";
import type { PlatformFamily } from "./platform.ts";

export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectValidationError";
  }
}

const PROJECT_ENVIRONMENT_KINDS = ["LOCAL", "REMOTE", "INTEGRATION"] as const;
const PROJECT_WORKSPACE_KINDS = ["PRIMARY", "WORKTREE"] as const;
const PLATFORM_FAMILIES = ["WINDOWS", "LINUX", "ANDROID"] as const;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ProjectValidationError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(value).some((key) => !allowed.has(key)) || required.some((key) => !(key in value))) {
    throw new ProjectValidationError("project record contains unsupported or missing fields");
  }
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value)) throw new ProjectValidationError(`${label} is invalid`);
  return value;
}

function text(value: unknown, label: string, max = 256): string {
  if (typeof value !== "string" || value.length < 1 || value.length > max || value.includes("\0")) throw new ProjectValidationError(`${label} is invalid`);
  return value;
}

function platform(value: unknown): PlatformFamily {
  if (typeof value !== "string" || !(PLATFORM_FAMILIES as readonly string[]).includes(value)) throw new ProjectValidationError("platform is invalid");
  return value as PlatformFamily;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new ProjectValidationError(`${label} is invalid`);
  return value as T;
}

export function validateProjectRecord(value: unknown): ProjectRecord {
  const input = record(value, "project");
  keys(input, ["projectId", "displayName", "canonicalRoot", "canonicalIdentity"], ["repositoryIdentity"]);
  return Object.freeze({
    projectId: id(input.projectId, "projectId"),
    displayName: text(input.displayName, "displayName"),
    canonicalRoot: validatePlatformPathRef(input.canonicalRoot),
    canonicalIdentity: id(input.canonicalIdentity, "canonicalIdentity"),
    ...(input.repositoryIdentity === undefined ? {} : { repositoryIdentity: id(input.repositoryIdentity, "repositoryIdentity") }),
  });
}

export function validateProjectAliasRecord(value: unknown): ProjectAliasRecord {
  const input = record(value, "project alias");
  keys(input, ["alias", "projectId"]);
  return Object.freeze({ alias: id(input.alias, "alias"), projectId: id(input.projectId, "projectId") });
}

export function validateProjectEnvironmentRecord(value: unknown): ProjectEnvironmentRecord {
  const input = record(value, "project environment");
  keys(input, ["environmentId", "projectId", "displayName", "kind", "platform"]);
  return Object.freeze({
    environmentId: id(input.environmentId, "environmentId"),
    projectId: id(input.projectId, "projectId"),
    displayName: text(input.displayName, "displayName"),
    kind: enumValue(input.kind, PROJECT_ENVIRONMENT_KINDS, "environment kind") as ProjectEnvironmentKind,
    platform: platform(input.platform),
  });
}

export function validateProjectWorkspaceRecord(value: unknown): ProjectWorkspaceRecord {
  const input = record(value, "project workspace");
  keys(input, ["workspaceId", "projectId", "displayName", "kind", "canonicalRoot"], ["worktreeIdentity", "branch", "sourceCommit"]);
  const kind = enumValue(input.kind, PROJECT_WORKSPACE_KINDS, "workspace kind") as ProjectWorkspaceKind;
  if (kind === "WORKTREE" && input.worktreeIdentity === undefined) throw new ProjectValidationError("worktree requires a stable identity");
  if (kind === "PRIMARY" && input.worktreeIdentity !== undefined) throw new ProjectValidationError("primary workspace cannot contain a worktree identity");
  return Object.freeze({
    workspaceId: id(input.workspaceId, "workspaceId"),
    projectId: id(input.projectId, "projectId"),
    displayName: text(input.displayName, "displayName"),
    kind,
    canonicalRoot: validatePlatformPathRef(input.canonicalRoot),
    ...(input.worktreeIdentity === undefined ? {} : { worktreeIdentity: id(input.worktreeIdentity, "worktreeIdentity") }),
    ...(input.branch === undefined ? {} : { branch: text(input.branch, "branch", 1024) }),
    ...(input.sourceCommit === undefined ? {} : { sourceCommit: text(input.sourceCommit, "sourceCommit", 256) }),
  });
}
