import { strict as assert } from "node:assert";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateDomainEvent } from "../../../packages/protocol/src/domain-event-runtime.mts";
import { applyCoreMigrations, CoreSchemaError, CoreStateRepository } from "../../../services/core/src/schema.ts";
import { openCoreDatabase } from "../../../services/core/src/persistence.ts";

const TEST_DB_DEK = Buffer.alloc(32, 0x42);
const EVENT = {
  eventId: "0192f2d0-7abc-7def-8abc-1234567890ab",
  occurredAt: "2026-08-15T00:00:00.000Z",
  type: "task.created",
  payloadVersion: 1,
  aggregateType: "task",
  aggregateId: "task-1",
  correlationId: "0192f2d0-7abd-7def-8abc-1234567890ab",
  causationId: "0192f2d0-7abe-7def-8abc-1234567890ab",
  actorType: "CORE",
  actorId: "core",
  payload: { state: "READY", attempt: 1 },
};

test("domain event validation enforces the contract envelope and rejects secret-bearing payloads", () => {
  const validated = validateDomainEvent(EVENT);
  assert.equal(validated.eventId, EVENT.eventId);
  assert.equal(Object.isFrozen(validated), true);
  assert.throws(() => validateDomainEvent({ ...EVENT, actorType: "UNKNOWN" }), /actorType is invalid/);
  assert.throws(() => validateDomainEvent({ ...EVENT, payload: { accessToken: "never-store" } }), /secret-bearing/);
});

test("domain event append is durable, versioned, deduplicated, and publishes only after commit", async () => {
  const root = join(tmpdir(), `jarvis-domain-event-${process.pid}-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  const databasePath = join(root, "state.db");
  try {
    const firstConnection = openCoreDatabase(databasePath, { dbDek: TEST_DB_DEK });
    applyCoreMigrations(firstConnection, () => "2026-08-15T00:00:00.000Z");
    const firstRepository = new CoreStateRepository(firstConnection);
    const published = [];
    firstRepository.onDomainEventCommitted((event) => published.push(event.eventId));
    firstRepository.onDomainEventCommitted(() => { throw new Error("consumer failure"); });
    assert.deepEqual(
      firstRepository.appendDomainEvent(EVENT, { sourceType: "PROXMOX", sourceId: "cluster-a", deduplicationKey: "event-1" }),
      { eventId: EVENT.eventId, aggregateVersion: 1, duplicate: false },
    );
    assert.deepEqual(published, [EVENT.eventId]);
    firstConnection.close();

    const secondConnection = openCoreDatabase(databasePath, { dbDek: TEST_DB_DEK });
    applyCoreMigrations(secondConnection, () => "2026-08-15T00:00:01.000Z");
    const secondRepository = new CoreStateRepository(secondConnection);
    assert.deepEqual(
      secondRepository.appendDomainEvent({ ...EVENT, eventId: "0192f2d0-7abf-7def-8abc-1234567890ab" }, { sourceType: "PROXMOX", sourceId: "cluster-a", deduplicationKey: "event-1" }),
      { eventId: EVENT.eventId, aggregateVersion: 1, duplicate: true },
    );
    assert.equal(secondConnection.database.prepare("SELECT COUNT(*) AS count FROM events").get().count, 1);
    assert.equal(secondConnection.database.prepare("SELECT COUNT(*) AS count FROM event_provenance").get().count, 1);
    assert.equal(secondConnection.database.prepare("SELECT COUNT(*) AS count FROM domain_event_envelopes").get().count, 1);
    secondConnection.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("domain event listener registration rejects non-functions", async () => {
  const root = join(tmpdir(), `jarvis-domain-event-listener-${process.pid}-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  const connection = openCoreDatabase(join(root, "state.db"), { dbDek: TEST_DB_DEK });
  try {
    applyCoreMigrations(connection);
    const repository = new CoreStateRepository(connection);
    assert.throws(() => repository.onDomainEventCommitted(null), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_SCHEMA_INVALID");
  } finally {
    connection.close();
    await rm(root, { recursive: true, force: true });
  }
});
