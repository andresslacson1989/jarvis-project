import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  validateMoneyAmount,
  validateProviderQuotaSnapshot,
} from "../../../packages/protocol/src/accounting-runtime.mts";
import { applyCoreMigrations, CoreSchemaError, CoreStateRepository } from "../../../services/core/src/schema.ts";
import { openCoreDatabase } from "../../../services/core/src/persistence.ts";

const TEST_DB_DEK = Buffer.alloc(32, 0x42);

async function withDatabase(testBody) {
  const root = join(tmpdir(), `jarvis-accounting-${process.pid}-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  const connection = openCoreDatabase(join(root, "state.db"), { dbDek: TEST_DB_DEK });
  try { await testBody(connection, new CoreStateRepository(connection)); } finally { connection.close(); await rm(root, { recursive: true, force: true }); }
}

test("accounting validators preserve exact money and provenance enums", () => {
  assert.deepEqual(validateMoneyAmount({ currency: "USD", nanoUnits: "1000" }), { currency: "USD", nanoUnits: "1000" });
  assert.throws(() => validateMoneyAmount({ currency: "USD", nanoUnits: "1.0" }));
  assert.deepEqual(validateProviderQuotaSnapshot({ snapshotId: "quota-1", providerId: "provider-1", quotaType: "TOKENS", unit: "tokens", observedAt: "2026-08-15T00:00:00.000Z", source: "PROVIDER_REPORTED", remaining: "100" }).source, "PROVIDER_REPORTED");
});

test("provider facts append and hard budget reservations serialize against exact amounts", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    assert.deepEqual(repository.appendProviderQuotaSnapshot({ snapshotId: "quota-1", providerId: "provider-1", quotaType: "TOKENS", unit: "tokens", observedAt: "2026-08-15T00:00:00.000Z", source: "PROVIDER_REPORTED", remaining: "100" }), { snapshotId: "quota-1" });
    assert.deepEqual(repository.appendUsageRecord({ usageId: "usage-1", providerId: "provider-1", units: { tokens: "10" }, costConfidence: "PROVIDER_REPORTED", actualCost: { currency: "USD", nanoUnits: "10" }, occurredAt: "2026-08-15T00:00:00.000Z" }), { usageId: "usage-1" });
    assert.deepEqual(repository.putBudgetPolicy({ budget: { budgetId: "budget-1", scopeType: "GLOBAL", limit: { currency: "USD", nanoUnits: "100" }, warningAtBasisPoints: 8000, hardLimit: true, period: "MONTH" }, expectedVersion: 0 }), { budgetId: "budget-1", version: 1 });
    assert.deepEqual(repository.reserveBudget({ reservation: { reservationId: "reservation-1", budgetId: "budget-1", providerId: "provider-1", amount: { currency: "USD", nanoUnits: "40" }, state: "RESERVED", createdAt: "2026-08-15T00:00:01.000Z" }, expectedBudgetVersion: 1 }), { reservationId: "reservation-1", budgetVersion: 2 });
    assert.throws(() => repository.reserveBudget({ reservation: { reservationId: "reservation-2", budgetId: "budget-1", providerId: "provider-1", amount: { currency: "USD", nanoUnits: "70" }, state: "RESERVED", createdAt: "2026-08-15T00:00:02.000Z" }, expectedBudgetVersion: 2 }), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT");
    assert.deepEqual(repository.reserveBudget({ reservation: { reservationId: "reservation-3", budgetId: "budget-1", providerId: "provider-1", amount: { currency: "USD", nanoUnits: "50" }, state: "RESERVED", createdAt: "2026-08-15T00:00:03.000Z" }, expectedBudgetVersion: 2 }), { reservationId: "reservation-3", budgetVersion: 3 });
    assert.throws(() => repository.reserveBudget({ reservation: { reservationId: "reservation-4", budgetId: "budget-1", providerId: "provider-1", amount: { currency: "EUR", nanoUnits: "1" }, state: "RESERVED", createdAt: "2026-08-15T00:00:04.000Z" }, expectedBudgetVersion: 3 }), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID");
  });
});
