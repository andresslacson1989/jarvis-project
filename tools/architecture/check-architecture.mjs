import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".rs"]);
const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(here, "..", "..");

function posix(path) {
  return path.split(sep).join("/");
}

function under(path, root) {
  return path === root || path.startsWith(`${root}/`);
}

function excluded(path, policy) {
  return policy.excludedRoots.some((root) => under(path, root));
}

async function collectFiles(rootDir, policy) {
  const files = [];
  async function walk(relativeDir) {
    if (excluded(relativeDir, policy)) return;
    const absolute = resolve(rootDir, relativeDir);
    if (!existsSync(absolute)) return;
    const entries = await readdir(absolute, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      const rel = posix(relative(relativeDir ? resolve(rootDir, relativeDir) : rootDir, resolve(absolute, entry.name)));
      const child = relativeDir ? `${relativeDir}/${rel}` : rel;
      if (entry.isDirectory()) await walk(child);
      else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(child);
    }
  }
  for (const sourceRoot of policy.sourceRoots) await walk(sourceRoot);
  return files.sort((a, b) => a.localeCompare(b, "en"));
}

function extractImports(source) {
  const found = [];
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^"'`]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[1]);
  }
  return [...new Set(found)];
}

function stripCommentsAndStrings(source) {
  let out = "";
  let state = "code";
  let quote = "";
  for (let index = 0; index < source.length; index += 1) {
    const ch = source[index];
    const next = source[index + 1];
    if (state === "code") {
      if (ch === "/" && next === "/") {
        state = "line-comment";
        out += "  ";
        index += 1;
      } else if (ch === "/" && next === "*") {
        state = "block-comment";
        out += "  ";
        index += 1;
      } else if (ch === "'" || ch === "\"" || ch === "`") {
        state = "string";
        quote = ch;
        out += " ";
      } else {
        out += ch;
      }
    } else if (state === "line-comment") {
      if (ch === "\n") {
        state = "code";
        out += "\n";
      } else out += " ";
    } else if (state === "block-comment") {
      if (ch === "*" && next === "/") {
        state = "code";
        out += "  ";
        index += 1;
      } else out += ch === "\n" ? "\n" : " ";
    } else {
      if (ch === "\\") {
        out += "  ";
        index += 1;
      } else if (ch === quote) {
        state = "code";
        out += " ";
      } else out += ch === "\n" && quote === "`" ? "\n" : " ";
    }
  }
  return out;
}

function unitFor(path) {
  const parts = path.split("/");
  if (!["apps", "services", "packages", "platform", "providers", "tools", "modules"].includes(parts[0])) {
    return null;
  }
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
}

function findCycles(graph) {
  const cycles = [];
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function visit(node) {
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      const cycle = [...stack.slice(start), node];
      cycles.push(cycle);
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const next of [...(graph.get(node) ?? [])].sort()) visit(next);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of [...graph.keys()].sort()) visit(node);
  const unique = new Map();
  for (const cycle of cycles) {
    const body = cycle.slice(0, -1);
    const rotations = body.map((_, index) => [...body.slice(index), ...body.slice(0, index)]);
    const canonical = rotations.map((item) => item.join(" -> ")).sort()[0];
    unique.set(canonical, `${canonical} -> ${canonical.split(" -> ")[0]}`);
  }
  return [...unique.values()].sort();
}

function violation(code, path, detail) {
  return Object.freeze({ code, path, detail });
}

export async function checkArchitecture(rootDir = defaultRoot) {
  const policy = JSON.parse(await readFile(resolve(rootDir, "tools/architecture/architecture-policy.json"), "utf8"));
  if (policy?.schemaVersion !== 1) throw new Error("architecture policy schemaVersion must be 1");

  const files = await collectFiles(rootDir, policy);
  const violations = [];
  const graph = new Map();

  for (const path of files) {
    const source = await readFile(resolve(rootDir, path), "utf8");
    const imports = extractImports(source);
    const sourceUnit = unitFor(path);
    if (sourceUnit && !graph.has(sourceUnit)) graph.set(sourceUnit, new Set());

    for (const specifier of imports) {
      let target = null;
      if (specifier.startsWith(".")) {
        target = posix(relative(rootDir, resolve(rootDir, dirname(path), specifier))).replace(/^\.\//, "");
      } else if (specifier.startsWith("@jarvis/")) {
        const name = specifier.slice("@jarvis/".length).split("/")[0];
        target = name === "platform-contracts" ? "packages/platform-contracts" : `packages/${name}`;
      }
      if (target === null) continue;

      const targetUnit = unitFor(target);
      if (sourceUnit && targetUnit && sourceUnit !== targetUnit) graph.get(sourceUnit).add(targetUnit);

      if (
        policy.sharedRoots.some((root) => under(path, root)) &&
        policy.sharedForbiddenTargetRoots.some((root) => under(target, root))
      ) {
        violations.push(violation("SHARED_NATIVE_IMPORT", path, `${specifier} -> ${target}`));
      }
      if (
        policy.uiRoots.some((root) => under(path, root)) &&
        policy.uiForbiddenTargetRoots.some((root) => under(target, root))
      ) {
        violations.push(violation("UI_AUTHORITY_IMPORT", path, `${specifier} -> ${target}`));
      }
      if (
        under(path, policy.sharedUtilityRoot) &&
        policy.sharedUtilityForbiddenTargetRoots.some((root) => under(target, root))
      ) {
        violations.push(violation("SHARED_UTILITY_BOUNDARY", path, `${specifier} -> ${target}`));
      }
    }

    const stripped = stripCommentsAndStrings(source);
    const osPatterns = [
      /\bprocess\s*\.\s*platform\b/,
      /\bDeno\s*\.\s*build\s*\.\s*os\b/,
      /\bBun\s*\.\s*platform\b/,
      /\bcfg\s*\(\s*target_os\b/,
    ];
    if (
      osPatterns.some((pattern) => pattern.test(stripped)) &&
      !policy.osBranchAllowedRoots.some((root) => under(path, root))
    ) {
      violations.push(violation("SCATTERED_OS_BRANCH", path, "OS selection outside composition/platform/provider/tool boundary"));
    }

    if (path.endsWith(".rs")) {
      const unsafePattern = /\bunsafe\s*(?:\{|fn\b|impl\b|trait\b|extern\b)/g;
      const matches = [...stripped.matchAll(unsafePattern)];
      if (matches.length > 0) {
        if (!policy.unsafeRustAllowedRoots.some((root) => under(path, root))) {
          violations.push(violation("UNSAFE_RUST_LOCATION", path, "unsafe Rust outside explicit native allowlist"));
        } else {
          const lines = source.split(/\r?\n/);
          for (const match of matches) {
            const before = source.slice(0, match.index).split(/\r?\n/).length - 1;
            const start = Math.max(0, before - 3);
            const context = lines.slice(start, before + 1).join("\n");
            if (!/SAFETY:/i.test(context)) {
              violations.push(violation("UNSAFE_RUST_JUSTIFICATION", path, `unsafe at line ${before + 1} lacks nearby SAFETY justification`));
            }
          }
        }
      }
    }
  }

  for (const cycle of findCycles(graph)) {
    violations.push(violation("PACKAGE_CYCLE", "<graph>", cycle));
  }

  const compositionPath = resolve(rootDir, "platform/composition.ts");
  if (existsSync(compositionPath)) {
    const composition = await readFile(compositionPath, "utf8");
    if (!composition.includes('status: "UNAVAILABLE"') || !composition.includes('reason: "PLATFORM_BACKEND_UNQUALIFIED"')) {
      violations.push(violation(
        "PLATFORM_FAILURE_NOT_FAIL_CLOSED",
        "platform/composition.ts",
        "composition root must preserve explicit UNAVAILABLE / PLATFORM_BACKEND_UNQUALIFIED behavior",
      ));
    }
  }

  return violations.sort((a, b) =>
    `${a.code}:${a.path}:${a.detail}`.localeCompare(`${b.code}:${b.path}:${b.detail}`, "en"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = await checkArchitecture(defaultRoot);
  if (violations.length > 0) {
    for (const item of violations) {
      console.error(`[architecture] ${item.code} ${item.path}: ${item.detail}`);
    }
    process.exit(1);
  }
  console.log("[architecture] PASS");
}
