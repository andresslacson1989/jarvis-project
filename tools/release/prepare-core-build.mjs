import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const generatedEntrypoint = resolve(projectRoot, ".artifacts/core-build/services/core/src/main.js");
const outputDirectory = resolve(projectRoot, "services/core/dist");
const outputEntrypoint = resolve(outputDirectory, "main.js");
const generatedTrustModule = resolve(
  projectRoot,
  ".artifacts/core-build/services/core/src/release-trust.js",
);
const outputTrustModule = resolve(outputDirectory, "release-trust.js");
const generatedIpcModule = resolve(
  projectRoot,
  ".artifacts/core-build/services/core/src/ipc-bootstrap.js",
);
const outputIpcModule = resolve(outputDirectory, "ipc-bootstrap.js");

async function main() {
  const information = await stat(generatedEntrypoint).catch(() => null);
  if (!information?.isFile()) {
    throw new Error("compiled Core entrypoint is missing from the generated build graph");
  }
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  await copyFile(generatedEntrypoint, outputEntrypoint);
  await copyFile(generatedTrustModule, outputTrustModule);
  await copyFile(generatedIpcModule, outputIpcModule);
  console.log(`[core-build] wrote ${outputEntrypoint}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(`[core-build] FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
