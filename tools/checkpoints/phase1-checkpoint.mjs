import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const REQUIRED_ROWS = Object.freeze([
  "1.1",
  "1.2",
  "1.3",
  "1.4",
  "1.5",
  "1.6",
  "1.7",
  "1.8",
  "1.9",
  "1.10",
  "1.11",
  "1.12",
  "1.13",
  "1.14",
]);

function violation(code, path, detail) {
  return Object.freeze({ code, path, detail });
}

function matrixRowStatus(matrix, id) {
  const escaped = id.replace(".", "\\.");
  const match = String(matrix).match(
    new RegExp(`^\\| ↳ \\*\\*${escaped}\\*\\*[^\\n]*\\| \\*\\*([^*]+)\\*\\* \\|`, "m"),
  );
  return match?.[1] ?? null;
}

function sectionStatus(matrix) {
  const match = String(matrix).match(
    /^\| \*\*SECTION 1 — Windows Tauri Host \/ Mission Control Foundation \/ Application-Owned Core\*\* \| \*\*([^*]+)\*\* \|/m,
  );
  return match?.[1] ?? null;
}

function hasAny(text, patterns) {
  return patterns.every((pattern) => pattern.test(text));
}

export async function validatePhase1Snapshot({
  matrix,
  tauriConfig,
  coreRuntimeManifest,
  nativeMain,
  nativePlatform,
  nativeRuntime,
  nativeLifecycle,
  nativeUiBoundary,
  coreMain,
  missionControl,
}) {
  const violations = [];

  if (sectionStatus(matrix) !== "VERIFIED") {
    violations.push(
      violation(
        "PHASE1_SECTION_STATUS",
        "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md",
        "Section 1 must be VERIFIED only after its integration checkpoint passes",
      ),
    );
  }

  for (const id of REQUIRED_ROWS) {
    if (matrixRowStatus(matrix, id) !== "VERIFIED") {
      violations.push(
        violation(
          "PHASE1_CHILD_NOT_VERIFIED",
          "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md",
          `${id} must be VERIFIED before the Section 1 checkpoint can pass`,
        ),
      );
    }
  }

  if (matrixRowStatus(matrix, "1.CP") !== "VERIFIED") {
    violations.push(
      violation(
        "PHASE1_CHECKPOINT_STATUS",
        "docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md",
        "1.CP must be VERIFIED when its integration evidence passes",
      ),
    );
  }

  const bundle = tauriConfig?.bundle;
  if (
    tauriConfig?.build?.frontendDist !== "../dist" ||
    tauriConfig?.build?.devUrl !== "http://127.0.0.1:1420" ||
    bundle?.active !== true ||
    JSON.stringify(bundle?.resources) !== JSON.stringify(["resources/core-runtime"]) ||
    bundle?.windows?.digestAlgorithm !== "sha256" ||
    !/^[0-9A-F]{40}$/u.test(bundle?.windows?.certificateThumbprint ?? "")
  ) {
    violations.push(
      violation(
        "PHASE1_TAURI_RELEASE_CONFIG",
        "apps/desktop/src-tauri/tauri.conf.json",
        "Tauri must use bundled local UI, the explicit release-owned Core resource, and SHA-256 Windows signing metadata",
      ),
    );
  }

  if (
    coreRuntimeManifest?.nodeVersion !== "24.18.0" ||
    coreRuntimeManifest?.architecture !== "x64" ||
    coreRuntimeManifest?.platform !== "WINDOWS" ||
    coreRuntimeManifest?.runtimeRole !== "FULL_HOST"
  ) {
    violations.push(
      violation(
        "PHASE1_RUNTIME_IDENTITY",
        "apps/desktop/src-tauri/resources/core-runtime/runtime-manifest.json",
        "packaged Core must identify the Windows/FULL_HOST/x64 V1 runtime and pinned Node version",
      ),
    );
  }

  if (
    !/REPAIR_REQUIRED/u.test(nativeMain) ||
    !/windows-v1-x64-full-host/u.test(nativePlatform) ||
    !hasAny(nativeRuntime, [
      /CoreRuntimeMissing/u,
      /CoreRuntimeIntegrityFailed/u,
      /JARVIS_CORE_ROOT/u,
      /NODE_OPTIONS/u,
      /NODE_PATH/u,
    ]) ||
    !hasAny(nativeLifecycle, [/instance/u, /maintenance/u]) ||
    !/CORE_IPC_NOT_READY/u.test(nativeUiBoundary) ||
    !hasAny(coreMain, [/CORE_IPC_NOT_READY/u, /LOCKED/u]) ||
    !hasAny(missionControl, [/REPAIR_REQUIRED/u, /NOT_CONNECTED/u])
  ) {
    violations.push(
      violation(
        "PHASE1_TRUTHFUL_FOUNDATION_STATES",
        "apps/desktop/src-tauri/src + services/core/src/main.ts + apps/desktop/src/mission-control.tsx",
        "startup, runtime-integrity, pre-IPC, and repair states must remain explicit and fail closed",
      ),
    );
  }

  const forbiddenSharedNative = /Win32|DPAPI|named[- ]pipe|Job Object|HWND|SID|UAC/u;
  if (forbiddenSharedNative.test(coreMain)) {
    violations.push(
      violation(
        "PHASE1_SHARED_NATIVE_LEAK",
        "services/core/src/main.ts",
        "shared Core must not depend on Windows-native implementation details",
      ),
    );
  }

  return violations;
}

async function requiredJson(path) {
  if (!existsSync(path)) throw new Error(`${path} is missing`);
  return JSON.parse(await readFile(path, "utf8"));
}

export async function loadPhase1Snapshot(root = ROOT) {
  const read = (path) => readFile(resolve(root, path), "utf8");
  return {
    matrix: await read("docs/implementation/JARVIS-IMPLEMENTATION-MATRIX.md"),
    tauriConfig: await requiredJson(resolve(root, "apps/desktop/src-tauri/tauri.conf.json")),
    coreRuntimeManifest: await requiredJson(
      resolve(root, "apps/desktop/src-tauri/resources/core-runtime/runtime-manifest.json"),
    ),
    nativeMain: await read("apps/desktop/src-tauri/src/main.rs"),
    nativePlatform: await read("apps/desktop/src-tauri/src/platform.rs"),
    nativeRuntime: await read("apps/desktop/src-tauri/src/core_runtime.rs"),
    nativeLifecycle: await read("apps/desktop/src-tauri/src/lifecycle.rs"),
    nativeUiBoundary: await read("apps/desktop/src-tauri/src/ui_boundary.rs"),
    coreMain: await read("services/core/src/main.ts"),
    missionControl: await read("apps/desktop/src/mission-control.tsx"),
  };
}

async function main() {
  const violations = await validatePhase1Snapshot(await loadPhase1Snapshot());
  if (violations.length > 0) {
    console.error(JSON.stringify({ checkpoint: "1.CP", status: "FAIL", violations }, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ checkpoint: "1.CP", status: "PASS" }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(`[phase1-checkpoint] FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
