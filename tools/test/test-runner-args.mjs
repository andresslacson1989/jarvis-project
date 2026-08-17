import { pathToFileURL } from "node:url";

export function buildNodeTestArgs({ preloadPath, testFile, normalProfile }) {
  const args = [];
  if (normalProfile) {
    args.push("--import", pathToFileURL(preloadPath).href);
  }
  args.push("--test", testFile);
  return args;
}
