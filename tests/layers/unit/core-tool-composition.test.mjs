import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { CoreNativeCapabilityClient } from "../../../services/core/src/native-capability.mjs";
import { CoreBootstrap } from "../../../services/core/src/main.ts";
import { CoreStateRepository } from "../../../services/core/src/schema.ts";
import { writeTufReleaseMetadata } from "../../helpers/tuf-release-fixture.mjs";

const DB_DEK = Buffer.alloc(32, 0x42);
const EXECUTION_ID = "018f0000-0000-7000-8000-000000000301";
const NOW = "2026-08-17T00:00:00.000Z";

async function createReleaseRoot() {
  const root = join(tmpdir(), `jarvis-core-tool-composition-${process.pid}-${Date.now()}`);
  const entrypoint = join(root, "core", "dist", "main.js");
  const metadataDirectory = join(root, "tuf", "metadata");
  await mkdir(join(root, "core", "dist"), { recursive: true });
  await writeFile(entrypoint, "export {};\n");
  const manifest = {
    jarvisReleaseVersion: "0.0.0",
    releaseSequence: 1,
    securityEpoch: 1,
    sourceCommitSha: "a".repeat(40),
    releaseDistributionScope: "PRIVATE_INTERNAL",
    publicDistributionSupported: false,
    windowsSigning: {
      trustMode: "PRIVATE_INTERNAL_AUTHENTICODE",
      certificateThumbprint: "23DA4DA3E340B66EC4240B4CC845E4387E5BBDD3",
      authorizedTargetScope: "CURRENT_USER_ONLY",
      trustEnrollment: "CURRENT_USER_TRUSTEDPUBLISHER_AND_ROOT",
      timestampEvidence: "ABSENT_PUBLIC_TIMESTAMP_PRIVATE_INTERNAL",
    },
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8");
  await writeFile(join(root, "runtime-manifest.json"), manifestBytes);
  await writeTufReleaseMetadata({
    metadataDirectory,
    targetBytes: manifestBytes,
    custom: {
      tufSpecVersion: "1.0.35",
      releaseId: manifest.jarvisReleaseVersion,
      jarvisVersion: manifest.jarvisReleaseVersion,
      releaseSequence: manifest.releaseSequence,
      securityEpoch: manifest.securityEpoch,
      sourceCommitSha: manifest.sourceCommitSha,
      platform: "WINDOWS",
      runtimeRole: "FULL_HOST",
      architecture: "x64",
    },
  });
  return { root, entrypoint, metadataDirectory };
}

test("bootstrapped Core produces pre-ALLOW facts and executes through the typed native status boundary", async () => {
  const release = await createReleaseRoot();
  const databaseRoot = join(release.root, "data");
  await mkdir(databaseRoot, { recursive: true });
  const databasePath = join(databaseRoot, "state.db");
  const bootstrap = new CoreBootstrap();
  const transport = {
    async write(frame) {
      assert.equal(frame.payload.capability, "status.system");
      const core = {
        protocolMajor: 1,
        platform: "WINDOWS",
        runtimeRole: "FULL_HOST",
        architecture: "x64",
        serviceState: "LOCKED",
        transportState: "NOT_CONNECTED",
      };
      const platform = { platform: "WINDOWS", runtimeRole: "FULL_HOST", architecture: "x64", backendProfileId: "windows-v1" };
      client.handleResponse({ ok: true, result: { core, platform }, correlationId: frame.correlationId });
    },
  };
  const client = new CoreNativeCapabilityClient(transport);
  try {
    await bootstrap.start({
      JARVIS_CORE_ROOT: release.root,
      JARVIS_CORE_ENTRYPOINT: release.entrypoint,
      JARVIS_TUF_METADATA_DIR: release.metadataDirectory,
      JARVIS_DATABASE_PATH: databasePath,
    }, DB_DEK);

    const repository = new CoreStateRepository(bootstrap.database);
    repository.putPermissionDecision({
      decisionId: "decision-core-tool-1",
      toolExecutionId: EXECUTION_ID,
      outcome: "ALLOW",
      contextualRisk: "LOW",
      reasonCodes: ["TEST_AUTHORIZED"],
      matchedPolicyIds: [],
      matchedPrecedentIds: [],
      decidedAt: NOW,
      policyVersion: 1,
    });
    bootstrap.attachNativeCapabilityClient(client);
    const result = await bootstrap.executeTool({
      protocolVersion: 1,
      kind: "request",
      id: EXECUTION_ID,
      name: "execute_tool",
      correlationId: EXECUTION_ID,
      payload: {
        toolExecutionId: EXECUTION_ID,
        toolId: "jarvis.status.project-system",
        toolVersion: 1,
        executionScope: { kind: "SYSTEM" },
        authorityEnvelopeId: "018f0000-0000-7000-8000-000000000302",
        arguments: { query: "SYSTEM" },
      },
    });

    assert.equal(result.outcome, "SUCCEEDED");
    assert.equal(result.output?.query, "SYSTEM");
    assert.equal(result.output?.system?.platform?.backendProfileId, "windows-v1");
    const audit = bootstrap.database.database
      .prepare("SELECT event_type, subject_id, audit_json FROM audit_events WHERE subject_id = ?")
      .get(EXECUTION_ID);
    assert.equal(audit.event_type, "TOOL_EXECUTION");
    assert.equal(audit.subject_id, EXECUTION_ID);
    assert.equal(JSON.parse(audit.audit_json).reasonCode, "TOOL_EXECUTION_SUCCEEDED");
  } finally {
    bootstrap.stop();
    await rm(release.root, { recursive: true, force: true });
  }
});
