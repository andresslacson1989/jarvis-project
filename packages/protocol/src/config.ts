import type { PlatformRuntimeIdentity } from "./platform.js";

export type ConfigurationDomain =
  | "STARTUP"
  | "SESSION_SECURITY"
  | "VOICE"
  | "PROVIDERS"
  | "PRIVACY"
  | "PERMISSIONS"
  | "BUDGETS"
  | "PROJECTS"
  | "MODULES"
  | "INTEGRATIONS"
  | "NOTIFICATIONS"
  | "RETENTION"
  | "UPDATES"
  | "PLATFORM_BACKEND"
  | "DEVELOPER_MODE";

export interface BootstrapConfigurationV1 {
  schemaVersion: 1;
  contractSuiteVersion: "1.0.5";
  releaseProfileVersion: "1.0.5";
  protocolMajor: 1;
  canonicalValuesId: "jarvis.contract-values.v1.0.5";
  runtime: PlatformRuntimeIdentity & {
    platform: "WINDOWS";
    runtimeRole: "FULL_HOST";
    architecture: "x64";
  };
  developerMode: boolean;
}

export interface ConfigurationCandidate {
  readonly candidateId: string;
  readonly domain: ConfigurationDomain;
  readonly schemaVersion: number;
  readonly values: Readonly<Record<string, unknown>>;
  readonly expectedActiveVersion: number;
  readonly createdAt: string;
}

export interface ActiveConfiguration {
  readonly domain: ConfigurationDomain;
  readonly schemaVersion: number;
  readonly values: Readonly<Record<string, unknown>>;
  readonly version: number;
  readonly sourceCandidateId: string;
  readonly activatedAt: string;
}
