import { strict as assert } from "node:assert";
import test from "node:test";
import {
  validateOpaquePlatformIdentifier,
  validatePlatformCompatibility,
  validatePlatformPathRef,
  validatePlatformRuntimeIdentity,
} from "../../../packages/protocol/src/platform-runtime.mts";

test("platform runtime identity and compatibility validators preserve typed identity", () => {
  assert.deepEqual(
    validatePlatformRuntimeIdentity({
      platform: "WINDOWS",
      runtimeRole: "FULL_HOST",
      architecture: "x64",
      backendProfileId: "windows-v1-x64-full-host",
    }),
    {
      platform: "WINDOWS",
      runtimeRole: "FULL_HOST",
      architecture: "x64",
      backendProfileId: "windows-v1-x64-full-host",
    },
  );
  assert.deepEqual(
    validatePlatformCompatibility({
      platform: "ANDROID",
      runtimeRoles: ["COMPANION"],
      architecture: ["arm64-v8a"],
    }).runtimeRoles,
    ["COMPANION"],
  );
});

test("platform validators reject unknown values, duplicate compatibility entries, and extra fields", () => {
  assert.throws(() => validatePlatformRuntimeIdentity({
    platform: "WINDOWS",
    runtimeRole: "COMPANION",
    architecture: "x64",
    backendProfileId: "windows-v1",
    supported: true,
  }), /unsupported or missing fields/u);
  assert.throws(() => validatePlatformCompatibility({
    platform: "LINUX",
    runtimeRoles: ["FULL_HOST", "FULL_HOST"],
  }), /duplicates/u);
  assert.throws(() => validatePlatformRuntimeIdentity({
    platform: "WINDOWS",
    runtimeRole: "FULL_HOST",
    architecture: "x64/unsafe",
    backendProfileId: "windows-v1",
  }), /bounded opaque identity token/u);
});

test("platform path references remain tagged and reject malformed values", () => {
  assert.deepEqual(validatePlatformPathRef({ platform: "WINDOWS", value: "C:\\Jarvis Project" }), {
    platform: "WINDOWS",
    value: "C:\\Jarvis Project",
  });
  assert.equal(validateOpaquePlatformIdentifier("project-018f3b8e"), "project-018f3b8e");
  assert.throws(() => validatePlatformPathRef({ platform: "WINDOWS", value: "" }), /path value is invalid/u);
  assert.throws(() => validatePlatformPathRef({ platform: "LINUX", value: "/srv/jarvis", extra: true }), /unsupported or missing fields/u);
});
