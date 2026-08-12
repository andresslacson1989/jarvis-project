# Platform Contracts Package Boundary

`packages/platform-contracts` owns semantic native-capability contracts and platform-neutral capability types.

The contracts describe required semantics, availability/qualification, and failure behavior without encoding a Windows or Linux implementation technology. Capability availability is a technical fact only; it never grants user/action authority. An unavailable or unqualified capability must block or truthfully degrade its dependent feature rather than triggering a weaker generic fallback.

Concrete capability interfaces are implemented in subsection 0.4; native Windows implementations belong under `platform/windows` in later subsections.
