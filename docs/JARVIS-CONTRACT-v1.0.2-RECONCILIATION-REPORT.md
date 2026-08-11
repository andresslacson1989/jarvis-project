# JARVIS Contract v1.0.2 Reconciliation Report

**Review date:** August 11, 2026  
**Reviewed branch:** `codex/contract-v1.0.2-consolidation`  
**Semantic base:** `codex/contract-consistency-fixes` at `f3de3ecea08d3ab2dd4413419810846a06d37506`  
**Canonical contract:** `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.2.md`  
**Scope:** Contract/architecture consistency and implementation-readiness. This is not product release qualification.

---

# 1. PURPOSE

This reconciliation was performed to eliminate the previous model in which an implementer had to read an older contract and mentally apply a growing stack of later ADRs/superseding decisions.

The target quality rule is:

> **There is one current contract. History explains it; history does not override it.**

The v1.0.2 consolidation therefore rewrites the effective rules directly into one current normative suite, moves old top-level contracts to an explicitly historical location, and changes future contract governance so a new architectural ADR cannot remain as an unreconciled overlay.

---

# 2. CANONICAL SOURCE OF TRUTH

The current implementation source of truth is exactly:

1. `docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.2.md`
2. `docs/JARVIS-V1-RELEASE-PROFILE.md`
3. `docs/implementation/JARVIS-RUNTIME-CONTRACT.md`
4. `docs/implementation/JARVIS-PROTOCOL-SCHEMA-CONTRACT.md`
5. `docs/implementation/JARVIS-DATA-STATE-CONTRACT.md`
6. `docs/implementation/JARVIS-SECURITY-HARDENING-CONTRACT.md`
7. `docs/implementation/JARVIS-CODING-STANDARDS-CONTRACT.md`
8. `docs/implementation/JARVIS-VERIFICATION-RELEASE-CONTRACT.md`
9. `docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md`

`README.md` and root `AGENTS.md` point to this same suite.

ADRs remain useful for context, alternatives, rationale, and decision history. Their still-valid effective behavior has been incorporated into the current suite; they are not a second live implementation layer.

---

# 3. DIVERGENT-BRANCH / DUPLICATE-ADR RESOLUTION

Two contract review branches previously diverged from the same earlier baseline:

- `codex/contract-consistency-fixes`
- `codex/contract-implementation-lock`

The second branch independently reused ADR-054, ADR-055, and ADR-056 identifiers for decisions different from the canonical consistency branch. That made a mechanical branch merge unacceptable because one ADR number would have two meanings.

Resolution:

- the accepted ADR numbering lineage from `codex/contract-consistency-fixes` remains canonical;
- ADR-054 through ADR-068 retain those identities;
- ADR-069 records the v1.0.2 consolidation;
- the duplicate ADR-054/055/056 files from `codex/contract-implementation-lock` are not imported as canonical ADRs;
- valuable content from that branch was reviewed and incorporated directly into v1.0.2 where still valid;
- `codex/contract-implementation-lock` is classified as historical/non-authoritative rather than a parallel source of implementation truth.

No valid engineering concept was rejected merely because it originated on the divergent branch; only the duplicate decision identity/parallel-authority model was rejected.

---

# 4. HISTORICAL CONTRACT TREATMENT

The former top-level contracts are preserved under:

- `docs/history/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.md`
- `docs/history/JARVIS-TECHNICAL-CONTRACT-v0.1.md`

They no longer exist beside the current contract as apparent implementation alternatives.

`docs/history/README.md` marks them non-normative.

Historical wording is useful for provenance but is not a permitted implementation choice when it differs from v1.0.2.

---

# 5. FUTURE AMENDMENT MODEL

The old ordinary pattern:

```text
old contract
+ later ADR supersedes one clause
+ another ADR supersedes another clause
+ implementer reconstructs effective behavior mentally
```

is no longer accepted.

A future material architecture change SHALL land synchronously as:

```text
new unique ADR
+ every affected current normative document updated
+ Release Profile updated when support scope changes
+ verification/compatibility implications updated
```

Implementation SHALL NOT depend on a new ADR while contradictory canonical wording remains.

If two current normative documents disagree, that is a contract defect to correct, not a precedence puzzle for an implementer to solve.

---

# 6. NORMALIZED SEMANTIC DECISIONS

## 6.1 Execution scope

Exactly one task scope model is current:

```text
PROJECT_WORKSPACE
INTEGRATION
SYSTEM
GLOBAL
```

Non-filesystem work no longer invents fake project/workspace identity.

## 6.2 Data policy

Exactly one current vocabulary exists:

```text
DataSensitivity: PUBLIC | PRIVATE | SENSITIVE | SECRET
DataLocality:    LOCAL_ONLY | ANY_APPROVED_PROVIDER
```

Sensitivity and routing locality are independent.

## 6.3 Authoritative money

Exactly one current authoritative monetary representation exists:

```text
MoneyAmount {
  currency,
  nanoUnits // canonical base-10 integer string, major unit × 1,000,000,000
}
```

Binary floating point is not authoritative for budget admission, reservations, settlement, or remaining-budget decisions.

## 6.4 Task resume

`RESUMING` is one durable canonical `TaskState`.

The previous durable-vs-runtime-only ambiguity is removed.

## 6.5 IPC response

One discriminated response convention is current:

```text
{ ok: true, result }
OR
{ ok: false, error }
```

Never both and never an ambiguous null/optional convention.

## 6.6 Approval action binding

Exactly one V1 canonical approval object/algorithm is current:

```text
CanonicalActionDescriptorV1
→ schema validation
→ RFC 8785 JCS
→ UTF-8
→ SHA-256
→ base64url without padding
```

Fresh material target/account/environment/arguments are re-resolved immediately before approval consumption. Material mismatch invalidates approval.

## 6.7 PermissionEngine precedence

The current deterministic order is:

1. mandatory system invariant;
2. explicit applicable DENY;
3. session/automation eligibility;
4. authority-envelope containment;
5. required capability and canonical identity resolution;
6. locality/budget/resource/integrity/preconditions;
7. current explicit authenticated instruction;
8. explicit matching standing permission;
9. risk/approval rule;
10. ALLOW only if every prior gate passes.

Risk is normalized:

- LOW: may run inside valid authority;
- MODERATE: may run when subordinate to current instruction or matching standing permission;
- HIGH: precedent alone is never authority; a recoverable HIGH action may run without a new prompt only when the exact action/target/scope is directly authorized by the current authenticated instruction or an explicit matching standing permission under policy; otherwise it requires approval;
- CRITICAL/destructive/materially unrecoverable: always fresh final confirmation immediately before execution.

AI confidence is not an authorization input.

During the final reconciliation audit, the top-level contract contained one overly compressed HIGH/CRITICAL summary that could have been read as “all HIGH always prompts.” It was corrected so the top-level summary and detailed Security Contract now express the same rule.

## 6.8 Tauri/WebView boundary

The authoritative WebView is local bundled JARVIS UI content and requires:

- explicit per-window/WebView capability allowlists;
- no privileged remote-origin capabilities;
- restrictive CSP;
- no remote executable script/CDN dependency by default;
- navigation restrictions;
- external links outside the privileged WebView;
- inert/sanitized rendering of untrusted HTML/Markdown;
- production devtools policy;
- release qualification against relevant upstream security fixes.

## 6.9 Core runtime packaging

Production uses an application-owned pinned Node/Core release unit.

No arbitrary system `node.exe`/PATH fallback is permitted.

## 6.10 Named-pipe IPC

Current rule is restrictive explicit Windows DACL/logon-session scope + local-only behavior + unpredictable endpoint + independent bootstrap authentication + bounded versioned schema protocol.

The default Windows named-pipe ACL is not accepted as the privileged Core boundary.

## 6.11 Windows Job Objects

Job Object containment is mandatory for ordinary JARVIS-managed executable child trees, with narrow documented/verified compatibility exceptions only.

Job Objects are explicitly lifecycle/resource containment, not filesystem/network/same-user security sandboxing.

## 6.12 Delegated engineering worker

`WORKSPACE_ENGINEERING` is the current delegated shell-capable engineering profile.

It may inspect/edit/build/test its assigned project within qualified provider/OS sandbox behavior, but provider shell capability does not grant external consequential authority.

GitHub push, deploy, Proxmox mutation, message/email send, credential administration, and similar external effects return through typed JARVIS tools/integrations and PermissionEngine.

The contract does not falsely claim workspace-only read isolation unless conformance proves the selected provider/OS sandbox enforces it. Delegated network is denied by default.

## 6.13 Provider compatibility

Provider compatibility and runtime health are separate.

Production `SUPPORTED` requires exact executable/version identity, release compatibility policy, conformance evidence, and current required health/auth/capability state.

Installed/launchable is not synonymous with supported.

## 6.14 Provider resume

Provider session resume is an optimization only. JARVIS-owned task/checkpoint/artifact/live-state records are the durability source of truth.

## 6.15 SQLite / SQLCipher / WAL

The current V1 persistence contract requires:

- local-filesystem SQLite/SQLCipher;
- WAL unless explicitly qualified otherwise;
- embedded SQLite core with upstream WAL-reset corruption fix;
- `synchronous=FULL` for authoritative state by default;
- foreign keys on every connection;
- bounded busy handling;
- owned connection initialization;
- WAL/checkpoint/integrity diagnostics;
- SQLite-safe online backup.

## 6.16 Backup key hierarchy

The previous clean-machine SQLCipher-key ambiguity is removed.

Current hierarchy:

```text
live DB_DEK
  used only for current live database / local secure-store path

backup snapshot
  re-keyed/exported under fresh SnapshotDBKey

outer backup package
  encrypted/authenticated under fresh BackupDEK

BackupDEK key slots
  local DPAPI current-user slot
  and/or portable Argon2id recovery-factor slot
```

`SnapshotDBKey` exists only inside the authenticated encrypted backup payload and trusted restore memory; it is not a plaintext sidecar/manifest field.

Clean-machine restore does not need the historical live `DB_DEK`. After verifying/opening the snapshot, restored state is re-keyed under a new local random `DB_DEK` protected by the new Windows profile.

Ordinary backups still exclude raw integration credentials; restored accounts without secrets become `REAUTH_REQUIRED`.

## 6.17 Session password recovery

The session password remains authentication, not a database key.

There is no weak Windows-only forgot-password bypass. A verified portable JARVIS recovery factor may authorize an explicit password-reset/recovery workflow. Without an applicable factor, the verifier is not reversible. Clean-machine restore establishes a new session password.

## 6.18 Consequential target races

Fresh target re-resolution remains mandatory. Where an external platform supports conditional mutation, the adapter also uses expected version/ref/SHA/ETag/hash/generation or equivalent compare-and-set semantics.

A changed target/precondition mismatch causes re-resolution/re-authorization/re-approval as applicable; stale authority is not silently applied to new state.

## 6.19 Module execution

Exactly three execution classes are current:

```text
DATA_ONLY
BUILT_IN_TRUSTED
EXTERNAL_MANAGED
```

There is no untrusted in-Core execution class.

An open arbitrary executable-plugin marketplace is not required for V1 Production Complete. Only release/profile/catalog-qualified external modules may be represented as supported.

## 6.20 Proxmox

Proxmox VE is consistently mandatory for V1 and uses a typed HTTPS REST API integration with scoped credentials/capabilities, TLS verification, exact connection/environment/resource identity, asynchronous task tracking, live verification, destructive final confirmation, and no silent SSH/CLI/root/raw-API fallback.

Guest OS shell authority is separate. Direct Proxmox Backup Server administration is separate.

## 6.21 V1 release set

The current mandatory V1 integration families are consistently:

1. Local filesystem + Git
2. GitHub
3. Codex/OpenAI
4. Proxmox VE

Voice is also a mandatory V1 production feature.

SSH, Google Workspace, Microsoft 365, and Cloudflare remain binding requirements for the first feature-bearing post-V1 release, while maintenance/security patch releases remain permitted before that feature gate.

---

# 7. IMPLEMENTATION ORDER RECONCILIATION

The current implementation plan builds/proves foundational boundaries before broad AI autonomy:

```text
repository/coding standards
→ Tauri/WebView + application-owned Core
→ named-pipe/Job Object boundary
→ SQLite/SQLCipher/WAL + portable-restore proof
→ authoritative state
→ session/PermissionEngine/approval
→ projects/scopes/context/memory
→ Codex version + actual Windows sandbox proof
→ controlled tools
→ workers
→ missions
→ resources/budgets/recovery
→ credentials/modules
→ Local Git/GitHub
→ Proxmox VE
→ voice
→ events/automation
→ operations/update
→ exact signed-release qualification
```

This removes the risk of discovering late that the chosen packaged SQLite binding, recovery design, Tauri security configuration, or provider sandbox cannot satisfy the production contract.

---

# 8. VERIFICATION COVERAGE RECONCILIATION

Every major new hard rule has an explicit release test family.

Added/strengthened qualification includes:

- Tauri remote-origin capability denial, CSP/navigation/untrusted-rendering tests;
- named-pipe DACL/session/remote/bootstrap negative tests;
- PermissionEngine deny/current-instruction/standing-permission/precedent/HIGH/CRITICAL scenarios;
- Rust/TypeScript JCS/digest vectors;
- provider/Codex exact-version and real sandbox write/network/read-boundary evidence;
- worker shell attempt to perform external consequential action without typed JARVIS authority;
- conditional-mutation race tests;
- SQLite WAL-reset-fixed-build, WAL/checkpoint, FULL synchronous, online-backup tests;
- `SnapshotDBKey`/`BackupDEK` clean-profile restore/re-key tests;
- Job Object descendant/breakaway/orphan tests;
- exact budget concurrency/reservation tests;
- mandatory Git/GitHub/Proxmox V1 conformance;
- voice, crash/recovery, update/rollback, resource-pressure, soak, packaging, SBOM, and provenance gates.

---

# 9. CONTRADICTION CHECKLIST RESULT

The v1.0.2 active suite was reconciled against these known failure modes:

| Check | Result |
|---|---|
| One current top-level implementation contract | PASS |
| Old v1.0/v0.1 top-level contracts outside active root | PASS — moved to `docs/history/` |
| Active implementation appendices use v1.0.2 parent/semantics | PASS |
| Duplicate ADR-054/055/056 imported into canonical lineage | PASS — no |
| One ExecutionScope model | PASS |
| One DataSensitivity/DataLocality vocabulary | PASS |
| One authoritative money representation | PASS |
| One durable `RESUMING` meaning | PASS |
| One IPC response union | PASS |
| One canonical approval descriptor/digest pipeline | PASS |
| PermissionEngine precedence deterministic | PASS |
| HIGH vs CRITICAL authorization consistent | PASS after final audit correction |
| Job Objects optional for ordinary managed production children | PASS — no; mandatory with narrow verified exception policy |
| Job Objects misrepresented as security sandbox | PASS — explicitly prohibited |
| Tauri privileged remote-origin authority left unspecified | PASS — prohibited/qualified |
| Engineering shell equated to JARVIS external authority | PASS — explicitly separated |
| Provider resume required for durability | PASS — no |
| Portable backup depends on historical live DB_DEK | PASS — no |
| Portable snapshot key handoff unspecified | PASS — explicit fresh SnapshotDBKey inside authenticated payload |
| Consequential target race relies only on time-adjacent re-read | PASS — conditional mutation required where supported |
| Proxmox optional vs mandatory contradiction | PASS — mandatory V1 consistently |
| Proxmox generic raw API/shell fallback | PASS — prohibited |
| Voice optional vs required contradiction | PASS — voice required V1; wake word remains optional |
| Open arbitrary executable-module marketplace required V1 | PASS — no |
| Future ADR allowed to remain an unreconciled override | PASS — synchronous amendment required |

No known unresolved normative contradiction from this review remains in the active v1.0.2 suite.

---

# 10. REPOSITORY CHANGE SCOPE

Compared with `codex/contract-consistency-fixes`, the consolidation branch changes only contract/governance documentation plus root contributor guidance.

No application implementation source is introduced or modified by this reconciliation.

The consolidation intentionally does **not** merge `codex/contract-implementation-lock`; that would reintroduce duplicate ADR identities. Its valid engineering material is incorporated semantically instead.

---

# 11. CURRENT EXTERNAL-PLATFORM ASSUMPTIONS REVIEWED

The consolidation was checked against current primary platform documentation for implementation-sensitive assumptions, including:

- Tauri 2 capability and Content Security Policy model, including current remote-origin security-fix requirements;
- OpenAI/Codex Windows sandbox behavior, particularly the distinction between write/network sandboxing and broad same-user read capability;
- SQLite WAL behavior and the upstream WAL-reset corruption fix requirement;
- current supported Windows 11 release lifecycle used for the Release Profile baseline.

These facts are treated as release-qualified dependencies rather than timeless architecture constants. Exact versions belong in the signed Release Profile/release manifest and must be revalidated for each production release.

---

# 12. WHAT THIS REPORT DOES NOT CLAIM

This report proves document-level reconciliation only.

It does not prove:

- the application builds;
- the selected SQLite/SQLCipher binding works in the final package;
- Tauri configuration is implemented safely;
- Codex sandbox behavior passes conformance;
- Proxmox/GitHub integrations work;
- voice latency/AEC works on real target hardware;
- portable backup actually restores;
- release signing/SBOM/provenance exists;
- soak/recovery/security tests pass.

Those claims require implementation and evidence under `JARVIS-VERIFICATION-RELEASE-CONTRACT.md`.

---

# 13. STATUS

## CONTRACT / ARCHITECTURE

**v1.0.2 is the canonical implementation baseline.**

The current suite is structured so an implementer reads the current contract rather than reconstructing it from a superseding ADR stack.

## PRODUCT

**NOT Production Complete.**

No documentation reconciliation can substitute for the implementation, signed artifacts, conformance tests, recovery drills, security tests, voice qualification, performance/resource testing, soak tests, and release evidence required by the active Release Profile.

---

# 14. GOVERNING RESULT

> **History explains why JARVIS is designed this way. v1.0.2 states how JARVIS must be built. A future change must update the current contract when the decision changes—not leave implementers to discover which old sentence was superseded.**
