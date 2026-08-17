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

  const missingPairing = mutate(snapshot, (copy) => {
    copy.tauriCargo = copy.tauriCargo.replace(
      '[dependencies]\ntauri = { version = "=2.11.5", default-features = false }\n\n',
      "",
    );
  });
  const missingWindowsWry = mutate(snapshot, (copy) => {
    copy.tauriCargo = copy.tauriCargo.replace(', features = ["wry"]', "");
  });
  assert.ok(codes(missingPairing).includes("DESKTOP_TAURI_BUILD_PAIRING_MISSING"));
  assert.ok(codes(missingWindowsWry).includes("DESKTOP_TAURI_WINDOWS_WRY_MISSING"));
});

test("missing Tauri manifest fails closed", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  assert.ok(codes(mutate(snapshot, (copy) => { copy.tauriCargo = null; })).includes("DESKTOP_TAURI_MANIFEST_MISSING"));
});

test("Tauri runtime and build pin drift fail closed", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  const runtime = mutate(snapshot, (copy) => { copy.tauriCargo = copy.tauriCargo.replaceAll('version = "=2.11.5"', 'version = "=9.9.9"'); });
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

test("Tauri production build hook must invoke the real renderer build", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  const missingHook = mutate(snapshot, (copy) => { copy.tauriConfig.build.beforeBuildCommand = ""; });
  assert.ok(codes(missingHook).includes("DESKTOP_TAURI_BEFORE_BUILD_COMMAND_MISSING"));
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

test("non-Windows runtime support cannot be introduced silently", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  const drifted = mutate(snapshot, (copy) => {
    copy.mainRs = copy.mainRs.replace('#[cfg(not(target_os = "windows"))]', "");
  });
  assert.ok(codes(drifted).includes("DESKTOP_NON_WINDOWS_STUB_MISSING"));
});

test("Tauri qualification drift fails closed", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  const drifted = mutate(snapshot, (copy) => { copy.toolchain.tauri.qualification = "DECLARED_RELEASE_FACT_NOT_YET_IMPLEMENTED"; });
  assert.ok(codes(drifted).includes("DESKTOP_TAURI_QUALIFICATION_MISMATCH"));
});

test("removing either mandatory Section 1.1 CI gate fails closed", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  const foundation = mutate(snapshot, (copy) => { copy.workflow = copy.workflow.replace("      - name: Desktop foundation contract\n        run: pnpm desktop:foundation:check\n\n", ""); });
  const production = mutate(snapshot, (copy) => { copy.workflow = copy.workflow.replace("      - name: Desktop Tauri production build\n        shell: pwsh\n        working-directory: apps/desktop\n        run: pnpm tauri build --no-bundle --target x86_64-pc-windows-msvc --ci\n", ""); });
  assert.ok(codes(foundation).includes("DESKTOP_FOUNDATION_CI_GATE_MISSING"));
  assert.ok(codes(production).includes("DESKTOP_TAURI_PRODUCTION_BUILD_CI_GATE_MISSING"));
});

test("mandatory static CI cannot drift back to an Ubuntu host", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  const ubuntu = mutate(snapshot, (copy) => {
    copy.workflow = copy.workflow.replace(
      "  static-ci:\n    name: static-ci\n    needs: windows-tauri-build\n    if: ${{ always() }}\n    runs-on: windows-2025",
      "  static-ci:\n    name: static-ci\n    needs: windows-tauri-build\n    if: ${{ always() }}\n    runs-on: ubuntu-24.04",
    );
  });
  assert.ok(codes(ubuntu).includes("DESKTOP_STATIC_CI_WINDOWS_RUNNER_REQUIRED"));
});

test("Linux Tauri host prerequisites cannot become Section 1.1 qualification gates", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  const linuxHost = mutate(snapshot, (copy) => {
    copy.workflow = copy.workflow.replace(
      "      - name: Rust formatting\n        run: cargo fmt --all -- --check",
      "      - name: Install Tauri host-check system dependencies\n        shell: bash\n        run: sudo apt-get install -y libwebkit2gtk-4.1-dev libxdo-dev libayatana-appindicator3-dev librsvg2-dev\n\n      - name: Rust formatting\n        run: cargo fmt --all -- --check",
    );
  });
  assert.ok(codes(linuxHost).includes("DESKTOP_LINUX_TAURI_HOST_QUALIFICATION_FORBIDDEN"));
});

test("clean Windows checkout line-ending policy is mandatory and source rewriting is forbidden", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  const missingPolicy = mutate(snapshot, (copy) => { copy.sourceAttributes = null; });
  const sourceRewrite = mutate(snapshot, (copy) => {
    copy.workflow = copy.workflow.replace(
      "      - name: Install pinned pnpm and Node",
      "      - name: Normalize Rust source newlines\n        shell: pwsh\n        run: Write-Output normalize\n\n      - name: Install pinned pnpm and Node",
    );
  });
  assert.ok(codes(missingPolicy).includes("DESKTOP_LINE_ENDING_POLICY_MISSING"));
  assert.ok(codes(sourceRewrite).includes("DESKTOP_SOURCE_REWRITE_CI_FORBIDDEN"));
});

test("Tauri context generation pairing fails closed if build-context include is reintroduced", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  const incorrect = mutate(snapshot, (copy) => {
    copy.mainRs = copy.mainRs.replace(
      "tauri::generate_context!()",
      "tauri::tauri_build_context!()",
    );
  });
  assert.ok(codes(incorrect).includes("DESKTOP_TAURI_CONTEXT_PAIRING_INVALID"));
});
