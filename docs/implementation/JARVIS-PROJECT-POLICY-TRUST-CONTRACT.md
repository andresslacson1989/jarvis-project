# JARVIS Project Policy Trust & Enrollment Contract

**Normative Appendix to:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.5.md`  
**Version:** 1.0.5  
**Date:** August 12, 2026  
**Adopted by:** ADR-073

---

# 1. PURPOSE

This contract defines the deterministic trust transition by which repository files such as `AGENTS.md` may become scoped JARVIS project policy.

Repository content is untrusted data by default. Merely cloning, opening, registering, checking out, or scanning a repository SHALL NOT promote repository text into trusted policy.

> **Project policy is trusted because the user enrolled an exact policy identity—not because a filename looks authoritative.**

---

# 2. POLICY TRUST STATES

Canonical policy trust states are:

```text
UNTRUSTED_CANDIDATE
TRUSTED
CHANGED_REVIEW_REQUIRED
DISABLED_BY_USER
REVOKED
```

`TRUSTED` is the only state in which repository policy text may enter the trusted project-policy context class.

All other states remain untrusted content for AI/content-authority purposes.

---

# 3. CANDIDATE DISCOVERY

V1 SHALL recognize `AGENTS.md` as a project-policy candidate filename. Additional filenames require explicit typed configuration/contract support; arbitrary files SHALL NOT become trusted merely because they contain policy-like prose.

Candidate discovery SHALL:

- resolve the canonical project and filesystem identity first;
- reject traversal/reparse/symlink escape under the normal platform path policy;
- record the canonical project-relative path;
- record the canonical scope directory;
- hash the exact bytes with SHA-256;
- record Git blob OID/commit/ref provenance when available;
- treat contents as untrusted until enrollment completes.

A newly cloned or unfamiliar repository with an `AGENTS.md` SHALL therefore begin at `UNTRUSTED_CANDIDATE`.

---

# 4. EXPLICIT ENROLLMENT

Before an `UNTRUSTED_CANDIDATE` becomes `TRUSTED`, an unlocked authenticated user SHALL explicitly accept the candidate through a JARVIS-owned policy-enrollment flow.

The flow SHALL show at least:

- project identity;
- canonical project-relative policy path;
- scope root;
- source repository/ref/commit when known;
- content SHA-256;
- bounded policy summary;
- full content/diff access before acceptance;
- the fact that accepted policy constrains future JARVIS work in that scope.

Acceptance SHALL persist a `ProjectPolicyTrustRecord` equivalent to:

```ts
interface ProjectPolicyTrustRecord {
  policyTrustId: string;
  projectId: string;
  canonicalRelativePath: string;
  canonicalScopeRoot: string;
  contentSha256: string;
  gitBlobOid?: string;
  sourceCommit?: string;
  state: 'TRUSTED' | 'CHANGED_REVIEW_REQUIRED' | 'DISABLED_BY_USER' | 'REVOKED';
  acceptedAt?: string;
  acceptedSessionId?: string;
  revision: number;
}
```

Display names and raw path strings alone are never policy identity.

---

# 5. REGISTRATION/OPENING BEHAVIOR

Project registration SHALL NOT silently accept detected policy candidates.

If a candidate exists and consequential project mutation is requested before the user has decided how to handle it, JARVIS SHALL surface `PROJECT_POLICY_DECISION_REQUIRED` or equivalent and offer:

```text
Review and trust
Ignore/disable for this project
Cancel project work
```

If the user explicitly disables the candidate, JARVIS may proceed under global/user/task policy while continuing to treat the file as untrusted repository content. The UI SHALL make that choice visible in project policy status.

---

# 6. TRUSTED POLICY AUTHORITY LIMIT

Trusted project policy is subordinate to JARVIS global security, PermissionEngine, Authority Envelope, DataPolicy, budget, credential, provider setup, platform security, destructive-confirmation, update, and recovery invariants.

Trusted project policy MAY:

- constrain project-local engineering conventions;
- impose additional validation/build/test requirements;
- constrain file/layout/style/workflow choices;
- provide scoped project context/instructions;
- require more restrictive project-local handling.

Trusted project policy SHALL NOT by itself:

- grant external write/deploy/infrastructure authority;
- widen ExecutionScope or Authority Envelope;
- waive approval/final destructive confirmation;
- reveal credentials;
- change DataSensitivity/DataLocality;
- authorize provider setup/elevation;
- install/authorize modules;
- disable audit/security/update rules;
- convert untrusted external content into system policy.

A project policy is therefore primarily a scoped constraint/context source, not a permission grant.

---

# 7. IMMUTABLE POLICY SNAPSHOT PER ATTEMPT

Before an engineering attempt starts, Core SHALL resolve the applicable trusted policy set and persist an immutable `ProjectPolicySnapshot` containing the exact trust-record revisions/content hashes applied to that attempt.

AI/workers receive the snapshot contents/context, not a promise that the on-disk file will remain unchanged.

A repository file changing mid-attempt does not retroactively rewrite the active attempt's trusted instruction set.

However, before a new attempt, task `RESUMING`, or a consequential action whose safety/acceptance semantics materially depend on project policy, JARVIS SHALL revalidate the applicable policy identities/hashes.

---

# 8. POLICY CHANGE DETECTION

If a trusted policy file no longer matches its enrolled canonical identity/content hash, the record becomes `CHANGED_REVIEW_REQUIRED`.

Causes include:

- checkout/branch switch;
- pull/fetch/update changing the file;
- local edit;
- worker/tool edit;
- file replacement, symlink/reparse change, or path-identity change;
- source repository/worktree identity change.

The new content remains untrusted until re-enrolled.

JARVIS SHALL NOT silently carry trust from hash A to hash B merely because the path remains `AGENTS.md`.

---

# 9. MUTATING A TRUSTED POLICY FILE

A write that changes an enrolled trusted project-policy file is contextually HIGH project-policy work.

It SHALL NOT occur merely because a normal engineering worker has filesystem write access.

The mutation requires exact user authority under the normal HIGH-action rules and SHALL bind the intended policy path/content change as precisely as practical.

After the write, the resulting new content enters `CHANGED_REVIEW_REQUIRED`. It SHALL NOT become trusted automatically simply because JARVIS or a trusted worker produced it.

The user may then inspect the diff and explicitly accept the new policy revision.

---

# 10. NESTED POLICY FILES

Nested policy is supported without implicit trust propagation.

Each candidate path requires its own enrollment/disable decision.

For a target resource/path, applicable trusted policies are ordered from the shallowest enrolled scope to the deepest enrolled scope whose canonical scope contains the target.

A deeper trusted policy MAY refine project-local instructions for its subtree. It SHALL NOT widen authority/security beyond parent/global rules.

If two applicable trusted policies conflict materially and deterministic "stricter wins" handling cannot preserve user intent, JARVIS SHALL block/clarify rather than choose a permissive interpretation.

An untrusted nested `AGENTS.md` never overrides a trusted parent policy.

---

# 11. WORKTREES, BRANCHES, AND COPIES

Policy trust is bound to the registered project identity plus canonical policy identity and content hash.

Trust SHALL NOT automatically transfer to:

- an unrelated repository containing the same filename;
- a copied project directory registered as a different project;
- a branch/worktree whose policy content hash differs;
- a symlink/junction/reparse target outside the enrolled project identity.

Parallel worktrees may reuse a trust record only while canonical policy identity/content/provenance requirements remain satisfied.

---

# 12. CONTEXT PACKAGING

Context Manager SHALL label policy sources distinctly:

```text
SYSTEM POLICY
AUTHENTICATED USER INSTRUCTION
TRUSTED PROJECT POLICY (with policyTrustId/revision)
VERIFIED STATE
RETRIEVED MEMORY
UNTRUSTED REPOSITORY/EXTERNAL CONTENT
```

An `UNTRUSTED_CANDIDATE`, `CHANGED_REVIEW_REQUIRED`, disabled, or revoked policy-looking file stays under untrusted content labeling.

Workers SHALL NOT be told that an untrusted candidate is authoritative merely to improve compliance.

---

# 13. REVOCATION AND DISABLE

The user may disable/revoke a project policy trust record.

Revocation/disable prevents the record from entering new policy snapshots immediately after authoritative state changes.

Existing running work reaches an integrity-safe boundary and SHALL revalidate policy before new consequential actions as required by its task/recovery policy.

Policy trust changes are auditable without storing private chain-of-thought.

---

# 14. REQUIRED UI/DIAGNOSTIC STATE

Mission Control project status SHALL distinguish:

```text
no policy candidate
policy decision required
trusted policy
policy changed — review required
policy disabled
policy revoked
policy/path validation error
```

The UI SHALL expose the exact trusted path/hash/revision and source provenance needed to explain why JARVIS considered a project instruction trusted.

---

# 15. REQUIRED VERIFICATION

Production tests SHALL include:

- unfamiliar repository `AGENTS.md` stays untrusted after clone/open/register;
- policy-looking malicious text cannot self-enroll;
- explicit enrollment binds canonical path + hash + project identity;
- path traversal/reparse escape cannot become trusted policy;
- branch checkout changing policy enters `CHANGED_REVIEW_REQUIRED`;
- same path/different hash is not trusted;
- nested untrusted policy cannot override trusted parent;
- separately enrolled nested policy applies only to its subtree;
- trusted project policy cannot grant GitHub/Proxmox/deploy/credential/elevation authority;
- worker attempt to edit trusted policy requires HIGH authority;
- edited policy does not auto-trust its new content;
- active attempt uses immutable policy snapshot;
- `RESUMING`/new attempt detects changed policy;
- disabled/revoked policy stops entering new context;
- policy status/explanation derives from authoritative trust records, not AI inference.

---

# 16. INVARIANTS

1. Repository content is untrusted by default.
2. Filename alone never grants trust.
3. Trust requires explicit authenticated enrollment.
4. Trust binds canonical project/path/scope/content identity.
5. Content change invalidates prior trust for new work.
6. Trusted project policy cannot widen JARVIS authority or waive global security.
7. Nested policy requires separate enrollment.
8. Workers cannot silently rewrite the policy that constrains them.
9. Active attempts use immutable policy snapshots.
10. Policy state is visible, revocable, durable, and auditable.

---

**END — JARVIS PROJECT POLICY TRUST & ENROLLMENT CONTRACT v1.0.5**
