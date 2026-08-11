# ADR-065 — Provider Version Qualification and Codex Compatibility

**Status:** Accepted  
**Date:** 2026-08-11  
**Decision Type:** Provider/runtime compatibility hardening  
**Scope:** JARVIS v1.0 provider adapters, with Codex CLI as the initial engineering provider

## Context

JARVIS intentionally treats AI providers as replaceable adapters rather than hardcoding orchestration to one vendor/model/runtime.

The runtime contract already requires every provider adapter to implement discovery, version checking, authentication checking where possible, health probing, cancellation semantics, capability advertisement, and sanitized error mapping.

That requirement needs a stricter production meaning.

For an external CLI provider such as Codex, the mere existence of an executable named `codex` does not prove that the installed version is compatible with the JARVIS adapter. CLI interfaces, output formats, authentication behavior, available models, execution modes, and cancellation semantics can change between releases.

JARVIS therefore needs an explicit compatibility/qualification layer that distinguishes installation from production support.

---

## Decision

A provider SHALL be considered production `SUPPORTED` only when:

1. the provider executable/runtime is discovered through an approved resolution path;
2. its exact version is identified;
3. that version is covered by the compatibility policy shipped with the active JARVIS release;
4. the provider adapter/version combination has passed the required release-time conformance suite;
5. runtime health/authentication/capability checks required for use currently pass.

JARVIS SHALL NOT treat "installed" or "launchable" as synonymous with "supported."

Codex CLI SHALL follow this rule as the initial software-engineering provider.

---

## 1. Compatibility state is separate from health

JARVIS SHALL distinguish provider compatibility from provider runtime health.

The logical model SHALL be equivalent to:

```ts
type ProviderCompatibilityState =
  | 'NOT_DETECTED'
  | 'VERSION_UNKNOWN'
  | 'VERSION_UNSUPPORTED'
  | 'CONFORMANCE_UNQUALIFIED'
  | 'COMPATIBLE';

type ProviderHealth =
  | 'STARTING'
  | 'READY'
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'FAILED';
```

A provider may be:

```text
COMPATIBLE + UNAVAILABLE
COMPATIBLE + DEGRADED
VERSION_UNSUPPORTED + otherwise launchable
```

These states SHALL not be collapsed into one ambiguous boolean.

---

## 2. Release compatibility policy

Each JARVIS release SHALL ship a provider compatibility policy equivalent to:

```ts
interface ProviderCompatibilityPolicy {
  providerId: ProviderId;
  adapterVersion: string;

  acceptedVersions: ProviderVersionRule[];
  deniedVersions?: string[];

  requiredCapabilities: string[];
  conformanceProfileId: string;
}

type ProviderVersionRule =
  | {
      kind: 'EXACT';
      version: string;
    }
  | {
      kind: 'RANGE';
      range: string;
    };
```

Exact schema/semver library choice MAY be refined during implementation.

The binding rule is that accepted versions/ranges are shipped with JARVIS and represent combinations actually qualified by the release process.

---

## 3. Conservative version policy

For external CLI providers, JARVIS SHALL prefer a conservative compatibility policy.

A newly released provider version newer than JARVIS's tested maximum SHALL NOT automatically inherit `SUPPORTED` status merely because its semantic version looks compatible.

JARVIS MAY support a version range only when the relevant versions/interfaces have enough compatibility evidence to justify that range.

Where provider CLI compatibility is not guaranteed, exact tested versions or narrowly bounded ranges are preferred.

This avoids optimistic execution against an untested command/output contract.

---

## 4. Runtime version discovery

The adapter SHALL obtain provider version information using the provider's documented/versioned mechanism when available.

For CLI providers, this normally means an equivalent of:

```text
provider executable --version
```

through the managed Process Broker.

Version discovery SHALL:

- use a bounded timeout;
- use the resolved executable identity/path that JARVIS intends to execute;
- capture only bounded output;
- parse against an adapter-specific schema/pattern;
- reject malformed/ambiguous version output;
- avoid executing arbitrary shell interpolation.

A version that cannot be reliably identified SHALL be `VERSION_UNKNOWN`, not assumed current.

---

## 5. Executable identity

Provider discovery SHALL resolve an exact executable identity before use.

Once selected for an attempt, the provider executable path/identity and discovered version SHALL be recorded or referenced in the attempt/runtime diagnostics.

JARVIS SHOULD detect if the provider executable is replaced or upgraded between health checks and execution.

If the executable/version changes, compatibility SHALL be re-evaluated before new consequential work is routed to it.

JARVIS SHALL not continue using stale `SUPPORTED` state after detecting a changed provider binary/version.

---

## 6. Release-time conformance

Runtime smoke checks alone are insufficient to declare an adapter/provider version production-supported.

The JARVIS release pipeline SHALL maintain provider conformance fixtures/tests covering the adapter's required behavior.

For Codex CLI, the conformance profile SHALL cover as applicable:

- executable/version discovery;
- supported authentication state detection;
- non-interactive invocation used by JARVIS;
- structured/machine-readable result handling used by the adapter;
- stdout/stderr/error normalization;
- exit-code semantics;
- cancellation/termination behavior;
- working-directory/project scoping;
- environment handling;
- approval/sandbox mode assumptions;
- timeout behavior;
- model selection/capability reporting;
- process-tree containment;
- behavior when authentication expires;
- behavior when the requested model is unavailable or incompatible;
- rate-limit/quota/provider-unavailable mapping;
- checkpoint/resume behavior only if JARVIS uses it.

A provider version SHALL not appear in a production-supported compatibility rule until this conformance profile passes for that combination.

---

## 7. Runtime health probe

Runtime startup SHALL perform a lightweight, non-destructive provider probe appropriate to the adapter.

The probe SHOULD avoid chargeable inference merely to determine whether an executable exists and is structurally compatible.

It MAY verify:

- executable availability;
- exact version;
- basic CLI invocation/help/version path;
- authentication presence/status when the provider exposes a safe check;
- local configuration readability needed by the provider itself;
- required command/features advertised by that version.

A full chargeable inference probe MAY be used only when necessary and governed by budget/user/provider policy.

---

## 8. Authentication compatibility

Provider authentication is adapter state, not a secret for the orchestrator to inspect directly.

JARVIS SHALL use documented provider authentication flows supported by the qualified provider version.

The provider adapter SHALL report states equivalent to:

```text
AUTHENTICATED
REAUTH_REQUIRED
AUTH_UNAVAILABLE
AUTH_UNKNOWN
```

without exposing raw access/refresh tokens into AI context, normal logs, or renderer state.

If provider authentication mechanisms change in a new CLI release, that release SHALL not be marked supported until the adapter behavior is qualified.

---

## 9. Model compatibility is separate from CLI compatibility

A compatible provider executable does not imply every model is usable.

JARVIS SHALL maintain observed/declared model capability state independently from provider-version compatibility.

A routing decision SHALL consider at least:

```text
provider adapter compatible?
provider healthy/authenticated?
requested model/capability available?
privacy/locality permitted?
budget/quota permitted?
resource policy permitted?
```

If a model requires a newer provider version than the installed compatible range, JARVIS SHALL report the model/provider combination as unavailable rather than silently changing models unless normal provider fallback policy authorizes an equivalent substitute.

---

## 10. No automatic trust of provider self-update

A provider CLI MAY offer its own self-update mechanism, but successful self-update does not automatically grant production support inside JARVIS.

After any external/provider-managed update:

```text
detect new executable/version
  ↓
mark previous compatibility observation stale
  ↓
run version compatibility check
  ↓
SUPPORTED only if active JARVIS policy covers it
```

If the user upgrades Codex to an unqualified version, JARVIS SHALL surface an actionable compatibility status.

It SHALL NOT silently execute production tasks through that version merely to avoid inconvenience.

---

## 11. JARVIS-managed provider updates

A future JARVIS-managed provider installation/update feature MAY install a qualified provider version.

If implemented, it SHALL:

- retrieve from an approved source;
- verify package/source integrity according to the provider supply-chain policy;
- select a version explicitly allowed by the active JARVIS compatibility manifest;
- stage/verify before activation where practical;
- preserve rollback/reinstall guidance.

This ADR does not require JARVIS to manage Codex installation in V1.

---

## 12. Unsupported-version behavior

When a provider is detected but not compatible, JARVIS SHALL:

- mark compatibility as `VERSION_UNSUPPORTED` or `CONFORMANCE_UNQUALIFIED`;
- exclude it from normal automatic routing;
- show detected version and supported policy in diagnostics;
- provide safe remediation guidance;
- allow other compliant providers to receive work according to fallback policy.

Developer mode MAY permit explicit experimentation with an unsupported provider version only behind a clearly non-production override that cannot silently become the default production path.

Consequential production work SHALL not depend on such an override.

---

## 13. Compatibility evidence

The release artifacts/metadata SHOULD preserve evidence equivalent to:

```ts
interface ProviderQualificationRecord {
  providerId: ProviderId;
  providerVersion: string;
  adapterVersion: string;
  conformanceProfileId: string;
  testedAt: UtcTimestamp;
  result: 'PASS' | 'FAIL';
  platform: string;
}
```

This record MAY be build/release metadata rather than mutable user data.

The goal is to make "SUPPORTED" an evidence-backed release claim.

---

## 14. Provider output contract

The Codex/provider adapter SHALL use the most stable qualified machine-readable interface available for the selected provider version.

JARVIS SHALL NOT build authoritative parsing around terminal colors, screen coordinates, transient TUI text, or human-oriented formatting when a structured interface is available.

If a provider offers only human-oriented output for a required capability, the adapter parser SHALL be version-qualified and treated as a compatibility-sensitive component.

Unexpected output SHALL fail parsing safely rather than being guessed into a successful worker result.

---

## 15. Provider capability advertisement

`ProviderProfile.capabilities` SHALL represent capabilities validated/known for the active provider/version/profile, not marketing assumptions.

Capabilities MAY be sourced from:

- release qualification metadata;
- runtime provider discovery;
- model/provider metadata;
- explicitly configured policy.

A capability discovered at runtime SHALL not bypass provider-version compatibility or security policy.

---

## 16. Startup and continuous revalidation

Provider compatibility SHALL be evaluated:

- during initial provider discovery;
- after detected executable/version change;
- after provider update;
- after adapter/JARVIS update;
- before routing when cached compatibility evidence is stale or invalidated.

JARVIS need not execute expensive conformance suites on every startup; release-time qualification plus lightweight runtime identity/health checks is the intended production model.

---

## 17. Diagnostics

Provider diagnostics SHALL expose at least:

```text
provider id
resolved executable/runtime identity
detected version
adapter version
compatibility state
supported version rule
health state
auth state
model/capability availability
last compatibility check
last health check
remediation reason/code
```

Secret-bearing provider configuration SHALL not be displayed.

---

## 18. Verification requirements

Production verification SHALL include at minimum:

1. qualified Codex/provider version detected and marked compatible;
2. older unsupported version rejected;
3. newer unqualified version rejected rather than optimistically accepted;
4. malformed `--version` output producing `VERSION_UNKNOWN`;
5. provider executable replaced between checks causing compatibility re-evaluation;
6. expired/missing authentication mapped without secret leakage;
7. compatible CLI with unavailable requested model handled separately from CLI compatibility;
8. structured output fixture parsing for each supported provider version;
9. changed/unknown output schema failing safely;
10. cancellation/process-tree behavior under ADR-063 containment;
11. provider self-update followed by version revalidation;
12. fallback routing excludes unsupported provider versions;
13. release conformance evidence exists for every version/range marked supported;
14. developer override cannot silently qualify a provider for production.

---

## Non-goals

This ADR does not require:

- bundling Codex CLI inside JARVIS;
- auto-updating Codex to latest;
- supporting every Codex release immediately;
- pinning one forever-static Codex version in this ADR;
- assuming semantic versioning alone guarantees CLI compatibility;
- treating provider health as the same thing as compatibility;
- parsing unstable human TUI output when a better qualified interface exists.

---

## Consequences

### Positive

- provider version drift cannot silently break authoritative worker behavior;
- `SUPPORTED` becomes an evidence-backed compatibility claim;
- Codex upgrades are handled predictably;
- model availability and CLI compatibility are separated cleanly;
- JARVIS can add future AI CLIs using the same qualification model;
- runtime startup remains lightweight because full conformance happens in release qualification.

### Trade-offs

- new provider versions may temporarily be unavailable in JARVIS until qualification is updated;
- the release pipeline must maintain provider-version fixtures/matrices;
- diagnostics and provider registry need explicit compatibility state.

These costs are appropriate because provider CLIs are moving external dependencies at an authoritative execution boundary.

---

## Governing Principle

> **Detected means present. Compatible means understood. Supported means tested. JARVIS routes production work only through providers for which all three are true.**
