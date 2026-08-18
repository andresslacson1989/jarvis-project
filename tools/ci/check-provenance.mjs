import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { isMain, violation, printViolations } from "./lib.mjs";
import { fileURLToPath } from "node:url";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function normalizeLicense(value) {
  return String(value ?? "").replace(/[()]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function actionRepository(specifier) {
  return specifier.split("@")[0].split("/").slice(0, 2).join("/");
}

async function workflowFiles(rootDir) {
  const directory = resolve(rootDir, ".github", "workflows");
  if (!existsSync(directory)) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => resolve(directory, entry.name))
    .sort((a, b) => a.localeCompare(b, "en"));
}

async function checkSecurityToolProvenance(rootDir, violations) {
  const profilePath = resolve(rootDir, "third_party", "security-tools.json");
  const noticesPath = resolve(rootDir, "third_party", "SECURITY_TOOL_NOTICES.md");
  if (!existsSync(profilePath)) {
    violations.push(violation("PROVENANCE_SECURITY_TOOLS_MISSING", "third_party/security-tools.json", "CI security-tool provenance is required"));
    return 0;
  }
  if (!existsSync(noticesPath)) {
    violations.push(violation("PROVENANCE_SECURITY_TOOL_NOTICES_MISSING", "third_party/SECURITY_TOOL_NOTICES.md", "CI security-tool notices are required"));
    return 0;
  }

  let profile;
  try {
    profile = await readJson(profilePath);
  } catch (error) {
    violations.push(violation("PROVENANCE_SECURITY_TOOLS_INVALID", "third_party/security-tools.json", error instanceof Error ? error.message : String(error)));
    return 0;
  }

  if (profile.schemaVersion !== 1 || !Array.isArray(profile.tools)) {
    violations.push(violation("PROVENANCE_SECURITY_TOOLS_INVALID", "third_party/security-tools.json", "schemaVersion must be 1 and tools must be an array"));
    return Array.isArray(profile.tools) ? profile.tools.length : 0;
  }

  const notices = (await readFile(noticesPath, "utf8")).toLowerCase();
  const seen = new Set();
  for (const tool of profile.tools) {
    const name = String(tool?.name ?? "");
    const version = String(tool?.version ?? "");
    const identity = `${name || "<missing>"}@${version || "<missing>"}`;
    if (seen.has(identity)) {
      violations.push(violation("PROVENANCE_SECURITY_TOOL_DUPLICATE", "third_party/security-tools.json", `duplicate security tool ${identity}`));
    }
    seen.add(identity);

    for (const field of ["name", "version", "ecosystem", "license", "source", "registry", "role", "installCommand"]) {
      if (typeof tool?.[field] !== "string" || tool[field].trim().length === 0) {
        violations.push(violation("PROVENANCE_SECURITY_TOOL_INCOMPLETE", "third_party/security-tools.json", `${identity} missing ${field}`));
      }
    }
    if (tool.ecosystem !== "cargo") {
      violations.push(violation("PROVENANCE_SECURITY_TOOL_ECOSYSTEM", "third_party/security-tools.json", `${identity} must use cargo ecosystem`));
    }
    if (tool.reviewStatus !== "APPROVED") {
      violations.push(violation("PROVENANCE_SECURITY_TOOL_UNAPPROVED", "third_party/security-tools.json", `${identity} is not APPROVED`));
    }
    if (tool.packaged !== false) {
      violations.push(violation("PROVENANCE_SECURITY_TOOL_PACKAGED", "third_party/security-tools.json", `${identity} must be CI-only with packaged=false`));
    }
    if (!String(tool.source ?? "").startsWith("https://") || !String(tool.registry ?? "").startsWith("https://")) {
      violations.push(violation("PROVENANCE_SECURITY_TOOL_SOURCE", "third_party/security-tools.json", `${identity} source and registry must use HTTPS`));
    }

    for (const expected of [tool.name, tool.version, tool.license]) {
      if (!notices.includes(String(expected ?? "").toLowerCase())) {
        violations.push(violation("PROVENANCE_SECURITY_TOOL_NOTICE", "third_party/SECURITY_TOOL_NOTICES.md", `missing name/version/license for ${identity}`));
        break;
      }
    }
  }

  return profile.tools.length;
}

export async function checkProvenance(rootDir) {
  const violations = [];
  const provenancePath = resolve(rootDir, "third_party", "provenance.json");
  const noticesPath = resolve(rootDir, "THIRD_PARTY_NOTICES.md");
  const baselinePath = resolve(rootDir, "tools", "toolchain", "toolchain-baseline.json");
  if (!existsSync(provenancePath)) {
    return { dependencyCount: 0, ciActionCount: 0, toolchainCount: 0, securityToolCount: 0, violations: [violation("PROVENANCE_MISSING", "third_party/provenance.json", "provenance inventory is required")] };
  }

  const provenance = await readJson(provenancePath);
  const dependencies = provenance.dependencies ?? [];
  const ciActions = provenance.ciActions ?? [];
  const toolchains = provenance.toolchains ?? [];
  if (provenance.schemaVersion !== 1) {
    violations.push(violation("PROVENANCE_SCHEMA", "third_party/provenance.json", "schemaVersion must be 1"));
  }

  const seen = new Set();
  for (const [kind, records] of [["dependency", dependencies], ["action", ciActions], ["toolchain", toolchains]]) {
    for (const record of records) {
      const identity = kind === "dependency"
        ? `${record.ecosystem}:${record.name}@${record.version}`
        : kind === "action"
          ? `${record.repository}@${record.commit}`
          : `${record.name}@${record.version}`;
      if (seen.has(`${kind}:${identity}`)) {
        violations.push(violation("PROVENANCE_DUPLICATE", "third_party/provenance.json", `duplicate ${kind} ${identity}`));
      }
      seen.add(`${kind}:${identity}`);
      if (record.reviewStatus !== "APPROVED") {
        violations.push(violation("PROVENANCE_NOT_APPROVED", "third_party/provenance.json", `${kind} ${identity} is not APPROVED`));
      }
    }
  }

  if (existsSync(baselinePath)) {
    const baseline = await readJson(baselinePath);
    const expectedToolchains = new Map([
      ["Node.js", baseline.node?.version],
      ["pnpm", baseline.pnpm?.version],
      ["Rust", baseline.rust?.version],
      ["Tauri", baseline.tauri?.runtime],
    ]);
    for (const [name, expectedVersion] of expectedToolchains) {
      const record = toolchains.find((item) => item.name === name);
      if (!record || record.version !== expectedVersion) {
        violations.push(violation("PROVENANCE_TOOLCHAIN_MISMATCH", "third_party/provenance.json", `${name} must match canonical toolchain ${expectedVersion ?? "<missing>"}`));
      }
    }
    const typescript = dependencies.find((item) => item.ecosystem === "npm" && item.name === "typescript");
    if (!typescript || typescript.version !== baseline.typescript?.version) {
      violations.push(violation("PROVENANCE_TOOLCHAIN_MISMATCH", "third_party/provenance.json", `TypeScript must match canonical toolchain ${baseline.typescript?.version ?? "<missing>"}`));
    }
  }

  for (const file of await workflowFiles(rootDir)) {
    const workflow = await readFile(file, "utf8");
    for (const match of workflow.matchAll(/^\s*-?\s*uses:\s*([^\s#]+).*$/gm)) {
      const specifier = match[1];
      if (specifier.startsWith("./")) continue;
      const at = specifier.lastIndexOf("@");
      const commit = at >= 0 ? specifier.slice(at + 1) : "";
      const repository = actionRepository(specifier);
      if (!/^[0-9a-f]{40}$/.test(commit)) {
        violations.push(violation("PROVENANCE_FLOATING_ACTION", ".github/workflows", `${specifier} must use an immutable 40-hex commit`));
        continue;
      }
      if (!ciActions.some((item) => item.repository === repository && item.commit === commit && item.reviewStatus === "APPROVED")) {
        violations.push(violation("PROVENANCE_UNKNOWN_ACTION", ".github/workflows", `${specifier} is not in approved CI action provenance`));
      }
    }
  }

  for (const dependency of dependencies.filter((item) => item.ecosystem === "npm")) {
    const installedPath = resolve(rootDir, "node_modules", ...dependency.name.split("/"), "package.json");
    if (!existsSync(installedPath)) continue;
    const installed = await readJson(installedPath);
    if (installed.version !== dependency.version) {
      violations.push(violation("PROVENANCE_INSTALLED_VERSION_MISMATCH", dependency.name, `expected ${dependency.version}, got ${installed.version}`));
    }
    if (normalizeLicense(installed.license) !== normalizeLicense(dependency.license)) {
      violations.push(violation("PROVENANCE_INSTALLED_LICENSE_MISMATCH", dependency.name, `expected ${dependency.license}, got ${installed.license ?? "<missing>"}`));
    }
  }

  if (!existsSync(noticesPath)) {
    violations.push(violation("PROVENANCE_NOTICES_MISSING", "THIRD_PARTY_NOTICES.md", "third-party notices file is required"));
  } else {
    const notices = (await readFile(noticesPath, "utf8")).toLowerCase();
    for (const record of [...dependencies, ...toolchains]) {
      const name = String(record.name).toLowerCase();
      const version = String(record.version).toLowerCase();
      const license = String(record.license).toLowerCase();
      if (!notices.includes(name) || !notices.includes(version) || !notices.includes(license)) {
        violations.push(violation("PROVENANCE_NOTICE_INCOMPLETE", "THIRD_PARTY_NOTICES.md", `missing name/version/license for ${record.name}@${record.version}`));
      }
    }
    for (const record of ciActions) {
      if (!notices.includes(record.repository.toLowerCase()) || !notices.includes(record.release.toLowerCase()) || !notices.includes(record.license.toLowerCase())) {
        violations.push(violation("PROVENANCE_NOTICE_INCOMPLETE", "THIRD_PARTY_NOTICES.md", `missing repository/release/license for ${record.repository}`));
      }
    }
  }

  const securityToolCount = await checkSecurityToolProvenance(rootDir, violations);
  return { dependencyCount: dependencies.length, ciActionCount: ciActions.length, toolchainCount: toolchains.length, securityToolCount, violations };
}

if (isMain(import.meta.url)) {
  const rootDir = fileURLToPath(new URL("../..", import.meta.url));
  const result = await checkProvenance(rootDir);
  if (result.violations.length > 0) {
    printViolations("provenance", result.violations);
    process.exit(1);
  }
  console.log(`[provenance] PASS dependencies=${result.dependencyCount} actions=${result.ciActionCount} toolchains=${result.toolchainCount} securityTools=${result.securityToolCount}`);
}
