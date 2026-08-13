import { strict as assert } from "node:assert";
import { createServer } from "node:net";
import { Readable } from "node:stream";
import test from "node:test";
import {
  authenticateCoreTransport,
  computeBootstrapProofForTest,
  connectCoreTransport,
  constantTimeProofEqualForTest,
  encodeBootstrapFrame,
  handshakeConstantsForTest,
  parseBootstrapFrame,
  readBootstrapMaterial,
} from "../../../services/core/src/ipc-bootstrap.ts";

const WINDOWS_ONLY = process.platform !== "win32" ? "requires Windows named-pipe support" : false;

test("bootstrap material is bounded, exact, and secret-bearing only in memory", () => {
  const { secretBytes } = handshakeConstantsForTest();
  const material = {
    endpoint: "\\\\.\\pipe\\jarvis-core-0123456789abcdef0123456789abcdef",
    protocolMajor: 1,
    secret: Buffer.alloc(secretBytes, 0x42),
  };
  const frame = encodeBootstrapFrame(material);
  const decoded = parseBootstrapFrame(frame);
  assert.equal(decoded.endpoint, material.endpoint);
  assert.deepEqual(decoded.secret, material.secret);
  assert.throws(
    () => parseBootstrapFrame(Buffer.concat([Buffer.from([0xff, 0xff, 0xff, 0x7f]), Buffer.alloc(8)])),
    (error) => error.code === "BOOTSTRAP_TOO_LARGE",
  );
});

test("bootstrap channel rejects missing or malformed material", async () => {
  await assert.rejects(
    readBootstrapMaterial(Readable.from([])),
    (error) => error.code === "BOOTSTRAP_REQUIRED",
  );
  await assert.rejects(
    readBootstrapMaterial(Readable.from([Buffer.from([1, 0, 0, 0, 0xff])])),
    (error) => error.code === "BOOTSTRAP_MALFORMED",
  );
});

test("Core-side named-pipe handshake proves protocol and bootstrap secret", {
  skip: WINDOWS_ONLY || process.env.JARVIS_TEST_PROFILE !== "qualification",
}, async () => {
  const { secretBytes, nonceBytes } = handshakeConstantsForTest();
  const endpoint = `\\\\.\\pipe\\jarvis-core-${Buffer.from(cryptoRandomBytes(16)).toString("hex")}`;
  const material = {
    endpoint,
    protocolMajor: 1,
    secret: Buffer.alloc(secretBytes, 0x5a),
  };
  const server = createServer((socket) => {
    const nonce = Buffer.alloc(nonceBytes, 0x19);
    socket.write(frame({
      kind: "challenge",
      protocolMajor: 1,
      supportedProtocolMajors: [1],
      nonce: nonce.toString("hex"),
    }));
    let buffered = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      buffered = Buffer.concat([buffered, chunk]);
      if (buffered.length < 4) return;
      const length = buffered.readUInt32LE(0);
      if (buffered.length < length + 4) return;
      const hello = JSON.parse(buffered.subarray(4, length + 4).toString("utf8"));
      assert.equal(hello.kind, "hello");
      assert.equal(hello.protocolMajor, 1);
      assert.equal(
        hello.proof,
        computeBootstrapProofForTest(material.secret, 1, nonce).toString("hex"),
      );
      socket.write(frame({ kind: "welcome", protocolMajor: 1 }));
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(endpoint, resolve);
  });
  try {
    const decoded = await readBootstrapMaterial(Readable.from([encodeBootstrapFrame(material)]));
    const socket = await connectCoreTransport(decoded.endpoint);
    const authenticated = await authenticateCoreTransport(decoded, socket);
    assert.equal(authenticated.protocolMajor, 1);
    assert.equal(constantTimeProofEqualForTest(material.secret, decoded.secret), true);
    socket.destroy();
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

function frame(value) {
  const payload = Buffer.from(JSON.stringify(value), "utf8");
  const result = Buffer.alloc(4 + payload.length);
  result.writeUInt32LE(payload.length, 0);
  payload.copy(result, 4);
  return result;
}

function cryptoRandomBytes(length) {
  const result = Buffer.alloc(length);
  for (let index = 0; index < result.length; index += 1) result[index] = (index * 73 + 19) & 0xff;
  return result;
}
