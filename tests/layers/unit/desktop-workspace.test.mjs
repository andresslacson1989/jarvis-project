import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..", "..");
const desktop = resolve(root, "apps", "desktop");
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
}

function validatePngPayload(payload, expectedSize, layerIndex) {
  assert.deepEqual(
    payload.subarray(0, pngSignature.length),
    pngSignature,
    `ICO layer ${layerIndex} must use PNG compression accepted by modern Windows resource compilation`,
  );

  let cursor = pngSignature.length;
  let sawHeader = false;
  let sawEnd = false;
  while (cursor < payload.length) {
    assert.ok(cursor + 12 <= payload.length, `ICO layer ${layerIndex} contains a truncated PNG chunk header`);
    const chunkLength = payload.readUInt32BE(cursor);
    const chunkType = payload.toString("ascii", cursor + 4, cursor + 8);
    const chunkEnd = cursor + 12 + chunkLength;
    assert.ok(chunkEnd <= payload.length, `ICO layer ${layerIndex} contains a truncated PNG ${chunkType} chunk`);

    if (chunkType === "IHDR") {
      assert.equal(chunkLength, 13, `ICO layer ${layerIndex} PNG IHDR must be 13 bytes`);
      assert.equal(payload.readUInt32BE(cursor + 8), expectedSize, `ICO layer ${layerIndex} PNG width must match directory size`);
      assert.equal(payload.readUInt32BE(cursor + 12), expectedSize, `ICO layer ${layerIndex} PNG height must match directory size`);
      sawHeader = true;
    }
    if (chunkType === "IEND") {
      assert.equal(chunkLength, 0, `ICO layer ${layerIndex} PNG IEND must be empty`);
      assert.equal(chunkEnd, payload.length, `ICO layer ${layerIndex} must not contain bytes after PNG IEND`);
      sawEnd = true;
      break;
    }
    cursor = chunkEnd;
  }

  assert.equal(sawHeader, true, `ICO layer ${layerIndex} PNG must contain IHDR`);
  assert.equal(sawEnd, true, `ICO layer ${layerIndex} PNG must contain complete IEND`);
}

const requiredWorkspaceFiles = [
  "apps/desktop/package.json",
  "apps/desktop/index.html",
  "apps/desktop/tsconfig.json",
  "apps/desktop/vite.config.ts",
  "apps/desktop/src/main.tsx",
  "apps/desktop/src/App.tsx",
  "apps/desktop/src/styles.css",
  "apps/desktop/src/design-system/tokens.css",
  "apps/desktop/src/design-system/components.css",
  "apps/desktop/src/design-system/components.tsx",
  "apps/desktop/src/mission-control.tsx",
  "apps/desktop/src/mission-control.css",
  "apps/desktop/src-tauri/Cargo.toml",
  "apps/desktop/src-tauri/build.rs",
  "apps/desktop/src-tauri/tauri.conf.json",
  "apps/desktop/src-tauri/src/main.rs",
  "apps/desktop/src-tauri/capabilities/main-local-ui.json",
  "apps/desktop/src-tauri/icons/README.md",
  "apps/desktop/src-tauri/icons/icon.ico",
];

test("1.1 desktop workspace owns a concrete React and Tauri application skeleton", () => {
  for (const path of requiredWorkspaceFiles) {
    assert.ok(existsSync(resolve(root, path)), `missing required desktop workspace file: ${path}`);
  }
});

test("desktop JavaScript dependencies are exact, production-aged pins", { skip: !existsSync(resolve(desktop, "package.json")) }, () => {
  const pkg = readJson("apps/desktop/package.json");
  assert.equal(pkg.name, "@jarvis/desktop");
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, "module");
  assert.deepEqual(pkg.engines, { node: "24.18.0", pnpm: "11.21.0" });
  assert.deepEqual(pkg.dependencies, {
    "@tauri-apps/api": "2.11.1",
    "@tauri-apps/plugin-opener": "2.5.4",
    react: "19.2.8",
    "react-dom": "19.2.8",
  });
  assert.deepEqual(pkg.devDependencies, {
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    typescript: "6.0.3",
    vite: "8.1.5",
  });
  assert.equal(pkg.scripts?.typecheck, "tsc -p tsconfig.json --noEmit");
  assert.equal(pkg.scripts?.["build:web"], "vite build");
});

test("production WebView source is a bundled local frontend and development binding is loopback only", { skip: !existsSync(resolve(desktop, "src-tauri", "tauri.conf.json")) }, () => {
  const config = readJson("apps/desktop/src-tauri/tauri.conf.json");
  assert.equal(config.build?.frontendDist, "../dist");
  assert.equal(config.build?.devUrl, "http://127.0.0.1:1420");
  assert.equal(config.app?.windows, undefined, "the security-sensitive window is created by the native builder");
  assert.deepEqual(config.bundle, {
    active: true,
    resources: ["resources/core-runtime"],
    icon: ["icons/icon.ico"],
  });
  assert.doesNotMatch(JSON.stringify(config), /https?:\/\/(?!127\.0\.0\.1:1420|ipc\.localhost)/i);
});

test("canonical-derived Windows icon uses complete PNG-compressed ICO layers", { skip: !existsSync(resolve(desktop, "src-tauri", "icons", "icon.ico")) }, () => {
  const icon = readFileSync(resolve(desktop, "src-tauri", "icons", "icon.ico"));
  assert.ok(icon.length > 6, "ICO file must contain a directory and image entries");
  assert.equal(icon.readUInt16LE(0), 0, "ICO reserved field must be zero");
  assert.equal(icon.readUInt16LE(2), 1, "ICO type must be icon");
  const count = icon.readUInt16LE(4);
  assert.ok(count >= 6, `ICO must contain at least six image layers, got ${count}`);
  assert.ok(6 + count * 16 <= icon.length, "ICO directory must be complete");
  const sizes = [];
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    const width = icon[offset] === 0 ? 256 : icon[offset];
    const height = icon[offset + 1] === 0 ? 256 : icon[offset + 1];
    const byteLength = icon.readUInt32LE(offset + 8);
    const imageOffset = icon.readUInt32LE(offset + 12);
    assert.equal(width, height, `ICO layer ${index} must be square`);
    assert.ok(byteLength > pngSignature.length, `ICO layer ${index} payload must be non-empty`);
    assert.ok(imageOffset >= 6 + count * 16, `ICO layer ${index} payload must start after the directory`);
    assert.ok(imageOffset + byteLength <= icon.length, `ICO layer ${index} directory length must fit inside the file`);
    const payload = icon.subarray(imageOffset, imageOffset + byteLength);
    validatePngPayload(payload, width, index);
    sizes.push(width);
  }
  for (const requiredSize of [16, 24, 32, 48, 64, 256]) {
    assert.ok(sizes.includes(requiredSize), `ICO missing required ${requiredSize}x${requiredSize} layer`);
  }
  const note = read("apps/desktop/src-tauri/icons/README.md");
  assert.match(note, /canonical-derived/i);
  assert.match(note, /jarvis-app-icon\.svg/i);
  assert.doesNotMatch(note, /non-canonical/i);
});

test("1.11 packages canonical brand sources, offline Inter, and auditable provenance", () => {
  for (const path of [
    "assets/brand/jarvis-mark.svg",
    "assets/brand/jarvis-lockup.svg",
    "assets/brand/jarvis-app-icon.svg",
    "assets/brand/fonts/InterVariable.woff2",
    "assets/brand/third-party/Inter-OFL.txt",
    "assets/brand/third-party/provenance.json",
    "tools/assets/generate-brand-icons.mjs",
  ]) {
    assert.ok(existsSync(resolve(root, path)), `missing brand/provenance input: ${path}`);
  }

  const brandSource = [
    read("assets/brand/jarvis-mark.svg"),
    read("assets/brand/jarvis-lockup.svg"),
    read("assets/brand/jarvis-app-icon.svg"),
  ].join("\n");
  const colors = [...brandSource.matchAll(/#[0-9A-Fa-f]{6}/g)].map(([value]) => value.toUpperCase());
  assert.deepEqual([...new Set(colors)].sort(), ["#0B0F14", "#2D7BFF", "#FFFFFF"]);

  const provenance = readJson("assets/brand/third-party/provenance.json");
  assert.equal(provenance.schemaVersion, 1);
  assert.equal(provenance.thirdPartyVisualAssets[0].name, "Inter");
  assert.equal(provenance.thirdPartyVisualAssets[0].version, "4.1");
  assert.equal(provenance.thirdPartyVisualAssets[0].license, "SIL Open Font License 1.1");
  assert.equal(provenance.thirdPartyVisualAssets[0].sha256, sha256("assets/brand/fonts/InterVariable.woff2"));
  assert.equal(provenance.generatedPlatformAssets[0].sha256, sha256("apps/desktop/src-tauri/icons/icon.ico"));
  assert.deepEqual(provenance.generatedPlatformAssets[0].layers, [16, 24, 32, 48, 64, 256]);

  const css = read("apps/desktop/src/styles.css");
  const main = read("apps/desktop/src/main.tsx");
  const vite = read("apps/desktop/vite.config.ts");
  assert.match(css, /@font-face/);
  assert.match(css, /\/brand\/fonts\/InterVariable\.woff2/);
  assert.match(css, /font-weight:\s*100\s+900/);
  assert.match(main, /\.\/styles\.css/);
  assert.match(vite, /publicDir:\s*["']\.\.\/\.\.\/assets["']/);
  assert.doesNotMatch(css, /https?:\/\//i);
});

test("1.12 centralizes design tokens and exposes accessible presentation primitives", () => {
  const tokens = read("apps/desktop/src/design-system/tokens.css");
  const components = read("apps/desktop/src/design-system/components.tsx");
  const componentStyles = read("apps/desktop/src/design-system/components.css");
  const app = read("apps/desktop/src/mission-control.tsx");

  for (const tokenGroup of [
    "--brand-blue",
    "--surface-canvas",
    "--text-primary",
    "--border-subtle",
    "--status-info",
    "--space-4",
    "--radius-control",
    "--type-body",
    "--motion-standard",
    "--focus-color",
    "--z-skip-link",
  ]) {
    assert.match(tokens, new RegExp(`${tokenGroup.replaceAll("-", "\\-")}\\s*:`), `missing centralized token ${tokenGroup}`);
  }
  assert.match(tokens, /prefers-reduced-motion:\s*reduce/);
  assert.match(tokens, /forced-colors:\s*active/);
  const forcedColorsSystem = `${tokens}\n${componentStyles}`;
  for (const systemColor of ["Canvas", "CanvasText", "Highlight", "HighlightText", "ButtonText", "GrayText"]) {
    assert.match(forcedColorsSystem, new RegExp(`\\b${systemColor}\\b`), `forced-colors token missing ${systemColor}`);
  }

  for (const primitive of ["SkipLink", "Button", "Panel", "TextInput", "StatusChip"]) {
    assert.match(components, new RegExp(`export function ${primitive}\\b`), `missing reusable primitive ${primitive}`);
  }
  assert.match(components, /type=\{props\.type \?\? ["']button["']\}/);
  assert.match(components, /aria-describedby/);
  assert.match(components, /aria-invalid/);
  assert.match(components, /role=\{?"alert"\}?/);
  assert.match(components, /role=\{?"status"\}?/);
  assert.match(componentStyles, /\*:focus-visible/);
  assert.match(componentStyles, /min-width:\s*24px/);
  assert.match(componentStyles, /min-height:\s*24px/);
  assert.match(componentStyles, /forced-colors:\s*active/);
  assert.match(componentStyles, /var\(--motion-(?:fast|standard)\)/);
  assert.match(app, /<SkipLink/);
  assert.match(app, /<Panel/);
  assert.match(app, /<StatusChip/);
});

test("1.13 Mission Control has four regions and truthful locked startup state", () => {
  const app = read("apps/desktop/src/App.tsx");
  const shell = read("apps/desktop/src/mission-control.tsx");
  const styles = read("apps/desktop/src/mission-control.css");

  assert.match(app, /MissionControlShell/);
  assert.match(app, /resolveStartupSnapshot/);
  assert.match(shell, /aria-label="JARVIS navigation"/);
  assert.match(shell, /aria-label="JARVIS system status"/);
  assert.match(shell, /<main[^>]+id="mission-control-main"/);
  assert.match(shell, /aria-label="Context and attention"/);
  assert.match(shell, /serviceState: "LOCKED"/);
  assert.match(shell, /startupCondition: "LOCKED"/);
  assert.match(shell, /transportState: "NOT_CONNECTED"/);
  assert.match(shell, /voiceState: "IDLE"/);
  assert.match(shell, /No mission, approval, provider, or project state is being inferred/);
  assert.match(shell, /No verified attention items are available while Core is locked/);
  assert.match(shell, /REPAIR_REQUIRED/);
  assert.match(shell, /will not use a system Node or an unverified fallback/);
  assert.match(shell, /aria-current/);
  assert.match(styles, /grid-template-columns:\s*minmax\(12rem, 15rem\)/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(16rem, 22rem\)/);
  assert.match(styles, /@media \(max-width: 719px\)/);
  assert.match(styles, /grid-template-columns:\s*1fr/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.doesNotMatch(`${app}\n${shell}`, /\b(invoke|fetch|WebSocket|localStorage|indexedDB)\s*\(/);
});

test("renderer bootstrap is semantic and has no authoritative/native integration authority in 1.1", { skip: !existsSync(resolve(desktop, "src", "App.tsx")) }, () => {
  const app = read("apps/desktop/src/App.tsx");
  const main = read("apps/desktop/src/main.tsx");
  const shell = read("apps/desktop/src/mission-control.tsx");
  assert.match(shell, /JARVIS Mission Control/);
  assert.match(main, /createRoot/);
  for (const forbidden of [
    /services\/core/,
    /packages\/policy/,
    /platform\/windows/,
    /\bfetch\s*\(/,
    /\bWebSocket\b/,
    /\blocalStorage\b/,
    /\bindexedDB\b/,
    /\binvoke\s*\(/,
  ]) {
    assert.doesNotMatch(`${app}\n${main}`, forbidden);
  }
});

test("Tauri host is pinned and keeps the typed UI boundary separate from native supervision", { skip: !existsSync(resolve(desktop, "src-tauri", "Cargo.toml")) }, () => {
  const cargo = read("apps/desktop/src-tauri/Cargo.toml");
  const build = read("apps/desktop/src-tauri/build.rs");
  const rustMain = read("apps/desktop/src-tauri/src/main.rs");
  const coreRuntime = read("apps/desktop/src-tauri/src/core_runtime.rs");
  const supervisor = read("platform/windows/src/process_supervisor.rs");
  const pathIdentity = read("platform/windows/src/path_identity.rs");
  const sessionSystem = read("platform/windows/src/session_system.rs");
  const windowController = read("platform/windows/src/window_controller.rs");
  assert.match(cargo, /tauri\s*=\s*\{\s*version\s*=\s*"=2\.11\.5"/);
  assert.match(cargo, /tauri-build\s*=\s*\{\s*version\s*=\s*"=2\.6\.3"\s*,\s*features\s*=\s*\["codegen"\]\s*\}/);
  assert.match(build, /tauri_build::try_build\s*\(/);
  assert.match(build, /tauri_build::Attributes::new\(\)/);
  assert.match(build, /\.codegen\(tauri_build::CodegenContext::new\(\)\)/);
  assert.match(build, /expect\("failed to generate JARVIS Tauri build context"\)/);
  assert.doesNotMatch(build, /tauri_build::build\(\)/);
  assert.match(rustMain, /tauri::Builder::default\(\)/);
  assert.match(rustMain, /tauri::tauri_build_context!\(\)/);
  assert.doesNotMatch(rustMain, /generate_context!/);
  assert.match(rustMain, /invoke_handler\(tauri::generate_handler!\[ui_boundary::get_core_status\]\)/);
  assert.match(rustMain, /pub mod process_supervisor;/);
  assert.match(rustMain, /pub mod path_identity;/);
  assert.match(rustMain, /pub mod session_system;/);
  assert.match(rustMain, /pub mod window_controller;/);
  assert.match(rustMain, /load_verified_layout/);
  assert.match(rustMain, /REPAIR_REQUIRED/);
  assert.match(rustMain, /index\.html\?startup=\{startup_condition\}/);
  assert.match(rustMain, /Core runtime preflight state/);
  assert.match(coreRuntime, /never searches PATH/);
  assert.match(coreRuntime, /release-owned Node runtime is missing/);
  assert.match(cargo, /windows-sys\s*=\s*\{\s*version\s*=\s*"=0\.61\.2"/);
  for (const feature of [
    "Win32_Foundation",
    "Win32_Security",
    "Win32_System_JobObjects",
    "Win32_System_RemoteDesktop",
    "Win32_System_StationsAndDesktops",
    "Win32_System_SystemInformation",
    "Win32_System_Threading",
    "Win32_UI_WindowsAndMessaging",
  ]) {
    assert.match(cargo, new RegExp(`"${feature}"`));
  }
  assert.match(supervisor, /CreateProcessW\(/);
  assert.match(supervisor, /CREATE_SUSPENDED\s*\|\s*CREATE_UNICODE_ENVIRONMENT/);
  assert.match(supervisor, /self\.job\.assign\(pending\.process_handle\(\)\)/);
  assert.match(supervisor, /ResumeThread\(pending\.thread_handle\(\)\)/);
  assert.match(supervisor, /limits\.BasicLimitInformation\.LimitFlags\s*=\s*JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE/);
  assert.match(supervisor, /const NO_INHERITED_HANDLES: i32 = 0/);
  assert.match(sessionSystem, /enum SessionTrustState/);
  assert.match(sessionSystem, /OpenInputDesktop\(/);
  assert.match(sessionSystem, /WTSQuerySessionInformationW\(/);
  assert.match(sessionSystem, /GetNativeSystemInfo\(/);
  assert.match(sessionSystem, /GlobalMemoryStatusEx\(/);
  assert.match(sessionSystem, /HARDWARE_ACCELERATION_CAPABILITY/);
  assert.match(sessionSystem, /CapabilityAvailability::Unavailable/);
  assert.match(pathIdentity, /resolve_application_paths/);
  assert.match(pathIdentity, /LOCALAPPDATA/);
  assert.match(pathIdentity, /reject_reparse/);
  assert.match(pathIdentity, /case_insensitive_key/);
  assert.match(pathIdentity, /ParentDir/);
  assert.match(windowController, /enum PresentationMode/);
  assert.match(windowController, /\.focused\(false\)/);
  assert.match(windowController, /\.always_on_top\(false\)/);
  assert.match(windowController, /WindowEvent::CloseRequested/);
  assert.match(windowController, /available_monitors\(\)/);
  assert.match(windowController, /recover_geometry/);
  assert.match(windowController, /logical_width/);
  assert.doesNotMatch(rustMain, /platform::windows|windows_sys|windows::Win32/);
});

test("root build and typecheck pipelines include the desktop workspace", () => {
  const pkg = readJson("package.json");
  assert.match(pkg.scripts?.typecheck ?? "", /@jarvis\/desktop/);
  assert.match(pkg.scripts?.build ?? "", /@jarvis\/desktop/);
  const cargoWorkspace = read("Cargo.toml");
  assert.match(cargoWorkspace, /apps\/desktop\/src-tauri/);
});
