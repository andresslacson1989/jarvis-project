# Schemas Package Boundary

`packages/schemas` owns runtime validators for data crossing trust, process, provider, integration, storage, and configuration boundaries.

Validation establishes data shape and invariants; it does not grant action authority. Unvalidated external or AI-produced data must not be allowed to flow into execution paths merely because it has a TypeScript type.

Concrete schema infrastructure is owned by later Phase-0 subsections.
