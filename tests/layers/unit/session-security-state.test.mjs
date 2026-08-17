import { strict as assert } from "node:assert";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  isSessionCooldownActive,
  progressiveCooldownMs,
  validateSessionSecurityState,
} from "../../../packages/protocol/src/session-runtime.mts";
import { applyCoreMigrations, CoreSchemaError, CoreStateRepository } from "../../../services/core/src/schema.ts";
import { CorePersistenceError, openCoreDatabase } from "../../../services/core/src/persistence.ts";

const TEST_DB_DEK = Buffer.alloc(32, 0x42);
const NOW = "2026-08-15T00:00:00.000Z";
const USER_ID = "local-user";
const SESSION_ID = "0190f2b0-0000-7000-8000-000000000001";

async function withDatabase(testBody) {
  const root = join(tmpdir(), `jarvis-session-${process.pid}-${Date.now()}-${Math.random()}`);
  await mkdir(root, { recursive: true });
  const connection = openCoreDatabase(join(root, "state.db"), { dbDek: TEST_DB_DEK });
  try {
    applyCoreMigrations(connection, () => NOW);
    await testBody(connection, new CoreStateRepository(connection));
  } finally {
    connection.close();
    await rm(root, { recursive: true, force: true });
  }
}

function verifier() {
  return {
    profileId: "session-password-v1",
    purpose: "SESSION_PASSWORD",
    algorithm: "ARGON2ID",
    version: 0x13,
    memoryKiB: 65_536,
    iterations: 3,
    parallelism: 4,
    salt: Buffer.alloc(16, 0x51),
    verifier: Buffer.alloc(32, 0x52),
  };
}

function strongerVerifier(seed = 0x61, memoryKiB = 131_072, iterations = 4) {
  return {
    ...verifier(),
    memoryKiB,
    iterations,
    salt: Buffer.alloc(16, seed),
    verifier: Buffer.alloc(32, seed + 1),
  };
}

function evidence(eventId, eventType = "SESSION_AUTHENTICATION") {
  return { userId: USER_ID, sessionId: SESSION_ID, now: NOW, eventId, eventType, correlationId: eventId };
}

test("session security validation enforces locked and unlocked invariants and bounded cooldown", () => {
  assert.equal(progressiveCooldownMs(1), 1_000);
  assert.equal(progressiveCooldownMs(2), 2_000);
  assert.equal(progressiveCooldownMs(31), 900_000);
  assert.throws(() => progressiveCooldownMs(32), /invalid/iu);
  const locked = validateSessionSecurityState({ userId: USER_ID, state: "LOCKED", sessionId: null, unlockedAt: null, lockedReason: "STARTUP", failedUnlockAttempts: 0, cooldownUntil: null });
  assert.equal(isSessionCooldownActive(locked, NOW), false);
  assert.throws(() => validateSessionSecurityState({ ...locked, state: "UNLOCKED", sessionId: SESSION_ID }), /UNLOCKED session/iu);
  assert.throws(() => validateSessionSecurityState({ ...locked, failedUnlockAttempts: 32 }), /failedUnlockAttempts/iu);
});

test("session password verifier and locked state are initialized atomically, then wrong attempts progressively cool down and correct verification unlocks", async () => {
  await withDatabase(async (connection, repository) => {
    assert.deepEqual(repository.initializeSession(evidence("0190f2b0-0000-7000-8000-000000000010"), verifier()), { version: 1, state: { userId: USER_ID, state: "LOCKED", sessionId: null, unlockedAt: null, lockedReason: "STARTUP", failedUnlockAttempts: 0, cooldownUntil: null } });
    assert.equal(repository.getSessionPasswordVerifier().verifier.length, 32);
    assert.equal(repository.getSessionSecurityState().state, "LOCKED");
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM session_security_state").get().count, 1);
    assert.doesNotMatch(connection.database.prepare("SELECT state_json || verifier_json AS value FROM session_security_state CROSS JOIN session_auth_verifiers").get()?.value ?? "", /live-password|secret-value|raw-key/iu);

    const firstFailure = repository.authenticateSession({ ...evidence("0190f2b0-0000-7000-8000-000000000011"), passwordVerified: false });
    assert.equal(firstFailure.status, "DENIED");
    assert.equal(firstFailure.retryAfterMs, 1_000);
    const cooldown = repository.authenticateSession({ ...evidence("0190f2b0-0000-7000-8000-000000000012", "SESSION_AUTH_COOLDOWN"), now: "2026-08-15T00:00:00.500Z", passwordVerified: false });
    assert.equal(cooldown.status, "COOLDOWN");
    assert.equal(repository.getSessionSecurityState().failedUnlockAttempts, 1);

    const secondFailure = repository.authenticateSession({ ...evidence("0190f2b0-0000-7000-8000-000000000013"), now: "2026-08-15T00:00:01.100Z", passwordVerified: false });
    assert.equal(secondFailure.retryAfterMs, 2_000);
    const unlocked = repository.authenticateSession({ ...evidence("0190f2b0-0000-7000-8000-000000000014"), now: "2026-08-15T00:00:03.200Z", passwordVerified: true });
    assert.equal(unlocked.status, "UNLOCKED");
    assert.equal(unlocked.state.state, "UNLOCKED");
    assert.equal(unlocked.state.failedUnlockAttempts, 0);
    assert.equal(repository.lockSession({ ...evidence("0190f2b0-0000-7000-8000-000000000015", "SESSION_LOCK") , now: "2026-08-15T00:00:04.000Z" }).state.lockedReason, "USER");
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM events WHERE aggregate_type = 'SESSION_SECURITY'").get().count, 5);
  });
});

test("session authentication rolls back the state transition when causative evidence conflicts", async () => {
  await withDatabase(async (connection, repository) => {
    const initEvent = "0190f2b0-0000-7000-8000-000000000020";
    repository.initializeSession(evidence(initEvent), verifier());
    assert.throws(
      () => repository.authenticateSession({ ...evidence(initEvent), now: "2026-08-15T00:00:02.000Z", passwordVerified: false }),
      (error) => error instanceof CorePersistenceError,
    );
    assert.equal(repository.getSessionSecurityState().failedUnlockAttempts, 0);
    assert.equal(connection.database.prepare("SELECT COUNT(*) AS count FROM session_security_state").get().count, 1);
  });
});

test("an authenticated session can atomically upgrade its verifier, while explicit recovery reset requires verified non-secret evidence", async () => {
  await withDatabase(async (connection, repository) => {
    repository.initializeSession(evidence("0190f2b0-0000-7000-8000-000000000030"), verifier());
    repository.authenticateSession({
      ...evidence("0190f2b0-0000-7000-8000-000000000031"),
      now: "2026-08-15T00:00:01.000Z",
      passwordVerified: true,
    });

    const upgraded = repository.upgradeSessionPasswordVerifier({
      ...evidence("0190f2b0-0000-7000-8000-000000000032", "SESSION_PASSWORD_REHASH_AFTER_AUTH"),
      now: "2026-08-15T00:00:02.000Z",
      expectedVerifierVersion: 1,
      replacementVerifier: strongerVerifier(),
      kind: "REHASH_AFTER_AUTH",
      currentVerifierVerified: true,
    });
    assert.deepEqual(upgraded, { version: 2, profileId: "session-password-v1" });
    assert.equal(repository.getSessionPasswordVerifierRecord().version, 2);
    assert.equal(repository.getSessionPasswordVerifier().memoryKiB, 131_072);
    assert.throws(
      () => repository.upgradeSessionPasswordVerifier({
        ...evidence("0190f2b0-0000-7000-8000-000000000033", "SESSION_PASSWORD_REHASH_AFTER_AUTH"),
        now: "2026-08-15T00:00:03.000Z",
        expectedVerifierVersion: 2,
        replacementVerifier: verifier(),
        kind: "REHASH_AFTER_AUTH",
        currentVerifierVerified: true,
      }),
      (error) => error instanceof CoreSchemaError,
    );

    assert.throws(
      () => repository.resetSessionPasswordAfterRecovery({
        ...evidence("0190f2b0-0000-7000-8000-000000000034", "SESSION_PASSWORD_RECOVERY_RESET"),
        now: "2026-08-15T00:00:03.000Z",
        expectedSessionVersion: 2,
        expectedVerifierVersion: 2,
        replacementVerifier: verifier(),
        explicitConfirmation: true,
        recoveryEvidence: {
          type: "GENERATED_RECOVERY_V1",
          evidenceId: "0190f2b0-0000-4000-8000-000000000035",
          backupId: "0190f2b0-0000-7000-8000-000000000036",
          slotId: "generated-recovery",
          descriptorDigestSha256: "A".repeat(43),
          verifiedAt: NOW,
        },
      }),
      (error) => error instanceof CoreSchemaError,
    );

    repository.lockSession({
      ...evidence("0190f2b0-0000-7000-8000-000000000037", "SESSION_LOCK"),
      now: "2026-08-15T00:00:03.000Z",
    });
    const reset = repository.resetSessionPasswordAfterRecovery({
      ...evidence("0190f2b0-0000-7000-8000-000000000038", "SESSION_PASSWORD_RECOVERY_RESET"),
      now: "2026-08-15T00:00:04.000Z",
      expectedSessionVersion: 3,
      expectedVerifierVersion: 2,
      replacementVerifier: verifier(),
      explicitConfirmation: true,
      recoveryEvidence: {
        type: "GENERATED_RECOVERY_V1",
        evidenceId: "0190f2b0-0000-4000-8000-000000000035",
        backupId: "0190f2b0-0000-7000-8000-000000000036",
        slotId: "generated-recovery",
        descriptorDigestSha256: "A".repeat(43),
        verifiedAt: NOW,
      },
    });
    assert.deepEqual(reset, { version: 3, profileId: "session-password-v1" });
    assert.equal(repository.getSessionSecurityState().state, "LOCKED");
    assert.equal(repository.getSessionSecurityState().failedUnlockAttempts, 0);
    assert.throws(
      () => repository.resetSessionPasswordAfterRecovery({
        ...evidence("0190f2b0-0000-7000-8000-000000000039", "SESSION_PASSWORD_RECOVERY_RESET"),
        now: "2026-08-15T00:00:05.000Z",
        expectedSessionVersion: 3,
        expectedVerifierVersion: 2,
        replacementVerifier: verifier(),
        explicitConfirmation: true,
        recoveryEvidence: {
          type: "GENERATED_RECOVERY_V1",
          evidenceId: "0190f2b0-0000-4000-8000-000000000035",
          backupId: "0190f2b0-0000-7000-8000-000000000036",
          slotId: "generated-recovery",
          descriptorDigestSha256: "A".repeat(43),
          verifiedAt: NOW,
        },
      }),
      (error) => error instanceof CoreSchemaError,
    );
    const evidenceText = connection.database
      .prepare("SELECT payload_json FROM events WHERE aggregate_type IN ('SESSION_PASSWORD_VERIFIER', 'SESSION_SECURITY')")
      .all()
      .map((row) => row.payload_json)
      .join("\n");
    assert.doesNotMatch(evidenceText, /recovery-secret|live-password|derived-key/iu);
  });
});

test("platform lock reasons map into the authoritative locked state and clear the active session", async () => {
  await withDatabase(async (_connection, repository) => {
    repository.initializeSession(evidence("0190f2b0-0000-7000-8000-000000000040"), verifier());
    repository.authenticateSession({
      ...evidence("0190f2b0-0000-7000-8000-000000000041"),
      now: "2026-08-15T00:00:01.000Z",
      passwordVerified: true,
    });
    const locked = repository.lockSessionForPlatform({
      ...evidence("0190f2b0-0000-7000-8000-000000000042", "SESSION_LOCK_OS"),
      now: "2026-08-15T00:00:02.000Z",
      reason: "OS_SESSION_LOCK",
    });
    assert.equal(locked.state.state, "LOCKED");
    assert.equal(locked.state.lockedReason, "OS_SESSION_LOCK");
    assert.equal(locked.state.sessionId, null);
    assert.throws(
      () => repository.lockSessionForPlatform({
        ...evidence("0190f2b0-0000-7000-8000-000000000043", "SESSION_LOCK_INVALID"),
        reason: "USER",
      }),
      /reason is invalid/iu,
    );
  });
});
