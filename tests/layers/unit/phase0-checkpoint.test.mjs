import test from "node:test";
import assert from "node:assert/strict";
import { validatePhase0Snapshot } from "../../../tools/checkpoints/phase0-checkpoint.mjs";
import profile from "../../../tools/checkpoints/phase0-checkpoint-profile.json" with { type: "json" };

const childIds = ["0.1", "0.2", "0.3", "0.4", "0.5", "0.6", "0.7", "0.8", "0.9", "0.10", "0.11", "0.12", "0.13"];
const packageJson = { scripts: { "phase0:check": "node tools/checkpoints/phase0-checkpoint.mjs", build: "tsc -p tsconfig.build.json && pnpm --filter @jarvis/core build && pnpm --filter @jarvis/desktop build:web" } };
const corePackageJson = { scripts: { build: "tsc -p tsconfig.build.json && node ../../tools/release/prepare-core-build.mjs" } };
const desktopPackageJson = { scripts: { "build:web": "vite build" }, dependencies: { "@tauri-apps/api": "2.11.1", "@tauri-apps/plugin-opener": "2.5.4" } };
const cargoToml = '[package]\nname = "jarvis-desktop-host"\n[build-dependencies]\ntauri-build = { version = "=2.6.3", features = ["codegen"] }\n[dependencies]\ntauri = { version = "=2.11.5", features = ["custom-protocol"] }\ntauri-plugin-opener = "=2.5.4"\n';
const toolchainBaseline = { tauri: { runtime: "2.11.5", build: "2.6.3", rustPluginOpener: "2.5.4", javascriptApi: "2.11.1", javascriptPluginOpener: "2.5.4" } };
const canonicalValues = { contractSuiteVersion: "1.0.8", v1RuntimeTarget: { platform: "WINDOWS", runtimeRole: "FULL_HOST", architecture: "x64" } };
const matrix = `| Contract suite | JARVIS v1.0.8 |\n| **SECTION 0 — Repository / Platform Contracts / Toolchain / Governance** | **IN PROGRESS** |\n${childIds.map((id) => `| ↳ **${id}** x | **VERIFIED** |`).join("\n")}\n`;
const referenceMatrix = "**Contract suite:** JARVIS v1.0.8\ndocs/JARVIS-CONTRACT-MANIFEST-v1.0.6.md\ndocs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.6.md\n";
const allEvidencePaths = new Set(profile.requiredEvidencePaths);

function codes(overrides = {}) {
  return validatePhase0Snapshot({ profile, packageJson, corePackageJson, desktopPackageJson, cargoToml, toolchainBaseline, canonicalValues, matrix, referenceMatrix, linuxSourcePaths: [], androidSourcePaths: [], existingPaths: allEvidencePaths, ...overrides }).map((item) => item.code);
}

test("0.CP local Phase 0 checkpoint snapshot passes", () => assert.deepEqual(codes(), []));
test("independent Core build gate is required", () => assert.ok(codes({ corePackageJson: { scripts: {} } }).includes("PHASE0_CORE_BUILD_GATE")));
test("independent desktop web build gate is required", () => assert.ok(codes({ packageJson: { ...packageJson, scripts: { ...packageJson.scripts, build: "pnpm --filter @jarvis/core build" } } }).includes("PHASE0_DESKTOP_WEB_BUILD_GATE")));
test("exact Tauri release facts are required", () => assert.ok(codes({ toolchainBaseline: { tauri: { ...toolchainBaseline.tauri, runtime: "2.11.4" } } }).includes("PHASE0_TAURI_RELEASE_FACTS")));
test("mandatory Draft 2020-12 schema gate is required locally", () => assert.ok(codes({ profile: { ...profile, requiredLocalGates: profile.requiredLocalGates.filter((gate) => gate.args[0] !== "schema:check") } }).includes("PHASE0_LOCAL_GATE_MISSING")));
test("reference matrix must use active contract routes", () => assert.ok(codes({ referenceMatrix: "**Contract suite:** JARVIS v1.0.5" }).includes("PHASE0_REFERENCE_MATRIX_DRIFT")));
test("canonical V1 runtime target drift fails", () => assert.ok(codes({ canonicalValues: { ...canonicalValues, v1RuntimeTarget: { platform: "LINUX", runtimeRole: "FULL_HOST", architecture: "x64" } } }).includes("PHASE0_RUNTIME_TARGET")));
test("unqualified Linux or Android runtime sources fail", () => assert.equal(codes({ linuxSourcePaths: ["platform/linux/src/runtime.ts"], androidSourcePaths: ["platform/android/src/main.rs"] }).filter((code) => code === "PHASE0_UNQUALIFIED_RUNTIME_SOURCE").length, 2));
test("unverified child subsection fails checkpoint", () => assert.ok(codes({ matrix: matrix.replace("| ↳ **0.13** x | **VERIFIED** |", "| ↳ **0.13** x | **IN PROGRESS** |") }).includes("PHASE0_CHILD_NOT_VERIFIED")));
test("missing child evidence fails checkpoint", () => { const existingPaths = new Set(allEvidencePaths); existingPaths.delete(profile.requiredEvidencePaths.at(-1)); assert.ok(codes({ existingPaths }).includes("PHASE0_CHILD_EVIDENCE_MISSING")); });
test("superseded active top-level contract fails checkpoint", () => assert.ok(codes({ existingPaths: new Set([...allEvidencePaths, "docs/JARVIS-IMPLEMENTATION-CONTRACT-v1.0.5.md"]) }).includes("PHASE0_SUPERSEDED_ACTIVE_CONTRACT")));
