import type { UUIDv7 } from "./common.js";

export type ErrorCategory =
  | "VALIDATION"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PRECONDITION"
  | "POSTCONDITION"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_FAILED"
  | "TOOL_FAILED"
  | "TIMEOUT"
  | "CANCELLED"
  | "BUDGET"
  | "RESOURCE"
  | "PRIVACY"
  | "INTEGRITY"
  | "RECOVERY_REQUIRED"
  | "UNSUPPORTED"
  | "INTERNAL";

export interface JarvisError {
  code: string;
  category: ErrorCategory;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
  correlationId: UUIDv7;
}
