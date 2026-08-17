import { useEffect, useState } from "react";
import { authenticateSession, initializeSession, requestProviderSetupStart, requestProviderSetupStatus, requestSessionStatus, type SessionStatusResponse } from "./coreBridge";
import { MissionControlShell, resolveStartupSnapshot, type ProviderSetupModel, type SessionControlModel } from "./mission-control";

export function App() {
  const [providerSetup, setProviderSetup] = useState<ProviderSetupModel | undefined>();
  const [providerSetupStatusMessage, setProviderSetupStatusMessage] = useState<string | undefined>();
  const [sessionControl, setSessionControl] = useState<SessionControlModel | undefined>();
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    void requestSessionStatus().then((status) => {
      if (active) setSessionControl(buildSessionControl(status, setSessionControl, setRefresh));
    }).catch((error) => {
      if (!active) return;
      setSessionControl({
        initialized: false,
        state: "LOCKED",
        errorMessage: error instanceof Error ? error.message : "Session status is unavailable.",
        onInitialize: async (password: string) => {
          const result = await initializeSession(password);
          setSessionControl(buildSessionControl(result, setSessionControl, setRefresh));
        },
      });
    });
    return () => { active = false; };
  }, [refresh]);
  useEffect(() => {
    let active = true;
    if (sessionControl?.state !== "UNLOCKED") {
      setProviderSetup(undefined);
      setProviderSetupStatusMessage(undefined);
      return () => { active = false; };
    }
    void requestProviderSetupStatus().then((records) => {
      if (!active) return;
      if (records.length === 0) {
        setProviderSetup(undefined);
        setProviderSetupStatusMessage("Core returned no registered provider setup record.");
        return;
      }
      const record = records.at(0);
      if (!record) return;
      setProviderSetupStatusMessage(undefined);
      setProviderSetup({
        providerId: record.providerId,
        distributionId: record.distributionId,
        adapterVersion: record.adapterVersion,
        state: record.state,
        ...(record.providerVersion ? { providerVersion: record.providerVersion } : {}),
        ...(record.setupPolicyId ? { setupPolicyId: record.setupPolicyId } : {}),
        ...(record.lastVerifiedAt ? { lastVerifiedAt: record.lastVerifiedAt } : {}),
        ...(record.conformanceEvidenceRef ? { conformanceEvidenceRef: record.conformanceEvidenceRef } : {}),
        ...(record.compatibility ? { compatibility: record.compatibility } : {}),
        ...(record.health ? { health: record.health } : {}),
        ...(record.qualificationState ? { qualificationState: record.qualificationState } : {}),
        ...(record.qualificationEvidenceRef ? { qualificationEvidenceRef: record.qualificationEvidenceRef } : {}),
        ...(record.locality ? { locality: record.locality } : {}),
        capabilities: record.capabilities ?? [],
        supportState: record.supportState ?? "UNSUPPORTED",
        ...(record.sanitizedFailureReason ? { failureMessage: record.sanitizedFailureReason } : {}),
        onStart: () => {
        setProviderSetupStatusMessage("Codex setup is running. Wait for the qualified helper and readiness probe to finish.");
        void requestProviderSetupStart({ requestId: uuidV7(), providerId: record.providerId, distributionId: record.distributionId, adapterVersion: record.adapterVersion }).then(() => {
          setProviderSetupStatusMessage(undefined);
          setRefresh((value) => value + 1);
        }).catch((error) => {
          const detail = error instanceof Error ? error.message : typeof error === "string" ? error : "the native setup operation failed";
          setProviderSetup((current) => current ? { ...current, state: "SETUP_FAILED", failureMessage: detail } : current);
          setProviderSetupStatusMessage(`Codex setup did not complete: ${detail}`);
        });
        },
      });
    }).catch((error) => {
      if (!active) return;
      setProviderSetup(undefined);
      const detail = error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
      setProviderSetupStatusMessage(detail ? `Provider setup status is unavailable: ${detail}` : "Provider setup status is unavailable.");
    });
    return () => { active = false; };
  }, [refresh, sessionControl?.state]);
  return <MissionControlShell snapshot={{ ...resolveStartupSnapshot(), ...(providerSetup ? { providerSetup } : {}), ...(providerSetupStatusMessage ? { providerSetupStatusMessage } : {}), ...(sessionControl ? { sessionControl } : {}) }} />;
}

function buildSessionControl(status: SessionStatusResponse, setSessionControl: (value: SessionControlModel) => void, setRefresh: (value: (current: number) => number) => void): SessionControlModel {
  const state = status.state?.state ?? "LOCKED";
  return {
    initialized: status.initialized,
    state,
    ...(status.initialized ? {} : { onInitialize: async (password: string) => {
      const result = await initializeSession(password);
      setSessionControl(buildSessionControl(result, setSessionControl, setRefresh));
    } }),
    ...(status.initialized && state !== "UNLOCKED" ? { onUnlock: async (password: string) => {
      const result = await authenticateSession(password);
      const next = buildSessionControl({ initialized: true, state: result.state }, setSessionControl, setRefresh);
      setSessionControl({ ...next, retryAfterMs: result.retryAfterMs, ...(result.status === "UNLOCKED" ? {} : { errorMessage: result.status === "COOLDOWN" ? "The session is cooling down after failed attempts." : "The session password was not accepted." }) });
      if (result.status === "DENIED" || result.status === "COOLDOWN") throw new Error(result.status === "COOLDOWN" ? "The session is cooling down after failed attempts." : "The session password was not accepted.");
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
