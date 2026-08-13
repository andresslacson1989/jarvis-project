import { createHmac, timingSafeEqual } from "node:crypto";
import { createConnection, type Socket } from "node:net";
import type { Readable } from "node:stream";

export const CORE_IPC_PROTOCOL_MAJOR = 1 as const;
export const CORE_IPC_FRAME_CEILING = 1024 * 1024;
const BOOTSTRAP_FRAME_CEILING = 64 * 1024;
const BOOTSTRAP_SECRET_BYTES = 32;
const HANDSHAKE_NONCE_BYTES = 32;
const HANDSHAKE_DOMAIN = Buffer.from("JARVIS-CORE-IPC-BOOTSTRAP-V1\0", "utf8");
const HANDSHAKE_TIMEOUT_MS = 5_000;

export interface BootstrapMaterial {
  readonly endpoint: string;
  readonly protocolMajor: typeof CORE_IPC_PROTOCOL_MAJOR;
  readonly secret: Buffer;
}

export interface AuthenticatedTransport {
  readonly socket: Socket;
  readonly protocolMajor: typeof CORE_IPC_PROTOCOL_MAJOR;
}

export type CoreIpcFailureCode =
  | "BOOTSTRAP_REQUIRED"
  | "BOOTSTRAP_MALFORMED"
  | "BOOTSTRAP_TOO_LARGE"
  | "IPC_FRAME_MALFORMED"
  | "IPC_FRAME_TOO_LARGE"
  | "IPC_PROTOCOL_MISMATCH"
  | "IPC_AUTHENTICATION_FAILED"
  | "IPC_CONNECT_FAILED"
  | "IPC_HANDSHAKE_TIMEOUT";

export class CoreIpcBootstrapError extends Error {
  readonly code: CoreIpcFailureCode;

  constructor(code: CoreIpcFailureCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CoreIpcBootstrapError";
    this.code = code;
  }
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return JSON.stringify(actual) === JSON.stringify([...expected].sort());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeHex(value: string, bytes: number): Buffer | undefined {
  if (!new RegExp(`^[0-9a-f]{${bytes * 2}}$`, "u").test(value)) return undefined;
  return Buffer.from(value, "hex");
}

function encodeFrame(payload: Buffer, ceiling: number): Buffer {
  if (payload.length > ceiling || payload.length > 0xffff_ffff) {
    throw new CoreIpcBootstrapError(
      ceiling === BOOTSTRAP_FRAME_CEILING ? "BOOTSTRAP_TOO_LARGE" : "IPC_FRAME_TOO_LARGE",
      "IPC frame exceeds its bounded ceiling",
    );
  }
  const frame = Buffer.allocUnsafe(4 + payload.length);
  frame.writeUInt32LE(payload.length, 0);
  payload.copy(frame, 4);
  return frame;
}

export function encodeBootstrapFrame(material: BootstrapMaterial): Buffer {
  const payload = Buffer.from(
    JSON.stringify({
      endpoint: material.endpoint,
      protocolMajor: material.protocolMajor,
      secret: material.secret.toString("hex"),
    }),
    "utf8",
  );
  return encodeFrame(payload, BOOTSTRAP_FRAME_CEILING);
}

export function parseBootstrapFrame(frame: Buffer): BootstrapMaterial {
  if (frame.length < 4) {
    throw new CoreIpcBootstrapError("BOOTSTRAP_MALFORMED", "bootstrap frame is truncated");
  }
  const length = frame.readUInt32LE(0);
  if (length > BOOTSTRAP_FRAME_CEILING) {
    throw new CoreIpcBootstrapError("BOOTSTRAP_TOO_LARGE", "bootstrap frame is oversized");
  }
  if (frame.length !== length + 4) {
    throw new CoreIpcBootstrapError("BOOTSTRAP_MALFORMED", "bootstrap frame length is inconsistent");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(frame.subarray(4).toString("utf8")) as unknown;
  } catch (error) {
    throw new CoreIpcBootstrapError("BOOTSTRAP_MALFORMED", "bootstrap payload is not valid JSON", { cause: error });
  }
  if (!isRecord(parsed) || !exactKeys(parsed, ["endpoint", "protocolMajor", "secret"])) {
    throw new CoreIpcBootstrapError("BOOTSTRAP_MALFORMED", "bootstrap payload shape is invalid");
  }
  const endpoint = parsed.endpoint;
  const protocolMajor = parsed.protocolMajor;
  const secretText = parsed.secret;
  if (
    typeof endpoint !== "string" ||
    !/^\\\\\.\\pipe\\jarvis-core-[0-9a-f]{32}$/u.test(endpoint) ||
    protocolMajor !== CORE_IPC_PROTOCOL_MAJOR ||
    typeof secretText !== "string"
  ) {
    throw new CoreIpcBootstrapError("BOOTSTRAP_MALFORMED", "bootstrap identity or protocol is invalid");
  }
  const secret = decodeHex(secretText, BOOTSTRAP_SECRET_BYTES);
  if (!secret) {
    throw new CoreIpcBootstrapError("BOOTSTRAP_MALFORMED", "bootstrap secret encoding is invalid");
  }
  return { endpoint, protocolMajor, secret };
}

export async function readBootstrapMaterial(input: Readable): Promise<BootstrapMaterial> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of input) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.length;
    if (total > BOOTSTRAP_FRAME_CEILING + 4) {
      throw new CoreIpcBootstrapError("BOOTSTRAP_TOO_LARGE", "bootstrap channel exceeded its bounded size");
    }
    chunks.push(bytes);
  }
  if (total === 0) {
    throw new CoreIpcBootstrapError("BOOTSTRAP_REQUIRED", "Core bootstrap material was not transferred");
  }
  return parseBootstrapFrame(Buffer.concat(chunks, total));
}

function proof(secret: Buffer, protocolMajor: number, nonce: Buffer): Buffer {
  const message = Buffer.concat([
    HANDSHAKE_DOMAIN,
    (() => {
      const version = Buffer.alloc(4);
      version.writeUInt32LE(protocolMajor, 0);
      return version;
    })(),
    nonce,
  ]);
  return createHmac("sha256", secret).update(message).digest();
}

function safeEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}

class FrameReader {
  private buffered = Buffer.alloc(0);
  private readonly socket: Socket;

  constructor(socket: Socket) {
    this.socket = socket;
  }

  async read(ceiling: number, timeoutMs: number): Promise<Buffer> {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      if (this.buffered.length >= 4) {
        const length = this.buffered.readUInt32LE(0);
        if (length > ceiling) {
          throw new CoreIpcBootstrapError("IPC_FRAME_TOO_LARGE", "IPC frame exceeds the 1 MiB ceiling");
        }
        if (this.buffered.length >= length + 4) {
          const payload = this.buffered.subarray(4, length + 4);
          this.buffered = this.buffered.subarray(length + 4);
          return Buffer.from(payload);
        }
      }
      if (this.buffered.length > ceiling + 4) {
        throw new CoreIpcBootstrapError("IPC_FRAME_TOO_LARGE", "IPC frame buffer exceeded its ceiling");
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new CoreIpcBootstrapError("IPC_HANDSHAKE_TIMEOUT", "Core IPC handshake timed out");
      }
      const chunk = await this.nextChunk(remaining);
      this.buffered = Buffer.concat([this.buffered, chunk]);
    }
  }

  private nextChunk(timeoutMs: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.socket.off("data", onData);
        this.socket.off("end", onEnd);
        this.socket.off("error", onError);
        this.socket.off("close", onClose);
      };
      const onData = (chunk: Buffer) => {
        cleanup();
        resolve(Buffer.from(chunk));
      };
      const onEnd = () => {
        cleanup();
        reject(new CoreIpcBootstrapError("IPC_FRAME_MALFORMED", "Core IPC closed before a complete frame arrived"));
      };
      const onError = (error: Error) => {
        cleanup();
        reject(new CoreIpcBootstrapError("IPC_CONNECT_FAILED", "Core IPC read failed", { cause: error }));
      };
      const onClose = () => {
        cleanup();
        reject(new CoreIpcBootstrapError("IPC_CONNECT_FAILED", "Core IPC closed during handshake"));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new CoreIpcBootstrapError("IPC_HANDSHAKE_TIMEOUT", "Core IPC handshake timed out"));
      }, timeoutMs);
      this.socket.once("data", onData);
      this.socket.once("end", onEnd);
      this.socket.once("error", onError);
      this.socket.once("close", onClose);
    });
  }
}

function parseJson<T>(payload: Buffer, description: string): T {
  try {
    return JSON.parse(payload.toString("utf8")) as T;
  } catch (error) {
    throw new CoreIpcBootstrapError("IPC_FRAME_MALFORMED", `${description} is not valid JSON`, { cause: error });
  }
}

export function connectCoreTransport(endpoint: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ path: endpoint });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new CoreIpcBootstrapError("IPC_HANDSHAKE_TIMEOUT", "Core IPC connection timed out"));
    }, HANDSHAKE_TIMEOUT_MS);
    const fail = (error: Error) => {
      clearTimeout(timer);
      socket.destroy();
      reject(new CoreIpcBootstrapError("IPC_CONNECT_FAILED", "Core IPC connection failed", { cause: error }));
    };
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.setNoDelay(true);
      resolve(socket);
    });
    socket.once("error", fail);
  });
}

export async function authenticateCoreTransport(material: BootstrapMaterial, socket: Socket): Promise<AuthenticatedTransport> {
  const reader = new FrameReader(socket);
  try {
    const challenge = parseJson<unknown>(await reader.read(CORE_IPC_FRAME_CEILING, HANDSHAKE_TIMEOUT_MS), "Core IPC challenge");
    if (
      !isRecord(challenge) ||
      !exactKeys(challenge, ["kind", "nonce", "protocolMajor", "supportedProtocolMajors"]) ||
      challenge.kind !== "challenge" ||
      challenge.protocolMajor !== CORE_IPC_PROTOCOL_MAJOR ||
      !Array.isArray(challenge.supportedProtocolMajors) ||
      !challenge.supportedProtocolMajors.includes(CORE_IPC_PROTOCOL_MAJOR) ||
      typeof challenge.nonce !== "string"
    ) {
      throw new CoreIpcBootstrapError("IPC_PROTOCOL_MISMATCH", "Core IPC challenge is unsupported");
    }
    const nonce = decodeHex(challenge.nonce, HANDSHAKE_NONCE_BYTES);
    if (!nonce) throw new CoreIpcBootstrapError("IPC_FRAME_MALFORMED", "Core IPC challenge nonce is invalid");
    const hello = Buffer.from(
      JSON.stringify({
        kind: "hello",
        protocolMajor: CORE_IPC_PROTOCOL_MAJOR,
        proof: proof(material.secret, CORE_IPC_PROTOCOL_MAJOR, nonce).toString("hex"),
      }),
      "utf8",
    );
    socket.write(encodeFrame(hello, CORE_IPC_FRAME_CEILING));
    const welcome = parseJson<unknown>(await reader.read(CORE_IPC_FRAME_CEILING, HANDSHAKE_TIMEOUT_MS), "Core IPC welcome");
    if (!isRecord(welcome) || !exactKeys(welcome, ["kind", "protocolMajor"]) || welcome.kind !== "welcome" || welcome.protocolMajor !== CORE_IPC_PROTOCOL_MAJOR) {
      throw new CoreIpcBootstrapError("IPC_PROTOCOL_MISMATCH", "Core IPC welcome is unsupported");
    }
    return { socket, protocolMajor: CORE_IPC_PROTOCOL_MAJOR };
  } catch (error) {
    socket.destroy();
    if (error instanceof CoreIpcBootstrapError) throw error;
    throw new CoreIpcBootstrapError("IPC_AUTHENTICATION_FAILED", "Core IPC authentication failed", { cause: error });
  }
}

export function computeBootstrapProofForTest(secret: Buffer, protocolMajor: number, nonce: Buffer): Buffer {
  return proof(secret, protocolMajor, nonce);
}

export function constantTimeProofEqualForTest(left: Buffer, right: Buffer): boolean {
  return safeEqual(left, right);
}

export function handshakeConstantsForTest(): { secretBytes: number; nonceBytes: number } {
  return { secretBytes: BOOTSTRAP_SECRET_BYTES, nonceBytes: HANDSHAKE_NONCE_BYTES };
}
