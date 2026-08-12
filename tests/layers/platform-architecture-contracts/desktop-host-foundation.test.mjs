import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../..", import.meta.url));

async function text(path) {
  return readFile(resolve(root, path), "utf8");
}

async function json(path) {
  return JSON.parse(await text(path));
}

test("1.1 desktop package pins the minimum React/Vite dependency surface", async () => {
  const packageJson = await json("apps/desktop/package.json");
  assert.equal(packageJson.name, "@jarvis/desktop");
  assert.equal(packageJson.private, true);
  assert.deepEqual(packageJson.dependencies, {
    react: "19.2.8",
    "react-dom": "19.2.8",
  });
  assert.deepEqual(packageJson.devDependencies, {
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    vite: "8.1.5",
  });
  assert.equal(packageJson.scripts.build, "vite build");
  assert.equal(packageJson.scripts.typecheck, "tsc -p tsconfig.json --noEmit");
});

test("1.1 renderer entry is bundled-local and non-authoritative", async () => {
  const index = await text("apps/desktop/index.html");
  assert.match(index, /<script type="module" src="\/src\/main\.tsx"><\/script>/);
  assert.doesNotMatch(index, /https?:\/\//i);

  const app = await text("apps/desktop/src/App.tsx");
  assert.match(app, /data-authority="non-authoritative"/);
  assert.match(app, /JARVIS/);
  assert.doesNotMatch(app, /invoke\(|fetch\(|WebSocket|EventSource/);
});

test("1.1 Tauri configuration binds production to local frontendDist", async () => {
  const config = await json("apps/desktop/src-tauri/tauri.conf.json");
  assert.equal(config.productName, "JARVIS");
  assert.equal(config.version, "0.0.0");
  assert.equal(config.identifier, "com.jarvis.desktop");
  assert.equal(config.build.frontendDist, "../dist");
  assert.equal(config.build.devUrl, "http://localhost:1420");
  assert.deepEqual(config.app.security.capabilities, ["main-bundled-local"]);
  assert.equal(config.app.windows.length, 1);
  assert.equal(config.app.windows[0].label, "main");
  assert.equal(config.app.windows[0].url, undefined);
});

test("1.1 main WebView capability is Windows-only, local, and fail-closed", async () => {
  const capability = await json("apps/desktop/src-tauri/capabilities/main-bundled-local.json");
  assert.equal(capability.identifier, "main-bundled-local");
  assert.deepEqual(capability.windows, ["main"]);
  assert.deepEqual(capability.platforms, ["windows"]);
  assert.equal(capability.local, true);
  assert.deepEqual(capability.permissions, []);
  assert.equal(capability.remote, undefined);
});

test("1.1 Rust host pins Tauri and fails closed outside Windows", async () => {
  const cargo = await text("apps/desktop/src-tauri/Cargo.toml");
  assert.match(cargo, /tauri-build\s*=\s*"=2\.6\.2"/);
  assert.match(cargo, /\[target\.'cfg\(target_os = "windows"\)'\.dependencies\]/);
  assert.match(cargo, /tauri\s*=\s*\{\s*version\s*=\s*"=2\.11\.2"/);

  const main = await text("apps/desktop/src-tauri/src/main.rs");
  assert.match(main, /#\[cfg\(target_os = "windows"\)\]/);
  assert.match(main, /tauri::Builder::default\(\)/);
  assert.match(main, /#\[cfg\(not\(target_os = "windows"\)\)\]/);
  assert.match(main, /not supported on this platform/i);
  assert.doesNotMatch(main, /Command::new|named.?pipe|TcpListener|UdpSocket/);
});

test("1.1 desktop host is admitted as an explicit OS composition boundary", async () => {
  const policy = await json("tools/architecture/architecture-policy.json");
  assert.ok(policy.allowedOsBranchPrefixes.includes("apps/desktop/src-tauri/src/"));
});
