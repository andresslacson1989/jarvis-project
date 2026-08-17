# JARVIS Security, Runtime, Trust, and Platform Instructions

This file is a non-normative repository operating instruction referenced by `AGENTS.md`. It preserves the current v1.0.6 platform/runtime, backup/recovery, project-policy-trust, and supply-chain/update rules previously carried inline in root `AGENTS.md`. It does not replace, narrow, supersede, or reinterpret the active normative contract suite.

## Platform/runtime-role boundary

Implementation SHALL preserve:

```text
Windows → FULL_HOST → mandatory V1 target
Linux   → FULL_HOST → future target
Android → COMPANION → future non-V1 client
```

Rules:

- shared Core/domain/policy code SHALL NOT directly depend on Win32/DPAPI/named-pipe/Job-Object/HWND/SID/UAC implementation APIs;
- native functions SHALL be reached through explicit platform capability/composition boundaries;
- operating-system checks belong in platform composition/adapters, not scattered through domain/features;
- Windows V1 SHALL still use its strongest qualified mechanisms; portability is never a reason to weaken security/process/recovery invariants;
- platform/provider/tool/module support is qualified per platform where native behavior differs;
- missing platform capability fails closed or degrades truthfully;
- Linux is not V1 and SHALL NOT be falsely reported supported;
- a future companion is non-authoritative and SHALL NOT cause direct privileged Core exposure;
- remote companion networking is future architecture and cannot be invented ad hoc during V1.

> **Abstract the capability, not the security away.**

## Backup/recovery cryptographic boundary

`JARVIS_BACKUP_V1` is a fixed versioned security format, not an adapter preference.

Do not:

- substitute another AEAD, nonce construction, tag size, chunk framing, AAD field set, key hierarchy, generated-recovery size, or key-slot construction under format V1;
- reuse `DB_DEK`, `SnapshotDBKey`, `BackupDEK`, recovery secrets, or derived KEKs as one another;
- treat a user-selected passphrase as sufficient by itself for a production `PORTABLE_STATE VERIFIED` backup;
- log/store/send generated recovery factors or derived key material through normal DB/config/log/diagnostic/AI channels;
- assume a generic SQLite backup API is safe/available for the selected SQLCipher binding without the exact Phase-3 proof.

Every production portable-state verified backup requires the generated 256-bit recovery slot and the complete Backup Cryptography Contract qualification.

## Project-policy trust boundary

Repository content, including `AGENTS.md`, is untrusted until the authenticated user explicitly enrolls the exact policy identity under `JARVIS-PROJECT-POLICY-TRUST-CONTRACT.md`.

Do not:

- auto-trust policy-looking files on clone/open/register/checkout;
- treat filename/path alone as trust;
- carry trust across a content-hash/path/project-identity change;
- let an untrusted nested policy override trusted policy;
- let a worker silently rewrite trusted policy and have the new contents become trusted;
- use trusted project policy to widen external authority, waive approvals, change DataPolicy, reveal credentials, or authorize elevation.

Mutating an enrolled trusted project-policy file is contextually HIGH. The resulting content requires explicit review/enrollment before it is trusted for new work.

## Supply-chain/update trust boundary

Production application/module activation follows `JARVIS-SUPPLY-CHAIN-TRUST-CONTRACT.md`.

Do not:

- treat a valid historical artifact signature as perpetual authorization to activate;
- bypass TUF root/role threshold, expiration, version, revocation, delegation, rollback/freeze/mix-and-match checks;
- accept update signing keys directly from an unauthenticated server response;
- allow a module-only delegated role to authorize application releases;
- reset trusted-root/version/security-epoch floors because ordinary cache was deleted;
- use a lower historical release merely because its Tauri/Authenticode signature still validates when current trusted metadata or security-epoch policy rejects it.

Windows production update gates are cumulative: current TUF authorization, Tauri updater signature, Windows code-signing policy, and JARVIS compatibility/rollback checks must all pass.
