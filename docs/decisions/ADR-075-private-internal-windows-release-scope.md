# ADR-075 — Private/Internal Windows Release Scope

**Status:** Accepted  
**Date:** August 15, 2026  
**Decision owner:** User / project governance  
**Contract suite introduced:** v1.0.7

## Context

The JARVIS implementation is intended for one owner and private/internal use. Public Microsoft Store distribution and public Internet distribution are not release goals. The v1.0.6 qualification wording therefore created an unnecessary external gate by treating publicly trusted Windows signing custody as the only acceptable Windows artifact-signing path, even though the application will be deployed only to explicitly controlled Windows profiles.

The current checkout has a self-signed development certificate. It is not suitable for public distribution, but it can be used for a private/internal release only when the exact certificate identity is explicitly enrolled and trusted on every authorized target.

## Decision

JARVIS V1 changes its distribution scope to `PRIVATE_INTERNAL`:

- Windows 11 x64 `FULL_HOST`, the Core/host security boundaries, recovery behavior, TUF metadata, Tauri updater signature, and exact-artifact qualification remain mandatory.
- Microsoft Store/public distribution is outside the supported V1 release scope.
- Every private/internal installer and executable SHALL still carry an Authenticode signature. Unsigned artifacts are not permitted.
- In `PRIVATE_INTERNAL` mode, the Authenticode certificate MAY be self-signed or issued by a private CA. The certificate identity/fingerprint, trust-provisioning procedure, authorized target scope, and timestamp evidence SHALL be recorded with the release evidence.
- The private/internal certificate SHALL be explicitly trusted on each authorized Windows profile through a controlled enrollment step. The application SHALL NOT silently install an arbitrary trust root or claim public Windows trust.
- The signing private key SHALL remain protected and unavailable to the running application. A self-signed certificate is valid only for this private/internal mode and SHALL NOT be represented as publicly trusted.
- TUF root/targets/snapshot/module threshold and offline-custody requirements remain unchanged. Private/internal Authenticode trust does not waive TUF, Tauri, rollback, revocation, or release-manifest checks.
- The final qualification label is scoped to the private/internal release and SHALL NOT imply public distribution or public-trust reputation.

## Consequences

- The owner can qualify the current NSIS artifact without purchasing a public CA certificate.
- A second user or machine requires explicit trust enrollment before installation/use; this is an intentional private-distribution boundary.
- The exact signed artifact and the enrolled certificate identity remain bound to the qualification report.
- The existing self-signed development certificate may qualify only after it is explicitly designated as the private/internal release signer for the tested artifact; it remains invalid for public release.
- TUF production key custody remains a separate release requirement and is not replaced by the Windows certificate.

## Rejected alternatives

### Publish through the Microsoft Store

Rejected because public Store distribution is outside the requested private/internal scope.

### Remove Authenticode signing

Rejected because private distribution still needs artifact identity and tamper evidence.

### Treat a self-signed artifact as publicly trusted

Rejected because Windows will not trust it on an unenrolled target and that would be a false release claim.

## Synchronous contract changes

ADR-075 requires synchronized updates to:

- the top-level implementation contract and suite identity;
- the V1 Release Profile and private/internal distribution scope;
- the Supply-Chain Trust Contract's Windows signing mode;
- the Verification/Release Contract's exact-artifact and trust-enrollment gates;
- the Implementation Plan's release qualification wording;
- the contract manifest, canonical repeated values, drift tooling, and entry-point documentation;
- the active implementation matrix and 3.15 evidence.
