# JARVIS Project

JARVIS is a Windows-first, voice-capable AI operating companion built around deterministic authorization, bounded workers, durable mission orchestration, secure integrations, verified execution, recovery, and one adaptive product identity.

## Start here

- [Contributor instructions](AGENTS.md)
- [Current contract manifest](docs/JARVIS-CONTRACT-MANIFEST-v1.0.8.md)
- [V1 Release Profile](docs/JARVIS-V1-RELEASE-PROFILE.md)
- [Implementation Plan](docs/implementation/JARVIS-IMPLEMENTATION-PLAN.md) — non-normative sequencing aid
- [Implementation Matrix](docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md) — non-normative status board
- [Developer Execution Goal](docs/implementation/JARVIS-DEVELOPER-EXECUTION-GOAL.md) — non-normative implementation and handoff routing
- [Contract Simplification Final-Closure Goal](docs/implementation/JARVIS-CONTRACT-SIMPLIFICATION-FINAL-CLOSURE-GOAL.md) — non-normative contract-maintenance closure criteria

The manifest identifies the six active normative components and their exact authority. No historical document, branch, report, or policy-looking file supplements the active suite.

## V1 boundary

Windows is the V1 production `FULL_HOST`. Linux remains a future `FULL_HOST` target; Android remains a future non-authoritative `COMPANION`. The active contracts define the platform, security, backup, authorization, voice, UI, verification, and release requirements.

`master` is the sole authoritative branch. GitHub Actions is mandatory CI authority; GitLab is mirror-only; LocalCI is supplementary tooling and cannot qualify CI or a release.

## Verification

Use the pinned `pnpm` toolchain. Common checks:

```text
pnpm contract:check
pnpm format:check
pnpm test
pnpm governance:check
```

Documentation or contract completion is not `Production Complete`; the Release Profile and J05 define that gate.
