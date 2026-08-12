import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_EXCLUDED_DIRS = new Set([
  ".git",
  ".artifacts",
  ".pnpm-store",
  "coverage",
  "dist",
  "node_modules",
  "target",
]);

export function toPosix(path) {
  return path.split(sep).join("/");
}

export function relativePath(rootDir, path) {
  return toPosix(relative(rootDir, path));
}

export function isMain(importMetaUrl) {
  return Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(importMetaUrl);
}

export function violation(code, path, detail) {
  return Object.freeze({ code, path, detail });
}

export async function collectFiles(rootDir, options = {}) {
  const excludedDirs = options.excludedDirs ?? DEFAULT_EXCLUDED_DIRS;
  const include = options.include ?? (() => true);
  const files = [];

  async function walk(current) {
    if (!existsSync(current)) return;
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      if (entry.isDirectory() && excludedDirs.has(entry.name)) continue;
      const absolute = resolve(current, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && include(absolute)) files.push(absolute);
    }
  }

  await walk(rootDir);
  return files.sort((a, b) => a.localeCompare(b, "en"));
}

export function printViolations(label, violations) {
  for (const item of violations) {
    const location = item.path ? ` ${item.path}` : "";
    console.error(`[${label}] ${item.code}${location}: ${item.detail}`);
  }
}
