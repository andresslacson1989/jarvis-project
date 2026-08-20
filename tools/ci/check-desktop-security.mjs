import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

export function validateDesktopSecurity({ config, capability, nativeSource, externalLinkSource }) {
  const violations = [];
  const csp = config?.app?.security?.csp;
  const devCsp = config?.app?.security?.devCsp;
  if (typeof csp !== "string" || !csp.includes("default-src 'self'") || !csp.includes("connect-src 'self'") || !csp.includes("script-src 'self'")) {
    violations.push("DESKTOP_SECURITY_RESTRICTIVE_CSP_MISSING");
  }
  if (typeof devCsp !== "string" || !devCsp.includes("http://127.0.0.1:5173")) {
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
  if (!externalLinkSource.includes("@tauri-apps/plugin-opener") || !externalLinkSource.includes("/^https?:\\/\\//i")) {
    violations.push("DESKTOP_SECURITY_EXTERNAL_LINK_BOUNDARY_MISSING");
  }
  return violations;
}

export async function checkDesktopSecurity(root = ROOT) {
  const config = JSON.parse(await readFile(resolve(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"));
  const capability = JSON.parse(await readFile(resolve(root, "apps/desktop/src-tauri/capabilities/main-local-ui.json"), "utf8"));
  const nativeSource = await readFile(resolve(root, "apps/desktop/src-tauri/src/main.rs"), "utf8");
  const externalLinkSource = await readFile(resolve(root, "apps/desktop/src/external-link.ts"), "utf8");
  return validateDesktopSecurity({ config, capability, nativeSource, externalLinkSource });
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
