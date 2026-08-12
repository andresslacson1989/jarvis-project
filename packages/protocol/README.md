# Protocol Package Boundary

`packages/protocol` owns canonical cross-boundary contracts and transport-neutral types.

Protocol types must not encode provider-native or OS-native implementation structures. This package carries shared product semantics only and must not acquire execution authority, persistence ownership, native API calls, or platform backend dependencies.

Versioned protocol/schema implementation begins in later Phase-0 subsections.
