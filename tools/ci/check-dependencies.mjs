import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import { collectFiles, isMain, relativePath, violation, printViolations } from "./lib.mjs";
import { fileURLToPath } from "node:url";

const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"];
const EXACT_SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function provenanceKey(ecosystem, name, version) {
  return `${ecosystem}:${name}@${version}`;
}

function parsePnpmPackages(text) {
  const packages = [];
  let inPackages = false;
  for (const line of text.split(/\r?\n/)) {
    if (line === "packages:") {
      inPackages = true;
      continue;
    }
    if (inPackages && /^[^\s]/.test(line) && line.endsWith(":")) break;
    if (!inPackages) continue;
    const match = line.match(/^  ([^ ].*):\s*$/);
    if (!match) continue;
    let key = match[1].trim();
    if ((key.startsWith("'") && key.endsWith("'")) || (key.startsWith('"') && key.endsWith('"'))) {
      key = key.slice(1, -1);
    }
    key = key.replace(/\(.*/, "");
    const separator = key.lastIndexOf("@");
    if (separator <= 0) continue;
    const name = key.slice(0, separator);
    const version = key.slice(separator + 1);
    packages.push({ name, version });
  }
  return packages;
}

function parseCargoPackages(text) {
  const packages = [];
  for (const block of text.split(/\n(?=\[\[package\]\])/)) {
    if (!block.includes("[[package]]")) continue;
    const name = block.match(/^name = "([^"]+)"$/m)?.[1];
    const version = block.match(/^version = "([^"]+)"$/m)?.[1];
    const source = block.match(/^source = "([^"]+)"$/m)?.[1];
    if (name && version && source) packages.push({ name, version, source });
  }
  return packages;
}

export async function checkDependencies(rootDir) {
  const violations = [];
  const provenancePath = resolve(rootDir, "third_party", "provenance.json");
  const lockPath = resolve(rootDir, "pnpm-lock.yaml");
  const cargoLockPath = resolve(rootDir, "Cargo.lock");
  if (!existsSync(provenancePath)) {
    return { npmPackages: 0, cargoPackages: 0, violations: [violation("DEPENDENCY_PROVENANCE_MISSING", "third_party/provenance.json", "dependency provenance inventory is required")] };
  }

  const provenance = await readJson(provenancePath);
  const approved = new Set(
    (provenance.dependencies ?? [])
      .filter((item) => item.reviewStatus === "APPROVED")
      .map((item) => provenanceKey(item.ecosystem, item.name, item.version)),
  );

  const manifests = await collectFiles(rootDir, {
    include: (file) => file.endsWith("package.json") && extname(file) === ".json",
  });
  const directExternal = new Set();
  for (const manifestPath of manifests) {
    const manifest = await readJson(manifestPath);
    const path = relativePath(rootDir, manifestPath);
    for (const field of DEPENDENCY_FIELDS) {
      for (const [name, specifier] of Object.entries(manifest[field] ?? {})) {
        if (typeof specifier !== "string") {
          violations.push(violation("DEPENDENCY_INVALID_SPECIFIER", path, `${field}.${name} must be a string`));
          continue;
        }
        if (specifier.startsWith("workspace:")) continue;
        directExternal.add(`${name}@${specifier}`);
        if (!EXACT_SEMVER.test(specifier)) {
          violations.push(violation("DEPENDENCY_NON_EXACT_PIN", path, `${field}.${name} must use an exact version, got ${specifier}`));
        }
      }
    }
  }

  const npmPackages = existsSync(lockPath) ? parsePnpmPackages(await readFile(lockPath, "utf8")) : [];
  for (const item of npmPackages) {
    if (!approved.has(provenanceKey("npm", item.name, item.version))) {
      violations.push(violation("DEPENDENCY_UNREVIEWED_NPM", "pnpm-lock.yaml", `${item.name}@${item.version} is absent from approved provenance`));
    }
  }
  for (const direct of directExternal) {
    if (!npmPackages.some((item) => `${item.name}@${item.version}` === direct)) {
      violations.push(violation("DEPENDENCY_LOCK_MISMATCH", "pnpm-lock.yaml", `direct dependency ${direct} is not exactly represented in the lockfile`));
    }
  }

  const cargoPackages = existsSync(cargoLockPath) ? parseCargoPackages(await readFile(cargoLockPath, "utf8")) : [];
  for (const item of cargoPackages) {
    if (!approved.has(provenanceKey("cargo", item.name, item.version))) {
      violations.push(violation("DEPENDENCY_UNREVIEWED_CARGO", "Cargo.lock", `${item.name}@${item.version} from ${item.source} is absent from approved provenance`));
    }
  }

  return { npmPackages: npmPackages.length, cargoPackages: cargoPackages.length, violations };
}

if (isMain(import.meta.url)) {
  const rootDir = fileURLToPath(new URL("../..", import.meta.url));
  const result = await checkDependencies(rootDir);
  if (result.violations.length > 0) {
    printViolations("dependency", result.violations);
    process.exit(1);
  }
  console.log(`[dependency] PASS npm=${result.npmPackages} cargo=${result.cargoPackages}`);
}
