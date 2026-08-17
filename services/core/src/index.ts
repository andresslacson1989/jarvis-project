export interface CoreRuntimeIdentity {
  readonly platform: "WINDOWS";
  readonly runtimeRole: "FULL_HOST";
  readonly architecture: "x64";
}

export function createCoreRuntimeIdentity(): CoreRuntimeIdentity {
  return Object.freeze({ platform: "WINDOWS", runtimeRole: "FULL_HOST", architecture: "x64" });
}
