import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACCEPTANCE_GATE_CATALOG,
  LOCALCI_GATE_COMMANDS,
  validateAcceptanceGateCatalog,
  validateLocalCiGateScript,
  validateLocalCiWorkerQualificationScript,
} from "../../../tools/ci/localci-gate-manifest.mjs";

const ciScript = readFileSync(new URL("../../../.localci/ci.sh", import.meta.url), "utf8");
const workerScript = readFileSync(new URL("../../../.localci/worker-qualification.sh", import.meta.url), "utf8");
const catalogText = readFileSync(new URL("../../../docs/implementation/CONTRACT-ACCEPTANCE-GATE-CATALOG.md", import.meta.url), "utf8");
const codes = (violations) => violations.map(({ code }) => code);

test("LocalCI compatibility runner exactly matches its non-authoritative gate manifest", () => {
  assert.deepEqual(codes(validateLocalCiGateScript(ciScript)), []);
  assert.equal(LOCALCI_GATE_COMMANDS.length, 30);
  assert.deepEqual(LOCALCI_GATE_COMMANDS[4], ["contract-suite-valid", "pnpm contract:check"]);
});

test("acceptance catalog covers every canonical gate with ownership, evidence, and distinctness", () => {
  assert.deepEqual(validateAcceptanceGateCatalog(), []);
  assert.equal(ACCEPTANCE_GATE_CATALOG.length, 30);
  assert.deepEqual(ACCEPTANCE_GATE_CATALOG.map(({ gate }) => gate), LOCALCI_GATE_COMMANDS.map(([gate]) => gate));
  assert.deepEqual(ACCEPTANCE_GATE_CATALOG.map(({ command }) => command), LOCALCI_GATE_COMMANDS.map(([, command]) => command));
  for (const entry of ACCEPTANCE_GATE_CATALOG) {
    for (const field of ["contractClause", "evidence", "authority", "purpose", "distinctness"]) {
      assert.equal(typeof entry[field], "string");
      assert.notEqual(entry[field].trim(), "");
    }
    assert.ok(catalogText.includes(`| ${entry.gate} |`), entry.gate);
    assert.ok(catalogText.includes(`<code>${entry.command.replaceAll("|", "\\|")}</code>`), entry.gate);
  }
});

test("acceptance catalog rejects command, duplicate, and metadata drift", () => {
  const commandDrift = ACCEPTANCE_GATE_CATALOG.map((entry) => ({ ...entry }));
  commandDrift[0].command = "pnpm unexpected";
  assert.ok(codes(validateAcceptanceGateCatalog(commandDrift)).includes("ACCEPTANCE_CATALOG_COMMAND_DRIFT"));

  const duplicate = [...ACCEPTANCE_GATE_CATALOG, { ...ACCEPTANCE_GATE_CATALOG[0] }];
  assert.ok(codes(validateAcceptanceGateCatalog(duplicate)).includes("ACCEPTANCE_CATALOG_LENGTH"));

  const metadataDrift = ACCEPTANCE_GATE_CATALOG.map((entry) => ({ ...entry }));
  metadataDrift[0].purpose = "";
  assert.ok(codes(validateAcceptanceGateCatalog(metadataDrift)).includes("ACCEPTANCE_CATALOG_METADATA_MISSING"));
});

test("LocalCI rejects omitted, duplicate, and mutated compatibility gates", () => {
  const [gate, command] = LOCALCI_GATE_COMMANDS[0];
  assert.ok(codes(validateLocalCiGateScript(ciScript.replace(`run_gate ${gate} ${command}\n`, ""))).includes("LOCALCI_GATE_MISSING"));
  assert.ok(codes(validateLocalCiGateScript(ciScript.replace(`run_gate ${gate} ${command}\n`, `run_gate ${gate} ${command}\nrun_gate ${gate} ${command}\n`))).includes("LOCALCI_GATE_DUPLICATE"));
  assert.ok(codes(validateLocalCiGateScript(ciScript.replace("pnpm toolchain:verify", "pnpm toolchain:verify:metadata"))).includes("LOCALCI_GATE_COMMAND_DRIFT"));
  assert.ok(codes(validateLocalCiGateScript(ciScript.replace("--audit-level high", "--audit-level low"))).includes("LOCALCI_GATE_COMMAND_DRIFT"));
});

test("LocalCI rejects an inserted unknown command in the canonical gate sequence", () => {
  const injected = ciScript.replace(
    "run_gate dependencies-frozen pnpm install --frozen-lockfile --ignore-scripts",
    "run_gate injected-command pnpm unexpected\nrun_gate dependencies-frozen pnpm install --frozen-lockfile --ignore-scripts",
  );
  const result = validateLocalCiGateScript(injected);
  assert.ok(codes(result).includes("LOCALCI_GATE_UNKNOWN"));
  assert.ok(codes(result).includes("LOCALCI_GATE_ORDER"));
});

test("LocalCI rejects reordered gates even when every gate and command remains present", () => {
  const [, firstGate, firstCommand, secondGate, secondCommand] = ciScript.match(/run_gate ([a-z0-9-]+) ([^\n]+)\nrun_gate ([a-z0-9-]+) ([^\n]+)/) ?? [];
  assert.ok(firstGate && firstCommand && secondGate && secondCommand);
  const reordered = ciScript.replace(
    `run_gate ${firstGate} ${firstCommand}\nrun_gate ${secondGate} ${secondCommand}`,
    `run_gate ${secondGate} ${secondCommand}\nrun_gate ${firstGate} ${firstCommand}`,
  );
  const result = validateLocalCiGateScript(reordered);
  assert.ok(codes(result).includes("LOCALCI_GATE_ORDER"));
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
