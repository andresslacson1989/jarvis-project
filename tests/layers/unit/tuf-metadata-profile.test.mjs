import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeTufReleaseMetadata } from "../../helpers/tuf-release-fixture.mjs";
import {
  ROLLBACK_POLICY,
  TufMetadataProfileError,
  verifyTufMetadataProfile,
} from "../../../tools/release/verify-tuf-metadata-profile.mjs";

const custom = {
  tufSpecVersion: "1.0.35",
  releaseId: "1.0.6",
  jarvisVersion: "1.0.6",
  releaseSequence: 7,
  securityEpoch: 2,
  sourceCommitSha: "a".repeat(40),
  platform: "WINDOWS",
  runtimeRole: "FULL_HOST",
  architecture: "x64",
  rollbackPolicy: ROLLBACK_POLICY,
};

async function fixture(productionProfile, overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), "jarvis-tuf-profile-"));
  const bytes = Buffer.from('{"release":"fixture"}\n', "utf8");
  await writeTufReleaseMetadata({
    metadataDirectory: join(root, "metadata"),
    targetBytes: bytes,
    custom: { ...custom, ...overrides },
    productionProfile,
  });
  return { root, metadataDirectory: join(root, "metadata") };
}

test("production TUF profile verifies separated roles, thresholds, signatures, expiry, and target identity", async () => {
  const { root, metadataDirectory } = await fixture(true);
  try {
    const result = await verifyTufMetadataProfile({ metadataDirectory });
    assert.equal(result.profile, "1.0.35");
    assert.equal(result.productionProfileShape, "PASS");
    assert.equal(result.keyCustodyEvidence, "EXTERNAL_REQUIRED");
    assert.equal(result.roles.root.threshold, 2);
    assert.equal(result.roles.root.keyIDs.length, 3);
    assert.equal(result.roles.targets.threshold, 2);
    assert.equal(result.roles.modules.threshold, 2);
    assert.equal(result.target.releaseId, "1.0.6");
    assert.equal(result.target.releaseSequence, 7);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("production TUF profile rejects missing module delegation and unsafe rollback policy", async () => {
  const missingModules = await fixture(false);
  try {
    await assert.rejects(
      verifyTufMetadataProfile({ metadataDirectory: missingModules.metadataDirectory }),
      (error) => error instanceof TufMetadataProfileError && /modules delegated targets role is missing/u.test(error.message),
    );
  } finally {
    await rm(missingModules.root, { recursive: true, force: true });
  }

  const unsafeRollback = await fixture(true, { rollbackPolicy: "SIGNATURE_ONLY" });
  try {
    await assert.rejects(
      verifyTufMetadataProfile({ metadataDirectory: unsafeRollback.metadataDirectory }),
      (error) => error instanceof TufMetadataProfileError && /unsupported rollback policy/u.test(error.message),
    );
  } finally {
    await rm(unsafeRollback.root, { recursive: true, force: true });
  }
});
