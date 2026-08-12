import { lstat, readFile, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, relative, resolve, sep } from "node:path";

const MAX_SYNTHETIC_JSON_BYTES = 1024 * 1024;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function within(base, candidate) {
  const rel = relative(base, candidate);
  return rel === "" || (!rel.startsWith("..") && !rel.includes(`${sep}..${sep}`));
}

export async function loadSyntheticJsonFixture(rootDir, fixtureId) {
  const manifestPath = resolve(rootDir, "tests", "fixtures", "manifest.json");
  const manifestRoot = dirname(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert(manifest?.schemaVersion === 1, "fixture manifest schemaVersion must be 1");
  assert(Array.isArray(manifest.fixtures), "fixture manifest fixtures must be an array");

  const matches = manifest.fixtures.filter((entry) => entry?.id === fixtureId);
  assert(matches.length === 1, `fixture ${fixtureId} must resolve exactly once`);
  const entry = matches[0];
  assert(entry.provenance === "SYNTHETIC", `fixture ${fixtureId} must be SYNTHETIC`);
  assert(entry.containsRealCredentials === false,
    `fixture ${fixtureId} must explicitly declare containsRealCredentials=false`);
  assert(entry.mediaType === "application/json", `fixture ${fixtureId} must be JSON`);
  assert(typeof entry.sha256 === "string" && /^[0-9a-f]{64}$/.test(entry.sha256),
    `fixture ${fixtureId} sha256 is invalid`);
  assert(typeof entry.path === "string" && entry.path.length > 0,
    `fixture ${fixtureId} path missing`);

  const fixturePath = resolve(manifestRoot, entry.path);
  assert(within(manifestRoot, fixturePath), `fixture ${fixtureId} escapes fixture root`);
  const stat = await lstat(fixturePath);
  assert(stat.isFile() && !stat.isSymbolicLink(), `fixture ${fixtureId} must be a regular non-symlink file`);
  assert(stat.size <= MAX_SYNTHETIC_JSON_BYTES,
    `fixture ${fixtureId} exceeds ${MAX_SYNTHETIC_JSON_BYTES} bytes`);

  const realManifestRoot = await realpath(manifestRoot);
  const realFixture = await realpath(fixturePath);
  assert(within(realManifestRoot, realFixture), `fixture ${fixtureId} resolves outside fixture root`);

  const bytes = await readFile(realFixture);
  const digest = createHash("sha256").update(bytes).digest("hex");
  assert(digest === entry.sha256, `fixture ${fixtureId} integrity mismatch`);
  return JSON.parse(bytes.toString("utf8"));
}
