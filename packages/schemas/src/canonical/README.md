# Canonical contract values

`v1/jarvis-v1.0.6.contract-values.json` is the machine-readable Phase-0 binding
of repeated values fixed by the active JARVIS v1.0.6 contract suite.

It is **not** a replacement for the normative contracts. It exists so runtime,
tests, generated artifacts, and later drift checks can consume one structured
representation rather than retyping security/profile/capability constants.

Only values fixed by the current active suite belong here. Per-release dynamic
facts such as source commit, toolchain versions, signing identities,
`releaseSequence`, `securityEpoch`, concrete provider versions, and TUF key IDs
remain release-manifest facts and must not be invented in this file.

Routine product configuration must not mutate these contract-bound values.
A material normative change follows the synchronous contract-amendment process;
0.12 owns automated contract/profile drift checks.
