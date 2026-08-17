import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateReleaseTrustRecord, validateTrustedUpdateMetadata } from "../../../packages/protocol/src/update-trust-runtime.mts";
import { applyCoreMigrations, CoreSchemaError, CoreStateRepository } from "../../../services/core/src/schema.ts";
import { openCoreDatabase } from "../../../services/core/src/persistence.ts";

const TEST_DB_DEK = Buffer.alloc(32, 0x42);
const now = "2026-08-15T00:00:00.000Z";
const digest = "a".repeat(64);
const role = { version: "1", sha256: digest, keyIds: ["key-1", "key-2", "key-3"], threshold: 2, custodyClass: "OFFLINE" };
const metadata = { metadataId: "metadata-1", tufSpecVersion: "1.0.35", trustedRootVersion: "1", trustedRootSha256: digest, roles: { root: role, targets: role, snapshot: role, timestamp: { ...role, threshold: 1, custodyClass: "ONLINE_MINIMAL" }, modules: role }, metadataVersion: "1", metadataSha256: digest, minimumSecurityEpoch: "1", observedAt: now, expiresAt: "2026-09-15T00:00:00.000Z", state: "TRUSTED" };
const release = { releaseId: "release-1", jarvisVersion: "1.0.6", releaseSequence: "1", securityEpoch: "1", platform: "WINDOWS", runtimeRole: "FULL_HOST", architecture: "x64", sourceCommitSha: "a".repeat(40), artifactSha256: digest, tufTargetPath: "targets/jarvis.exe", tufTargetMetadataVersion: "1", rollbackPolicy: "NORMAL_ONLY", revoked: false };

async function withDatabase(testBody) {
  const root = join(tmpdir(), `jarvis-update-trust-${process.pid}-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  const connection = openCoreDatabase(join(root, "state.db"), { dbDek: TEST_DB_DEK });
  try { await testBody(connection, new CoreStateRepository(connection)); } finally { connection.close(); await rm(root, { recursive: true, force: true }); }
}

test("update trust validators preserve TUF role floors and reject malformed release metadata", () => {
  assert.equal(validateTrustedUpdateMetadata(metadata).tufSpecVersion, "1.0.35");
  assert.equal(validateReleaseTrustRecord(release).releaseSequence, "1");
  assert.throws(() => validateTrustedUpdateMetadata({ ...metadata, tufSpecVersion: "1.1.0" }));
  assert.throws(() => validateReleaseTrustRecord({ ...release, releaseSequence: "01" }));
});

test("trusted metadata and release floors reject rollback while incidents and operation states remain durable", async () => {
  await withDatabase(async (connection, repository) => {
    applyCoreMigrations(connection);
    assert.deepEqual(repository.putTrustedUpdateMetadata(metadata, now), { id: "metadata-1", version: 1 });
    assert.throws(() => repository.putTrustedUpdateMetadata({ ...metadata, metadataId: "metadata-2", metadataVersion: "0" }, now), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT");
    assert.deepEqual(repository.putReleaseTrustRecord(release, now), { id: "release-1", version: 1 });
    assert.throws(() => repository.putReleaseTrustRecord({ ...release, releaseId: "release-old", releaseSequence: "0" }, now), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT");
    assert.deepEqual(repository.appendUpdateIncident({ incidentId: "incident-1", reason: "UPDATE_ROLLBACK_BLOCKED", releaseId: "release-old", observedAt: now, details: "lower release sequence" }), { incidentId: "incident-1" });
    assert.deepEqual(repository.putUpdateOperation({ operationId: "operation-1", kind: "UPDATE", state: "STARTED", startedAt: now, metadataRef: "metadata-1" }, now), { id: "operation-1", version: 1 });
    assert.deepEqual(repository.putUpdateOperation({ operationId: "operation-1", kind: "UPDATE", state: "COMMITTED", startedAt: now, completedAt: now, metadataRef: "metadata-1" }, now), { id: "operation-1", version: 2 });
    assert.throws(() => repository.putUpdateOperation({ operationId: "operation-1", kind: "UPDATE", state: "STARTED", startedAt: now }, now), (error) => error instanceof CoreSchemaError && error.code === "PERSISTENCE_CONFLICT");
  });
});
