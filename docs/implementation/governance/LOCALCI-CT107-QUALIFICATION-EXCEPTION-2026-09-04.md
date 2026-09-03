# LocalCI CT107 Qualification Exception

**Exception ID:** `JARVIS-CT107-QUAL-EXCEPTION-2026-09-04-v1`  
**Status:** `AUTHORIZED_FOR_ONE_BOUNDED_QUALIFICATION_RUN`  
**Approval timestamp:** `2026-09-04` (Asia/Manila; exact UTC event timestamp is retained in the approval/audit record)  
**Approver:** repository and LocalCI document owner, as explicitly approved in the controlling Codex task  
**Evidence provenance:** owner approval in the implementation task and independent auditor response

## Scope and supersession

This exception authorizes one bounded, non-mutating LocalCI qualification run for
the exact JARVIS candidate `0fc861fca5e8d5d382176fce143607af61ee994c` on CT107.
For this run only, it supersedes the CT107 no-testing clauses in:

- `F:\local-ci-installation\PRODUCTION_IMPLEMENTATION_GOAL.md` §§87–91;
- `F:\local-ci-installation\docs\install.md` §§12–27.

It does not change the production role of CT107, authorize installation or setup
work, or authorize any unrelated LocalCI or Proxmox operation. CT104 is not part
of this exception.

## Target and exact qualification inputs

| Field | Authorized value |
|---|---|
| Protected target | CT107 (`localci-clean107`) |
| LocalCI endpoint | `https://192.168.99.211` |
| Repository | `andresslacson1989/jarvis-project` |
| Full ref | `refs/heads/codex/section1-2-tauri-security` |
| Exact candidate | `0fc861fca5e8d5d382176fce143607af61ee994c` |
| Pipeline identity/profile | `static-ci` / `tauri2418` |
| Repository pipeline | `.localci/ci.sh` |
| Submission identity | unique server-issued job ID and idempotency key, recorded in final evidence |
| Server resolution | repository, full ref, exact SHA, and immutable attestation, recorded in final evidence |

The canonical entrypoint is the checked-in `.localci/ci.sh` from the exact
candidate checkout. The approved submission is the documented `POST
/api/v1/jobs` operation with only the repository, full ref, approved pipeline,
exact candidate, and unique idempotency fields above. Job polling, log retrieval,
artifact retrieval, and cancellation use only the documented job-specific API
paths. No credential, arbitrary clone URL, command, image, mount, host path, or
network may be supplied.

## Allowed operations

- Verify the CT107 TLS identity before authentication.
- Authenticate with the least-privileged approved LocalCI account/API client.
- Submit and observe the single exact-candidate qualification job.
- Retrieve the job’s bounded logs/artifact metadata and terminal evidence.
- Exercise the named cancellation/recovery cases supported by the approved
  qualification procedure.
- Stop and start CT107 only when required by the approved recovery/health check;
  after each such operation, verify service health and protected-state identity.

## Explicit prohibitions

The run MUST NOT modify setup, configuration, registration, branch rules,
installation, release state, credentials, firewall policy, storage, network
identity, unrelated CTs, volumes, or Proxmox resources. It MUST NOT create a
second job, use CT104, use arbitrary execution surfaces, or bypass TLS,
authentication, profile/ref allowlists, server resolution, isolation, or
retention controls.

## Preconditions, abort criteria, and recovery

Before submission, capture the CT107 identity, endpoint certificate fingerprint,
running/unprivileged state, repository/profile registration, and branch-rule
state. Abort without submitting if any identity, TLS, registration, branch/ref,
profile, worker, or candidate value is missing or mismatched. Abort immediately
if any unexpected setup/configuration/registration mutation, unrelated resource
effect, second job, non-Windows/X64 worker, credential exposure, or arbitrary
execution surface is observed.

The exception covers one job and expires at its terminal result, an operator
abort, or a control-plane timeout. If CT107 is stopped, restart it through the
approved operational path and verify HTTPS availability, service health,
registration/configuration identity, and absence of unrelated changes before
continuing or closing the run. Preserve failed or ambiguous outcomes as
`UNCERTAIN` until reconciled; never retry blindly.

## Required immutable evidence

The final evidence package MUST retain, with UTC timestamps and verifier identity:

1. this exception ID and approval provenance;
2. CT107 TLS fingerprint, subject/SAN, issuer, validity, endpoint, and comparison
   source;
3. immutable registration and branch-rule export;
4. server-resolved repository, full ref, exact candidate SHA, and attestation;
5. native Windows/X64 worker observation and canonical `tauri2418` gate manifest;
6. unique idempotency key, job identity, timestamps, terminal status, bounded
   logs, artifact hashes, and retention/export proof;
7. cancellation and recovery results within this scope; and
8. post-run proof that CT107 setup/configuration/registration and unrelated
   resources were unchanged, plus independent reviewer sign-off.

This exception authorizes testing only. It does not make LocalCI qualified and
does not change the repository status: Section 0 and Section 1.2 remain
`VERIFYING` until every mandatory gate and independent review pass.
