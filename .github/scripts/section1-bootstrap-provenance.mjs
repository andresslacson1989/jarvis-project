import { readFile, writeFile } from "node:fs/promises";

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
    if (
      (key.startsWith("'") && key.endsWith("'")) ||
      (key.startsWith('"') && key.endsWith('"'))
    ) {
      key = key.slice(1, -1);
    }
    key = key.replace(/\(.*/, "");
    const separator = key.lastIndexOf("@");
    if (separator <= 0) continue;
    packages.push({ name: key.slice(0, separator), version: key.slice(separator + 1) });
  }
  const unique = new Map(packages.map((item) => [`${item.name}@${item.version}`, item]));
  return [...unique.values()].sort((a, b) =>
    `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`, "en"),
  );
}

function collectPnpmTree(node, out) {
  if (!node || typeof node !== "object") return;
  if (
    node.name &&
    node.version &&
    node.name !== "jarvis-project" &&
    !String(node.version).startsWith("link:")
  ) {
    out.add(`${node.name}@${node.version}`);
  }
  for (const field of ["dependencies", "optionalDependencies"]) {
    const value = node[field];
    if (!value || typeof value !== "object") continue;
    for (const child of Object.values(value)) collectPnpmTree(child, out);
  }
}

function normalizeRepository(value) {
  const raw = typeof value === "string" ? value : value?.url;
  if (!raw) return null;
  return String(raw)
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/\.git$/, "");
}

const prod = new Set();
for (const root of JSON.parse(await readFile("/tmp/pnpm-prod.json", "utf8"))) {
  collectPnpmTree(root, prod);
}
const npmPackages = parsePnpmPackages(await readFile("pnpm-lock.yaml", "utf8"));

const npmRecords = [];
for (const item of npmPackages) {
  const encodedName = item.name.startsWith("@") ? item.name.replace("/", "%2f") : item.name;
  const response = await fetch(`https://registry.npmjs.org/${encodedName}/${item.version}`);
  if (!response.ok) {
    throw new Error(`npm metadata failed ${item.name}@${item.version}: ${response.status}`);
  }
  const meta = await response.json();
  const license = typeof meta.license === "string" ? meta.license : meta.license?.type;
  if (!license) throw new Error(`npm license missing ${item.name}@${item.version}`);
  npmRecords.push({
    ecosystem: "npm",
    name: item.name,
    version: item.version,
    license,
    source:
      normalizeRepository(meta.repository) ??
      meta.homepage ??
      `https://www.npmjs.com/package/${item.name}/v/${item.version}`,
    role: prod.has(`${item.name}@${item.version}`) ? "DESKTOP_RUNTIME" : "DESKTOP_BUILD_TEST",
    packaged: prod.has(`${item.name}@${item.version}`),
    reviewStatus: "APPROVED",
  });
}

const cargo = JSON.parse(await readFile("/tmp/cargo-metadata.json", "utf8"));
const nodeById = new Map((cargo.resolve?.nodes ?? []).map((node) => [node.id, node]));
const root = cargo.packages.find((pkg) => pkg.name === "jarvis-desktop");
if (!root) throw new Error("jarvis-desktop missing from cargo metadata");

const runtimeIds = new Set();
const queue = [root.id];
while (queue.length > 0) {
  const id = queue.shift();
  if (!id || runtimeIds.has(id)) continue;
  runtimeIds.add(id);
  const node = nodeById.get(id);
  for (const dep of node?.deps ?? []) {
    const normalForWindows = (dep.dep_kinds ?? []).some(
      (kind) =>
        kind.kind === null &&
        (kind.target === null || String(kind.target).includes("windows")),
    );
    if (normalForWindows) queue.push(dep.pkg);
  }
}

const cargoRecords = cargo.packages
  .filter(
    (pkg) =>
      pkg.source &&
      pkg.name !== "jarvis-desktop" &&
      pkg.name !== "jarvis-toolchain-smoke",
  )
  .map((pkg) => {
    if (!pkg.license) throw new Error(`cargo license missing ${pkg.name}@${pkg.version}`);
    return {
      ecosystem: "cargo",
      name: pkg.name,
      version: pkg.version,
      license: pkg.license,
      source: pkg.repository ?? `https://crates.io/crates/${pkg.name}/${pkg.version}`,
      role: runtimeIds.has(pkg.id) ? "DESKTOP_NATIVE_RUNTIME" : "DESKTOP_NATIVE_BUILD",
      packaged: runtimeIds.has(pkg.id),
      reviewStatus: "APPROVED",
    };
  })
  .sort((a, b) =>
    `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`, "en"),
  );

await writeFile("/tmp/npm-provenance.json", JSON.stringify(npmRecords, null, 2));
await writeFile("/tmp/cargo-provenance.json", JSON.stringify(cargoRecords, null, 2));
console.log(`[bootstrap-provenance] npm=${npmRecords.length} cargo=${cargoRecords.length}`);
