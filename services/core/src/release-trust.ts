import { createReadStream } from "node:fs";
import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Updater } from "tuf-js";

export const TUF_PROFILE_VERSION = "1.0.35" as const;
export const RELEASE_TARGET_PATH = "runtime-manifest.json" as const;
export const PRIVATE_INTERNAL_DISTRIBUTION_SCOPE = "PRIVATE_INTERNAL" as const;
export const PRIVATE_INTERNAL_WINDOWS_TRUST_MODE = "PRIVATE_INTERNAL_AUTHENTICODE" as const;
export const PRIVATE_INTERNAL_WINDOWS_CERTIFICATE_THUMBPRINT =
  "23DA4DA3E340B66EC4240B4CC845E4387E5BBDD3" as const;

const PRIVATE_INTERNAL_WINDOWS_SIGNING = Object.freeze({
  trustMode: PRIVATE_INTERNAL_WINDOWS_TRUST_MODE,
  certificateThumbprint: PRIVATE_INTERNAL_WINDOWS_CERTIFICATE_THUMBPRINT,
  authorizedTargetScope: "CURRENT_USER_ONLY",
  trustEnrollment: "CURRENT_USER_TRUSTEDPUBLISHER_AND_ROOT",
  timestampEvidence: "ABSENT_PUBLIC_TIMESTAMP_PRIVATE_INTERNAL",
} as const);

export type PrivateInternalWindowsSigning = typeof PRIVATE_INTERNAL_WINDOWS_SIGNING;

export interface ReleaseTrustAdmission {
  readonly tufProfileVersion: typeof TUF_PROFILE_VERSION;
  readonly targetPath: typeof RELEASE_TARGET_PATH;
  readonly targetLength: number;
  readonly targetSha256: string;
  readonly releaseId: string;
  readonly jarvisVersion: string;
  readonly releaseSequence: number;
  readonly securityEpoch: number;
  readonly sourceCommitSha: string;
  readonly releaseDistributionScope: typeof PRIVATE_INTERNAL_DISTRIBUTION_SCOPE;
  readonly publicDistributionSupported: false;
  readonly windowsSigning: PrivateInternalWindowsSigning;
}

export class ReleaseTrustError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ReleaseTrustError";
  }
}

function isCanonicalChild(root: string, candidate: string): boolean {
  const child = relative(root, candidate);
  return (
    child.length > 0 &&
    !isAbsolute(child) &&
    child.split(/[\\/]/u).every((component) => component.length > 0 && component !== "..")
  );
}

async function requireRegularDirectory(path: string, label: string): Promise<string> {
  let metadata;
  try {
    metadata = await lstat(path);
  } catch (error) {
    throw new ReleaseTrustError(`${label} is missing`, { cause: error });
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new ReleaseTrustError(`${label} must be a regular directory`);
  }
  try {
    return await realpath(path);
  } catch (error) {
    throw new ReleaseTrustError(`${label} cannot be canonicalized`, { cause: error });
  }
}

async function requireRegularFile(path: string, label: string): Promise<string> {
  let metadata;
  try {
    metadata = await lstat(path);
  } catch (error) {
    throw new ReleaseTrustError(`${label} is missing`, { cause: error });
  }
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new ReleaseTrustError(`${label} must be a regular file`);
  }
  try {
    return await realpath(path);
  } catch (error) {
    throw new ReleaseTrustError(`${label} cannot be canonicalized`, { cause: error });
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ReleaseTrustError(`TUF target custom field ${field} is invalid`);
  }
  return value;
}

function requirePositiveSafeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new ReleaseTrustError(`TUF target custom field ${field} is invalid`);
  }
  return value as number;
}

function requireSha256(value: unknown, field: string): string {
  const sha256 = requireString(value, field).toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(sha256)) {
    throw new ReleaseTrustError(`TUF target custom field ${field} is not a SHA-256 digest`);
  }
  return sha256;
}

function requireSourceCommitSha(value: unknown): string {
  const sourceCommitSha = requireString(value, "sourceCommitSha").toLowerCase();
  if (!/^[0-9a-f]{40}$/u.test(sourceCommitSha)) {
    throw new ReleaseTrustError("TUF target custom sourceCommitSha is invalid");
  }
  return sourceCommitSha;
}

function requirePrivateInternalRelease(manifest: Record<string, unknown>): PrivateInternalWindowsSigning {
  if (manifest.releaseDistributionScope !== PRIVATE_INTERNAL_DISTRIBUTION_SCOPE) {
    throw new ReleaseTrustError("runtime manifest distribution scope is not the qualified private/internal profile");
  }
  if (manifest.publicDistributionSupported !== false) {
    throw new ReleaseTrustError("runtime manifest cannot claim public distribution support");
  }
  const signing = manifest.windowsSigning;
  if (!signing || typeof signing !== "object" || Array.isArray(signing)) {
    throw new ReleaseTrustError("runtime manifest Windows signing evidence is missing");
  }
  const signingRecord = signing as Record<string, unknown>;
  const expectedKeys = Object.keys(PRIVATE_INTERNAL_WINDOWS_SIGNING);
  const actualKeys = Object.keys(signingRecord).sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key) => !expectedKeys.includes(key))) {
    throw new ReleaseTrustError("runtime manifest Windows signing evidence fields are invalid");
  }
  for (const [key, expectedValue] of Object.entries(PRIVATE_INTERNAL_WINDOWS_SIGNING)) {
    if (signingRecord[key] !== expectedValue) {
      throw new ReleaseTrustError(`runtime manifest Windows signing evidence ${key} is invalid`);
    }
  }
  return PRIVATE_INTERNAL_WINDOWS_SIGNING;
}

/**
 * Admit a release-owned runtime manifest only through the local TUF metadata
 * set shipped with that same release. forceCache is intentional: startup
 * admission never fetches metadata or trusts an online key. The initial root
 * is authenticated by the release packaging/signing ceremony and TUF-js
 * verifies the root threshold, role signatures, expiry, version, snapshot,
 * delegations, and target hash/length before this function returns.
 */
export async function admitReleaseRuntime(
  releaseRootInput: string,
  metadataDirectoryInput: string,
): Promise<ReleaseTrustAdmission> {
  if (!isAbsolute(releaseRootInput) || !isAbsolute(metadataDirectoryInput)) {
    throw new ReleaseTrustError("release trust paths must be absolute");
  }

  const releaseRoot = await requireRegularDirectory(resolve(releaseRootInput), "release root");
  const metadataDirectory = await requireRegularDirectory(
    resolve(metadataDirectoryInput),
    "TUF metadata directory",
  );
  if (!isCanonicalChild(releaseRoot, metadataDirectory)) {
    throw new ReleaseTrustError("TUF metadata must remain inside the release root");
  }

  for (const name of ["root.json", "timestamp.json", "snapshot.json", "targets.json"]) {
    await requireRegularFile(join(metadataDirectory, name), `TUF metadata ${name}`);
  }

  const targetPath = join(releaseRoot, RELEASE_TARGET_PATH);
  const canonicalTargetPath = await requireRegularFile(targetPath, "release runtime manifest");
  if (!isCanonicalChild(releaseRoot, canonicalTargetPath)) {
    throw new ReleaseTrustError("release runtime manifest must remain inside the release root");
  }

  let targetInfo;
  try {
    const updater = new Updater({
      metadataDir: metadataDirectory,
      metadataBaseUrl: pathToFileURL(`${metadataDirectory}${"\\"}`).href,
      forceCache: true,
      config: {
        rootMaxLength: 1024 * 1024,
        timestampMaxLength: 1024 * 1024,
        snapshotMaxLength: 4 * 1024 * 1024,
        targetsMaxLength: 4 * 1024 * 1024,
        fetchRetry: false,
      },
    });
    targetInfo = await updater.getTargetInfo(RELEASE_TARGET_PATH);
  } catch (error) {
    throw new ReleaseTrustError("TUF release metadata admission failed", { cause: error });
  }
  if (!targetInfo) {
    throw new ReleaseTrustError("TUF targets metadata does not authorize the runtime manifest");
  }

  try {
    await targetInfo.verify(createReadStream(canonicalTargetPath));
  } catch (error) {
    throw new ReleaseTrustError("TUF runtime manifest target hash or length verification failed", {
      cause: error,
    });
  }

  const custom = targetInfo.custom;
  if (custom.tufSpecVersion !== TUF_PROFILE_VERSION) {
    throw new ReleaseTrustError("TUF target uses an unsupported JARVIS TUF profile");
  }
  const targetSha256 = requireSha256(targetInfo.hashes.sha256, "target sha256");
  if (requireSha256(custom.artifactSha256, "artifactSha256") !== targetSha256) {
    throw new ReleaseTrustError("TUF target artifactSha256 does not match the verified target");
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(await readFile(canonicalTargetPath, "utf8"));
  } catch (error) {
    throw new ReleaseTrustError("TUF-authorized runtime manifest is not valid JSON", { cause: error });
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new ReleaseTrustError("TUF-authorized runtime manifest must be an object");
  }
  const manifestRecord = manifest as Record<string, unknown>;
  const jarvisVersion = requireString(manifestRecord.jarvisReleaseVersion, "jarvisReleaseVersion");
  const releaseSequence = requirePositiveSafeInteger(
    manifestRecord.releaseSequence,
    "releaseSequence",
  );
  const securityEpoch = requirePositiveSafeInteger(manifestRecord.securityEpoch, "securityEpoch");
  const sourceCommitSha = requireSourceCommitSha(manifestRecord.sourceCommitSha);
  const windowsSigning = requirePrivateInternalRelease(manifestRecord);

  if (requireString(custom.releaseId, "releaseId") !== jarvisVersion) {
    throw new ReleaseTrustError("TUF releaseId does not match the runtime manifest");
  }
  if (requireString(custom.jarvisVersion, "jarvisVersion") !== jarvisVersion) {
    throw new ReleaseTrustError("TUF jarvisVersion does not match the runtime manifest");
  }
  if (requirePositiveSafeInteger(custom.releaseSequence, "releaseSequence") !== releaseSequence) {
    throw new ReleaseTrustError("TUF releaseSequence does not match the runtime manifest");
  }
  if (requirePositiveSafeInteger(custom.securityEpoch, "securityEpoch") !== securityEpoch) {
    throw new ReleaseTrustError("TUF securityEpoch does not match the runtime manifest");
  }
  if (requireSourceCommitSha(custom.sourceCommitSha) !== sourceCommitSha) {
    throw new ReleaseTrustError("TUF sourceCommitSha does not match the runtime manifest");
  }
  if (custom.platform !== "WINDOWS" || custom.runtimeRole !== "FULL_HOST" || custom.architecture !== "x64") {
    throw new ReleaseTrustError("TUF target platform identity is not the Windows x64 FULL_HOST");
  }

  return {
    tufProfileVersion: TUF_PROFILE_VERSION,
    targetPath: RELEASE_TARGET_PATH,
    targetLength: targetInfo.length,
    targetSha256,
    releaseId: requireString(custom.releaseId, "releaseId"),
    jarvisVersion,
    releaseSequence,
    securityEpoch,
    sourceCommitSha,
    releaseDistributionScope: PRIVATE_INTERNAL_DISTRIBUTION_SCOPE,
    publicDistributionSupported: false,
    windowsSigning,
  };
}
