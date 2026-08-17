export const PRE_ALLOW_GATE_NAMES = [
  "PLATFORM_CAPABILITY",
  "PROVIDER_SETUP",
  "INTEGRITY",
  "PROJECT_POLICY_TRUST",
  "SUPPLY_CHAIN_TRUST",
  "LOCALITY",
  "BUDGET",
  "RESOURCE",
  "PRECONDITION",
] as const;

export type PreAllowGateName = (typeof PRE_ALLOW_GATE_NAMES)[number];
export type PreAllowFactState = "PASS" | "FAIL" | "UNKNOWN" | "NOT_APPLICABLE";

export interface PreAllowFact {
  readonly state: PreAllowFactState;
  readonly reasonCode: string;
}

export type PreAllowGateFacts = Readonly<Record<PreAllowGateName, PreAllowFact>>;

export interface PreAllowGateResult {
  readonly passed: boolean;
  readonly reasonCode: string;
  readonly failedGate?: PreAllowGateName;
  readonly evaluatedGates: readonly PreAllowGateName[];
}

export class PreAllowGateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreAllowGateValidationError";
  }
}

const STATES = new Set<PreAllowFactState>(["PASS", "FAIL", "UNKNOWN", "NOT_APPLICABLE"]);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new PreAllowGateValidationError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>): void {
  const allowed = new Set(PRE_ALLOW_GATE_NAMES);
  if (Object.keys(value).some((key) => !allowed.has(key as PreAllowGateName)) || PRE_ALLOW_GATE_NAMES.some((name) => !(name in value))) {
    throw new PreAllowGateValidationError("pre-ALLOW facts contain unsupported or missing gates");
  }
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 256 || !ID_PATTERN.test(value)) throw new PreAllowGateValidationError(`${label} is invalid`);
  return value;
}

function validateFact(value: unknown, gateName: PreAllowGateName): PreAllowFact {
  const input = record(value, gateName);
  if (Object.keys(input).length !== 2 || !("state" in input) || !("reasonCode" in input)) throw new PreAllowGateValidationError(`${gateName} fact fields are invalid`);
  if (typeof input.state !== "string" || !STATES.has(input.state as PreAllowFactState)) throw new PreAllowGateValidationError(`${gateName} state is unsupported`);
  return Object.freeze({ state: input.state as PreAllowFactState, reasonCode: id(input.reasonCode, `${gateName}.reasonCode`) });
}

export function validatePreAllowGateFacts(value: unknown): PreAllowGateFacts {
  const input = record(value, "pre-ALLOW facts");
  keys(input);
  return Object.freeze(Object.fromEntries(PRE_ALLOW_GATE_NAMES.map((gateName) => [gateName, validateFact(input[gateName], gateName)])) as PreAllowGateFacts);
}

export function evaluatePreAllowGates(value: unknown): PreAllowGateResult {
  const facts = validatePreAllowGateFacts(value);
  const evaluatedGates = Object.freeze([...PRE_ALLOW_GATE_NAMES]);
  for (const gateName of PRE_ALLOW_GATE_NAMES) {
    const fact = facts[gateName];
    if (fact.state !== "PASS" && fact.state !== "NOT_APPLICABLE") {
      return Object.freeze({
        passed: false,
        reasonCode: fact.state === "UNKNOWN" ? `${gateName}_UNKNOWN` : fact.reasonCode,
        failedGate: gateName,
        evaluatedGates,
      });
    }
  }
  return Object.freeze({ passed: true, reasonCode: "PRE_ALLOW_GATES_PASS", evaluatedGates });
}
