import { strict as assert } from "node:assert";
import { EventEmitter } from "node:events";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { writeTufReleaseMetadata } from "../../helpers/tuf-release-fixture.mjs";
import {
  CoreBootstrap,
  CoreBootstrapError,
  AuthenticatedCoreServiceShell,
  CoreServiceShell,
  LockedCoreIpcBoundary,
  serveAuthenticatedCoreTransport,
  validateCoreEnvironment,
} from "../../../services/core/src/main.ts";
import { CoreIpcFrameReader } from "../../../services/core/src/ipc-bootstrap.ts";
import { CoreSchemaError } from "../../../services/core/src/schema.ts";

function encodeFrame(value) {
  const payload = Buffer.from(JSON.stringify(value), "utf8");
  const frame = Buffer.allocUnsafe(payload.length + 4);
  frame.writeUInt32LE(payload.length, 0);
  payload.copy(frame, 4);
  return frame;
}

function readFrame(socket) {
  return new Promise((resolve, reject) => {
    let buffered = Buffer.alloc(0);
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onClose = () => {
      cleanup();
      reject(new Error("socket closed before a complete frame arrived"));
    };
    const onData = (chunk) => {
      buffered = Buffer.concat([buffered, chunk]);
      if (buffered.length < 4) return;
      const length = buffered.readUInt32LE(0);
      if (buffered.length < length + 4) return;
      const payload = buffered.subarray(4, length + 4);
      cleanup();
      resolve(JSON.parse(payload.toString("utf8")));
    };
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

function createMemorySocketPair() {
  class MemorySocket extends EventEmitter {
    peer;

    write(chunk, callback) {
      queueMicrotask(() => {
        this.peer.emit("data", Buffer.from(chunk));
        callback?.();
      });
      return true;
    }

    destroy() {
      this.emit("close");
      this.peer.emit("close");
    }
  }

  const left = new MemorySocket();
  const right = new MemorySocket();
  left.peer = right;
  right.peer = left;
  return [left, right];
}

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
      releaseDistributionScope: "PRIVATE_INTERNAL",
      publicDistributionSupported: false,
      windowsSigning: {
        trustMode: "PRIVATE_INTERNAL_AUTHENTICODE",
        certificateThumbprint: "23DA4DA3E340B66EC4240B4CC845E4387E5BBDD3",
        authorizedTargetScope: "CURRENT_USER_ONLY",
        trustEnrollment: "CURRENT_USER_TRUSTEDPUBLISHER_AND_ROOT",
        timestampEvidence: "ABSENT_PUBLIC_TIMESTAMP_PRIVATE_INTERNAL",
      },
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

    const recoveryBootstrap = new CoreBootstrap();
    assert.equal((await recoveryBootstrap.start({
      JARVIS_CORE_ROOT: root,
      JARVIS_CORE_ENTRYPOINT: entrypoint,
      JARVIS_TUF_METADATA_DIR: join(root, "tuf", "metadata"),
      JARVIS_RECOVERY_MODE: "1",
    })).state, "RECOVERY");
    assert.equal(recoveryBootstrap.getRuntimeEnvironment().recoveryMode, true);
    assert.equal(recoveryBootstrap.stop().state, "STOPPED");

    const invalidManifest = { ...manifest, releaseDistributionScope: "PUBLIC" };
    const invalidManifestBytes = Buffer.from(`${JSON.stringify(invalidManifest)}\n`, "utf8");
    await writeFile(join(root, "runtime-manifest.json"), invalidManifestBytes);
    await writeTufReleaseMetadata({
      metadataDirectory: join(root, "tuf", "metadata"),
      targetBytes: invalidManifestBytes,
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
    await assert.rejects(
      validateCoreEnvironment({
        JARVIS_CORE_ROOT: root,
        JARVIS_CORE_ENTRYPOINT: entrypoint,
        JARVIS_TUF_METADATA_DIR: join(root, "tuf", "metadata"),
      }),
      (error) => error instanceof CoreBootstrapError && error.code === "CORE_RUNTIME_INTEGRITY_FAILED",
    );

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

    await assert.rejects(
      validateCoreEnvironment({
        JARVIS_CORE_ROOT: root,
        JARVIS_CORE_ENTRYPOINT: entrypoint,
        JARVIS_TUF_METADATA_DIR: join(root, "tuf", "metadata"),
        JARVIS_RECOVERY_MODE: "true",
      }),
      (error) => error instanceof CoreBootstrapError && error.code === "CORE_RUNTIME_INCOMPATIBLE",
    );

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

test("authenticated Core control plane returns only the deterministic locked status", async () => {
  const shell = new AuthenticatedCoreServiceShell();
  const response = await shell.handle({
    protocolVersion: 1,
    kind: "request",
    id: null,
    name: "get_core_status",
    correlationId: "018f3b8e-6c68-7abc-8def-0123456789ab",
    payload: {},
  });
  assert.deepEqual(response, {
    ok: true,
    result: {
      protocolMajor: 1,
      platform: "WINDOWS",
      runtimeRole: "FULL_HOST",
      architecture: "x64",
      serviceState: "LOCKED",
      transportState: "NOT_CONNECTED",
    },
  });

  const rejected = await shell.handle({
    protocolVersion: 1,
    kind: "request",
    id: null,
    name: "execute_any_command",
    correlationId: "018f3b8e-6c68-7abc-8def-0123456789ab",
    payload: {},
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.error.code, "CORE_IPC_REQUEST_INVALID");
});

test("authenticated Core validates setup identity and never fabricates readiness", async () => {
  const request = {
    protocolVersion: 1,
    kind: "request",
    id: "018f3b8e-6c68-7abc-8def-0123456789ab",
    name: "start_provider_setup",
    correlationId: "018f3b8e-6c68-7abc-8def-0123456789ac",
    payload: {
      requestId: "018f3b8e-6c68-7abc-8def-0123456789ad",
      providerId: "codex-cli",
      distributionId: "codex-cli-standalone-windows-x64-0.147.0",
      adapterVersion: "1.0.0",
      action: "AUTHENTICATED_USER_START",
    },
  };
  const unavailable = await new AuthenticatedCoreServiceShell().handle(request);
  assert.equal(unavailable.ok, false);
  if (!unavailable.ok) assert.equal(unavailable.error.code, "CORE_PROVIDER_SETUP_NOT_READY");

  const started = await new AuthenticatedCoreServiceShell(async (received) => ({
    ok: true,
    result: { requestId: received.payload.requestId, state: "SETUP_IN_PROGRESS" },
  })).handle(request);
  assert.deepEqual(started, { ok: true, result: { requestId: request.payload.requestId, state: "SETUP_IN_PROGRESS" } });

  const conflict = await new AuthenticatedCoreServiceShell(async () => {
    throw new CoreSchemaError("PERSISTENCE_CONFLICT", "stale");
  }).handle(request);
  assert.equal(conflict.ok, false);
  if (!conflict.ok) {
    assert.equal(conflict.error.code, "PERSISTENCE_CONFLICT");
    assert.equal(conflict.error.category, "CONFLICT");
    assert.equal(conflict.error.retryable, true);
  }
});

test("authenticated Core returns sanitized provider setup status only through the typed request", async () => {
  const request = {
    protocolVersion: 1,
    kind: "request",
    id: "018f3b8e-6c68-7abc-8def-0123456789ab",
    name: "get_provider_setup_status",
    correlationId: "018f3b8e-6c68-7abc-8def-0123456789ac",
    payload: {},
  };
  const shell = new AuthenticatedCoreServiceShell(undefined, undefined, async () => ({
    ok: true,
    result: { providers: [{ providerId: "codex-cli", distributionId: "codex-cli-standalone-windows-x64-0.147.0", adapterVersion: "1.0.0", state: "SETUP_REQUIRED" }] },
  }));
  assert.deepEqual(await shell.handle(request), {
    ok: true,
    result: { providers: [{ providerId: "codex-cli", distributionId: "codex-cli-standalone-windows-x64-0.147.0", adapterVersion: "1.0.0", state: "SETUP_REQUIRED" }] },
  });
  const invalid = await shell.handle({ ...request, payload: { executablePath: "C:\\\\unsafe.exe" } });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, "CORE_IPC_REQUEST_INVALID");
});

test("authenticated Core returns session initialization state without secret material", async () => {
  const request = {
    protocolVersion: 1,
    kind: "request",
    id: "018f3b8e-6c68-7abc-8def-0123456789ab",
    name: "get_session_status",
    correlationId: "018f3b8e-6c68-7abc-8def-0123456789ac",
    payload: {},
  };
  const shell = new AuthenticatedCoreServiceShell(undefined, undefined, undefined, async () => ({
    ok: true,
    result: { initialized: false, state: null },
  }));
  assert.deepEqual(await shell.handle(request), {
    ok: true,
    result: { initialized: false, state: null },
  });
  const invalid = await shell.handle({ ...request, payload: { password: "must-not-cross-status" } });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, "CORE_IPC_REQUEST_INVALID");
});

test("authenticated Core routes bounded session initialization and authentication through typed callbacks", async () => {
  const initializationRequest = {
    protocolVersion: 1,
    kind: "request",
    id: "018f3b8e-6c68-7abc-8def-0123456789ab",
    name: "initialize_session",
    correlationId: "018f3b8e-6c68-7abc-8def-0123456789ac",
    payload: { userId: "S-1-5-21-1000", password: "initial-password" },
  };
  const authenticationRequest = {
    ...initializationRequest,
    id: "018f3b8e-6c68-7abc-8def-0123456789ad",
    name: "authenticate_session",
    correlationId: "018f3b8e-6c68-7abc-8def-0123456789ae",
    payload: { userId: "S-1-5-21-1000", password: "unlock-password" },
  };
  let initializedPassword;
  let authenticatedPassword;
  const shell = new AuthenticatedCoreServiceShell(
    undefined,
    undefined,
    undefined,
    undefined,
    async (request) => {
      initializedPassword = request.payload.password;
      return { ok: true, result: { initialized: true, state: { state: "LOCKED" } } };
    },
    async (request) => {
      authenticatedPassword = request.payload.password;
      return { ok: true, result: { status: "UNLOCKED", retryAfterMs: 0, state: { state: "UNLOCKED" } } };
    },
  );
  assert.deepEqual(await shell.handle(initializationRequest), { ok: true, result: { initialized: true, state: { state: "LOCKED" } } });
  assert.equal(initializedPassword, "initial-password");
  assert.deepEqual(await shell.handle(authenticationRequest), { ok: true, result: { status: "UNLOCKED", retryAfterMs: 0, state: { state: "UNLOCKED" } } });
  assert.equal(authenticatedPassword, "unlock-password");

  const invalid = await shell.handle({ ...initializationRequest, payload: { ...initializationRequest.payload, extra: true } });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, "CORE_IPC_REQUEST_INVALID");

  const notReady = await new AuthenticatedCoreServiceShell().handle(initializationRequest);
  assert.equal(notReady.ok, false);
  if (!notReady.ok) assert.equal(notReady.error.code, "CORE_SESSION_INITIALIZE_NOT_READY");
});

test("authenticated Core routes only a validated text conversation envelope to the typed provider boundary", async () => {
  const request = {
    protocolVersion: 1,
    kind: "request",
    id: "018f3b8e-6c68-7abc-8def-0123456789ab",
    name: "process_authenticated_text",
    correlationId: "018f3b8e-6c68-7abc-8def-0123456789ac",
    payload: {
      instruction: { id: "018f3b8e-6c68-7abc-8def-0123456789ab", sessionId: "018f3b8e-6c68-7abc-8def-0123456789ad", modality: "TEXT", origin: "LOCAL_UI", text: "What is ready?", receivedAt: "2026-08-16T00:00:00.000Z", conversationId: "018f3b8e-6c68-7abc-8def-0123456789ae" },
      context: { domain: "jarvis.context-package.v1", schemaVersion: 1, contextId: "context-1", items: [{ itemId: "system-1", sourceLabel: { domain: "jarvis.content-authority.label.v1", schemaVersion: 1, sourceType: "SYSTEM_POLICY", sourceId: "system-1", authorityClass: "CONTENT_ONLY" }, content: "Do not take action." }] },
      dataPolicy: { sensitivity: "PRIVATE", locality: "LOCAL_ONLY" },
    },
  };
  let received;
  const shell = new AuthenticatedCoreServiceShell(undefined, undefined, undefined, undefined, undefined, undefined, async (value) => {
    received = value;
    return { ok: true, result: { instructionId: request.id, decision: { kind: "ANSWER", text: "ready" } } };
  });
  assert.deepEqual(await shell.handle(request), { ok: true, result: { instructionId: request.id, decision: { kind: "ANSWER", text: "ready" } } });
  assert.equal(received.payload.instruction.text, "What is ready?");
  const invalid = await shell.handle({ ...request, payload: { ...request.payload, dataPolicy: { sensitivity: "SECRET", locality: "LOCAL_ONLY" } } });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, "CORE_IPC_REQUEST_INVALID");
});

test("authenticated Core routes only a validated ToolRequest to the Core-owned execution boundary", async () => {
  const request = {
    protocolVersion: 1,
    kind: "request",
    id: "018f3b8e-6c68-7abc-8def-0123456789ab",
    name: "execute_tool",
    correlationId: "018f3b8e-6c68-7abc-8def-0123456789ac",
    payload: {
      toolExecutionId: "018f3b8e-6c68-7abc-8def-0123456789ab",
      toolId: "jarvis.filesystem.read-text",
      toolVersion: 1,
      executionScope: { kind: "PROJECT_WORKSPACE", projectId: "project-1", workspaceId: "workspace-1" },
      authorityEnvelopeId: "018f3b8e-6c68-7abc-8def-0123456789ad",
      arguments: { path: "README.md" },
    },
  };

  const notReady = await new AuthenticatedCoreServiceShell().handle(request);
  assert.equal(notReady.ok, false);
  if (!notReady.ok) {
    assert.equal(notReady.error.code, "CORE_TOOL_RUNTIME_NOT_READY");
    assert.equal(notReady.error.details.toolExecutionId, request.id);
  }

  let received;
  const executed = await new AuthenticatedCoreServiceShell(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    async (value) => {
      received = value;
      return {
        toolExecutionId: value.payload.toolExecutionId,
        outcome: "SUCCEEDED",
        output: { content: "ready" },
        startedAt: "2026-08-17T00:00:00.000Z",
        endedAt: "2026-08-17T00:00:00.001Z",
      };
    },
  ).handle(request);
  assert.deepEqual(executed, {
    ok: true,
    result: {
      toolExecutionId: request.id,
      outcome: "SUCCEEDED",
      output: { content: "ready" },
      startedAt: "2026-08-17T00:00:00.000Z",
      endedAt: "2026-08-17T00:00:00.001Z",
    },
  });
  assert.equal(received.payload.arguments.path, "README.md");

  const retargeted = await new AuthenticatedCoreServiceShell(undefined, undefined, undefined, undefined, undefined, undefined, undefined, async () => {
    throw new Error("must not execute retargeted request");
  }).handle({ ...request, payload: { ...request.payload, toolExecutionId: "018f3b8e-6c68-7abc-8def-0123456789ae" } });
  assert.equal(retargeted.ok, false);
  if (!retargeted.ok) assert.equal(retargeted.error.code, "CORE_TOOL_REQUEST_INVALID");
});

test("authenticated Core transport serves the bounded locked-status round-trip", async () => {
  const [serverSocket, client] = createMemorySocketPair();
  let stopping = false;
  const serving = serveAuthenticatedCoreTransport(
    { socket: serverSocket, protocolMajor: 1, reader: new CoreIpcFrameReader(serverSocket) },
    () => stopping,
  );

  client.write(
    encodeFrame({
      protocolVersion: 1,
      kind: "request",
      id: null,
      name: "get_core_status",
      correlationId: "018f3b8e-6c68-7abc-8def-0123456789ab",
      payload: {},
    }),
  );
  const response = await readFrame(client);
  assert.deepEqual(response, {
    ok: true,
    result: {
      protocolMajor: 1,
      platform: "WINDOWS",
      runtimeRole: "FULL_HOST",
      architecture: "x64",
      serviceState: "LOCKED",
      transportState: "NOT_CONNECTED",
    },
  });

  stopping = true;
  client.destroy();
  serverSocket.destroy();
  await serving;
});
