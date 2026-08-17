import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  evaluateDesktopFoundation,
  loadDesktopFoundationSnapshot,
} from "../../../tools/ci/check-desktop-foundation.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");

function codes(snapshot) {
  return evaluateDesktopFoundation(snapshot).map((item) => item.code);
}

function mutate(snapshot, transform) {
  const copy = structuredClone(snapshot);
  transform(copy);
  return copy;
}

test("current Section 1.1 desktop foundation satisfies the fail-closed contract", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  assert.deepEqual(evaluateDesktopFoundation(snapshot), []);
});

test("Tauri build-script pairing is host-visible while the WebView runtime stays Windows-only", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  assert.match(
    snapshot.tauriCargo,
    /^\[dependencies\]\ntauri = \{ version = "=2\.11\.5", default-features = false \}$/m,
  );
  assert.match(
    snapshot.tauriCargo,
    /^\[target\.'cfg\(target_os = "windows"\)'\.dependencies\]\ntauri = \{ version = "=2\.11\.5", default-features = false, features = \["wry"\] \}$/m,
  );
});

test("missing Tauri manifest fails closed", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  assert.ok(codes(mutate(snapshot, (copy) => { copy.tauriCargo = null; })).includes("DESKTOP_TAURI_MANIFEST_MISSING"));
});

test("Tauri runtime and build pin drift fail closed", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  const runtime = mutate(snapshot, (copy) => { copy.tauriCargo = copy.tauriCargo.replace('tauri = "=2.11.5"', 'tauri = "=9.9.9"'); });
  const build = mutate(snapshot, (copy) => { copy.tauriCargo = copy.tauriCargo.replace('tauri-build = "=2.6.3"', 'tauri-build = "=9.9.9"'); });
  assert.ok(codes(runtime).includes("DESKTOP_TAURI_RUNTIME_PIN_MISMATCH"));
  assert.ok(codes(build).includes("DESKTOP_TAURI_BUILD_PIN_MISMATCH"));
});

test("JavaScript API and CLI pin drift fail closed", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  const api = mutate(snapshot, (copy) => { copy.desktopPackage.dependencies["@tauri-apps/api"] = "9.9.9"; });
  const cli = mutate(snapshot, (copy) => { copy.desktopPackage.devDependencies["@tauri-apps/cli"] = "9.9.9"; });
  assert.ok(codes(api).includes("DESKTOP_TAURI_JS_PIN_MISMATCH"));
  assert.ok(codes(cli).includes("DESKTOP_TAURI_CLI_PIN_MISMATCH"));
});

test("remote production renderer target fails closed", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  const remote = mutate(snapshot, (copy) => { copy.tauriConfig.build.frontendDist = "https://example.invalid/app"; });
  assert.ok(codes(remote).includes("DESKTOP_FRONTEND_DIST_NOT_LOCAL"));
});

test("non-Vite build or removed Cargo workspace membership fails closed", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  const build = mutate(snapshot, (copy) => { copy.desktopPackage.scripts["build:web"] = "tsc -p tsconfig.json --noEmit"; });
  const workspace = mutate(snapshot, (copy) => { copy.rootCargo = copy.rootCargo.replaceAll(', "apps/desktop/src-tauri"', ""); });
  assert.ok(codes(build).includes("DESKTOP_WEB_BUILD_NOT_VITE"));
  assert.ok(codes(workspace).includes("DESKTOP_CARGO_WORKSPACE_MISSING"));
});

test("remote renderer resources and custom Tauri commands fail closed", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  const remote = mutate(snapshot, (copy) => { copy.indexHtml = copy.indexHtml.replace("</head>", '<script src="https://example.invalid/app.js"></script></head>'); });
  const command = mutate(snapshot, (copy) => { copy.mainRs += "\n#[tauri::command]\nfn unsafe_command() {}\n"; });
  assert.ok(codes(remote).includes("DESKTOP_REMOTE_SCRIPT"));
  assert.ok(codes(command).includes("DESKTOP_CUSTOM_COMMAND_SURFACE"));
});

test("Tauri qualification drift fails closed", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  const drifted = mutate(snapshot, (copy) => { copy.toolchain.tauri.qualification = "DECLARED_RELEASE_FACT_NOT_YET_IMPLEMENTED"; });
  assert.ok(codes(drifted).includes("DESKTOP_TAURI_QUALIFICATION_MISMATCH"));
});

test("removing either mandatory Section 1.1 CI gate fails closed", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  const foundation = mutate(snapshot, (copy) => { copy.workflow = copy.workflow.replace("      - name: Desktop foundation contract\n        run: pnpm desktop:foundation:check\n\n", ""); });
  const windows = mutate(snapshot, (copy) => { copy.workflow = copy.workflow.replace("      - name: Desktop Tauri Windows build\n        run: cargo check --locked -p jarvis-desktop --target x86_64-pc-windows-msvc\n\n", ""); });
  assert.ok(codes(foundation).includes("DESKTOP_FOUNDATION_CI_GATE_MISSING"));
  assert.ok(codes(windows).includes("DESKTOP_WINDOWS_BUILD_CI_GATE_MISSING"));
});
