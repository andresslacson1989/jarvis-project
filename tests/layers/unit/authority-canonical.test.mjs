import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildCanonicalActionDescriptorV1,
  canonicalizeBuiltActionDescriptor,
  canonicalizeCanonicalActionDescriptor,
} from "../../../packages/protocol/src/authority-canonical-runtime.mts";

const vector = JSON.parse(await readFile(new URL("../../fixtures/authority-action-v1-golden.json", import.meta.url), "utf8"));

test("canonical action builder and digest match the RFC 8785/SHA-256/base64url golden vector", () => {
  const buildInput = { ...vector.descriptor };
  delete buildInput.domain;
  delete buildInput.descriptorVersion;
  const rebuilt = buildCanonicalActionDescriptorV1(buildInput);
  assert.equal(canonicalizeCanonicalActionDescriptor(rebuilt), vector.canonicalUtf8);
  assert.equal(canonicalizeBuiltActionDescriptor(buildInput), vector.canonicalUtf8);
  assert.equal(createHash("sha256").update(vector.canonicalUtf8, "utf8").digest("hex"), vector.sha256Hex);
  assert.equal(createHash("sha256").update(vector.canonicalUtf8, "utf8").digest("base64url"), vector.base64url);
});

test("canonical action builder owns descriptor identity and rejects unsafe values", () => {
  assert.throws(() => buildCanonicalActionDescriptorV1(vector.descriptor), /must not provide descriptor identity/iu);
  assert.throws(() => canonicalizeCanonicalActionDescriptor({ ...vector.descriptor, arguments: { value: Number.NaN } }), /safe integers|non-JSON/iu);
  assert.throws(() => canonicalizeCanonicalActionDescriptor({ ...vector.descriptor, arguments: { value: -0 } }), /safe integers/iu);
  assert.throws(() => canonicalizeCanonicalActionDescriptor({ ...vector.descriptor, arguments: { value: "\ud800" } }), /invalid Unicode/iu);
});
