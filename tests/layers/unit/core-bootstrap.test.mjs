import { strict as assert } from "node:assert";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  CoreBootstrap,
  CoreBootstrapError,
  LockedCoreIpcBoundary,
  validateCoreEnvironment,
} from "../../../services/core/src/main.ts";

test("Core bootstrap accepts only explicit release paths and exposes truthful status", async () => {
  const root = join(tmpdir(), `jarvis-core-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const entrypoint = join(root, "core", "dist", "main.js");
  try {
    await mkdir(join(root, "core", "dist"), { recursive: true });
    await writeFile(entrypoint, "export {};\n");
    const environment = await validateCoreEnvironment({
      JARVIS_CORE_ROOT: root,
      JARVIS_CORE_ENTRYPOINT: entrypoint,
    });
    assert.equal(environment.entrypoint.endsWith("core\\dist\\main.js"), true);

    const bootstrap = new CoreBootstrap();
    assert.equal((await bootstrap.start({
      JARVIS_CORE_ROOT: root,
      JARVIS_CORE_ENTRYPOINT: entrypoint,
    })).state, "READY");
    assert.equal(bootstrap.getRuntimeEnvironment().releaseRoot, environment.releaseRoot);
    assert.equal(bootstrap.stop().state, "STOPPED");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Core bootstrap rejects missing paths and inherited Node modifiers", async () => {
  await assert.rejects(
    validateCoreEnvironment({
      JARVIS_CORE_ROOT: join(tmpdir(), "missing-jarvis-core"),
      JARVIS_CORE_ENTRYPOINT: join(tmpdir(), "missing-jarvis-core", "main.js"),
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
