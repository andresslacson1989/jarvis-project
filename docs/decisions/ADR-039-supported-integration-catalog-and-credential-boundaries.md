# ADR-039 — Supported Integration Catalog and Credential Boundaries

Status: Accepted
Date: 2026-08-11

## Context

JARVIS is expected to connect to external productivity, development, infrastructure, and AI services while preserving user control, least privilege, credential isolation, and modularity.

The Credential Broker architecture requires a defined set of supported integrations rather than ad-hoc access to arbitrary services. The standard dashboard should present only integrations that JARVIS explicitly supports and can manage safely.

## Decision

JARVIS SHALL maintain an official Supported Integration Catalog.

Each supported integration SHALL declare:

- identity and integration type;
- supported capabilities and operations;
- required authentication method;
- required credential scopes and permissions;
- health-check behavior;
- supported platforms and compatibility constraints;
- applicable permission/risk rules.

Only integrations meeting the JARVIS support contract SHALL appear as standard installable/connectable options in the dashboard.

The initial integration catalog SHOULD prioritize:

- Google Workspace, including Gmail, Calendar, Drive, Contacts/People, Docs, Sheets, Tasks, and Meet;
- GitHub;
- Cloudflare;
- Microsoft 365, including Outlook, Calendar, Contacts, OneDrive, SharePoint, Teams, OneNote, and Planner;
- local development and infrastructure integrations such as Git, filesystem/project registry, SSH, Proxmox, Docker/Podman where applicable, and local databases;
- supported AI providers, beginning with Codex and approved local/cloud providers.

Individual service capabilities SHOULD be independently enabled where the upstream platform permits it. A connected Google Workspace account, for example, MUST NOT imply that Gmail, Drive, Calendar, and other services are all automatically authorized.

Cloud and infrastructure integrations SHOULD use the narrowest practical permissions. Scoped tokens, installation-scoped credentials, and capability-specific authorization are preferred over broad global credentials.

An integration module SHALL expose tools and capabilities to JARVIS while credentials remain owned by the Credential Broker. AI orchestrators and workers SHOULD receive normalized operations rather than raw credentials or long-lived tokens.

The dashboard SHALL distinguish at minimum between:

- supported;
- connected or configured;
- enabled;
- authorized capabilities;
- health state.

The dashboard MUST NOT expose secret material.

Credential presence SHALL remain separate from action authorization. Connecting an account or service MUST NOT implicitly authorize every action supported by that service.

Unsupported or manually added extensions, if permitted in the future, MUST be clearly separated from the official supported-integration catalog and MUST NOT be represented as officially supported.

## Product Principle

Connect the account once, expose only the capabilities the user enables, and never hand the credentials directly to the AI.
