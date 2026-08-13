import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..", "..");
const desktop = resolve(root, "apps", "desktop");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

const requiredWorkspaceFiles = [
  "apps/desktop/package.json",
  "apps/desktop/index.html",
  "apps/desktop/tsconfig.json",
  "apps/desktop/vite.config.ts",
  "apps/desktop/src/main.tsx",
  "apps/desktop/src/App.tsx",
  "apps/desktop/src-tauri/Cargo.toml",
  "apps/desktop/src-tauri/build.rs",
  "apps/desktop/src-tauri/tauri.conf.json",
  "apps/desktop/src-tauri/src/main.rs",
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
  assert.equal(config.app?.windows?.length, 1);
  assert.equal(config.app.windows[0]?.label, "main");
  assert.equal(config.app.windows[0]?.title, "JARVIS Mission Control");
  assert.equal(config.app.windows[0]?.url, undefined, "production window must use bundled frontendDist rather than a remote URL");
  assert.doesNotMatch(JSON.stringify(config), /https?:\/\/(?!127\.0\.0\.1:1420)/i);
});

test("renderer bootstrap is semantic and has no authoritative/native integration authority in 1.1", { skip: !existsSync(resolve(desktop, "src", "App.tsx")) }, () => {
  const app = read("apps/desktop/src/App.tsx");
  const main = read("apps/desktop/src/main.tsx");
  assert.match(app, /JARVIS Mission Control/);
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

test("Tauri host is pinned and intentionally minimal before 1.2 and 1.3", { skip: !existsSync(resolve(desktop, "src-tauri", "Cargo.toml")) }, () => {
  const cargo = read("apps/desktop/src-tauri/Cargo.toml");
  const build = read("apps/desktop/src-tauri/build.rs");
  const rustMain = read("apps/desktop/src-tauri/src/main.rs");
  assert.match(cargo, /tauri\s*=\s*\{\s*version\s*=\s*"=2\.11\.5"/);
  assert.match(cargo, /tauri-build\s*=\s*\{\s*version\s*=\s*"=2\.6\.3"/);
  assert.match(build, /tauri_build::build\(\)/);
  assert.match(rustMain, /tauri::Builder::default\(\)/);
  assert.match(rustMain, /tauri::tauri_build_context!\(\)/);
  assert.doesNotMatch(rustMain, /generate_context!/);
  assert.doesNotMatch(rustMain, /invoke_handler/);
  assert.doesNotMatch(rustMain, /platform::windows|windows_sys|windows::Win32/);
});

test("root build and typecheck pipelines include the desktop workspace", () => {
  const pkg = readJson("package.json");
  assert.match(pkg.scripts?.typecheck ?? "", /@jarvis\/desktop/);
  assert.match(pkg.scripts?.build ?? "", /@jarvis\/desktop/);
  const cargoWorkspace = read("Cargo.toml");
  assert.match(cargoWorkspace, /apps\/desktop\/src-tauri/);
});
