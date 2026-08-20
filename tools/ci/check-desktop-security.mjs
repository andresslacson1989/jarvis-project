import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

export function validateDesktopSecurity({ config, capability, nativeSource, externalLinkSource }) {
  const violations = [];
  const csp = config?.app?.security?.csp;
  const devCsp = config?.app?.security?.devCsp;
  const parseCsp = (value) => {
    const policy = new Map();
    let duplicate = false;
    for (const [name, ...sources] of String(value).split(";").map((directive) => directive.trim().split(/\s+/)).filter(([name]) => name)) {
      if (policy.has(name)) duplicate = true;
      policy.set(name, sources);
    }
    policy.duplicate = duplicate;
    return policy;
  };
  const production = typeof csp === "string" ? parseCsp(csp) : new Map();
  const development = typeof devCsp === "string" ? parseCsp(devCsp) : new Map();
  const exactSources = (policy, name, expected) => JSON.stringify(policy.get(name) ?? []) === JSON.stringify(expected);
  if (production.duplicate || !exactSources(production, "default-src", ["'self'"]) || !exactSources(production, "connect-src", ["'self'"]) || !exactSources(production, "script-src", ["'self'"])) {
    violations.push("DESKTOP_SECURITY_RESTRICTIVE_CSP_MISSING");
  }
  if (development.duplicate || !exactSources(development, "default-src", ["'self'"]) || !exactSources(development, "connect-src", ["'self'", "http://127.0.0.1:5173"]) || !exactSources(development, "script-src", ["'self'"])) {
    violations.push("DESKTOP_SECURITY_DEV_CSP_MISSING");
  }
  if (config?.app?.windows?.length !== 0) {
    violations.push("DESKTOP_SECURITY_WINDOW_CONFIG_NOT_NATIVE_CONTROLLED");
  }
  if (capability?.windows?.join(",") !== "main" || !Array.isArray(capability?.permissions) || capability.permissions.length !== 1 || capability.permissions[0] !== "opener:allow-open-url") {
    violations.push("DESKTOP_SECURITY_CAPABILITY_NOT_MINIMAL");
  }
  if (JSON.stringify(capability).match(/remote|https?:\/\/|\*/i)) {
    violations.push("DESKTOP_SECURITY_REMOTE_ORIGIN_PRIVILEGE");
  }
  if (!nativeSource.includes(".devtools(false)") || !nativeSource.includes(".on_navigation(") || !nativeSource.includes("NewWindowResponse::Deny")) {
    violations.push("DESKTOP_SECURITY_NATIVE_POLICY_MISSING");
  }
  const releaseOrigin = 'url.scheme() == "http"\n            && url.host_str() == Some("tauri.localhost")\n            && url.port().is_none()';
  if (!nativeSource.includes(releaseOrigin) || nativeSource.includes('url.scheme() == "tauri"')) {
    violations.push("DESKTOP_SECURITY_RELEASE_ORIGIN_BOUNDARY_MISSING");
  }
  if (!externalLinkSource.includes("@tauri-apps/plugin-opener") || !externalLinkSource.includes("new URL") || !externalLinkSource.includes("url.username") || !externalLinkSource.includes("url.password")) {
    violations.push("DESKTOP_SECURITY_EXTERNAL_LINK_BOUNDARY_MISSING");
  }
  if (!nativeSource.includes("url.port() == Some(5173)")) violations.push("DESKTOP_SECURITY_DEBUG_PORT_BOUNDARY_MISSING");
  return violations;
}

export async function checkDesktopSecurity(root = ROOT) {
  const config = JSON.parse(await readFile(resolve(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"));
  const capability = JSON.parse(await readFile(resolve(root, "apps/desktop/src-tauri/capabilities/main-local-ui.json"), "utf8"));
  const nativeSource = await readFile(resolve(root, "apps/desktop/src-tauri/src/main.rs"), "utf8");
  const externalLinkSource = await readFile(resolve(root, "apps/desktop/src/external-link.ts"), "utf8");
  const violations = validateDesktopSecurity({ config, capability, nativeSource, externalLinkSource });
  const rendererFiles = [resolve(root, "apps/desktop/index.html"), ...await collectRendererFiles(resolve(root, "apps/desktop/src"))];
  const rendererSource = (await Promise.all(rendererFiles.map((file) => readFile(file, "utf8")))).join("\n");
  if (/(dangerouslySetInnerHTML|innerHTML|eval\s*\(|new Function|<iframe|invoke\s*\()/i.test(rendererSource)) violations.push("DESKTOP_SECURITY_INERT_CONTENT_EXECUTION_PATH");
  return violations;
}

async function collectRendererFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectRendererFiles(path));
    else if (/\.(tsx?|jsx?|html|css)$/.test(entry.name)) files.push(path);
  }
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const violations = await checkDesktopSecurity();
  if (violations.length > 0) {
    for (const violation of violations) console.error(`[desktop-security] ${violation}`);
    process.exitCode = 1;
  } else {
    console.log("[desktop-security] PASS");
  }
}
