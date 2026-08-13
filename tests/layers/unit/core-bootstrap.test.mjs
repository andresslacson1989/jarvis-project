import { strict as assert } from "node:assert";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { writeTufReleaseMetadata } from "../../helpers/tuf-release-fixture.mjs";
import {
  CoreBootstrap,
  CoreBootstrapError,
  CoreServiceShell,
  LockedCoreIpcBoundary,
  validateCoreEnvironment,
} from "../../../services/core/src/main.ts";

test("Core bootstrap accepts only explicit release paths and exposes truthful status", async () => {
  const root = join(tmpdir(), `jarvis-core-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const entrypoint = join(root, "core", "dist", "main.js");
  try {
    await mkdir(join(root, "core", "dist"), { recursive: true });
    await writeFile(entrypoint, "export {};\n");
    const manifest = {
      jarvisReleaseVersion: "0.0.0",
      releaseSequence: 1,
      securityEpoch: 1,
      sourceCommitSha: "a".repeat(40),
    };
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8");
    await writeFile(join(root, "runtime-manifest.json"), manifestBytes);
    await writeTufReleaseMetadata({
      metadataDirectory: join(root, "tuf", "metadata"),
      targetBytes: manifestBytes,
      custom: {
        tufSpecVersion: "1.0.35",
        releaseId: manifest.jarvisReleaseVersion,
        jarvisVersion: manifest.jarvisReleaseVersion,
        releaseSequence: manifest.releaseSequence,
        securityEpoch: manifest.securityEpoch,
        sourceCommitSha: manifest.sourceCommitSha,
        platform: "WINDOWS",
        runtimeRole: "FULL_HOST",
        architecture: "x64",
      },
    });
    const environment = await validateCoreEnvironment({
      JARVIS_CORE_ROOT: root,
      JARVIS_CORE_ENTRYPOINT: entrypoint,
      JARVIS_TUF_METADATA_DIR: join(root, "tuf", "metadata"),
    });
    assert.equal(environment.entrypoint.endsWith("core\\dist\\main.js"), true);

    const bootstrap = new CoreBootstrap();
    assert.equal((await bootstrap.start({
      JARVIS_CORE_ROOT: root,
      JARVIS_CORE_ENTRYPOINT: entrypoint,
      JARVIS_TUF_METADATA_DIR: join(root, "tuf", "metadata"),
    })).state, "READY");
    assert.equal(bootstrap.getRuntimeEnvironment().releaseRoot, environment.releaseRoot);
    assert.equal(bootstrap.stop().state, "STOPPED");

    await writeFile(join(root, "runtime-manifest.json"), Buffer.concat([manifestBytes, Buffer.from("tampered", "utf8")]));
    await assert.rejects(
      validateCoreEnvironment({
        JARVIS_CORE_ROOT: root,
        JARVIS_CORE_ENTRYPOINT: entrypoint,
        JARVIS_TUF_METADATA_DIR: join(root, "tuf", "metadata"),
      }),
      (error) => error instanceof CoreBootstrapError && error.code === "CORE_RUNTIME_INTEGRITY_FAILED",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Core bootstrap rejects missing paths and inherited Node modifiers", async () => {
  await assert.rejects(
    validateCoreEnvironment({
      JARVIS_CORE_ROOT: join(tmpdir(), "missing-jarvis-core"),
      JARVIS_CORE_ENTRYPOINT: join(tmpdir(), "missing-jarvis-core", "main.js"),
      JARVIS_TUF_METADATA_DIR: join(tmpdir(), "missing-jarvis-core", "tuf", "metadata"),
    }),
    (error) => error instanceof CoreBootstrapError && error.code === "CORE_RUNTIME_MISSING",
  );
  await assert.rejects(
    validateCoreEnvironment({
      JARVIS_CORE_ROOT: "C:\\release",
      JARVIS_CORE_ENTRYPOINT: "C:\\release\\core\\dist\\main.js",
      NODE_OPTIONS: "--inspect",
    }),
    (error) => error instanceof CoreBootstrapError && error.code === "CORE_RUNTIME_INCOMPATIBLE",
  );
});

test("locked Core IPC boundary rejects requests without fabricating success", async () => {
  const boundary = new LockedCoreIpcBoundary();
  const response = await boundary.handle({
    protocolVersion: 1,
    kind: "request",
    id: "018f3b8e-6c68-7abc-8def-0123456789ab",
    name: "get_system_status",
    correlationId: "018f3b8e-6c68-7abc-8def-0123456789ab",
    payload: {},
  });
  assert.deepEqual(response, {
    ok: false,
    error: {
      code: "CORE_IPC_NOT_READY",
      category: "UNSUPPORTED",
      message: "Core IPC is unavailable until the authenticated native transport is established",
      retryable: false,
      correlationId: "018f3b8e-6c68-7abc-8def-0123456789ab",
    },
  });
});

test("shared Core service shell validates typed status requests and stays locked", async () => {
  const shell = new CoreServiceShell();
  const response = await shell.handle({
    protocolVersion: 1,
    kind: "request",
    id: "018f3b8e-6c68-7abc-8def-0123456789ab",
    name: "get_core_status",
    correlationId: "018f3b8e-6c68-7abc-8def-0123456789ab",
    payload: {},
  });
  assert.deepEqual(response, {
    ok: false,
    error: {
      code: "CORE_IPC_NOT_READY",
      category: "UNSUPPORTED",
      message: "Core IPC is unavailable until the authenticated native transport is established",
      retryable: false,
      correlationId: "018f3b8e-6c68-7abc-8def-0123456789ab",
      details: {
        request: "get_core_status",
        serviceState: "LOCKED",
        transportState: "NOT_CONNECTED",
      },
    },
  });

  const invalid = await shell.handle({
    protocolVersion: 1,
    kind: "request",
    id: "018f3b8e-6c68-7abc-8def-0123456789ab",
    name: "get_core_status",
    correlationId: "018f3b8e-6c68-7abc-8def-0123456789ab",
    payload: { unexpected: true },
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, "CORE_IPC_REQUEST_INVALID");

  const invalidCorrelation = await shell.handle({
    protocolVersion: 1,
    kind: "request",
    id: "not-a-uuid",
    name: "get_core_status",
    correlationId: "not-a-uuid",
    payload: {},
  });
  assert.equal(invalidCorrelation.ok, false);
  if (!invalidCorrelation.ok) assert.equal(invalidCorrelation.error.code, "CORE_IPC_REQUEST_INVALID");
});
