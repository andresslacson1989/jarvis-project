# Windows Platform Backend Boundary

`platform/windows` is the production Windows FULL_HOST native backend/composition namespace.

Windows-specific implementations and native types remain inside the platform adapter layer. Windows V1 must retain the strongest contract-required Windows mechanisms; portability is not a reason to weaken secure storage, named-pipe security, Job Object containment, path identity, session integration, privilege mediation, or other native invariants.

This subsection creates only the ownership namespace. No Windows capability is implemented or claimed `SUPPORTED` here.
