# ADR-030 — Context-Aware Permission Engine

**Status:** Accepted  
**Date:** 2026-08-11  
**Decision Type:** Production Architecture

## Context

JARVIS must be safe without becoming unusably repetitive. A flat confirmation model would cause excessive prompts for harmless actions, while an overly permissive model could allow dangerous actions without sufficient authorization.

Risk is contextual. The same nominal action can have very different consequences depending on environment, target, scope, and reversibility.

## Decision

JARVIS SHALL use a context-aware permission and risk engine rather than a flat per-tool confirmation system.

The permission engine SHALL evaluate, where relevant:

- action type;
- target;
- environment;
- scope;
- reversibility;
- branch or deployment context;
- data sensitivity;
- whether a standing user policy applies.

## Risk Levels

### LOW

Examples:

- read project status;
- inspect Git branch/status;
- read non-sensitive logs;
- open an application;
- perform harmless health/status checks.

LOW-risk actions MAY execute automatically.

### MODERATE

Examples:

- edit local development files;
- run tests;
- install a development dependency;
- create local artifacts.

MODERATE-risk actions MAY execute automatically when covered by an approved standing policy or local development policy.

### HIGH

Examples:

- git push;
- deploy;
- restart production services;
- run database migrations in consequential environments;
- modify remote infrastructure.

HIGH-risk actions MUST require stronger authorization according to configured policy.

### CRITICAL

Examples:

- production database deletion;
- repository deletion;
- destructive infrastructure changes;
- privilege/security changes;
- broad filesystem deletion.

CRITICAL actions MUST require explicit confirmation every time.

## Context Sensitivity

The permission engine MUST NOT classify risk solely by tool name.

For example:

```text
git push feature/my-fix
```

and:

```text
git push main
```

MAY receive different risk classifications.

Likewise:

```text
database migration on local development
```

and:

```text
database migration in production
```

MUST be treated differently.

## Standing Permissions

The user MAY define standing permissions for recurring low/moderate-risk actions, such as allowing tests to run automatically in development projects.

Standing permissions MUST be:

- scoped;
- explicit;
- revocable;
- non-transitive across unrelated environments or risk classes.

A standing permission to run development tests MUST NOT imply permission to deploy production changes.

## UX Principle

JARVIS SHOULD ask for confirmation only when the consequence justifies the interruption.

Routine safe actions SHOULD remain frictionless.

Consequential actions MUST remain controlled.

## Governing Principle

**AI may request an action; deterministic software decides whether it is authorized.**
