import { readFile, lstat } from "node:fs/promises";
import { extname } from "node:path";
import { collectFiles, isMain, relativePath, violation, printViolations } from "./lib.mjs";
import { fileURLToPath } from "node:url";

const BINARY_EXTENSIONS = new Set([
  ".dll",
  ".exe",
  ".gif",
  ".gz",
  ".ico",
  ".jpeg",
  ".jpg",
  ".mp3",
  ".ogg",
  ".otf",
  ".pdf",
  ".pdb",
  ".png",
  ".tar",
  ".ttf",
  ".wasm",
  ".wav",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);
const MAX_BYTES = 2 * 1024 * 1024;
const HIGH_CONFIDENCE_PATTERNS = [
  ["PRIVATE_KEY", /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g],
  ["GITHUB_TOKEN", /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g],
  ["AWS_ACCESS_KEY", /\bAKIA[0-9A-Z]{16}\b/g],
  ["SLACK_TOKEN", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g],
  ["GOOGLE_API_KEY", /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ["STRIPE_LIVE_SECRET", /\bsk_live_[0-9A-Za-z]{20,}\b/g],
  ["JWT", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g],
];
const ASSIGNMENT_PATTERN = /\b(password|passwd|secret|token|api[_-]?key|authorization)\b\s*[:=]\s*["']([^"'\r\n]{20,})["']/gi;
const SAFE_VALUE = /^(?:JARVIS_TEST_ONLY|SYNTHETIC|REDACTED|CHANGEME|EXAMPLE|PLACEHOLDER|<[^>]+>|\$\{\{[^}]+\}\}|\$\{[^}]+\})$/i;

function lineFor(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

export async function scanSecrets(rootDir) {
  const files = await collectFiles(rootDir);
  const violations = [];
  let filesScanned = 0;

  for (const file of files) {
    const path = relativePath(rootDir, file);
    const base = file.split(/[\\/]/).at(-1);
    if (/^\.env(?:\.|$)/.test(base) && !/\.example$/.test(base)) {
      violations.push(violation("SECRET_ENV_FILE", path, ".env-style secret-bearing files are prohibited"));
      continue;
    }

    const stat = await lstat(file);
    if (stat.size > MAX_BYTES || BINARY_EXTENSIONS.has(extname(file).toLowerCase())) continue;
    const bytes = await readFile(file);
    if (bytes.includes(0)) continue;
    const text = bytes.toString("utf8");
    filesScanned += 1;

    for (const [patternName, pattern] of HIGH_CONFIDENCE_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        violations.push(violation(
          "SECRET_HIGH_CONFIDENCE",
          `${path}:${lineFor(text, match.index)}`,
          `high-confidence credential pattern ${patternName}`,
        ));
      }
    }

    ASSIGNMENT_PATTERN.lastIndex = 0;
    for (const match of text.matchAll(ASSIGNMENT_PATTERN)) {
      const value = match[2].trim();
      if (SAFE_VALUE.test(value) || /example\.invalid/i.test(value)) continue;
      violations.push(violation(
        "SECRET_LITERAL_ASSIGNMENT",
        `${path}:${lineFor(text, match.index)}`,
        `probable literal secret assignment for ${match[1]}`,
      ));
    }
  }

  return { filesScanned, violations };
}

if (isMain(import.meta.url)) {
  const rootDir = fileURLToPath(new URL("../..", import.meta.url));
  const result = await scanSecrets(rootDir);
  if (result.violations.length > 0) {
    printViolations("secret-scan", result.violations);
    process.exit(1);
  }
  console.log(`[secret-scan] PASS files=${result.filesScanned}`);
}
