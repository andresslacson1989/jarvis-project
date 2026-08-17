import { generateKeyPairSync, createHash, sign } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import {
  Key,
  MetaFile,
  Metadata,
  Root,
  Signature,
  Snapshot,
  TargetFile,
  Targets,
  Timestamp,
} from "@tufjs/models";
import { canonicalize } from "@tufjs/canonical-json";

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function expiration(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function makeKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicBytes = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const keyValue = publicBytes.toString("hex");
  const keyDocument = {
    keytype: "ed25519",
    scheme: "ed25519",
    keyval: { public: keyValue },
  };
  const keyId = digest(canonicalize(keyDocument));
  const key = new Key({
    keyID: keyId,
    keyType: "ed25519",
    scheme: "ed25519",
    keyVal: { public: keyValue },
  });
  return {
    key,
    sign: (bytes) =>
      new Signature({
        keyID: keyId,
        sig: sign(null, bytes, privateKey).toString("hex"),
      }),
  };
}

function signWith(metadata, keyPairs) {
  for (const [index, keyPair] of keyPairs.entries()) metadata.sign(keyPair.sign, index !== 0);
  return metadata;
}

function metadataBytes(metadata) {
  return Buffer.from(`${JSON.stringify(metadata.toJSON(), null, 2)}\n`, "utf8");
}

function metaFile(metadata) {
  const bytes = metadataBytes(metadata);
  return new MetaFile({
    version: metadata.signed.version,
    length: bytes.length,
    hashes: { sha256: digest(bytes) },
  });
}

class FixtureDelegations {
  constructor({ keys, roles }) {
    this.keys = keys;
    this.roles = roles;
  }

  toJSON() {
    return {
      keys: Object.fromEntries(Object.entries(this.keys).map(([keyID, key]) => [keyID, key.toJSON()])),
      roles: Object.entries(this.roles).map(([name, role]) => ({ name, ...role })),
    };
  }
}

export async function writeTufReleaseMetadata({ metadataDirectory, targetBytes, custom, productionProfile = false }) {
  await mkdir(metadataDirectory, { recursive: true });
  const rootKeys = [makeKeyPair(), makeKeyPair(), makeKeyPair()];
  const targetKeys = [makeKeyPair(), makeKeyPair(), makeKeyPair()];
  const moduleKeys = productionProfile ? [makeKeyPair(), makeKeyPair(), makeKeyPair()] : [];
  const snapshotKey = makeKeyPair();
  const timestampKey = makeKeyPair();
  const root = new Metadata(
    new Root({
      version: 1,
      specVersion: "1.0.35",
      expires: expiration(364),
      consistentSnapshot: true,
    }),
  );
  for (const keyPair of rootKeys) root.signed.addKey(keyPair.key, "root");
  for (const keyPair of targetKeys) root.signed.addKey(keyPair.key, "targets");
  root.signed.addKey(snapshotKey.key, "snapshot");
  root.signed.addKey(timestampKey.key, "timestamp");
  root.signed.roles.root.keyIDs = rootKeys.map(({ key }) => key.keyID);
  root.signed.roles.root.threshold = 2;
  root.signed.roles.targets.keyIDs = targetKeys.map(({ key }) => key.keyID);
  root.signed.roles.targets.threshold = 2;
  root.signed.roles.snapshot.keyIDs = [snapshotKey.key.keyID];
  root.signed.roles.timestamp.keyIDs = [timestampKey.key.keyID];
  signWith(root, rootKeys.slice(0, 2));

  const target = new TargetFile({
    path: "runtime-manifest.json",
    length: targetBytes.length,
    hashes: { sha256: digest(targetBytes) },
    unrecognizedFields: { custom: { ...custom, artifactSha256: digest(targetBytes) } },
  });
  const targets = new Metadata(
    new Targets({
      version: 1,
      specVersion: "1.0.35",
      expires: expiration(89),
      ...(productionProfile
        ? {
            delegations: new FixtureDelegations({
              keys: Object.fromEntries(moduleKeys.map(({ key }) => [key.keyID, key])),
              roles: {
                modules: {
                  keyids: moduleKeys.map(({ key }) => key.keyID),
                  threshold: 2,
                  terminating: true,
                  paths: ["modules/*"],
                },
              },
            }),
          }
        : {}),
    }),
  );
  targets.signed.addTarget(target);
  signWith(targets, targetKeys.slice(0, 2));

  const snapshot = new Metadata(
    new Snapshot({
      version: 1,
      specVersion: "1.0.35",
      expires: expiration(29),
      meta: { "targets.json": metaFile(targets) },
    }),
  );
  signWith(snapshot, [snapshotKey]);

  const timestamp = new Metadata(
    new Timestamp({
      version: 1,
      specVersion: "1.0.35",
      expires: expiration(6),
      snapshotMeta: metaFile(snapshot),
    }),
  );
  signWith(timestamp, [timestampKey]);

  await Promise.all([
    writeFile(`${metadataDirectory}/root.json`, metadataBytes(root)),
    writeFile(`${metadataDirectory}/targets.json`, metadataBytes(targets)),
    writeFile(`${metadataDirectory}/snapshot.json`, metadataBytes(snapshot)),
    writeFile(`${metadataDirectory}/timestamp.json`, metadataBytes(timestamp)),
  ]);
}
