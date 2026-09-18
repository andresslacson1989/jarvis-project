import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  ACCEPTANCE_GATE_DEFINITIONS,
  LOCALCI_GATE_COMMANDS,
  PHASE0_REQUIRED_GATE_IDS,
  renderLocalCiGateCommands,
  validateLocalCiGateScript,
  validateLocalCiWorkerQualificationScript,
} from "../../../tools/ci/localci-gate-manifest.mjs";
import { parseWorkflowSteps } from "../../../tools/checkpoints/phase0-checkpoint.mjs";

const ciScript = readFileSync(new URL("../../../.localci/ci.sh", import.meta.url), "utf8");
const workerScript = readFileSync(new URL("../../../.localci/worker-qualification.sh", import.meta.url), "utf8");
const githubWorkflow = readFileSync(new URL("../../../.github/workflows/static-ci.yml", import.meta.url), "utf8");
const codes = (violations) => violations.map(({ code }) => code);
const gitBash = [
  process.env.ProgramFiles ? `${process.env.ProgramFiles}/Git/bin/bash.exe` : null,
  "C:/Program Files/Git/bin/bash.exe",
].find((candidate) => candidate && existsSync(candidate));

test("LocalCI compatibility runner exactly matches its non-authoritative gate manifest", () => {
  assert.deepEqual(codes(validateLocalCiGateScript(ciScript)), []);
  assert.equal(LOCALCI_GATE_COMMANDS.length, 30);
  assert.deepEqual(LOCALCI_GATE_COMMANDS[4], ["contract-suite-valid", "pnpm contract:check"]);
});

test("gate definitions are complete, unique, and retain GitHub Actions authority metadata", () => {
  assert.equal(ACCEPTANCE_GATE_DEFINITIONS.length, 30);
  assert.equal(new Set(ACCEPTANCE_GATE_DEFINITIONS.map(({ id }) => id)).size, 30);
  for (const definition of ACCEPTANCE_GATE_DEFINITIONS) {
    assert.match(definition.id, /^[a-z0-9-]+$/);
    assert.ok(definition.workflowName.length > 0);
    assert.ok(definition.command.length > 0);
    assert.ok(["GENERAL", "WINDOWS"].includes(definition.executionClass));
    assert.equal(definition.requiredCiAuthority, "GITHUB_ACTIONS");
    assert.ok(definition.evidencePurpose.length > 0);
    assert.ok(definition.github.stepName.length > 0);
    assert.ok(["EXACT_COMMAND", "POWERSHELL_SCRIPT", "COMBINED_POWERSHELL_EVIDENCE", "WORKING_DIRECTORY"].includes(definition.github.mode));
    if (definition.github.mode === "EXACT_COMMAND") assert.equal(definition.github.command, definition.command);
    else assert.ok(definition.github.reason.length > 0);
  }
  assert.equal(PHASE0_REQUIRED_GATE_IDS.length, 21);
});

test("LocalCI executes one canonical rendered gate sequence through a fail-closed temporary file", () => {
  const rendered = renderLocalCiGateCommands();
  assert.equal(rendered.split("\n").filter(Boolean).length, LOCALCI_GATE_COMMANDS.length);
  for (const [gate, command] of LOCALCI_GATE_COMMANDS) {
    assert.match(rendered, new RegExp(`^run_gate ${gate} ${command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
    assert.doesNotMatch(ciScript, new RegExp(`^run_gate ${gate} `, "m"));
  }
  for (const mutation of [
    (text) => text.replace("if ! node tools/ci/render-localci-gates.mjs", "if false && node tools/ci/render-localci-gates.mjs"),
    (text) => text.replace("source \"${rendered_gates}\"", "# source \"${rendered_gates}\""),
    (text) => text.replace("if [[ ! -s ${rendered_gates} ]]", "if false"),
    (text) => text.replace("cleanup_rendered_gates\ntrap - EXIT", "trap - EXIT\ncleanup_rendered_gates"),
  ]) {
    assert.ok(codes(validateLocalCiGateScript(mutation(ciScript))).includes("LOCALCI_GATE_RENDERER_BLOCK"));
  }
  const movedEvidence = ciScript.replace("run_gate static-ci-evidence pnpm ci:evidence\n", "").replace("export JARVIS_CANDIDATE_SHA", "run_gate static-ci-evidence pnpm ci:evidence\nexport JARVIS_CANDIDATE_SHA");
  assert.ok(codes(validateLocalCiGateScript(movedEvidence)).includes("LOCALCI_TERMINAL_EVIDENCE_ORDER"));
});

test("rendered LocalCI gates retain canonical order and commands", () => {
  assert.deepEqual(
    renderLocalCiGateCommands().trim().split("\n"),
    LOCALCI_GATE_COMMANDS.map(([gate, command]) => `run_gate ${gate} ${command}`),
  );
});

test("native Windows Git Bash proves renderer failure exits 78 before gate sourcing", { skip: !gitBash }, () => {
  const syntax = spawnSync(gitBash, ["-n", ".localci/ci.sh"], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr);
  const proof = spawnSync(
    gitBash,
    ["-c", 'set -Eeuo pipefail; rendered_gates=$(mktemp); if ! false >"${rendered_gates}"; then rm -f -- "${rendered_gates}"; exit 78; fi; source "${rendered_gates}"'],
    { encoding: "utf8" },
  );
  assert.equal(proof.status, 78, proof.stderr);
});

test("every semantic gate has a controlled GitHub workflow representation", () => {
  const steps = parseWorkflowSteps(githubWorkflow);
  const byName = new Map(steps.map((step) => [step.name, step]));
  for (const definition of ACCEPTANCE_GATE_DEFINITIONS) {
    const step = byName.get(definition.github.stepName);
    assert.ok(step, `${definition.id} GitHub step`);
    const matchingSteps = steps.filter(({ name }) => name === definition.github.stepName);
    if (definition.github.mode === "EXACT_COMMAND") {
      assert.ok(matchingSteps.every(({ run }) => run === definition.command), `${definition.id} exact command`);
    }
  }
  assert.match(githubWorkflow, /Verify pinned cargo-audit[\s\S]*\$auditVersion = \(cargo audit --version\)\.Trim\(\)/);
  assert.match(githubWorkflow, /RustSec informational warning review[\s\S]*jarvis-rustsec-audit\.json[\s\S]*jarvis-cargo-metadata-windows\.json[\s\S]*check-rustsec-advisories\.mjs/);
  assert.match(githubWorkflow, /Desktop Tauri production build[\s\S]*working-directory: apps\/desktop[\s\S]*run: pnpm tauri build --no-bundle --target x86_64-pc-windows-msvc --ci/);
});

test("LocalCI runner remains fail closed and non-authoritative", () => {
  assert.ok(codes(validateLocalCiGateScript(ciScript.replaceAll("exit 78", "exit 0"))).includes("LOCALCI_FAIL_CLOSED_EXIT"));
  assert.match(ciScript, /JARVIS_CI_AUTHORITY=LOCALCI/);
  assert.match(ciScript, /PENDING_AUTHORITY_FINALIZATION/);
});

test("LocalCI worker qualification rejects Linux/WSL spoofing and missing attestation guards", () => {
  assert.deepEqual(codes(validateLocalCiWorkerQualificationScript(workerScript)), []);
  assert.ok(codes(validateLocalCiWorkerQualificationScript(workerScript.replace("MINGW|MSYS|CYGWIN", "MINGW|MSYS|CYGWIN|Linux"))).includes("LOCALCI_WORKER_OS_SPOOF_GUARD_MISSING"));
  assert.ok(codes(validateLocalCiWorkerQualificationScript(workerScript.replace("[[ ${attested_arch} != X64 ]]", "[[ ${attested_arch} != ARM64 ]]"))).includes("LOCALCI_WORKER_ATTESTATION_GUARD_MISSING"));
  assert.ok(codes(validateLocalCiWorkerQualificationScript(workerScript.replace("return 78", "return 0"))).includes("LOCALCI_WORKER_FAIL_CLOSED_EXIT"));
});
