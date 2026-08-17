import { createHash } from "node:crypto";
import { canonicalizeCanonicalActionDescriptor } from "../../../packages/protocol/src/authority-canonical-runtime.mjs";
import type { CanonicalActionDescriptorV1 } from "../../../packages/protocol/src/authority.ts";

export function digestCanonicalActionDescriptor(descriptor: CanonicalActionDescriptorV1): string {
  return createHash("sha256").update(canonicalizeCanonicalActionDescriptor(descriptor), "utf8").digest("base64url");
}
