import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("platform selection stays in the composition root and Linux remains non-runtime", async () => {
  const rootComposition = await readFile(resolve(root, "platform", "composition.ts"), "utf8");
  const contractComposition = await readFile(
    resolve(root, "packages", "platform-contracts", "src", "composition.ts"),
    "utf8",
  );
  const linuxMarker = await readFile(resolve(root, "platform", "linux", "src", "README.md"), "utf8");

  assert.match(rootComposition, /composePlatformBackend/);
  assert.doesNotMatch(contractComposition, /platform\/windows|Win32|process\.platform/i);
  assert.doesNotMatch(rootComposition, /process\.platform|DPAPI|Job Object|named pipe/i);
  assert.match(linuxMarker, /no V1 runtime/i);
});

test("Rust host projection cannot drift from canonical platform identity", async () => {
  const canonical = JSON.parse(
    await readFile(
      resolve(root, "packages", "schemas", "src", "canonical", "v1", "jarvis-v1.0.7.contract-values.json"),
      "utf8",
    ),
  );
  const registration = await readFile(
    resolve(root, "platform", "windows", "src", "registration.ts"),
    "utf8",
  );
  const rustWindows = await readFile(
    resolve(root, "apps", "desktop", "src-tauri", "src", "platform", "windows.rs"),
    "utf8",
  );
  const rustPlatform = await readFile(
    resolve(root, "apps", "desktop", "src-tauri", "src", "platform", "mod.rs"),
    "utf8",
  );
  const rustMain = await readFile(
    resolve(root, "apps", "desktop", "src-tauri", "src", "main.rs"),
    "utf8",
  );
  const target = canonical.v1RuntimeTarget;
  const profileMatches = [
    ...registration.matchAll(/WINDOWS_V1_BACKEND_PROFILE_ID\s*=\s*"([^"]+)"/g),
  ];
  const rustValue = (name) => {
    const matches = [
      ...rustWindows.matchAll(
        new RegExp(`${name}\\s*:\\s*&str\\s*=\\s*"([^"]+)"`, "g"),
      ),
    ];
    assert.equal(matches.length, 1, `Rust projection constant ${name} must appear exactly once`);
    return matches[0][1];
  };

  assert.equal(profileMatches.length, 1, "TypeScript backend profile identifier must appear exactly once");
  assert.equal(typeof target.platform, "string");
  assert.equal(typeof target.runtimeRole, "string");
  assert.equal(typeof target.architecture, "string");
  assert.equal(rustValue("WINDOWS_V1_PLATFORM"), target.platform);
  assert.equal(rustValue("WINDOWS_V1_RUNTIME_ROLE"), target.runtimeRole);
  assert.equal(rustValue("WINDOWS_V1_ARCHITECTURE"), target.architecture);
  assert.equal(rustValue("WINDOWS_V1_BACKEND_PROFILE_ID"), profileMatches[0][1]);
  assert.match(rustWindows, /UnavailableUnqualified/);
  assert.equal(
    (rustWindows.match(
      /(?:pub\s+)?const\s+fn\s+\w+\s*\(\)\s*->\s*WindowsHostRegistration/g,
    ) ?? []).length,
    1,
  );
  assert.equal(
    (rustWindows.match(/^\s*WindowsHostRegistration\s*\{\s*identity\s*:/gm) ?? []).length,
    1,
  );
  assert.equal(
    (rustWindows.match(/^\s*identity:\s*WindowsHostIdentity\s*\{\s*platform\s*:/gm) ?? []).length,
    1,
  );
  assert.doesNotMatch(rustPlatform, /WINDOWS_REGISTRATION_COUNT/);
  assert.match(rustMain, /fn main\(\)\s*->\s*std::process::ExitCode/);
  const selectionIndex = rustMain.indexOf("select_windows_host");
  const builderIndex = rustMain.indexOf("tauri::Builder::default()");
  assert.ok(selectionIndex >= 0, "Rust host selection call is required");
  assert.ok(builderIndex < 0 || selectionIndex < builderIndex, "host selection must precede Tauri construction");
  assert.doesNotMatch(rustWindows, /HashMap|BTreeMap|Vec\s*</);
});

test("unsupported compiled targets remain explicitly fail-closed", async () => {
  const rustPlatform = await readFile(
    resolve(root, "apps", "desktop", "src-tauri", "src", "platform", "mod.rs"),
    "utf8",
  );
  const rustMain = await readFile(
    resolve(root, "apps", "desktop", "src-tauri", "src", "main.rs"),
    "utf8",
  );

  assert.match(
    rustPlatform,
    /#\[cfg\(not\(target_os = "windows"\)\)\]\s*\{[\s\S]*?return Err\(HostStartupError::UnsupportedTarget\)/,
  );
  assert.match(
    rustPlatform,
    /#\[cfg\(all\(target_os = "windows", not\(target_arch = "x86_64"\)\)\)\]\s*\{[\s\S]*?return Err\(HostStartupError::UnsupportedArchitecture\)/,
  );
  assert.match(
    rustMain,
    /#\[cfg\(not\(target_os = "windows"\)\)\]\s*fn run_tauri_host[\s\S]*?Err\(HostStartupError::UnsupportedTarget\)/,
  );
  assert.match(
    rustMain,
    /#\[cfg\(all\(target_os = "windows", not\(target_arch = "x86_64"\)\)\)\]\s*fn run_tauri_host[\s\S]*?Err\(HostStartupError::UnsupportedArchitecture\)/,
  );
});
