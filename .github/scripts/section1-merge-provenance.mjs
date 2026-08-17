import { readFile, writeFile } from "node:fs/promises";

const provenancePath = "third_party/provenance.json";
const noticesPath = "THIRD_PARTY_NOTICES.md";

const current = JSON.parse(await readFile(provenancePath, "utf8"));
const generated = [
  ...JSON.parse(await readFile("/tmp/npm-provenance.json", "utf8")),
  ...JSON.parse(await readFile("/tmp/cargo-provenance.json", "utf8")),
];

const byKey = new Map();
for (const record of generated) {
  byKey.set(`${record.ecosystem}:${record.name}:${record.version}`, record);
}
for (const record of current.dependencies ?? []) {
  byKey.set(`${record.ecosystem}:${record.name}:${record.version}`, record);
}

const dependencies = [...byKey.values()].sort((left, right) =>
  `${left.ecosystem}:${left.name}:${left.version}`.localeCompare(
    `${right.ecosystem}:${right.name}:${right.version}`,
    "en",
  ),
);

const next = {
  ...current,
  dependencies,
};
await writeFile(provenancePath, `${JSON.stringify(next, null, 2)}\n`);

const rows = [];
for (const dependency of dependencies) {
  rows.push(
    `| ${dependency.ecosystem}:${dependency.name} | ${dependency.version} | ${dependency.role} | ${dependency.license} | ${dependency.source} |`,
  );
}
for (const toolchain of current.toolchains ?? []) {
  rows.push(
    `| toolchain:${toolchain.name} | ${toolchain.version} | ${toolchain.role} | ${toolchain.license} | ${toolchain.source} |`,
  );
}
for (const action of current.ciActions ?? []) {
  rows.push(
    `| action:${action.repository} | ${action.release} / ${action.commit} | CI_BOOTSTRAP | ${action.license} | https://github.com/${action.repository} |`,
  );
}

const notices = `# Third-Party Notices — Section 1.1 Desktop Foundation\n\nThis file records the repository-reviewed dependency, toolchain, and CI/bootstrap inventory required by the current implementation baseline. It is not the final release SBOM or packaged-asset notice set.\n\n| Component | Version | Role | License | Source |\n|---|---:|---|---|---|\n${rows.join("\n")}\n\n\`third_party/provenance.json\` is the machine-readable review record consumed by static CI. Final packaged dependencies/assets, required license texts, SBOM, and signed release provenance remain cumulative release work.\n`;
await writeFile(noticesPath, notices);

console.log(`[section1-provenance] dependencies=${dependencies.length}`);
