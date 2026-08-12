import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CANONICAL_VALUES_PATH = "packages/schemas/src/canonical/v1/jarvis-v1.0.5.contract-values.json";
export const MANIFEST_PATH = "docs/JARVIS-CONTRACT-MANIFEST-v1.0.5.md";
export const GENERATED_JSON_PATH = "generated/contract/jarvis-v1.0.5.contract-values.generated.json";
export const GENERATED_TS_PATH = "generated/contract/jarvis-v1.0.5.contract-values.generated.ts";

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function readUtf8(rootDir, path) {
  return readFile(resolve(rootDir, path), "utf8");
}

export async function readCanonical(rootDir) {
  const raw = await readUtf8(rootDir, CANONICAL_VALUES_PATH);
  return { raw, values: JSON.parse(raw), sha256: sha256Hex(Buffer.from(raw, "utf8")) };
}

export function stablePretty(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "en"));
}

export function sameSet(left, right) {
  return JSON.stringify(sortedUnique(left)) === JSON.stringify(sortedUnique(right));
}

export function quotedValues(source) {
  return [...source.matchAll(/['"]([A-Z][A-Z0-9_]+)['"]/g)].map((match) => match[1]);
}

export function extractTypeUnion(text, typeName) {
  const match = text.match(new RegExp(`\\btype\\s+${typeName}\\s*=([\\s\\S]*?);`));
  return match ? quotedValues(match[1]) : [];
}

export function extractFenceAfter(text, marker) {
  const start = text.indexOf(marker);
  if (start < 0) return null;
  const tail = text.slice(start + marker.length);
  const match = tail.match(/```(?:[A-Za-z0-9_-]+)?\n([\s\S]*?)```/);
  return match?.[1] ?? null;
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function violation(code, path, detail) {
  return Object.freeze({ code, path, detail });
}

export function printViolations(label, violations) {
  for (const item of violations) console.error(`[${label}] ${item.code} ${item.path}: ${item.detail}`);
}

export function isMain(importMetaUrl) {
  return Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(importMetaUrl);
}
