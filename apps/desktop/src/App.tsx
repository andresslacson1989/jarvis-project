import { useEffect, useState } from "react";
import { authenticateSession, initializeSession, requestProviderSetupStart, requestProviderSetupStatus, requestSessionStatus, type SessionStatusResponse } from "./coreBridge";
import { MissionControlShell, resolveStartupSnapshot, type ProviderSetupModel, type SessionControlModel } from "./mission-control";

export function App() {
  const [providerSetup, setProviderSetup] = useState<ProviderSetupModel | undefined>();
  const [sessionControl, setSessionControl] = useState<SessionControlModel | undefined>();
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    void requestSessionStatus().then((status) => {
      if (active) setSessionControl(buildSessionControl(status, setSessionControl, setRefresh));
    }).catch((error) => { if (active) setSessionControl({ initialized: false, state: "LOCKED", errorMessage: error instanceof Error ? error.message : "Session status is unavailable." }); });
    return () => { active = false; };
  }, [refresh]);
  useEffect(() => {
    let active = true;
    if (sessionControl?.state !== "UNLOCKED") {
      setProviderSetup(undefined);
      return () => { active = false; };
    }
    void requestProviderSetupStatus().then((records) => {
      if (!active || records.length === 0) return;
      const record = records.at(0);
      if (!record) return;
      setProviderSetup({ providerId: record.providerId, distributionId: record.distributionId, adapterVersion: record.adapterVersion, state: record.state, ...(record.sanitizedFailureReason ? { failureMessage: record.sanitizedFailureReason } : {}), onStart: () => {
        void requestProviderSetupStart({ requestId: uuidV7(), providerId: record.providerId, distributionId: record.distributionId, adapterVersion: record.adapterVersion }).then(() => setRefresh((value) => value + 1));
      } });
    }).catch(() => { if (active) setProviderSetup(undefined); });
    return () => { active = false; };
  }, [refresh, sessionControl?.state]);
  return <MissionControlShell snapshot={{ ...resolveStartupSnapshot(), ...(providerSetup ? { providerSetup } : {}), ...(sessionControl ? { sessionControl } : {}) }} />;
}

function buildSessionControl(status: SessionStatusResponse, setSessionControl: (value: SessionControlModel) => void, setRefresh: (value: (current: number) => number) => void): SessionControlModel {
  const state = status.state?.state ?? "LOCKED";
  return {
    initialized: status.initialized,
    state,
    ...(status.initialized ? {} : { onInitialize: async (password: string) => {
      const result = await initializeSession(password);
      setSessionControl(buildSessionControl(result, setSessionControl, setRefresh));
      setRefresh((value) => value + 1);
    } }),
    ...(status.initialized && state !== "UNLOCKED" ? { onUnlock: async (password: string) => {
      const result = await authenticateSession(password);
      const next = buildSessionControl({ initialized: true, state: result.state }, setSessionControl, setRefresh);
      setSessionControl({ ...next, retryAfterMs: result.retryAfterMs, ...(result.status === "UNLOCKED" ? {} : { errorMessage: result.status === "COOLDOWN" ? "The session is cooling down after failed attempts." : "The session password was not accepted." }) });
      if (result.status === "DENIED" || result.status === "COOLDOWN") throw new Error(result.status === "COOLDOWN" ? "The session is cooling down after failed attempts." : "The session password was not accepted.");
      setRefresh((value) => value + 1);
    } } : {}),
  };
}

function uuidV7(): `${string}-${string}-7${string}-${string}-${string}` {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const timestamp = Date.now();
  for (let index = 5; index >= 0; index -= 1) { bytes[index]! = timestamp / (2 ** (8 * (5 - index))) & 0xff; }
  bytes[6]! = bytes[6]! & 0x0f | 0x70;
  bytes[8]! = bytes[8]! & 0x3f | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
