# ADR-063 — Mandatory Windows Job Object Containment

**Status:** Accepted  
**Date:** 2026-08-11  
**Decision Type:** Runtime/process-containment hardening  
**Scope:** JARVIS v1.0 managed child processes on Windows

## Context

The JARVIS runtime contract already makes the Rust native host the root supervisor and requires that Core, workers, providers, modules, voice helpers, and integration helpers do not create detached process trees that the host cannot terminate.

The contract previously said Windows Job Objects should be used "where practical." That wording is too weak for a production system that intentionally launches AI/provider/tool processes capable of spawning descendants.

Windows Job Objects are the native operating-system mechanism for grouping process trees, applying limits/accounting, and terminating associated processes. Windows supports nested jobs on the JARVIS target platform, and `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` provides deterministic descendant cleanup when the owning job handle is closed.

The main requirement is not aggressive resource throttling everywhere. The critical production requirement is that JARVIS-owned process trees remain supervised and cannot silently escape ordinary shutdown/cancellation through descendant spawning.

---

## Decision

On supported Windows 11 production systems, every JARVIS-managed executable child process tree SHALL be placed into an explicitly owned Windows Job Object containment hierarchy unless a separately documented and verified platform incompatibility makes assignment impossible.

For ordinary managed children, Job Object containment is mandatory rather than best-effort.

A managed process that cannot be placed into its required containment boundary SHALL fail to start or enter an explicit degraded/blocked state according to the capability policy. JARVIS SHALL NOT silently continue with an uncontained equivalent process for consequential work.

---

## 1. Processes covered

The containment requirement applies to managed executable processes including:

- the Node.js JARVIS Core sidecar;
- Codex and other AI CLI provider workers;
- software-engineering worker processes;
- voice/STT/TTS sidecars when separately executable;
- integration helpers;
- `EXTERNAL_MANAGED` modules from ADR-057;
- tool helper processes;
- future AI/provider runtimes launched by JARVIS;
- descendants spawned by those managed processes unless an explicitly authorized policy says otherwise.

Pure renderer/WebView processes owned and managed by the Tauri/WebView platform MAY remain governed by their platform lifecycle where direct Job Object reassignment is unsupported or inappropriate.

User applications intentionally opened as independent external applications MAY use a separately defined launch policy if JARVIS does not claim continued process ownership over them.

---

## 2. Containment hierarchy

The production hierarchy SHALL be equivalent to:

```text
jarvis-desktop.exe (Rust host)
        |
        +-- JARVIS managed-child root Job Object
              |
              +-- jarvis-core
              |
              +-- provider / worker jobs
              |      +-- provider process
              |      +-- provider descendants
              |
              +-- module jobs
              |      +-- EXTERNAL_MANAGED module
              |      +-- module descendants
              |
              +-- helper / voice / integration jobs
```

The implementation MAY use one root job plus nested per-task/per-worker/per-module jobs when additional resource policy, accounting, cancellation, or observability is useful.

Nested jobs SHALL preserve the rule that the native host retains an owning path capable of terminating the relevant managed subtree.

---

## 3. Kill-on-close

Every JARVIS-owned containment job representing a process subtree that must terminate with JARVIS SHALL set:

```text
JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
```

or the verified governing equivalent.

The native host SHALL retain the controlling job handle for the intended lifetime of the process subtree.

Unexpected loss/closure of the final owning handle therefore terminates the processes associated with that job according to Windows Job Object semantics.

JARVIS SHALL not rely only on polite IPC shutdown for process-tree cleanup.

---

## 4. Assignment at process creation

JARVIS SHOULD assign managed processes to their required Job Object at creation time using supported Windows process-creation attributes when practical.

On the Windows 11 target platform, the preferred mechanism is equivalent to:

```text
STARTUPINFOEX
+
PROC_THREAD_ATTRIBUTE_JOB_LIST
```

so the child begins life already associated with the intended job hierarchy.

If a particular spawn path cannot use creation-time job assignment, JARVIS SHALL create the process suspended, assign it to the required job before untrusted/managed code can execute, and only then resume it.

The implementation SHALL avoid a race where a newly started provider/tool can spawn descendants before JARVIS assigns it to containment.

---

## 5. Descendant inheritance

Managed descendants SHALL remain inside the containing Job Object hierarchy by default.

JARVIS SHALL NOT enable ordinary breakaway behavior such as:

```text
JOB_OBJECT_LIMIT_BREAKAWAY_OK
JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK
CREATE_BREAKAWAY_FROM_JOB
```

for normal provider, worker, module, tool, or helper processes.

A capability that genuinely requires an independently surviving process SHALL define that behavior explicitly as a separate launch/ownership policy and SHALL not masquerade as a normal managed child.

---

## 6. Handle inheritance

Process containment and handle inheritance are separate controls.

The native Process Broker SHALL default to no inheritable handles.

When a child genuinely requires inherited handles, JARVIS SHOULD use an explicit handle allowlist equivalent to `PROC_THREAD_ATTRIBUTE_HANDLE_LIST` and inherit only the handles required for that operation.

The existence of Job Object containment SHALL NOT justify broad handle inheritance.

Sensitive handles such as database files, credential-broker internals, unrelated pipes, tokens, and application resources SHALL not be inherited unless explicitly required by a trusted design.

---

## 7. Cancellation semantics

Task/worker cancellation SHALL use a staged policy equivalent to:

```text
request cooperative cancellation
        ↓
wait bounded grace period
        ↓
terminate managed job/subtree if still running
        ↓
verify process-tree termination
        ↓
record cancellation/uncertain external side effects
```

For processes whose external actions may have escaped the local process boundary, killing the local job does not prove the external action did not occur.

The normal recovery/idempotency/`UNCERTAIN` rules remain binding.

---

## 8. Application shutdown

Normal JARVIS shutdown SHALL:

1. stop accepting new consequential work;
2. request cooperative Core/worker/provider shutdown;
3. persist required checkpoints/state;
4. wait bounded grace periods according to process class;
5. close/terminate remaining managed jobs as necessary;
6. verify no JARVIS-owned managed child tree remains running;
7. finalize shutdown diagnostics.

A hung child SHALL not indefinitely prevent desktop shutdown.

---

## 9. Crash cleanup

`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` exists specifically so the process tree does not depend solely on normal shutdown code running successfully.

If the host crashes and Windows closes the final job handles, associated managed process trees SHALL be terminated by the operating system according to the Job Object policy.

Startup recovery SHALL still scan for unexpected surviving processes/resources and reconcile authoritative state rather than assuming cleanup was perfect.

---

## 10. Resource controls

Job Object containment is mandatory; aggressive resource limits are policy-driven.

Per-worker/provider/module jobs MAY additionally enforce:

- process-count ceilings;
- job/process memory limits;
- CPU rate controls where compatible;
- priority/scheduling restrictions;
- resource accounting;
- completion-port notifications;
- runtime-specific ceilings.

Resource ceilings SHALL be calibrated and tested rather than chosen arbitrarily.

A limit that causes instability or invalid provider behavior may be adjusted by the Resource Manager, but removing containment entirely is not the normal fix.

---

## 11. Process count

Provider/worker profiles SHOULD declare or derive an expected maximum descendant-process policy.

Where technically compatible, JARVIS MAY apply an active process-count limit to jobs that should never create large process trees.

Software-engineering tools that legitimately spawn compilers/test runners MAY receive a broader bounded policy than simple provider adapters.

Unexpected process-tree growth SHALL be observable in diagnostics.

---

## 12. Compatibility exceptions

A production capability MAY receive a documented containment exception only when all of the following are true:

1. the Windows/runtime incompatibility is reproduced and documented;
2. no supported creation-time/nested-job approach resolves it;
3. the capability is necessary enough to justify the reduced containment;
4. an alternative deterministic lifecycle/termination mechanism exists;
5. the reduced guarantee is surfaced in capability metadata and diagnostics;
6. release verification specifically tests orphan cleanup for that exception;
7. the exception is narrow to the affected executable/version/path.

"The library does not expose Job Objects conveniently" is not, by itself, a valid production exception. The Rust Process Broker may use direct Win32 process-creation APIs where needed.

---

## 13. Core process

The bundled JARVIS Core defined by ADR-061 SHALL itself be launched under native supervision and Job Object containment.

The Core SHALL not gain authority to opt itself out of the host's containment policy.

If the Core requires child execution, it SHOULD request process creation through the native Process Broker rather than building independent unmanaged process trees.

Any direct Core child-spawn path retained for a narrowly justified purpose SHALL preserve the same Job Object and handle-inheritance invariants.

---

## 14. External managed modules

`EXTERNAL_MANAGED` modules from ADR-057 SHALL receive their own supervised process boundary and SHALL be placed in an appropriate JARVIS-owned Job Object hierarchy.

Module stop, rollback, disable, update, and crash recovery SHALL therefore have a deterministic process-tree termination mechanism.

A module package SHALL not request breakaway rights as an ordinary manifest permission.

---

## 15. Provider and worker isolation semantics

Job Objects provide lifecycle/resource containment; they are not a claim of complete security isolation from same-user malicious code.

ADR-056 remains binding.

A managed provider process running as the same Windows identity may still have access to resources that normal Windows discretionary access control grants that identity unless other controls restrict them.

Therefore Job Objects SHALL be combined with:

```text
non-elevated execution
narrow working directory/workspace
minimal environment
minimal handle inheritance
credential minimization
permission/authority envelopes
provider sandboxing when available
process-specific resource policy
```

JARVIS SHALL describe Job Objects as process containment, not as a perfect security sandbox.

---

## 16. Observability

Diagnostics SHALL record enough information to answer:

- which managed job owns a process;
- task/worker/provider/module association;
- process ID and executable identity;
- descendant count;
- start/end reason;
- cooperative vs forced termination;
- resource-limit violations;
- job-assignment failure;
- unexpected breakaway/escape detection where observable.

Raw sensitive command-line values SHALL remain redacted according to the security contract.

---

## 17. Verification requirements

Production verification SHALL include at minimum:

1. Core process job assignment;
2. provider worker job assignment;
3. `EXTERNAL_MANAGED` module job assignment;
4. child process spawning a grandchild, proving the grandchild remains contained;
5. normal app shutdown with all managed descendants gone;
6. simulated host termination/handle closure proving kill-on-close cleanup;
7. cooperative cancellation followed by forced subtree termination after timeout;
8. a deliberately hung child that cannot block JARVIS shutdown indefinitely;
9. a child attempting ordinary job breakaway and being denied/remaining contained;
10. explicit-handle-inheritance tests proving unrelated sensitive handles are not inherited;
11. nested-job behavior on supported Windows 11 targets;
12. resource-limit violation diagnostics where limits are configured;
13. compatibility-exception tests for every approved exception, if any;
14. recovery-state handling where local process termination leaves external side effects uncertain.

---

## Non-goals

This ADR does not require:

- treating Job Objects as a same-user malware sandbox;
- imposing identical CPU/memory limits on every worker;
- containing independent user applications JARVIS intentionally launches and relinquishes;
- allowing arbitrary child-process breakaway;
- replacing provider-native sandbox controls;
- requiring Administrator privileges.

---

## Consequences

### Positive

- process-tree cleanup is deterministic rather than convention-based;
- descendants cannot normally survive JARVIS merely by being spawned by a child process;
- shutdown/cancellation is more reliable;
- per-worker/module resource accounting becomes practical;
- the Rust host's supervisor role is enforced by the OS rather than only by application bookkeeping;
- external modules and AI CLIs receive the same lifecycle-containment baseline.

### Trade-offs

- the Rust Process Broker needs native Windows process-creation/job-management code;
- a small number of third-party tools may require documented compatibility handling;
- nested process/job behavior requires dedicated Windows integration tests;
- child launch wrappers become slightly more complex than generic `spawn()` calls.

These costs are justified because uncontrolled descendant processes are incompatible with a production supervisory runtime.

---

## Governing Principle

> **If JARVIS owns a process, Windows must know which JARVIS containment boundary owns its entire managed process tree.**
