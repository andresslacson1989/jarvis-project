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

test("checked-in Windows Tauri resource icon is a valid ICO", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  assert.ok(Buffer.isBuffer(snapshot.windowsResourceIcon));
  assert.equal(snapshot.windowsResourceIcon.readUInt16LE(0), 0);
  assert.equal(snapshot.windowsResourceIcon.readUInt16LE(2), 1);
  assert.ok(snapshot.windowsResourceIcon.readUInt16LE(4) >= 1);
  assert.ok(!evaluateDesktopFoundation(snapshot).some((item) => item.code === "DESKTOP_WINDOWS_RESOURCE_ICON_MISSING"));
});

test("malformed Windows Tauri resource icon fails closed", async () => {
  const snapshot = await loadDesktopFoundationSnapshot(root);
  snapshot.windowsResourceIcon = Buffer.from(snapshot.windowsResourceIcon);
  snapshot.windowsResourceIcon.writeUInt16LE(2, 2);
  assert.ok(evaluateDesktopFoundation(snapshot).map((item) => item.code).includes("DESKTOP_WINDOWS_RESOURCE_ICON_MISSING"));
});
