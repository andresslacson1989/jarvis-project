import type { PlatformFamily, PlatformPathRef } from "./platform.js";

export type ProjectEnvironmentKind = "LOCAL" | "REMOTE" | "INTEGRATION";
export type ProjectWorkspaceKind = "PRIMARY" | "WORKTREE";

export interface ProjectRecord {
  readonly projectId: string;
  readonly displayName: string;
  readonly canonicalRoot: PlatformPathRef;
  readonly canonicalIdentity: string;
  readonly repositoryIdentity?: string;
}

export interface ProjectAliasRecord {
  readonly alias: string;
  readonly projectId: string;
}

export interface ProjectEnvironmentRecord {
  readonly environmentId: string;
  readonly projectId: string;
  readonly displayName: string;
  readonly kind: ProjectEnvironmentKind;
  readonly platform: PlatformFamily;
}

export interface ProjectWorkspaceRecord {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly displayName: string;
  readonly kind: ProjectWorkspaceKind;
  readonly canonicalRoot: PlatformPathRef;
  readonly worktreeIdentity?: string;
  readonly branch?: string;
  readonly sourceCommit?: string;
}
