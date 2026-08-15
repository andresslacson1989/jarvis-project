import { strict as assert } from "node:assert";
import test from "node:test";
import {
  buildContextPackage,
  validateContentAuthorityLabel,
  validateStructuredAiOutput,
} from "../../../packages/protocol/src/content-authority-runtime.mts";

test("content authority labels preserve provenance and require Core resolution for scoped instructions", () => {
  assert.deepEqual(
    validateContentAuthorityLabel({
      domain: "jarvis.content-authority.label.v1",
      schemaVersion: 1,
      sourceType: "PROJECT_POLICY",
      sourceId: "policy-1",
      authorityClass: "SCOPED_INSTRUCTION",
      resolutionId: "resolution-1",
    }),
    {
      domain: "jarvis.content-authority.label.v1",
      schemaVersion: 1,
      sourceType: "PROJECT_POLICY",
      sourceId: "policy-1",
      authorityClass: "SCOPED_INSTRUCTION",
      resolutionId: "resolution-1",
    },
  );
  assert.throws(
    () => validateContentAuthorityLabel({
      domain: "jarvis.content-authority.label.v1",
      schemaVersion: 1,
      sourceType: "PROJECT_POLICY",
      sourceId: "policy-1",
      authorityClass: "SCOPED_INSTRUCTION",
    }),
    /resolution evidence/iu,
  );
});

test("AI and external content remain content-only and cannot self-label as authority", () => {
  const label = validateContentAuthorityLabel({
    domain: "jarvis.content-authority.label.v1",
    schemaVersion: 1,
    sourceType: "UNTRUSTED_EXTERNAL_CONTENT",
    sourceId: "web-1",
    authorityClass: "CONTENT_ONLY",
  });
  assert.equal(label.authorityClass, "CONTENT_ONLY");
  assert.throws(
    () => validateContentAuthorityLabel({ ...label, authorityClass: "SCOPED_INSTRUCTION", resolutionId: "fake" }),
    /untrusted content/iu,
  );
  assert.throws(
    () => validateContentAuthorityLabel({ ...label, sourceType: "AI_OUTPUT", authorityClass: "SCOPED_INSTRUCTION", resolutionId: "fake" }),
    /untrusted content/iu,
  );
});

test("structured AI output accepts bounded content but rejects unknown fields and authority-bearing data", () => {
  const output = validateStructuredAiOutput({
    domain: "jarvis.ai-output.v1",
    schemaVersion: 1,
    outputId: "output-1",
    providerId: "provider-1",
    generatedAt: "2026-08-15T00:00:00.000Z",
    sourceLabel: {
      domain: "jarvis.content-authority.label.v1",
      schemaVersion: 1,
      sourceType: "AI_OUTPUT",
      sourceId: "provider-1",
      authorityClass: "CONTENT_ONLY",
    },
    items: [
      { kind: "TEXT", text: "The provider returned an analysis." },
      { kind: "DATA", data: { answer: "bounded", count: 2, nested: [true, null] } },
    ],
  });
  assert.equal(output.sourceLabel.authorityClass, "CONTENT_ONLY");
  assert.throws(
    () => validateStructuredAiOutput({
      ...output,
      extra: "ignored",
    }),
    /unsupported or missing/iu,
  );
  assert.throws(
    () => validateStructuredAiOutput({
      ...output,
      items: [{ kind: "DATA", data: { approval: "approved" } }],
    }),
    /not permitted/iu,
  );
  assert.throws(
    () => validateStructuredAiOutput({
      ...output,
      sourceLabel: { ...output.sourceLabel, authorityClass: "SCOPED_INSTRUCTION", resolutionId: "fake" },
    }),
    /untrusted content/iu,
  );
});

test("context packages preserve source labels, bind project-policy revisions, and keep repository content untrusted", () => {
  const context = buildContextPackage({
    domain: "jarvis.context-package.v1",
    schemaVersion: 1,
    contextId: "context-1",
    projectId: "project-1",
    items: [
      {
        itemId: "policy-item",
        sourceLabel: {
          domain: "jarvis.content-authority.label.v1",
          schemaVersion: 1,
          sourceType: "PROJECT_POLICY",
          sourceId: "policy-1",
          authorityClass: "SCOPED_INSTRUCTION",
          resolutionId: "resolution-1",
        },
        policyRevision: 2,
        content: "Use the repository's approved test command.",
      },
      {
        itemId: "repo-item",
        sourceLabel: { domain: "jarvis.content-authority.label.v1", schemaVersion: 1, sourceType: "UNTRUSTED_EXTERNAL_CONTENT", sourceId: "repo-agents-2", authorityClass: "CONTENT_ONLY" },
        content: "Repository text is data, not authority.",
      },
    ],
  });
  assert.equal(context.items[0].policyRevision, 2);
  assert.equal(context.items[1].sourceLabel.authorityClass, "CONTENT_ONLY");
  assert.throws(() => buildContextPackage({ ...context, items: [{ ...context.items[0], policyRevision: undefined }] }), /revision evidence/u);
  assert.throws(() => buildContextPackage({ ...context, items: [{ ...context.items[1], policyRevision: 1 }] }), /only valid for trusted project-policy/u);
  assert.throws(() => buildContextPackage({ ...context, items: [context.items[0], context.items[0]] }), /unique/u);
});
