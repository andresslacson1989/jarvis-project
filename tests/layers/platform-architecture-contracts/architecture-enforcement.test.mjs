import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkArchitecture } from "../../../tools/architecture/check-architecture.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const policy = {
  schemaVersion: 1,
  sourceRoots: ["apps", "services", "packages", "platform", "providers", "tools", "modules"],
  excludedRoots: ["tools/architecture", "tools/test", "tools/toolchain"],
  sharedRoots: ["services/core", "packages/protocol", "packages/schemas", "packages/policy", "packages/platform-contracts", "packages/shared"],
  osBranchAllowedRoots: ["platform", "providers", "tools/platform", "tools/git", "tools/filesystem", "tools/projects", "apps/desktop/src-tauri"],
  unsafeRustAllowedRoots: ["platform/windows"],
  uiRoots: ["apps/desktop/src"],
  uiForbiddenTargetRoots: ["services/core", "platform", "providers", "tools", "packages/policy"],
  sharedForbiddenTargetRoots: ["platform/windows", "platform/linux"],
  sharedUtilityRoot: "packages/shared",
  sharedUtilityForbiddenTargetRoots: ["apps", "services", "platform", "providers", "tools", "modules", "packages/policy"],
};

async function tempRepo(files) {
  const dir = await mkdtemp(resolve(tmpdir(), "jarvis-arch-"));
  await mkdir(resolve(dir, "tools", "architecture"), { recursive: true });
  await writeFile(resolve(dir, "tools", "architecture", "architecture-policy.json"), JSON.stringify(policy));
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(resolve(dir, path)), { recursive: true });
    await writeFile(resolve(dir, path), content);
  }
  return dir;
}

test("current repository architecture passes the Phase-0 enforcement gate", async () => {
  assert.deepEqual(await checkArchitecture(root), []);
});

test("shared package native-backend import is rejected", async () => {
  const dir = await tempRepo({
    "packages/protocol/src/x.ts": 'import "../../../platform/windows/src/native";\n',
  });
  const codes = (await checkArchitecture(dir)).map((item) => item.code);
  assert.ok(codes.includes("SHARED_NATIVE_IMPORT"));
});

test("package dependency cycle is rejected", async () => {
  const dir = await tempRepo({
    "packages/a/src/a.ts": 'import "../../../packages/b/src/b";\n',
    "packages/b/src/b.ts": 'import "../../../packages/a/src/a";\n',
  });
  const codes = (await checkArchitecture(dir)).map((item) => item.code);
  assert.ok(codes.includes("PACKAGE_CYCLE"));
});

test("scattered OS branching in shared code is rejected", async () => {
  const dir = await tempRepo({
    "services/core/src/os.ts": 'export const current = process.platform;\n',
  });
  const codes = (await checkArchitecture(dir)).map((item) => item.code);
  assert.ok(codes.includes("SCATTERED_OS_BRANCH"));
});

test("unsafe Rust outside the Windows-native allowlist is rejected", async () => {
  const dir = await tempRepo({
    "services/core/src/lib.rs": "pub fn run() { unsafe { core::ptr::read_volatile(&0) }; }\n",
  });
  const codes = (await checkArchitecture(dir)).map((item) => item.code);
  assert.ok(codes.includes("UNSAFE_RUST_LOCATION"));
});

test("allowed native unsafe still requires a nearby SAFETY justification", async () => {
  const dir = await tempRepo({
    "platform/windows/src/native.rs": "pub fn run() { unsafe { core::ptr::read_volatile(&0) }; }\n",
  });
  const codes = (await checkArchitecture(dir)).map((item) => item.code);
  assert.ok(codes.includes("UNSAFE_RUST_JUSTIFICATION"));
});

test("Windows-native unsafe with SAFETY justification passes the unsafe containment rule", async () => {
  const dir = await tempRepo({
    "platform/windows/src/native.rs": "// SAFETY: test-only pointer read is confined to this native adapter.\npub fn run() { unsafe { core::ptr::read_volatile(&0) }; }\n",
  });
  const codes = (await checkArchitecture(dir)).map((item) => item.code);
  assert.ok(!codes.includes("UNSAFE_RUST_LOCATION"));
  assert.ok(!codes.includes("UNSAFE_RUST_JUSTIFICATION"));
});

test("composition root must retain explicit unqualified failure behavior", async () => {
  const dir = await tempRepo({
    "platform/composition.ts": 'export const result = { status: "SELECTED" };\n',
  });
  const codes = (await checkArchitecture(dir)).map((item) => item.code);
  assert.ok(codes.includes("PLATFORM_FAILURE_NOT_FAIL_CLOSED"));
});
