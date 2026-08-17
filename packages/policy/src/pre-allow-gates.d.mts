export type PreAllowGateName = "PLATFORM_CAPABILITY" | "PROVIDER_SETUP" | "INTEGRITY" | "PROJECT_POLICY_TRUST" | "SUPPLY_CHAIN_TRUST" | "LOCALITY" | "BUDGET" | "RESOURCE" | "PRECONDITION";
export type PreAllowGateState = "PASS" | "FAIL" | "UNKNOWN" | "NOT_APPLICABLE";
export interface PreAllowGateFact { readonly state: PreAllowGateState; readonly reasonCode: string; }
export type PreAllowGateFacts = Readonly<Record<PreAllowGateName, PreAllowGateFact>>;
export interface PreAllowGateResult { readonly passed: boolean; readonly reasonCode: string; readonly failedGate?: PreAllowGateName; readonly evaluatedGates: readonly PreAllowGateName[]; }
export declare function evaluatePreAllowGates(value: unknown): PreAllowGateResult;
export declare function validatePreAllowGateFacts(value: unknown): PreAllowGateFacts;
