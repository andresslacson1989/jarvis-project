export type KdfPurpose = "SESSION_PASSWORD" | "PORTABLE_RECOVERY";

export interface Argon2idProfile {
  profileId: string;
  purpose: KdfPurpose;
  algorithm: "ARGON2ID";
  version: 0x13;
  memoryKiB: number;
  iterations: number;
  parallelism: 4;
  saltBytes: number;
  outputBytes: number;
}
