import assert from "node:assert/strict";
import test from "node:test";
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
