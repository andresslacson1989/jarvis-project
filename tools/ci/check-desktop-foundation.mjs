import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { isMain, printViolations, violation } from "./lib.mjs";

const EXPECTED_QUALIFICATION = "DESKTOP_FOUNDATION_IMPLEMENTED_NOT_RELEASE_QUALIFIED";

async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

function parseJson(text) {
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function loadDesktopFoundationSnapshot(rootDir) {
  const read = (relativePath) => readOptional(resolve(rootDir, relativePath));
  const [rootCargo, desktopPackageText, tauriCargo, tauriConfigText, indexHtml, stylesCss, mainRs, toolchainText, workflow] = await Promise.all([
    read("Cargo.toml"),
    read("apps/desktop/package.json"),
    read("apps/desktop/src-tauri/Cargo.toml"),
    read("apps/desktop/src-tauri/tauri.conf.json"),
    read("apps/desktop/index.html"),
    read("apps/desktop/src/styles.css"),
    read("apps/desktop/src-tauri/src/main.rs"),
    read("tools/toolchain/toolchain-baseline.json"),
    read(".github/workflows/static-ci.yml"),
  ]);
  return {
    rootCargo,
    desktopPackage: parseJson(desktopPackageText),
    desktopPackageText,
    tauriCargo,
    tauriConfig: parseJson(tauriConfigText),
    tauriConfigText,
    indexHtml,
    stylesCss,
    mainRs,
    toolchain: parseJson(toolchainText),
    toolchainText,
    workflow,
  };
}

function hasWorkflowStep(workflow, name, run) {
  if (typeof workflow !== "string") return false;
  const start = workflow.indexOf(`      - name: ${name}\n`);
  if (start < 0) return false;
  const next = workflow.indexOf("\n      - name: ", start + 1);
  const block = workflow.slice(start, next < 0 ? workflow.length : next);
  return block.includes(`\n        run: ${run}`) && !/\n\s+if:/.test(block);
}

function add(violations, condition, code, path, detail) {
  if (!condition) violations.push(violation(code, path, detail));
}

export function evaluateDesktopFoundation(snapshot) {
  const violations = [];
  const baseline = snapshot.toolchain;
  const pkg = snapshot.desktopPackage;
  const config = snapshot.tauriConfig;
  const runtime = baseline?.tauri?.runtime;
  const build = baseline?.tauri?.build;
  const api = baseline?.tauri?.javascriptApi;
  const cli = baseline?.tauri?.cli;

  add(violations, snapshot.rootCargo !== null, "DESKTOP_ROOT_CARGO_MISSING", "Cargo.toml", "root Cargo workspace is required");
  add(violations, snapshot.tauriCargo !== null, "DESKTOP_TAURI_MANIFEST_MISSING", "apps/desktop/src-tauri/Cargo.toml", "real Tauri crate manifest is required");
  add(violations, snapshot.tauriConfigText !== null, "DESKTOP_TAURI_CONFIG_MISSING", "apps/desktop/src-tauri/tauri.conf.json", "Tauri configuration is required");
  add(violations, snapshot.desktopPackageText !== null, "DESKTOP_PACKAGE_MISSING", "apps/desktop/package.json", "desktop package manifest is required");
  add(violations, snapshot.indexHtml !== null, "DESKTOP_INDEX_MISSING", "apps/desktop/index.html", "bundled renderer entry point is required");
  add(violations, snapshot.mainRs !== null, "DESKTOP_TAURI_MAIN_MISSING", "apps/desktop/src-tauri/src/main.rs", "Tauri application entry point is required");
  add(violations, snapshot.toolchainText !== null, "DESKTOP_TOOLCHAIN_BASELINE_MISSING", "tools/toolchain/toolchain-baseline.json", "toolchain baseline is required");

  if (snapshot.desktopPackageText !== null && pkg === undefined) {
    violations.push(violation("DESKTOP_PACKAGE_INVALID_JSON", "apps/desktop/package.json", "desktop package manifest must be valid JSON"));
  }
  if (snapshot.tauriConfigText !== null && config === undefined) {
    violations.push(violation("DESKTOP_TAURI_CONFIG_INVALID_JSON", "apps/desktop/src-tauri/tauri.conf.json", "Tauri config must be valid JSON"));
  }
  if (snapshot.toolchainText !== null && baseline === undefined) {
    violations.push(violation("DESKTOP_TOOLCHAIN_INVALID_JSON", "tools/toolchain/toolchain-baseline.json", "toolchain baseline must be valid JSON"));
  }

  if (typeof snapshot.rootCargo === "string") {
    add(violations, snapshot.rootCargo.includes('"apps/desktop/src-tauri"'), "DESKTOP_CARGO_WORKSPACE_MISSING", "Cargo.toml", "desktop Tauri crate must be a workspace member");
  }
  if (pkg && typeof pkg === "object") {
    add(violations, pkg.scripts?.["build:web"] === "tsc -p tsconfig.json --noEmit && vite build", "DESKTOP_WEB_BUILD_NOT_VITE", "apps/desktop/package.json", "build:web must typecheck then create the Vite production bundle");
    add(violations, pkg.dependencies?.["@tauri-apps/api"] === api, "DESKTOP_TAURI_JS_PIN_MISMATCH", "apps/desktop/package.json", `@tauri-apps/api must equal ${String(api)}`);
    add(violations, pkg.devDependencies?.["@tauri-apps/cli"] === cli, "DESKTOP_TAURI_CLI_PIN_MISMATCH", "apps/desktop/package.json", `@tauri-apps/cli must equal ${String(cli)}`);
  }
  if (typeof snapshot.tauriCargo === "string") {
    const basePairing = `[dependencies]\ntauri = { version = "=${String(runtime)}", default-features = false }`;
    const windowsRuntime = `[target.'cfg(target_os = "windows")'.dependencies]\ntauri = { version = "=${String(runtime)}", default-features = false, features = ["wry"] }`;
    const basePairingOk = snapshot.tauriCargo.includes(basePairing);
    const windowsRuntimeOk = snapshot.tauriCargo.includes(windowsRuntime);
    add(violations, snapshot.tauriCargo.includes(`tauri-build = "=${String(build)}"`), "DESKTOP_TAURI_BUILD_PIN_MISMATCH", "apps/desktop/src-tauri/Cargo.toml", `tauri-build must equal ${String(build)}`);
    add(violations, basePairingOk && windowsRuntimeOk, "DESKTOP_TAURI_RUNTIME_PIN_MISMATCH", "apps/desktop/src-tauri/Cargo.toml", `Tauri runtime must equal ${String(runtime)} in both host-pairing and Windows WebView dependencies`);
    add(violations, basePairingOk, "DESKTOP_TAURI_BUILD_PAIRING_MISSING", "apps/desktop/src-tauri/Cargo.toml", "tauri-build requires a host-visible tauri dependency with default features disabled");
    add(violations, windowsRuntimeOk, "DESKTOP_TAURI_WINDOWS_WRY_MISSING", "apps/desktop/src-tauri/Cargo.toml", "Windows V1 must enable the wry WebView runtime only in the Windows dependency block");
  }
  if (config && typeof config === "object") {
    add(violations, config.build?.frontendDist === "../dist", "DESKTOP_FRONTEND_DIST_NOT_LOCAL", "apps/desktop/src-tauri/tauri.conf.json", "production frontendDist must be ../dist");
    add(violations, config.build?.devUrl === "http://localhost:5173", "DESKTOP_DEV_URL_UNEXPECTED", "apps/desktop/src-tauri/tauri.conf.json", "development URL must remain fixed localhost:5173");
  }
  if (typeof snapshot.indexHtml === "string") {
    add(violations, !/<script\b[^>]*\bsrc=["']https?:\/\//i.test(snapshot.indexHtml), "DESKTOP_REMOTE_SCRIPT", "apps/desktop/index.html", "remote executable scripts are prohibited");
    add(violations, !/<link\b[^>]*\bhref=["']https?:\/\//i.test(snapshot.indexHtml), "DESKTOP_REMOTE_LINK_RESOURCE", "apps/desktop/index.html", "remote renderer resources are prohibited in the foundation");
  }
  if (typeof snapshot.stylesCss === "string") {
    add(violations, !/(?:@import\s+|url\()\s*["']?https?:\/\//i.test(snapshot.stylesCss), "DESKTOP_REMOTE_STYLE_RESOURCE", "apps/desktop/src/styles.css", "remote CSS resources are prohibited");
  }
  if (typeof snapshot.mainRs === "string") {
    add(violations, !snapshot.mainRs.includes("invoke_handler") && !/#\s*\[\s*tauri::command/.test(snapshot.mainRs), "DESKTOP_CUSTOM_COMMAND_SURFACE", "apps/desktop/src-tauri/src/main.rs", "Section 1.1 must not add a consequential custom Tauri command surface");
    add(violations, snapshot.mainRs.includes('#[cfg(not(target_os = "windows"))]') && snapshot.mainRs.includes("only qualified for Windows"), "DESKTOP_NON_WINDOWS_STUB_MISSING", "apps/desktop/src-tauri/src/main.rs", "non-Windows builds must remain an explicit unsupported stub rather than a Tauri runtime");
  }
  if (baseline && typeof baseline === "object") {
    add(violations, baseline.tauri?.qualification === EXPECTED_QUALIFICATION, "DESKTOP_TAURI_QUALIFICATION_MISMATCH", "tools/toolchain/toolchain-baseline.json", `Tauri qualification must be ${EXPECTED_QUALIFICATION}`);
  }

  add(violations, hasWorkflowStep(snapshot.workflow, "Desktop foundation contract", "pnpm desktop:foundation:check"), "DESKTOP_FOUNDATION_CI_GATE_MISSING", ".github/workflows/static-ci.yml", "desktop foundation contract gate must be mandatory and unconditional");
  add(violations, hasWorkflowStep(snapshot.workflow, "Desktop Tauri Windows build", "cargo check --locked -p jarvis-desktop --target x86_64-pc-windows-msvc"), "DESKTOP_WINDOWS_BUILD_CI_GATE_MISSING", ".github/workflows/static-ci.yml", "explicit Windows Tauri build gate must be mandatory and unconditional");

  return violations;
}

export async function checkDesktopFoundation(rootDir) {
  const snapshot = await loadDesktopFoundationSnapshot(rootDir);
  return { violations: evaluateDesktopFoundation(snapshot) };
}

if (isMain(import.meta.url)) {
  const rootDir = fileURLToPath(new URL("../..", import.meta.url));
  const result = await checkDesktopFoundation(rootDir);
  if (result.violations.length > 0) {
    printViolations("desktop-foundation", result.violations);
    process.exit(1);
  }
  console.log("[desktop-foundation] PASS");
}
