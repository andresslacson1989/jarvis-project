import { fileURLToPath } from "node:url";
import { isMain, printViolations } from "./lib.mjs";
import { validateContractManifest } from "./manifest.mjs";

if (isMain(import.meta.url)) {
  const rootDir = fileURLToPath(new URL("../..", import.meta.url));
  const result = await validateContractManifest(rootDir);
  if (result.violations.length > 0) {
    printViolations("contract-manifest", result.violations);
    process.exit(1);
  }
  console.log(`[contract-manifest] PASS components=${result.components.length} suite=${result.canonical.contractSuiteVersion}`);
}
