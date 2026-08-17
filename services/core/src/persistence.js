// Node 22 test-loader bridge. The production Core build emits the typed
// persistence.ts module as persistence.js, while source tests execute the
// TypeScript tree directly.
export * from "./persistence.ts";
