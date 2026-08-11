# ADR-042 — Project Registry and Workspace Isolation

**Status:** Accepted  
**Date:** 2026-08-11

## Context

JARVIS is intended to manage multiple projects, repositories, environments, workers, integrations, credentials, queues, missions, and memories concurrently. Without an explicit project boundary, conversational context can leak across projects and cause workers or tools to act on the wrong repository, working tree, environment, or credentials.

An `active project` is useful conversational context but is not strong enough to serve as an execution authority. Consequential actions need an explicit, durable project/workspace binding.

## Decision

JARVIS SHALL maintain a durable **Project Registry** as the canonical inventory of managed projects and their execution boundaries.

Each project record SHOULD include, where applicable:

- project identity and display name;
- repository and local workspace locations;
- default branch and active branches/worktrees;
- explicit environments such as local, development, staging, and production;
- associated integrations and credential references;
- project-specific permissions and policies;
- active and historical missions/tasks;
- scoped project memory;
- preferred or allowed worker roles/providers;
- project health and relevant configuration metadata.

Every meaningful executable task SHALL be bound to an explicit project/workspace context before execution.

A conversational `active_project` MAY be used to resolve references and reduce unnecessary clarification, but it MUST NOT by itself authorize consequential cross-project execution.

Task project binding SHOULD remain stable for the lifetime of the task unless an explicit, validated transfer to another project/workspace is performed.

Workers SHALL receive a bounded **Workspace Envelope** defining at minimum:

- project identity;
- allowed repository/workspace;
- selected working tree or worktree;
- selected branch where applicable;
- target environment;
- task identity and scope;
- allowed tools and permissions;
- relevant integration access.

Workers SHOULD NOT receive unrestricted awareness of unrelated projects when that information is unnecessary for the task.

Development, staging, and production environments SHALL be represented explicitly and SHALL NOT be treated as interchangeable. Ambiguous consequential requests such as deployment MUST resolve or clarify the target environment before execution unless the task context already defines it authoritatively.

Cross-project missions MAY exist. Their constituent execution tasks SHOULD remain independently project-scoped. A higher-level synthesis task MAY combine verified outputs from multiple project-scoped tasks without collapsing their execution boundaries.

The work dashboard SHALL use projects as a primary organizational boundary for missions, workers, queue state, activity, environments, integrations, permissions, and memory.

## Rationale

This prevents accidental cross-project actions, reduces irrelevant model context, improves worker safety, and creates a durable organizing layer for the broader JARVIS architecture.

It also reinforces the existing execution principles:

> **AI decides. Software authorizes. Software verifies.**

Project and workspace resolution is part of the software authorization boundary, not merely conversational convenience.

## Product Principle

> **JARVIS must always know exactly which project it is touching, even when the user is discussing several projects at once.**
