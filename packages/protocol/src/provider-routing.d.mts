import type {
  ProviderRoleProfileV1,
  ProviderRoutingRequestV1,
  ProviderRoutingResultV1,
} from "./provider.js";

export declare function getProviderRoleProfile(role: unknown): ProviderRoleProfileV1;
export declare function validateProviderRoutingRequest(value: unknown): ProviderRoutingRequestV1;
export declare function selectProviderForRole(
  requestValue: unknown,
  candidatesValue: readonly unknown[],
): ProviderRoutingResultV1;
