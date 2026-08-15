import type { ProviderExecutableIdentity } from "./provider.js";

export interface ProviderSetupQualificationPlan {
  readonly providerId: string;
  readonly distributionId: string;
  readonly adapterVersion: string;
  readonly interfaceId: string;
  readonly executable: ProviderExecutableIdentity;
  readonly setupHelper: ProviderExecutableIdentity;
  readonly setupArguments: readonly string[];
  readonly qualifiedAt: string;
  readonly evidenceRef: string;
}

export function validateProviderSetupQualificationPlan(value: unknown): ProviderSetupQualificationPlan {
  if (!isRecord(value)) throw new Error("provider setup qualification plan must be an object");
  const providerId = boundedText(value.providerId, "providerId");
  const distributionId = boundedText(value.distributionId, "distributionId");
  const adapterVersion = boundedText(value.adapterVersion, "adapterVersion");
  const interfaceId = boundedText(value.interfaceId, "interfaceId");
  const executable = executableIdentity(value.executable, "executable", "MAIN_EXECUTABLE");
  const setupHelper = executableIdentity(value.setupHelper, "setupHelper", "SETUP_HELPER");
  if (!Array.isArray(value.setupArguments) || value.setupArguments.length === 0 || value.setupArguments.length > 32) {
    throw new Error("provider setup arguments are outside the bounded plan limit");
  }
  const setupArguments = value.setupArguments.map((argument, index) => boundedText(argument, `setupArguments[${index}]`, 4096));
  if (setupArguments.some((argument) => argument.includes("\0"))) throw new Error("provider setup arguments contain NUL");
  const qualifiedAt = boundedText(value.qualifiedAt, "qualifiedAt", 64);
  if (Number.isNaN(Date.parse(qualifiedAt))) throw new Error("qualifiedAt is not a timestamp");
  const evidenceRef = boundedText(value.evidenceRef, "evidenceRef");
  return Object.freeze({ providerId, distributionId, adapterVersion, interfaceId, executable, setupHelper, setupArguments: Object.freeze(setupArguments), qualifiedAt, evidenceRef });
}

function executableIdentity(value: unknown, label: string, kind: ProviderExecutableIdentity["kind"]): ProviderExecutableIdentity {
  if (!isRecord(value)) throw new Error(`${label} identity must be an object`);
  if (!isRecord(value.canonicalPath) || value.canonicalPath.platform !== "WINDOWS") throw new Error(`${label}.canonicalPath must be a Windows path reference`);
  const canonicalPath = boundedText(value.canonicalPath.value, `${label}.canonicalPath.value`, 4096);
  const result = { kind, fileName: boundedText(value.fileName, `${label}.fileName`, 260), canonicalPath: { platform: "WINDOWS" as const, value: canonicalPath }, sha256: boundedText(value.sha256, `${label}.sha256`, 64) };
  if (!/^[a-f0-9]{64}$/iu.test(result.sha256)) throw new Error(`${label}.sha256 is invalid`);
  if (!/^[A-Za-z]:[\\/]/u.test(canonicalPath)) throw new Error(`${label}.canonicalPath must be a local absolute path`);
  return Object.freeze(result) as ProviderExecutableIdentity;
}

function boundedText(value: unknown, label: string, max = 256): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max || /[\u0000-\u001F\u007F]/u.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
