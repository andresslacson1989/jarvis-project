import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { collectFiles, isMain, relativePath, violation, printViolations } from "./lib.mjs";
import { fileURLToPath } from "node:url";

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".rs",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const CONTROLLED_ROOTS = Object.freeze([
  ".github",
  "apps",
  "modules",
  "packages",
  "platform",
  "providers",
  "services",
  "tests",
  "third_party",
  "tools",
]);
const ROOT_TEXT_FILES = new Set([
  ".gitignore",
  ".node-version",
  "Cargo.lock",
  "Cargo.toml",
  "THIRD_PARTY_NOTICES.md",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "rust-toolchain.toml",
  "rustfmt.toml",
  "tsconfig.build.json",
  "tsconfig.json",
]);

export async function checkFormat(rootDir) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const files = await collectFiles(rootDir, {
    include: (file) => {
      const path = relativePath(rootDir, file);
      const inControlledRoot = CONTROLLED_ROOTS.some((root) => path === root || path.startsWith(`${root}/`));
      return (inControlledRoot && TEXT_EXTENSIONS.has(extname(file))) || ROOT_TEXT_FILES.has(path);
    },
  });
  const violations = [];

  for (const file of files) {
    const path = relativePath(rootDir, file);
    const bytes = await readFile(file);
    let text;
    try {
      text = decoder.decode(bytes);
    } catch {
      violations.push(violation("FORMAT_INVALID_UTF8", path, "text file is not valid UTF-8"));
      continue;
    }

    if (text.includes("\r")) {
      violations.push(violation("FORMAT_CRLF", path, "repository text must use LF, not CR/CRLF"));
    }
    if (text.length > 0 && !text.endsWith("\n")) {
      violations.push(violation("FORMAT_FINAL_NEWLINE", path, "text file must end with one LF newline"));
    }

    const lines = text.split("\n");
    for (let index = 0; index < lines.length - 1; index += 1) {
      const line = lines[index];
      if (/[ \t]+(?:\r)?$/.test(line)) {
        violations.push(violation("FORMAT_TRAILING_WHITESPACE", `${path}:${index + 1}`, "trailing whitespace is prohibited"));
      }
      if (line.includes("\t")) {
        violations.push(violation("FORMAT_TAB", `${path}:${index + 1}`, "tab characters are prohibited in repository text"));
      }
    }
  }

  return { filesScanned: files.length, violations };
}

if (isMain(import.meta.url)) {
  const rootDir = fileURLToPath(new URL("../..", import.meta.url));
  const result = await checkFormat(rootDir);
  if (result.violations.length > 0) {
    printViolations("format", result.violations);
    process.exit(1);
  }
  console.log(`[format] PASS files=${result.filesScanned}`);
}
