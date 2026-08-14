import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createConnection, type Socket } from "node:net";
import type { Readable } from "node:stream";

export const CORE_IPC_PROTOCOL_MAJOR = 1 as const;
export const CORE_IPC_FRAME_CEILING = 1024 * 1024;
const BOOTSTRAP_FRAME_CEILING = 64 * 1024;
const BOOTSTRAP_SECRET_BYTES = 32;
const HANDSHAKE_NONCE_BYTES = 32;
const HANDSHAKE_DOMAIN = Buffer.from("JARVIS-CORE-IPC-BOOTSTRAP-V1\0", "utf8");
const SECURE_STORAGE_DOMAIN = Buffer.from("JARVIS-CORE-SECURE-STORAGE-V1\0", "utf8");
const SESSION_PASSWORD_KDF_DOMAIN = Buffer.from("JARVIS-CORE-SESSION-PASSWORD-KDF-V1\0", "utf8");
const SESSION_PASSWORD_MAX_BYTES = 4096;
const LOCAL_BACKUP_SLOT_MAX_BYTES = 64 * 1024;
const HANDSHAKE_TIMEOUT_MS = 5_000;

export interface BootstrapMaterial {
  readonly endpoint: string;
  readonly protocolMajor: typeof CORE_IPC_PROTOCOL_MAJOR;
  readonly secret: Buffer;
  readonly databaseDek: Buffer;
  readonly secureStorageEndpoint: string;
  readonly secureStorageSecret: Buffer;
}

export interface AuthenticatedTransport {
  readonly socket: Socket;
  readonly protocolMajor: typeof CORE_IPC_PROTOCOL_MAJOR;
  /** The handshake reader is retained so frames arriving with the welcome
   * response cannot be discarded before the authenticated service loop starts. */
  readonly reader: CoreIpcFrameReader;
}

export interface SessionPasswordVerifier {
  readonly profileId: string;
  readonly purpose: "SESSION_PASSWORD";
  readonly algorithm: "ARGON2ID";
  readonly version: 0x13;
  readonly memoryKiB: number;
  readonly iterations: number;
  readonly parallelism: 4;
  readonly salt: Buffer;
  readonly verifier: Buffer;
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

export function encodeCoreIpcJsonFrame(value: unknown): Buffer {
  let payload: Buffer;
  try {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error("value is not JSON-serializable");
    payload = Buffer.from(encoded, "utf8");
  } catch (error) {
    throw new CoreIpcBootstrapError("IPC_FRAME_MALFORMED", "Core IPC response could not be encoded", { cause: error });
  }
  return encodeFrame(payload, CORE_IPC_FRAME_CEILING);
}

export function encodeBootstrapFrame(material: BootstrapMaterial): Buffer {
  const payload = Buffer.from(
    JSON.stringify({
      endpoint: material.endpoint,
      protocolMajor: material.protocolMajor,
      secret: material.secret.toString("hex"),
      databaseDek: material.databaseDek.toString("hex"),
      secureStorageEndpoint: material.secureStorageEndpoint,
      secureStorageSecret: material.secureStorageSecret.toString("hex"),
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
  if (!isRecord(parsed) || !exactKeys(parsed, ["databaseDek", "endpoint", "protocolMajor", "secret", "secureStorageEndpoint", "secureStorageSecret"])) {
    throw new CoreIpcBootstrapError("BOOTSTRAP_MALFORMED", "bootstrap payload shape is invalid");
  }
  const endpoint = parsed.endpoint;
  const protocolMajor = parsed.protocolMajor;
  const secretText = parsed.secret;
  const databaseDekText = parsed.databaseDek;
  const secureStorageEndpoint = parsed.secureStorageEndpoint;
  const secureStorageSecretText = parsed.secureStorageSecret;
  if (
    typeof endpoint !== "string" ||
    !/^\\\\\.\\pipe\\jarvis-core-[0-9a-f]{32}$/u.test(endpoint) ||
    protocolMajor !== CORE_IPC_PROTOCOL_MAJOR ||
    typeof secretText !== "string" ||
    typeof databaseDekText !== "string" ||
    typeof secureStorageEndpoint !== "string" ||
    !/^\\\\\.\\pipe\\jarvis-core-[0-9a-f]{32}$/u.test(secureStorageEndpoint) ||
    typeof secureStorageSecretText !== "string"
  ) {
    throw new CoreIpcBootstrapError("BOOTSTRAP_MALFORMED", "bootstrap identity or protocol is invalid");
  }
  const secret = decodeHex(secretText, BOOTSTRAP_SECRET_BYTES);
  if (!secret) {
    throw new CoreIpcBootstrapError("BOOTSTRAP_MALFORMED", "bootstrap secret encoding is invalid");
  }
  const databaseDek = decodeHex(databaseDekText, BOOTSTRAP_SECRET_BYTES);
  if (!databaseDek) {
    throw new CoreIpcBootstrapError("BOOTSTRAP_MALFORMED", "bootstrap database key encoding is invalid");
  }
  const secureStorageSecret = decodeHex(secureStorageSecretText, BOOTSTRAP_SECRET_BYTES);
  if (!secureStorageSecret) {
    throw new CoreIpcBootstrapError("BOOTSTRAP_MALFORMED", "secure-storage bootstrap secret encoding is invalid");
  }
  return { endpoint, protocolMajor, secret, databaseDek, secureStorageEndpoint, secureStorageSecret };
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

export class CoreIpcFrameReader {
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

async function closeCoreTransport(socket: Socket): Promise<void> {
  if (socket.destroyed) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, HANDSHAKE_TIMEOUT_MS);
    socket.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.destroy();
  });
}

async function connectAuthenticatedSecureStorage(
  material: Pick<BootstrapMaterial, "secureStorageEndpoint" | "secureStorageSecret">,
): Promise<Socket> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let socket: Socket | undefined;
    try {
      socket = await connectCoreTransport(material.secureStorageEndpoint);
      await authenticateTransport(material.secureStorageSecret, socket);
      return socket;
    } catch (error) {
      lastError = error;
      if (socket) await closeCoreTransport(socket);
      if (
        !(error instanceof CoreIpcBootstrapError) ||
        (error.code !== "IPC_CONNECT_FAILED" && error.code !== "IPC_HANDSHAKE_TIMEOUT") ||
        attempt === 2
      ) {
        throw error;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new CoreIpcBootstrapError("IPC_CONNECT_FAILED", "secure-storage connection failed");
}

export async function authenticateCoreTransport(material: BootstrapMaterial, socket: Socket): Promise<AuthenticatedTransport> {
  return authenticateTransport(material.secret, socket);
}

async function authenticateTransport(secret: Buffer, socket: Socket): Promise<AuthenticatedTransport> {
  const reader = new CoreIpcFrameReader(socket);
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
        proof: proof(secret, CORE_IPC_PROTOCOL_MAJOR, nonce).toString("hex"),
      }),
      "utf8",
    );
    socket.write(encodeFrame(hello, CORE_IPC_FRAME_CEILING));
    const welcome = parseJson<unknown>(await reader.read(CORE_IPC_FRAME_CEILING, HANDSHAKE_TIMEOUT_MS), "Core IPC welcome");
    if (!isRecord(welcome) || !exactKeys(welcome, ["kind", "protocolMajor"]) || welcome.kind !== "welcome" || welcome.protocolMajor !== CORE_IPC_PROTOCOL_MAJOR) {
      throw new CoreIpcBootstrapError("IPC_PROTOCOL_MISMATCH", "Core IPC welcome is unsupported");
    }
    return { socket, protocolMajor: CORE_IPC_PROTOCOL_MAJOR, reader };
  } catch (error) {
    socket.destroy();
    if (error instanceof CoreIpcBootstrapError) throw error;
    throw new CoreIpcBootstrapError("IPC_AUTHENTICATION_FAILED", "Core IPC authentication failed", { cause: error });
  }
}

function secureStorageProof(secret: Buffer, correlationId: string, databaseDek: Buffer): Buffer {
  return createHmac("sha256", secret)
    .update(Buffer.concat([SECURE_STORAGE_DOMAIN, Buffer.from(correlationId, "utf8"), databaseDek]))
    .digest();
}

function localBackupDekProof(
  secret: Buffer,
  operation: string,
  correlationId: string,
  protectedOrPlaintext: Buffer,
  descriptorDigest: Buffer,
): Buffer {
  return createHmac("sha256", secret)
    .update(
      Buffer.concat([
        SECURE_STORAGE_DOMAIN,
        Buffer.from(operation, "utf8"),
        Buffer.from([0]),
        Buffer.from(correlationId, "utf8"),
        Buffer.from([0]),
        protectedOrPlaintext,
        Buffer.from([0]),
        descriptorDigest,
      ]),
    )
    .digest();
}

function sessionPasswordKdfProof(secret: Buffer, correlationId: string, password: Buffer): Buffer {
  return createHmac("sha256", secret)
    .update(Buffer.concat([SESSION_PASSWORD_KDF_DOMAIN, Buffer.from(correlationId, "utf8"), password]))
    .digest();
}

function randomUuidV7(): string {
  const bytes = randomBytes(16);
  const timestamp = BigInt(Date.now());
  for (let index = 0; index < 6; index += 1) {
    bytes[index] = Number((timestamp >> BigInt(40 - index * 8)) & 0xffn);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function secureStorageHandleProof(
  secret: Buffer,
  operation: string,
  correlationId: string,
  handle: string,
): Buffer {
  return createHmac("sha256", secret)
    .update(
      Buffer.concat([
        SECURE_STORAGE_DOMAIN,
        Buffer.from(operation, "utf8"),
        Buffer.from([0]),
        Buffer.from(correlationId, "utf8"),
        Buffer.from([0]),
        Buffer.from(handle, "utf8"),
      ]),
    )
    .digest();
}

export interface RestoreDbDekProtectionLease {
  readonly handle: string;
  commit(): Promise<void>;
  abort(): Promise<void>;
}

async function sendSecureStorageOperation(
  material: Pick<BootstrapMaterial, "secureStorageEndpoint" | "secureStorageSecret">,
  operation: string,
  handle?: string,
  databaseDek?: Buffer,
): Promise<string> {
  const correlationId = randomUuidV7();
  const socket = await connectAuthenticatedSecureStorage(material);
  try {
    const request = databaseDek
      ? {
          protocolVersion: CORE_IPC_PROTOCOL_MAJOR,
          kind: "request",
          operation,
          correlationId,
          databaseDek: databaseDek.toString("hex"),
          proof: secureStorageProof(material.secureStorageSecret, correlationId, databaseDek).toString("hex"),
        }
      : {
          protocolVersion: CORE_IPC_PROTOCOL_MAJOR,
          kind: "request",
          operation,
          correlationId,
          handle,
          proof: secureStorageHandleProof(material.secureStorageSecret, operation, correlationId, handle ?? "").toString("hex"),
        };
    socket.write(encodeCoreIpcJsonFrame(request));
    const reader = new CoreIpcFrameReader(socket);
    const response = JSON.parse(
      (await reader.read(CORE_IPC_FRAME_CEILING, HANDSHAKE_TIMEOUT_MS)).toString("utf8"),
    ) as unknown;
    if (
      !isRecord(response) ||
      !exactKeys(response, ["correlationId", "errorCode", "handle", "ok"]) ||
      response.correlationId !== correlationId ||
      response.ok !== true ||
      typeof response.handle !== "string" ||
      response.handle.length === 0 ||
      response.errorCode !== null
    ) {
      throw new CoreIpcBootstrapError(
        "IPC_AUTHENTICATION_FAILED",
        `native secure-storage operation ${operation} was rejected`,
      );
    }
    socket.write(
      encodeCoreIpcJsonFrame({
        kind: "response_ack",
        correlationId,
      }),
    );
    return response.handle;
  } catch (error) {
    if (error instanceof CoreIpcBootstrapError) throw error;
    throw new CoreIpcBootstrapError("IPC_FRAME_MALFORMED", "native secure-storage response was invalid", { cause: error });
  } finally {
    await closeCoreTransport(socket);
  }
}

async function sendLocalBackupDekOperation(
  material: Pick<BootstrapMaterial, "secureStorageEndpoint" | "secureStorageSecret">,
  operation: "protect_local_backup_dek" | "unprotect_local_backup_dek",
  value: Buffer,
  descriptorDigest: Buffer,
): Promise<Buffer> {
  if (descriptorDigest.length !== 32) {
    throw new CoreIpcBootstrapError("IPC_FRAME_MALFORMED", "local recovery descriptor digest must be exactly 256 bits");
  }
  if (
    operation === "protect_local_backup_dek" && value.length !== 32
  ) {
    throw new CoreIpcBootstrapError("IPC_FRAME_MALFORMED", "local recovery BackupDEK must be exactly 256 bits");
  }
  if (
    operation === "unprotect_local_backup_dek" &&
    (value.length === 0 || value.length > LOCAL_BACKUP_SLOT_MAX_BYTES)
  ) {
    throw new CoreIpcBootstrapError("IPC_FRAME_MALFORMED", "local recovery protected slot is outside its bounded size");
  }
  const valueBytes = Buffer.from(value);
  const entropyBytes = Buffer.from(descriptorDigest);
  const correlationId = randomUuidV7();
  const socket = await connectAuthenticatedSecureStorage(material);
  try {
    const request = {
      protocolVersion: CORE_IPC_PROTOCOL_MAJOR,
      kind: "request",
      operation,
      correlationId,
      ...(operation === "protect_local_backup_dek"
        ? { backupDek: valueBytes.toString("hex") }
        : { protectedBackupDek: valueBytes.toString("hex") }),
      descriptorDigest: entropyBytes.toString("hex"),
      proof: localBackupDekProof(
        material.secureStorageSecret,
        operation,
        correlationId,
        valueBytes,
        entropyBytes,
      ).toString("hex"),
    };
    socket.write(encodeCoreIpcJsonFrame(request));
    const reader = new CoreIpcFrameReader(socket);
    const response = parseJson<unknown>(
      await reader.read(CORE_IPC_FRAME_CEILING, HANDSHAKE_TIMEOUT_MS),
      "native local backup-dek response",
    );
    if (
      !isRecord(response) ||
      !exactKeys(response, [
        "backupDek",
        "correlationId",
        "errorCode",
        "ok",
        "operation",
        "protectedBackupDek",
      ]) ||
      response.correlationId !== correlationId ||
      response.operation !== operation ||
      response.ok !== true ||
      response.errorCode !== null
    ) {
      throw new CoreIpcBootstrapError("IPC_AUTHENTICATION_FAILED", `native ${operation} was rejected`);
    }
    const encoded = operation === "protect_local_backup_dek"
      ? response.protectedBackupDek
      : response.backupDek;
    if (
      typeof encoded !== "string" ||
      !/^[0-9a-f]+$/u.test(encoded) ||
      encoded.length % 2 !== 0 ||
      encoded.length === 0 ||
      encoded.length > LOCAL_BACKUP_SLOT_MAX_BYTES * 2
    ) {
      throw new CoreIpcBootstrapError("IPC_FRAME_MALFORMED", `native ${operation} response encoding is invalid`);
    }
    const result = Buffer.from(encoded, "hex");
    if (operation === "unprotect_local_backup_dek" && result.length !== 32) {
      result.fill(0);
      throw new CoreIpcBootstrapError("IPC_FRAME_MALFORMED", "native local recovery returned an invalid BackupDEK");
    }
    socket.write(encodeCoreIpcJsonFrame({ kind: "response_ack", correlationId }));
    return result;
  } catch (error) {
    if (error instanceof CoreIpcBootstrapError) throw error;
    throw new CoreIpcBootstrapError("IPC_FRAME_MALFORMED", "native local backup-dek response was invalid", { cause: error });
  } finally {
    valueBytes.fill(0);
    entropyBytes.fill(0);
    await closeCoreTransport(socket);
  }
}

export function protectLocalBackupDekThroughNativeStorage(
  material: Pick<BootstrapMaterial, "secureStorageEndpoint" | "secureStorageSecret">,
  backupDek: Buffer,
  descriptorDigest: Buffer,
): Promise<Buffer> {
  return sendLocalBackupDekOperation(material, "protect_local_backup_dek", backupDek, descriptorDigest);
}

export function unprotectLocalBackupDekThroughNativeStorage(
  material: Pick<BootstrapMaterial, "secureStorageEndpoint" | "secureStorageSecret">,
  protectedBackupDek: Buffer,
  descriptorDigest: Buffer,
): Promise<Buffer> {
  return sendLocalBackupDekOperation(material, "unprotect_local_backup_dek", protectedBackupDek, descriptorDigest);
}

/**
 * Typed Core-to-host boundary for the restore-generated DB_DEK. The endpoint
 * and secret arrive only through authenticated native bootstrap material; no
 * generic command or renderer-controlled channel is exposed.
 */
export async function protectNewDbDekThroughNativeStorage(
  material: Pick<BootstrapMaterial, "secureStorageEndpoint" | "secureStorageSecret">,
  databaseDek: Buffer,
): Promise<RestoreDbDekProtectionLease> {
  if (databaseDek.length !== 32) {
    throw new CoreIpcBootstrapError("IPC_FRAME_MALFORMED", "restore DB_DEK must be exactly 256 bits");
  }
  const handle = await sendSecureStorageOperation(material, "protect_new_database_dek", undefined, databaseDek);
  let settled = false;
  return {
    handle,
    async commit(): Promise<void> {
      if (settled) return;
      await sendSecureStorageOperation(material, "commit_staged_database_dek", handle);
      settled = true;
    },
    async abort(): Promise<void> {
      if (settled) return;
      await sendSecureStorageOperation(material, "abort_staged_database_dek", handle);
      settled = true;
    },
  };
}

/**
 * Derive a new session-password verifier through the native Windows KDF
 * boundary. Core receives only the versioned verifier metadata, salt, and
 * derived verifier; the plaintext password never crosses into persistence.
 */
export async function deriveNewSessionPasswordThroughNativeStorage(
  material: Pick<BootstrapMaterial, "secureStorageEndpoint" | "secureStorageSecret">,
  password: Buffer,
): Promise<SessionPasswordVerifier> {
  const passwordBytes = Buffer.from(password);
  let canonicalPassword: Buffer | undefined;
  try {
    const passwordText = passwordBytes.toString("utf8");
    if (passwordText.length === 0 || !Buffer.from(passwordText, "utf8").equals(passwordBytes)) {
      throw new CoreIpcBootstrapError("IPC_FRAME_MALFORMED", "session password must be valid non-empty UTF-8");
    }
    canonicalPassword = Buffer.from(passwordText.normalize("NFC"), "utf8");
    if (canonicalPassword.length === 0 || canonicalPassword.length > SESSION_PASSWORD_MAX_BYTES) {
      throw new CoreIpcBootstrapError("IPC_FRAME_MALFORMED", "session password exceeds its bounded size");
    }
    const correlationId = randomUuidV7();
    const socket = await connectAuthenticatedSecureStorage(material);
    try {
      const request = {
        protocolVersion: CORE_IPC_PROTOCOL_MAJOR,
        kind: "request",
        operation: "derive_session_password_verifier",
        correlationId,
        password: canonicalPassword.toString("hex"),
        proof: sessionPasswordKdfProof(material.secureStorageSecret, correlationId, canonicalPassword).toString("hex"),
      };
      socket.write(encodeCoreIpcJsonFrame(request));
      const reader = new CoreIpcFrameReader(socket);
      const response = parseJson<unknown>(
        await reader.read(CORE_IPC_FRAME_CEILING, HANDSHAKE_TIMEOUT_MS),
        "native session-password verifier response",
      );
      if (
        !isRecord(response) ||
        !exactKeys(response, [
          "algorithm",
          "correlationId",
          "errorCode",
          "iterations",
          "memoryKiB",
          "ok",
          "parallelism",
          "profileId",
          "salt",
          "verifier",
          "version",
        ]) ||
        response.correlationId !== correlationId ||
        response.ok !== true ||
        response.errorCode !== null ||
        response.profileId !== "session-password-v1" ||
        response.algorithm !== "ARGON2ID" ||
        response.version !== 0x13 ||
        response.memoryKiB !== 65_536 ||
        response.iterations !== 3 ||
        response.parallelism !== 4 ||
        typeof response.salt !== "string" ||
        typeof response.verifier !== "string"
      ) {
        throw new CoreIpcBootstrapError("IPC_AUTHENTICATION_FAILED", "native session-password derivation was rejected");
      }
      const salt = decodeHex(response.salt, 16);
      const verifier = decodeHex(response.verifier, 32);
      if (!salt || !verifier) {
        throw new CoreIpcBootstrapError("IPC_FRAME_MALFORMED", "native session-password verifier encoding is invalid");
      }
      socket.write(encodeCoreIpcJsonFrame({ kind: "response_ack", correlationId }));
      return {
        profileId: "session-password-v1",
        purpose: "SESSION_PASSWORD",
        algorithm: "ARGON2ID",
        version: 0x13,
        memoryKiB: 65_536,
        iterations: 3,
        parallelism: 4,
        salt,
        verifier,
      };
    } finally {
      await closeCoreTransport(socket);
      canonicalPassword.fill(0);
    }
  } finally {
    canonicalPassword?.fill(0);
    passwordBytes.fill(0);
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
