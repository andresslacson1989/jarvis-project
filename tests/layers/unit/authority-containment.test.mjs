import { strict as assert } from "node:assert";
import test from "node:test";
import {
  assertAuthorityEnvelopeContains,
  AuthorityContainmentError,
} from "../../../packages/protocol/src/authority-runtime.mts";

const envelope = {
  id: "envelope-1",
  originatingInstructionId: "instruction-1",
  scopes: [{
    kind: "INTEGRATION",
    bindings: [{ integrationId: "github", accountId: "account-1", capabilityIds: ["read", "write"] }],
    projectId: "project-1",
    environmentId: "prod",
  }],
  allowedActionClasses: ["READ", "EXTERNAL_WRITE"],
  deniedActionClasses: ["DESTRUCTIVE"],
  externalSystems: ["github"],
  dataPolicy: { sensitivity: "PRIVATE", locality: "ANY_APPROVED_PROVIDER" },
  maxBudget: { currency: "USD", nanoUnits: "1000000000" },
  createdAt: "2026-08-15T00:00:00.000Z",
  policySnapshotVersion: 1,
};

const containedRequest = {
  actionClass: "EXTERNAL_WRITE",
  executionScope: {
    kind: "INTEGRATION",
    bindings: [{ integrationId: "github", accountId: "account-1", capabilityIds: ["write"] }],
    projectId: "project-1",
    environmentId: "prod",
  },
  externalSystems: ["github"],
  dataPolicy: { sensitivity: "PUBLIC", locality: "LOCAL_ONLY" },
  estimatedBudget: { currency: "USD", nanoUnits: "500000000" },
};

test("authority containment accepts only narrower action, scope, system, data, and budget requests", () => {
  assert.equal(assertAuthorityEnvelopeContains(envelope, containedRequest), true);
});

test("authority containment rejects action, scope, system, locality, sensitivity, and budget expansion", () => {
  const cases = [
    [{ ...containedRequest, actionClass: "DEPLOY" }, /action class/iu],
    [{ ...containedRequest, executionScope: { ...containedRequest.executionScope, environmentId: "staging" } }, /execution scope/iu],
    [{ ...containedRequest, externalSystems: ["github", "proxmox"] }, /external system/iu],
    [{ ...containedRequest, dataPolicy: { sensitivity: "SECRET", locality: "ANY_APPROVED_PROVIDER" } }, /data policy/iu],
    [{ ...containedRequest, estimatedBudget: { currency: "USD", nanoUnits: "1000000001" } }, /estimated budget/iu],
  ];
  for (const [request, pattern] of cases) {
    assert.throws(() => assertAuthorityEnvelopeContains(envelope, request), (error) => error instanceof AuthorityContainmentError && pattern.test(error.message));
  }
});

test("authority envelopes reject negative maximum budgets and containment cannot invent a budget cap", () => {
  assert.throws(() => assertAuthorityEnvelopeContains({ ...envelope, maxBudget: { currency: "USD", nanoUnits: "-1" } }, containedRequest), /non-negative/iu);
  assert.throws(() => assertAuthorityEnvelopeContains({ ...envelope, maxBudget: undefined }, containedRequest), /estimated budget/iu);
  assert.equal(assertAuthorityEnvelopeContains({ ...envelope, maxBudget: undefined }, { ...containedRequest, estimatedBudget: undefined }), true);
});
