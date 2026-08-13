import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..", "..");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

test("1.2 binds exactly one local capability with no native permissions or remote origins", () => {
  const capability = readJson("apps/desktop/src-tauri/capabilities/main-local-ui.json");
  assert.deepEqual(capability.windows, ["main"]);
  assert.deepEqual(capability.permissions, []);
  assert.equal(capability.remote, undefined);

  const config = readJson("apps/desktop/src-tauri/tauri.conf.json");
  assert.deepEqual(config.app.security.capabilities, ["main-local-ui"]);
});

test("1.2 configures restrictive local-only CSP without executable remote content", () => {
  const csp = readJson("apps/desktop/src-tauri/tauri.conf.json").app.security.csp;
  assert.deepEqual(csp["default-src"], ["'self'", "tauri:", "asset:"]);
  assert.deepEqual(csp["script-src"], ["'self'"]);
  assert.deepEqual(csp["object-src"], ["'none'"]);
  assert.deepEqual(csp["base-uri"], ["'none'"]);
  assert.deepEqual(csp["form-action"], ["'none'"]);
  assert.deepEqual(csp["frame-ancestors"], ["'none'"]);
  assert.doesNotMatch(JSON.stringify(csp), /https?:\/\/(?!ipc\.localhost)/i);
  assert.doesNotMatch(JSON.stringify(csp), /unsafe-eval|unsafe-inline/i);
});

test("1.2 native host blocks remote navigation, new windows, and devtools", () => {
  const main = read("apps/desktop/src-tauri/src/main.rs");
  assert.match(main, /on_navigation\(allows_authoritative_navigation\)/);
  assert.match(main, /url\.host_str\(\) == Some\("127\.0\.0\.1"\)/);
  assert.match(main, /url\.host_str\(\) == Some\("localhost"\)/);
  assert.match(main, /on_new_window\(\|_url, _features\| NewWindowResponse::Deny\)/);
  assert.match(main, /\.devtools\(false\)/);
  assert.match(main, /WebviewUrl::External\(\s*"http:\/\/127\.0\.0\.1:1420"/s);
});

test("1.2 renderer keeps untrusted content inert and bounded", () => {
  const app = read("apps/desktop/src/App.tsx");
  const inert = read("apps/desktop/src/security/inertContent.ts");
  assert.match(app, /toInertText/);
  assert.doesNotMatch(app, /dangerouslySetInnerHTML|innerHTML|outerHTML/);
  assert.match(inert, /typeof value !== "string"/);
  assert.match(inert, /MAX_INERT_CONTENT_LENGTH/);
  assert.match(inert, /slice\(0, MAX_INERT_CONTENT_LENGTH\)/);
});
