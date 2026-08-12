# AI Provider Adapter Boundary

`providers/ai` owns AI-provider-specific adapters and translation at the provider boundary.

Provider-native request/response/process types remain inside adapters. Canonical mission/task/domain state uses JARVIS protocol/domain types, and provider adapters cannot mutate authoritative mission/task state directly or widen authority/scope.

Provider implementation and qualification belong to their later owning matrix sections.
