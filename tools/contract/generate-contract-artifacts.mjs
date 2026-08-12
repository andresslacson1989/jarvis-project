import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATED_JSON_PATH, GENERATED_TS_PATH, isMain } from "./lib.mjs";
import { renderGeneratedArtifacts } from "./manifest.mjs";

export async function checkGeneratedArtifacts(rootDir) {
  const expected = await renderGeneratedArtifacts(rootDir);
  const stale = [];
  for (const [path, content] of [[GENERATED_JSON_PATH, expected.json], [GENERATED_TS_PATH, expected.ts]]) {
    const absolute = resolve(rootDir, path);
    if (!existsSync(absolute)) {
      stale.push({ path, reason: "MISSING" });
      continue;
    }
    if (await readFile(absolute, "utf8") !== content) stale.push({ path, reason: "STALE" });
  }
  return { stale, expected };
}

async function atomicWrite(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  try {
    await writeFile(temporary, content, { encoding: "utf8", flag: "w" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function writeGeneratedArtifacts(rootDir) {
  const expected = await renderGeneratedArtifacts(rootDir);
  await atomicWrite(resolve(rootDir, GENERATED_JSON_PATH), expected.json);
  await atomicWrite(resolve(rootDir, GENERATED_TS_PATH), expected.ts);
  return expected;
}

if (isMain(import.meta.url)) {
  const rootDir = fileURLToPath(new URL("../..", import.meta.url));
  const mode = process.argv[2] ?? "--check";
  if (mode === "--write") {
    const result = await writeGeneratedArtifacts(rootDir);
    console.log(`[contract-generated] WRITE sourceSha256=${result.sourceSha256}`);
  } else if (mode === "--check") {
    const result = await checkGeneratedArtifacts(rootDir);
    if (result.stale.length > 0) {
      for (const item of result.stale) console.error(`[contract-generated] ${item.reason} ${item.path}`);
      process.exit(1);
    }
    console.log(`[contract-generated] PASS sourceSha256=${result.expected.sourceSha256}`);
  } else {
    console.error(`[contract-generated] unknown mode ${mode}`);
    process.exit(2);
  }
}
