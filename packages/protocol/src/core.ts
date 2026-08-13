import type { IpcEnvelope, IpcResponse } from "./ipc";

export type CoreServiceState = "LOCKED";
export type CoreTransportState = "NOT_CONNECTED";

export interface CoreServiceStatus {
  readonly protocolMajor: 1;
  readonly platform: "WINDOWS";
  readonly runtimeRole: "FULL_HOST";
  readonly architecture: "x64";
  readonly serviceState: CoreServiceState;
  readonly transportState: CoreTransportState;
}

export type CoreStatusRequest = IpcEnvelope<Record<string, never>> & {
  readonly kind: "request";
  readonly name: "get_core_status";
};

export type CoreStatusResponse = IpcResponse<CoreServiceStatus>;
