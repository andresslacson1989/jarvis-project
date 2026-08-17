import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  evaluateDesktopFoundation,
  loadDesktopFoundationSnapshot,
} from "../../../tools/ci/check-desktop-foundation.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");

test("missing Windows Tauri resource icon fails closed", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  snapshot.windowsResourceIcon = null;

  const codes = evaluateDesktopFoundation(snapshot).map((item) => item.code);
  assert.ok(codes.includes("DESKTOP_WINDOWS_RESOURCE_ICON_MISSING"));
});
