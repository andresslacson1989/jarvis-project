import type { UUIDv7 } from "./common";
import type { JarvisError } from "./errors";

export type IpcKind = "request" | "response" | "event";

export interface IpcEnvelope<T = unknown> {
  protocolVersion: 1;
  kind: IpcKind;
  id: UUIDv7 | null;
  name: string;
  correlationId: UUIDv7;
  payload: T;
}

export type IpcResponse<T> =
  | { ok: true; result: T }
  | { ok: false; error: JarvisError };
