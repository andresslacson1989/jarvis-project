# Integration Provider Adapter Boundary

`providers/integrations` owns integration-specific transport/adaptation code.

Integration adapters must not bypass canonical execution, permission/authority, credential-broker, locality, budget/resource, platform-capability, postcondition, or audit controls. External-system live state remains authoritative for external facts.

No integration capability is implemented or claimed supported by subsection 0.2.
