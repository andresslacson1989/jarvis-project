import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..", "..");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("Section 7 checkpoint keeps every provider gate explicit and fail-closed", () => {
  const matrix = read("docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md");
  const qualification = read("platform/windows/src/provider_qualification.rs");
  const routing = read("services/core/src/provider-routing.ts");
  const providerRuntime = read("packages/protocol/src/provider-runtime.mts");
  const execution = read("providers/ai/src/provider-execution.mts");
  const bridge = read("apps/desktop/src/coreBridge.ts");
  const shell = read("apps/desktop/src/mission-control.tsx");

  for (const subsection of ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "7.9", "7.10", "7.11", "7.12", "7.13", "7.14", "7.15", "7.16", "7.17"]) {
    assert.match(matrix, new RegExp(`\\*\\*${subsection.replace(".", "\\.")}\\*\\*`));
  }
  for (const required of ["network_enabled_verified", "workspace_write_verified", "outside_workspace_write_denied", "structured_exec_interface_verified", "sandbox_non_elevated_verified"]) {
    assert.match(qualification, new RegExp(required));
  }
  assert.match(qualification, /network.*enabled|enabled.*network/iu);
  assert.match(providerRuntime, /SETUP_NOT_READY|QUALIFICATION_NOT_READY|CAPABILITY_MISSING/u);
  assert.match(execution, /circuit|timeout|abort/iu);
  assert.match(bridge, /supportState/);
  assert.match(shell, /Compatibility/);
  assert.match(shell, /Qualification/);
  assert.match(shell, /Capabilities/);
  assert.doesNotMatch(`${qualification}\n${routing}\n${execution}`, /password|credential.*value|raw.*token/iu);
});

test("Section 7 checkpoint does not promote the provider evidence to Linux or Production Complete", () => {
  const matrix = read("docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md");
  assert.match(matrix, /No Linux support or Production Complete claim/u);
  assert.match(matrix, /Production Complete \| \*\*NO\*\*/u);
});
