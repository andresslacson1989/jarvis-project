// Node 22 test-loader bridge. The production Core build emits the typed
// ipc-bootstrap.ts module as ipc-bootstrap.js, while source tests execute the
// TypeScript tree directly.
export * from "./ipc-bootstrap.ts";
