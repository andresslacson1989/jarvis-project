import { execFile, spawn } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { lstat, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { verifyTufMetadataProfile } from "./verify-tuf-metadata-profile.mjs";

export const V1_NODE_VERSION = "24.18.0";
const DEFAULT_STARTUP_TIMEOUT_MS = 2_000;
const DEFAULT_STOP_TIMEOUT_MS = 2_000;
const MAX_TIMEOUT_MS = 10_000;
const MAX_DIAGNOSTIC_BYTES = 16_384;
const IPC_PROTOCOL_MAJOR = 1;
const IPC_FRAME_CEILING = 1024 * 1024;
const BOOTSTRAP_FRAME_CEILING = 64 * 1024;
const HANDSHAKE_DOMAIN = Buffer.from("JARVIS-CORE-IPC-BOOTSTRAP-V1\0", "utf8");

const execFileAsync = promisify(execFile);

function usage() {
  return "Usage: node tools/release/qualify-core-runtime.mjs --release-root <absolute-release-root> [--production-tuf-profile] [--startup-timeout-ms <milliseconds>] [--stop-timeout-ms <milliseconds>]";
}

function parsePositiveTimeout(value, label) {
  if (!/^\d+$/u.test(value)) throw new Error(`${label} must be a positive integer`);
  const timeout = Number(value);
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > MAX_TIMEOUT_MS) {
    throw new Error(`${label} must be between 1 and ${MAX_TIMEOUT_MS} milliseconds`);
  }
  return timeout;
}

export function parseArguments(argv) {
  const values = new Map();
  const allowed = new Set([
    "--release-root",
    "--production-tuf-profile",
    "--startup-timeout-ms",
    "--stop-timeout-ms",
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error(`unexpected argument: ${argument}`);
    const [key, inlineValue] = argument.split("=", 2);
    if (!allowed.has(key)) throw new Error(`unknown argument: ${key}`);
    if (key === "--production-tuf-profile") {
      if (inlineValue !== undefined || values.has(key)) throw new Error(`duplicate argument: ${key}`);
      values.set(key, true);
      continue;
    }
    const value = inlineValue ?? argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${key}`);
    if (values.has(key)) throw new Error(`duplicate argument: ${key}`);
    values.set(key, value);
  }

  const releaseRoot = values.get("--release-root");
  if (!releaseRoot || !isAbsolute(releaseRoot)) {
    throw new Error(usage());
  }
  return {
    releaseRoot: resolve(releaseRoot),
    requireProductionTufProfile: values.get("--production-tuf-profile") === true,
    startupTimeoutMs: parsePositiveTimeout(
      values.get("--startup-timeout-ms") ?? String(DEFAULT_STARTUP_TIMEOUT_MS),
      "--startup-timeout-ms",
    ),
    stopTimeoutMs: parsePositiveTimeout(
      values.get("--stop-timeout-ms") ?? String(DEFAULT_STOP_TIMEOUT_MS),
      "--stop-timeout-ms",
    ),
  };
}

function isCanonicalChild(root, candidate) {
  const child = relative(root, candidate);
  return (
    child.length > 0 &&
    !isAbsolute(child) &&
    child.split(/[\\/]/u).every((component) => component.length > 0 && component !== "..")
  );
}

function appendDiagnostic(buffer, chunk) {
  if (buffer.length >= MAX_DIAGNOSTIC_BYTES) return buffer;
  return `${buffer}${chunk.toString("utf8")}`.slice(0, MAX_DIAGNOSTIC_BYTES);
}

function encodeFrame(value, ceiling = IPC_FRAME_CEILING) {
  const payload = Buffer.from(JSON.stringify(value), "utf8");
  if (payload.length > ceiling) throw new Error("qualification IPC frame exceeds its ceiling");
  const frame = Buffer.allocUnsafe(4 + payload.length);
  frame.writeUInt32LE(payload.length, 0);
  payload.copy(frame, 4);
  return frame;
}

function bootstrapFrame({ endpoint, secret, databaseDek, secureStorageEndpoint, secureStorageSecret }) {
  return encodeFrame(
    {
      endpoint,
      protocolMajor: IPC_PROTOCOL_MAJOR,
      secret: secret.toString("hex"),
      databaseDek: databaseDek.toString("hex"),
      secureStorageEndpoint,
      secureStorageSecret: secureStorageSecret.toString("hex"),
    },
    BOOTSTRAP_FRAME_CEILING,
  );
}

function handshakeProof(secret, nonce) {
  const version = Buffer.alloc(4);
  version.writeUInt32LE(IPC_PROTOCOL_MAJOR, 0);
  return createHmac("sha256", secret)
    .update(Buffer.concat([HANDSHAKE_DOMAIN, version, nonce]))
    .digest("hex");
}

function createQualificationCoreServer(endpoint, secret) {
  let authenticatedResolve;
  let authenticatedReject;
  const authenticated = new Promise((resolve, reject) => {
    authenticatedResolve = resolve;
    authenticatedReject = reject;
  });
  const server = createServer((socket) => {
    const nonce = randomBytes(32);
    socket.write(
      encodeFrame({
        kind: "challenge",
        protocolMajor: IPC_PROTOCOL_MAJOR,
        supportedProtocolMajors: [IPC_PROTOCOL_MAJOR],
        nonce: nonce.toString("hex"),
      }),
    );
    let buffered = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      buffered = Buffer.concat([buffered, chunk]);
      if (buffered.length < 4) return;
      const length = buffered.readUInt32LE(0);
      if (length > IPC_FRAME_CEILING || buffered.length < length + 4) return;
      let hello;
      try {
        hello = JSON.parse(buffered.subarray(4, length + 4).toString("utf8"));
      } catch (error) {
        authenticatedReject(new Error("Core qualification handshake emitted malformed JSON", { cause: error }));
        socket.destroy();
        return;
      }
      if (
        hello.kind !== "hello" ||
        hello.protocolMajor !== IPC_PROTOCOL_MAJOR ||
        hello.proof !== handshakeProof(secret, nonce)
      ) {
        authenticatedReject(new Error("Core qualification handshake proof or protocol was invalid"));
        socket.destroy();
        return;
      }
      socket.write(encodeFrame({ kind: "welcome", protocolMajor: IPC_PROTOCOL_MAJOR }));
      authenticatedResolve({ socket, protocolMajor: IPC_PROTOCOL_MAJOR });
    });
    socket.on("error", (error) => authenticatedReject(error));
  });
  return { server, authenticated };
}

async function requireRegularFile(path, label) {
  const metadata = await lstat(path).catch((error) => {
    throw new Error(`${label} is missing`, { cause: error });
  });
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`${label} must be a regular, non-symbolic-link file`);
  }
  return realpath(path);
}

async function requireReleaseFile(root, relativePath, label) {
  const candidate = resolve(root, relativePath);
  const canonicalRoot = await realpath(root);
  const canonicalCandidate = await requireRegularFile(candidate, label);
  if (!isCanonicalChild(canonicalRoot, canonicalCandidate)) {
    throw new Error(`${label} must remain inside the release root`);
  }
  return canonicalCandidate;
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolveWait, reject) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveWait(value);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    child.once("exit", () => finish(true));
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function stopChild(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  if (!child.kill()) return false;
  if (await waitForExit(child, timeoutMs)) return true;
  if (!child.kill("SIGKILL")) return false;
  return waitForExit(child, timeoutMs);
}

export async function qualifyPackagedCore({
  releaseRoot: releaseRootInput,
  requireProductionTufProfile = false,
  startupTimeoutMs = DEFAULT_STARTUP_TIMEOUT_MS,
  stopTimeoutMs = DEFAULT_STOP_TIMEOUT_MS,
}) {
  if (!isAbsolute(releaseRootInput)) throw new Error("release root must be absolute");
  const releaseRoot = resolve(releaseRootInput);
  const rootMetadata = await lstat(releaseRoot).catch((error) => {
    throw new Error("release root is missing", { cause: error });
  });
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
    throw new Error("release root must be a regular, non-symbolic-link directory");
  }

  const nodePath = await requireReleaseFile(releaseRoot, "runtime/node.exe", "release-owned node.exe");
  const entrypoint = await requireReleaseFile(
    releaseRoot,
    "core/dist/main.js",
    "release-owned Core entrypoint",
  );
  const metadataDirectory = await realpath(join(releaseRoot, "tuf", "metadata")).catch((error) => {
    throw new Error("release-owned TUF metadata directory is missing", { cause: error });
  });
  if (!isCanonicalChild(await realpath(releaseRoot), metadataDirectory)) {
    throw new Error("release-owned TUF metadata must remain inside the release root");
  }
  const productionTufProfile = requireProductionTufProfile
    ? await verifyTufMetadataProfile({ metadataDirectory })
    : undefined;

  const manifestPath = await requireReleaseFile(
    releaseRoot,
    "runtime-manifest.json",
    "release runtime manifest",
  );
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.nodeVersion !== V1_NODE_VERSION) {
    throw new Error(`release runtime manifest must pin Node ${V1_NODE_VERSION}`);
  }

  const versionResult = await execFileAsync(nodePath, ["--version"], {
    cwd: releaseRoot,
    env: {},
    windowsHide: true,
    timeout: startupTimeoutMs,
  });
  const nodeVersion = versionResult.stdout.trim();
  if (nodeVersion !== `v${V1_NODE_VERSION}`) {
    throw new Error(`release-owned Node reported ${nodeVersion}, expected v${V1_NODE_VERSION}`);
  }

  const coreModule = await import(pathToFileURL(entrypoint).href);
  if (typeof coreModule.validateCoreEnvironment !== "function") {
    throw new Error("release-owned Core does not expose its typed environment validator");
  }
  const qualificationDatabaseRoot = await mkdtemp(join(tmpdir(), "jarvis-core-runtime-qualification-"));
  const environment = {
    JARVIS_CORE_ROOT: releaseRoot,
    JARVIS_CORE_ENTRYPOINT: entrypoint,
    JARVIS_TUF_METADATA_DIR: metadataDirectory,
    JARVIS_DATABASE_PATH: join(qualificationDatabaseRoot, "state.db"),
  };
  const validated = await coreModule.validateCoreEnvironment(environment);
  const endpoint = `\\\\.\\pipe\\jarvis-core-${randomBytes(16).toString("hex")}`;
  const secret = randomBytes(32);
  const secureStorageEndpoint = `\\\\.\\pipe\\jarvis-core-${randomBytes(16).toString("hex")}`;
  const databaseDek = randomBytes(32);
  const secureStorageSecret = randomBytes(32);
  const qualificationServer = createQualificationCoreServer(endpoint, secret);
  await new Promise((resolveListen, rejectListen) => {
    qualificationServer.server.once("error", rejectListen);
    qualificationServer.server.listen(endpoint, resolveListen);
  });
  const child = spawn(nodePath, [entrypoint], {
    cwd: releaseRoot,
    env: environment,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdin?.end(
    bootstrapFrame({ endpoint, secret, databaseDek, secureStorageEndpoint, secureStorageSecret }),
  );
  let stderr = "";
  let stdout = "";
  child.stdout?.on("data", (chunk) => {
    stdout = appendDiagnostic(stdout, chunk);
  });
  child.stderr?.on("data", (chunk) => {
    stderr = appendDiagnostic(stderr, chunk);
  });

  try {
    const authenticated = await Promise.race([
      qualificationServer.authenticated.then(() => true),
      waitForExit(child, startupTimeoutMs).then((exited) => {
        if (exited) {
          throw new Error(
            `packaged Core exited before authenticated startup (code=${child.exitCode ?? "none"}, stderr=${stderr.trim() || "<empty>"})`,
          );
        }
        return false;
      }),
    ]);
    if (!authenticated) throw new Error("packaged Core did not complete authenticated IPC startup within the bounded timeout");
    const controlledStop = await stopChild(child, stopTimeoutMs);
    if (!controlledStop) throw new Error("packaged Core did not stop within the bounded timeout");
    if (stderr.trim()) throw new Error(`packaged Core wrote unexpected stderr: ${stderr.trim()}`);
    return {
      releaseRoot,
      nodeVersion,
      tufProfile: validated.releaseTrust.tufProfileVersion,
      releaseSequence: validated.releaseTrust.releaseSequence,
      sourceCommitSha: validated.releaseTrust.sourceCommitSha,
      coreStayedAliveBeforeControlledStop: true,
      authenticatedCoreTransport: true,
      protocolMajor: IPC_PROTOCOL_MAJOR,
      controlledStop: true,
      productionTufProfile: productionTufProfile
        ? {
            profile: productionTufProfile.profile,
            shape: productionTufProfile.productionProfileShape,
            keyCustodyEvidence: productionTufProfile.keyCustodyEvidence,
          }
        : "NOT_REQUESTED",
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      await stopChild(child, stopTimeoutMs);
    }
    qualificationServer.server.close();
    await rm(qualificationDatabaseRoot, { recursive: true, force: true });
  }
}

async function main() {
  const result = await qualifyPackagedCore(parseArguments(process.argv.slice(2)));
  console.log(JSON.stringify(result));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(`[core-runtime-qualification] FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
