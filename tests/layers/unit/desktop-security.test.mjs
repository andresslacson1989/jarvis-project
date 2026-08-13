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

test("1.2 binds exactly one local capability with only scoped opener permission and no remote origins", () => {
  const capability = readJson("apps/desktop/src-tauri/capabilities/main-local-ui.json");
  assert.deepEqual(capability.windows, ["main"]);
  assert.deepEqual(capability.permissions, [{
    identifier: "opener:allow-open-url",
    allow: [{ url: "http://*" }, { url: "https://*" }],
  }]);
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

test("1.2 native host blocks remote navigation, unexpected new windows, and devtools", () => {
  const main = read("apps/desktop/src-tauri/src/main.rs");
  const windowController = read("platform/windows/src/window_controller.rs");
  assert.match(windowController, /\.on_navigation\(navigation_policy\)/);
  assert.match(main, /url\.host_str\(\) == Some\("127\.0\.0\.1"\)/);
  assert.match(main, /url\.host_str\(\) == Some\("localhost"\)/);
  assert.match(windowController, /on_new_window\(\|_url, _features\| NewWindowResponse::Deny\)/);
  assert.match(windowController, /\.devtools\(false\)/);
  assert.match(main, /WebviewUrl::External\(\s*"http:\/\/127\.0\.0\.1:1420"/s);
  assert.match(main, /tauri_plugin_opener::init\(\)/);
});

test("1.2 external-link path validates HTTP(S) URLs before leaving the privileged WebView", () => {
  const helper = read("apps/desktop/src/security/externalLink.ts");
  assert.match(helper, /import \{ openUrl \} from "@tauri-apps\/plugin-opener"/);
  assert.match(helper, /url\.protocol === "http:" \|\| url\.protocol === "https:"/);
  assert.match(helper, /url\.username\.length === 0/);
  assert.match(helper, /url\.password\.length === 0/);
  assert.match(helper, /await openUrl\(value\)/);
  assert.doesNotMatch(helper, /window\.open|dangerouslySetInnerHTML|innerHTML/);
});

test("1.2 renderer keeps untrusted content inert and bounded", () => {
  const app = read("apps/desktop/src/mission-control.tsx");
  const inert = read("apps/desktop/src/security/inertContent.ts");
  assert.match(app, /toInertText/);
  assert.doesNotMatch(app, /dangerouslySetInnerHTML|innerHTML|outerHTML/);
  assert.match(inert, /typeof value !== "string"/);
  assert.match(inert, /MAX_INERT_CONTENT_LENGTH/);
  assert.match(inert, /slice\(0, MAX_INERT_CONTENT_LENGTH\)/);
});
