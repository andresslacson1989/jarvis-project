import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Key, MetaFile, Metadata, Root, Signature, Snapshot, TargetFile, Targets, Timestamp } from "@tufjs/models";
import { canonicalize } from "@tufjs/canonical-json";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const expires = (days) => new Date(Date.now() + days * 86400000).toISOString();
const bytes = (metadata) => Buffer.from(`${JSON.stringify(metadata.toJSON(), null, 2)}\n`, "utf8");
const metaFile = (metadata) => {
  const value = bytes(metadata);
  return new MetaFile({ version: metadata.signed.version, length: value.length, hashes: { sha256: digest(value) } });
};
class Delegations {
  constructor(keys, roles) { this.keys = keys; this.roles = roles; }
  toJSON() { return { keys: Object.fromEntries(Object.entries(this.keys).map(([id, key]) => [id, key.toJSON()])), roles: Object.entries(this.roles).map(([name, role]) => ({ name, ...role })) }; }
}

function keyFromPublic(publicHex, keyId) {
  return new Key({ keyID: keyId, keyType: "ed25519", scheme: "ed25519", keyVal: { public: publicHex } });
}

function pair() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicHex = publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("hex");
  const document = { keytype: "ed25519", scheme: "ed25519", keyval: { public: publicHex } };
  const keyId = digest(canonicalize(document));
  return { key: keyFromPublic(publicHex, keyId), privateKey, keyId };
}

async function rootPair(path) {
  const privateKey = createPrivateKey({ key: await readFile(path), format: "pem" });
  const publicHex = createPublicKey(privateKey).export({ format: "der", type: "spki" }).subarray(-32).toString("hex");
  const document = { keytype: "ed25519", scheme: "ed25519", keyval: { public: publicHex } };
  const keyId = digest(canonicalize(document));
  return { key: keyFromPublic(publicHex, keyId), privateKey, keyId };
}

function signWith(metadata, pairs) {
  for (const [index, item] of pairs.entries()) {
    metadata.sign((canonical) => new Signature({ keyID: item.keyId, sig: sign(null, canonical, item.privateKey).toString("hex") }), index !== 0);
  }
}

const [metadataDir, manifestPath, rootKeyDir, custodyA, custodyB] = process.argv.slice(2).map((value) => resolve(value));
if (![metadataDir, manifestPath, rootKeyDir, custodyA, custodyB].every(Boolean)) throw new Error("usage: node create-offline-tuf-hierarchy.mjs <metadata-dir> <runtime-manifest> <root-key-dir> <custody-a> <custody-b>");
const rootPairs = (await Promise.all(["root-1.private.pem", "root-2.private.pem", "root-3.private.pem"].map((name) => rootPair(join(rootKeyDir, name)))));
const targets = [pair(), pair(), pair()];
const modules = [pair(), pair(), pair()];
const snapshot = pair();
const timestamp = pair();
for (const [directory, role, pairs] of [[custodyA, "targets", targets], [custodyA, "modules", modules], [custodyA, "snapshot", [snapshot]], [custodyA, "timestamp", [timestamp]], [custodyB, "targets", targets], [custodyB, "modules", modules], [custodyB, "snapshot", [snapshot]], [custodyB, "timestamp", [timestamp]]]) {
  await mkdir(join(directory, `TUF-${role.toUpperCase()}-CUSTODY`), { recursive: true });
  for (const [index, item] of pairs.entries()) await writeFile(join(directory, `TUF-${role.toUpperCase()}-CUSTODY`, `${role}-${index + 1}.private.pem`), item.privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600 });
}
const root = new Metadata(new Root({ version: 1, specVersion: "1.0.35", expires: expires(364), consistentSnapshot: true }));
for (const item of rootPairs) root.signed.addKey(item.key, "root");
for (const item of targets) root.signed.addKey(item.key, "targets");
root.signed.addKey(snapshot.key, "snapshot"); root.signed.addKey(timestamp.key, "timestamp");
root.signed.roles.root.keyIDs = rootPairs.map((x) => x.keyId); root.signed.roles.root.threshold = 2;
root.signed.roles.targets.keyIDs = targets.map((x) => x.keyId); root.signed.roles.targets.threshold = 2;
root.signed.roles.snapshot.keyIDs = [snapshot.keyId]; root.signed.roles.snapshot.threshold = 1;
root.signed.roles.timestamp.keyIDs = [timestamp.keyId]; root.signed.roles.timestamp.threshold = 1;
signWith(root, rootPairs.slice(0, 2));
const manifest = await readFile(manifestPath);
const identity = JSON.parse(manifest);
const target = new TargetFile({ path: "runtime-manifest.json", length: manifest.length, hashes: { sha256: digest(manifest) }, unrecognizedFields: { custom: { tufSpecVersion: "1.0.35", releaseId: identity.jarvisReleaseVersion, jarvisVersion: identity.jarvisReleaseVersion, releaseSequence: identity.releaseSequence, securityEpoch: identity.securityEpoch, sourceCommitSha: identity.sourceCommitSha, platform: "WINDOWS", runtimeRole: "FULL_HOST", architecture: "x64", rollbackPolicy: "CURRENT_TRUSTED_TARGETS_ONLY", artifactSha256: digest(manifest) } } });
const targetsMeta = new Metadata(new Targets({ version: 1, specVersion: "1.0.35", expires: expires(89), delegations: new Delegations(Object.fromEntries(modules.map((x) => [x.keyId, x.key])), { modules: { keyids: modules.map((x) => x.keyId), threshold: 2, terminating: true, paths: ["modules/*"] } }) }));
targetsMeta.signed.addTarget(target); signWith(targetsMeta, targets.slice(0, 2));
const snapshotMeta = new Metadata(new Snapshot({ version: 1, specVersion: "1.0.35", expires: expires(29), meta: { "targets.json": metaFile(targetsMeta) } })); signWith(snapshotMeta, [snapshot]);
const timestampMeta = new Metadata(new Timestamp({ version: 1, specVersion: "1.0.35", expires: expires(6), snapshotMeta: metaFile(snapshotMeta) })); signWith(timestampMeta, [timestamp]);
await mkdir(metadataDir, { recursive: true });
await Promise.all([["root.json", root], ["targets.json", targetsMeta], ["snapshot.json", snapshotMeta], ["timestamp.json", timestampMeta]].map(async ([name, value]) => writeFile(join(metadataDir, name), bytes(value))));
console.log(JSON.stringify({ root: rootPairs.map((x) => x.keyId), targets: targets.map((x) => x.keyId), modules: modules.map((x) => x.keyId), snapshot: snapshot.keyId, timestamp: timestamp.keyId }, null, 2));
