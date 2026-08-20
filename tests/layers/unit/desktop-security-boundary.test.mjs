import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkDesktopSecurity, validateDesktopSecurity } from "../../../tools/ci/check-desktop-security.mjs";

test("desktop security boundary passes with the qualified restrictive configuration", async () => {
  assert.deepEqual(await checkDesktopSecurity(), []);
});

test("desktop security boundary rejects remote-origin privilege and missing native policy", () => {
  const violations = validateDesktopSecurity({
    config: { app: { security: { csp: "default-src *" }, windows: [{ url: "https://example.com" }] } },
    capability: { windows: ["*"], permissions: ["core:default"] },
    nativeSource: "",
    externalLinkSource: "",
  });
  assert.ok(violations.includes("DESKTOP_SECURITY_RESTRICTIVE_CSP_MISSING"));
  assert.ok(violations.includes("DESKTOP_SECURITY_REMOTE_ORIGIN_PRIVILEGE"));
  assert.ok(violations.includes("DESKTOP_SECURITY_NATIVE_POLICY_MISSING"));
});

test("desktop security boundary rejects unexpected CSP origins", async () => {
  const { readFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
  const config = JSON.parse(await readFile(resolve(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"));
  const capability = JSON.parse(await readFile(resolve(root, "apps/desktop/src-tauri/capabilities/main-local-ui.json"), "utf8"));
  const nativeSource = await readFile(resolve(root, "apps/desktop/src-tauri/src/main.rs"), "utf8");
  const externalLinkSource = await readFile(resolve(root, "apps/desktop/src/external-link.ts"), "utf8");
  config.app.security.csp += "; connect-src 'self' https://evil.example";
  assert.ok(validateDesktopSecurity({ config, capability, nativeSource, externalLinkSource }).includes("DESKTOP_SECURITY_RESTRICTIVE_CSP_MISSING"));
  config.app.security.csp = config.app.security.csp.replace("; connect-src 'self' https://evil.example", "");
  config.app.security.devCsp += " https://evil.example";
  assert.ok(validateDesktopSecurity({ config, capability, nativeSource, externalLinkSource }).includes("DESKTOP_SECURITY_DEV_CSP_MISSING"));
});
