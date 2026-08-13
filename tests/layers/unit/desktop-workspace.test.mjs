import test from "node:test";
import assert from "node:assert/strict";
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
  assert.deepEqual(config.bundle, { active: false, icon: ["icons/icon.ico"] });
  assert.doesNotMatch(JSON.stringify(config), /https?:\/\/(?!127\.0\.0\.1:1420|ipc\.localhost)/i);
});

test("bootstrap Windows icon uses complete PNG-compressed ICO layers and remains explicitly non-canonical until 1.11", { skip: !existsSync(resolve(desktop, "src-tauri", "icons", "icon.ico")) }, () => {
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
  assert.match(note, /non-canonical/i);
  assert.match(note, /1\.11/);
  assert.match(note, /must be replaced/i);
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
  assert.match(cargo, /tauri-build\s*=\s*\{\s*version\s*=\s*"=2\.6\.3"\s*,\s*features\s*=\s*\["codegen"\]\s*\}/);
  assert.match(build, /tauri_build::try_build\s*\(/);
  assert.match(build, /tauri_build::Attributes::new\(\)/);
  assert.match(build, /\.codegen\(tauri_build::CodegenContext::new\(\)\)/);
  assert.match(build, /expect\("failed to generate JARVIS Tauri build context"\)/);
  assert.doesNotMatch(build, /tauri_build::build\(\)/);
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
