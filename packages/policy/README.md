# Policy Package Boundary

`packages/policy` is reserved for deterministic, side-effect-free policy and state logic.

It MUST NOT directly perform filesystem, network, process, secure-storage, provider, clock, randomness, or native-platform side effects. Clocks, randomness, and comparable nondeterministic inputs are permitted only through explicit injected inputs/interfaces where the owning contract requires them.

Policy code does not own native mechanisms and must not import Windows/Linux backend implementations.
