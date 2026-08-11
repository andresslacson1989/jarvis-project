# ADR-059 — Proxmox VE Integration Boundary

**Status:** Accepted  
**Date:** 2026-08-11  
**Decision Type:** Integration/security architecture refinement  
**Scope:** JARVIS v1.0 infrastructure connections

## Context

JARVIS is intended to operate as a high-trust local assistant that can eventually manage infrastructure as well as local projects and software workflows.

Proxmox VE is a supported infrastructure connection for JARVIS V1. Proxmox VE exposes management operations through its API stack and represents virtual guests with stable numerical VMIDs. This gives JARVIS a structured control-plane integration path without requiring a generic privileged shell as the primary management interface.

The integration must preserve the governing JARVIS security principles:

- AI may propose and plan actions, but deterministic software authorizes and verifies them;
- credentials remain behind the Credential Broker;
- infrastructure targets and environments are resolved before authorization;
- destructive actions require final explicit confirmation;
- a connection grants only declared capabilities rather than unrestricted host authority;
- API failure must not trigger a silent privilege-escalating fallback;
- Proxmox control-plane authority is distinct from guest operating-system access.

This ADR makes Proxmox VE a first-class JARVIS connection while keeping its authority bounded and auditable.

---

## Decision

JARVIS V1 SHALL support Proxmox VE as a registered first-class integration/connection.

The normal production control path SHALL be equivalent to:

```text
User / AI request
      ↓
Mission / task / tool proposal
      ↓
Authority Envelope
      ↓
Permission Engine
      ↓
Proxmox Integration Adapter
      ↓
Credential Broker
      ↓
HTTPS Proxmox VE API
      ↓
Proxmox cluster / node / guest resource
```

The normal Proxmox integration SHALL NOT expose an unrestricted shell, unrestricted raw API execution, or direct credential access to the orchestrator or general AI workers.

---

## 1. Connection model

Each Proxmox VE environment SHALL be registered as a durable connection with a stable JARVIS identity.

The logical model SHALL be equivalent to:

```ts
interface ProxmoxConnection {
  connectionId: UUIDv7;
  displayName: string;
  endpoint: string;
  credentialHandle: string;

  tlsTrust:
    | { mode: 'SYSTEM_CA' }
    | {
        mode: 'PINNED_SHA256';
        fingerprint: string;
      };

  environmentId: UUIDv7;

  enabledCapabilities: ProxmoxCapability[];

  allowedNodes?: string[];
  allowedVmids?: number[];
  allowedPools?: string[];

  status:
    | 'CONNECTED'
    | 'DEGRADED'
    | 'REAUTH_REQUIRED'
    | 'DISABLED'
    | 'ERROR';

  lastVerifiedAt?: UtcTimestamp;
}
```

Exact protocol placement MAY be refined during implementation, but the semantics are binding.

A connection SHALL have one authoritative `environmentId` so development, staging, lab, and production Proxmox environments cannot be conflated by display name alone.

---

## 2. Resource identity

Consequential Proxmox actions SHALL resolve stable resource identity before permission evaluation and approval creation.

For VM/LXC operations, the resource identity SHALL include enough material information to distinguish the target unambiguously, equivalent to:

```ts
interface ProxmoxGuestIdentity {
  connectionId: UUIDv7;
  environmentId: UUIDv7;
  nodeId: string;
  guestType: 'QEMU' | 'LXC';
  vmid: number;
}
```

Display names are descriptive only and SHALL NOT be the sole authoritative identity for consequential operations.

Where a resource may move between nodes, JARVIS SHALL resolve current live placement before execution and determine whether node identity is material to the approved action.

---

## 3. Authentication and credentials

The preferred production authentication method SHALL be a dedicated Proxmox API token associated with a dedicated Proxmox identity and only the privileges required for the enabled JARVIS capabilities.

JARVIS SHALL NOT require the user's normal Proxmox administrator password for routine integration operation.

The Proxmox credential secret SHALL be stored through the Windows-backed JARVIS secure-store path and referenced by an opaque `credentialHandle`.

The AI, renderer, ordinary task persistence, journals, logs, and unrelated workers SHALL NOT receive the raw token secret.

Credential access SHALL be capability-scoped and transient through the trusted integration adapter path.

The connection wizard/diagnostics SHOULD encourage a dedicated JARVIS Proxmox identity/token rather than an unrestricted `root@pam` credential.

---

## 4. TLS trust

The adapter SHALL verify TLS for the Proxmox endpoint.

Production connection configuration SHALL support either:

- a certificate chain trusted through the normal system trust path; or
- an explicitly configured SHA-256 certificate fingerprint/pinning policy where appropriate.

The production adapter SHALL NOT silently disable certificate verification.

A certificate/fingerprint change SHALL cause connection verification failure or an explicit trust-review flow rather than silent acceptance.

---

## 5. Capability classes

Proxmox authority SHALL be capability-based.

The V1 capability model SHALL include equivalents to:

```ts
type ProxmoxCapability =
  | 'PROXMOX_READ'
  | 'PROXMOX_POWER_CONTROL'
  | 'PROXMOX_SNAPSHOT'
  | 'PROXMOX_BACKUP'
  | 'PROXMOX_GUEST_CONFIG'
  | 'PROXMOX_GUEST_CREATE'
  | 'PROXMOX_MIGRATE'
  | 'PROXMOX_STORAGE_WRITE'
  | 'PROXMOX_NETWORK_WRITE'
  | 'PROXMOX_DESTROY';
```

These are JARVIS policy capabilities, not a claim that Proxmox itself uses identical names.

Capabilities MAY later be subdivided if implementation evidence shows that a listed category is too broad for least-privilege authorization.

---

## 6. Read-only first connection posture

A Proxmox connection SHOULD be able to operate initially with read-only authority.

Read-only mode MAY support capabilities equivalent to:

- cluster and node discovery;
- VM/LXC discovery;
- current power/state inspection;
- configuration inspection;
- storage/resource status inspection;
- task/status observation;
- health/availability diagnostics.

Enabling write capabilities SHALL be explicit and auditable.

Connecting a Proxmox endpoint SHALL NOT automatically imply permission to modify or destroy infrastructure.

---

## 7. V1 managed operations

When the corresponding capabilities are enabled and authorized, the V1 Proxmox adapter MAY support operations equivalent to:

- VM/LXC start;
- graceful shutdown;
- reboot;
- snapshot creation and inspection;
- backup invocation and status observation;
- VM/LXC creation and cloning;
- selected CPU/RAM/disk/network guest configuration;
- migration between permitted nodes/storage targets;
- VM/LXC destruction through the destructive-action path.

Each operation SHALL use a registered typed tool/API contract rather than arbitrary endpoint construction by AI output.

The adapter SHALL distinguish asynchronous task submission from confirmed completion and SHALL verify terminal task/result state where the Proxmox API exposes asynchronous task identifiers.

---

## 8. Destructive operations

The following classes SHALL be treated as destructive or materially unrecoverable unless a more specific verified recovery policy proves otherwise:

- VM/LXC destroy/delete;
- purge operations;
- destructive disk removal;
- storage operations that can destroy guest data;
- deletion of a recovery-critical snapshot when no equivalent rollback remains;
- other actions whose material consequence is irreversible or destructive to infrastructure state.

Such operations SHALL require JARVIS final explicit destructive confirmation.

ADR-058 applies in full.

The approval action material SHALL bind all material Proxmox target state, including as applicable:

```text
system = proxmox-ve
connectionId
environmentId
node identity
guest type
VMID/resource identity
action/tool identity
material options such as purge/destroy-storage/force mode
```

Immediately before approval consumption, JARVIS SHALL re-resolve the target/live state, reconstruct the canonical approval action material, recompute the ADR-058 digest, and reject the approval if material state changed.

---

## 9. Permission and authority pipeline

The Proxmox adapter SHALL NOT decide its own authorization.

Every consequential request SHALL pass through normal JARVIS policy services, including as applicable:

- authenticated session/user authority;
- Authority Envelope scope;
- project/environment scope;
- Proxmox connection capability;
- node/VMID/pool allowlists;
- Permission Engine;
- approval requirements;
- budget/resource policy where relevant;
- audit/event recording.

AI confidence SHALL NOT reduce the required policy checks.

A valid Proxmox credential SHALL NOT by itself authorize an action.

---

## 10. API-only normal control path

The normal Proxmox integration SHALL use the structured Proxmox VE HTTPS API.

The adapter SHALL NOT use SSH, `qm`, `pct`, `pvesh`, direct `/etc/pve` editing, or a root shell as a silent fallback when an API operation fails or is denied.

If the API is unavailable or rejects the request, the integration SHALL enter an observable degraded/denied/error path as appropriate.

A future explicit Proxmox host-administration capability MAY introduce SSH or another host-management channel, but it SHALL be a separately governed high-risk integration/tool and SHALL NOT be an implementation fallback for this ADR.

---

## 11. No unrestricted raw API tool

JARVIS SHALL NOT expose a general tool equivalent to:

```text
proxmox.request(method, arbitraryPath, arbitraryBody)
```

to AI workers.

Supported operations SHALL be registered as typed capabilities/tools with:

- fixed semantic operation identity;
- input schema;
- target resolution rules;
- risk class;
- required Proxmox capability;
- preconditions;
- postconditions;
- idempotency/retry semantics;
- approval policy;
- output schema.

This prevents the integration from bypassing the Tool Registry and permission model through arbitrary REST-path access.

---

## 12. Guest operating-system access is separate

Proxmox control-plane access SHALL NOT imply guest OS access.

The following are distinct authorization domains:

```text
PROXMOX CONTROL PLANE
- start/stop/reboot guest
- snapshot/backup
- configure resources
- migrate
- create/delete guest

GUEST OPERATING SYSTEM
- SSH into Linux
- PowerShell/WinRM into Windows
- execute guest commands
- read/write guest files
- access guest application credentials
```

If JARVIS later needs guest-level administration, that guest connection SHALL be registered and authorized separately unless a future ADR defines a narrowly mediated guest-agent capability.

A VM/LXC management credential SHALL NOT silently become a guest-shell credential.

---

## 13. Idempotency, retries, and uncertain outcomes

The adapter SHALL model each operation's idempotency explicitly.

Read operations MAY be retried according to bounded transient-failure policy.

Write operations SHALL NOT be blindly replayed after timeouts or ambiguous responses.

When the API returns an asynchronous task identifier, JARVIS SHALL track the task and verify its outcome before declaring success.

If the request may have reached Proxmox but the resulting state cannot be established, the tool outcome SHALL become `UNCERTAIN` rather than automatically retrying a consequential operation.

Destructive actions SHALL never be automatically replayed merely because the client did not receive a response.

---

## 14. Live-state verification

Consequential Proxmox actions SHALL validate relevant live-state preconditions as close to execution as practical.

Examples include:

- target VMID still resolves to the intended guest type/resource;
- connection/environment identity is unchanged;
- current placement is compatible with the requested action;
- required storage/node target exists;
- destructive target has not changed materially since approval;
- asynchronous operation completed with the expected result.

Postconditions SHALL be verified from Proxmox state rather than assuming a successful HTTP submission equals successful infrastructure completion.

---

## 15. Audit requirements

Security/audit events SHALL retain enough structured data to answer:

- which JARVIS connection was used;
- which environment was targeted;
- which node/resource/VMID was affected;
- which capability/tool was requested;
- which Proxmox account/token identity metadata was used, without storing the token secret;
- the authorization/approval result;
- the Proxmox task identifier where relevant;
- the observed final outcome;
- whether the outcome was verified or uncertain.

Secrets SHALL remain redacted/excluded.

---

## 16. Scope restrictions

The base V1 Proxmox integration SHALL NOT automatically expose:

- arbitrary host shell access;
- arbitrary `pvesh` execution;
- arbitrary raw API paths;
- direct editing of `/etc/pve`;
- unrestricted cluster membership administration;
- unrestricted Ceph administration;
- unrestricted host firewall/SDN administration;
- package/repository/host-upgrade administration;
- credential or token administration;
- direct access to Proxmox server-side secret files;
- guest OS command execution merely because the guest is managed by Proxmox.

These capabilities MAY be introduced later only through explicit typed tools/ADRs with separate risk and permission analysis.

---

## 17. Proxmox Backup Server boundary

Proxmox Backup Server SHALL be treated as a distinct connection/integration type if JARVIS later manages PBS directly.

A Proxmox VE connection MAY observe or invoke PVE backup workflows that target configured storage according to its granted capabilities, but it SHALL NOT automatically inherit direct administrative authority over an external Proxmox Backup Server.

Direct PBS credentials, permissions, destructive datastore operations, and retention administration require their own connection boundary.

---

## 18. Verification requirements

Production verification for the Proxmox adapter SHALL include at minimum:

1. successful read-only connection/health validation with no write capability;
2. rejection of operations outside the connection's enabled capability set;
3. rejection of targets outside configured node/VMID/pool scope;
4. proof that the raw API token is absent from AI context, logs, journals, artifacts, and renderer state;
5. TLS certificate/fingerprint validation and failure on untrusted change;
6. correct resource identity resolution for QEMU and LXC guests;
7. typed operation schema rejection for invalid/ambiguous targets;
8. denial of arbitrary raw API-path requests;
9. proof that API denial/unavailability does not trigger SSH/CLI fallback;
10. power-control operation with verified postcondition;
11. asynchronous task tracking with success/failure/timeout handling;
12. ambiguous write response producing `UNCERTAIN` instead of blind replay;
13. destructive VM/LXC fixture requiring final confirmation;
14. ADR-058 digest invalidation after any material target/action change;
15. single-use destructive approval enforcement;
16. audit event coverage without credential leakage;
17. confirmation that Proxmox control-plane authority does not provide guest-shell access;
18. connection disable/revocation immediately preventing new dependent actions.

---

## Non-goals

This ADR does not require:

- unrestricted Proxmox administrator/root authority;
- SSH as the normal management transport;
- direct host filesystem editing;
- every Proxmox VE API endpoint in V1;
- direct Proxmox Backup Server administration;
- guest OS shell access;
- Ceph/SDN/firewall/cluster administration beyond explicitly added future typed capabilities;
- automatic privilege escalation when an API operation is denied.

---

## Consequences

### Positive

- Proxmox VE becomes a first-class JARVIS infrastructure connection.
- Infrastructure operations remain behind deterministic authorization and exact resource identity.
- API tokens and TLS verification provide a clean machine-to-machine integration path.
- Read-only onboarding is possible before management authority is granted.
- Destructive infrastructure actions inherit ADR-058 exact-action approval binding.
- Proxmox API failure cannot silently escalate into root-shell execution.
- Guest operating-system access remains a separate privilege domain.

### Trade-offs

- The adapter needs typed operation coverage rather than one generic raw API tool.
- Some advanced Proxmox administration will require later capabilities/ADRs.
- Asynchronous task and uncertain-outcome handling adds implementation work.
- Least-privilege token setup may require user-side Proxmox permission configuration.

---

## Governing Principle

> **JARVIS may manage Proxmox infrastructure only through explicit, scoped capabilities over a verified control-plane connection; infrastructure authority is never equivalent to unrestricted host or guest authority.**
