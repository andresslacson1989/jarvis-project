# Windows Platform Backend Boundary

`platform/windows` is the production Windows FULL_HOST native backend/composition namespace.

Windows-specific implementations and native types remain inside the platform adapter layer. Windows V1 must retain the strongest contract-required Windows mechanisms; portability is not a reason to weaken secure storage, named-pipe security, Job Object containment, path identity, session integration, privilege mediation, or other native invariants.

Section 1.4 implements only the scoped single-instance ownership, fixed
application-data layout, and maintenance-arbitration foundation. The native
crate does not by itself claim any complete Windows capability as `SUPPORTED`.
Later capability bindings, reusable PlatformPathsAndIdentity semantics,
qualified local IPC, process containment, secure storage, window control, and
other Windows V1 services remain owned by their later matrix subsections.
