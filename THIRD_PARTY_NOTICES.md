# Third-Party Notices — Phase 0 Baseline

This file records the current third-party build/test dependency and CI/bootstrap tools introduced by Phase 0. It is not the final release SBOM or packaged-asset notice set.

| Component | Version | Role | License | Source |
|---|---:|---|---|---|
| TypeScript | 6.0.3 | Build/test dependency; not packaged runtime | Apache-2.0 | Microsoft/TypeScript |
| ajv | 8.17.1 | Draft 2020-12 schema validation; not packaged runtime | MIT | ajv-validator/ajv |
| fast-deep-equal | 3.1.3 | AJV transitive schema-validation dependency; not packaged runtime | MIT | epoberezkin/fast-deep-equal |
| fast-uri | 3.1.5 | AJV transitive schema-validation dependency; not packaged runtime | BSD-3-Clause | fast-uri/fast-uri |
| json-schema-traverse | 1.0.0 | AJV transitive schema-validation dependency; not packaged runtime | MIT | epoberezkin/json-schema-traverse |
| require-from-string | 2.0.2 | AJV transitive schema-validation dependency; not packaged runtime | MIT | floatdrop/require-from-string |
| Node.js | 24.18.0 | Build/runtime toolchain baseline | MIT | nodejs/node |
| pnpm | 11.21.0 | Package manager | MIT | pnpm/pnpm |
| Rust | 1.97.1 | Build toolchain | MIT OR Apache-2.0 | rust-lang/rust |
| Tauri | 2.11.5 | Declared release fact; not yet implemented/packaged | Apache-2.0 OR MIT | tauri-apps/tauri |
| actions/checkout | v7.0.1 / pinned commit | CI bootstrap | MIT | actions/checkout |
| pnpm/setup | v2.0.2 / pinned commit | CI package-manager/runtime bootstrap | MIT | pnpm/setup |

`third_party/provenance.json` is the machine-readable review record consumed by static CI. Final packaged dependencies/assets, required license texts, SBOM, and signed release provenance remain cumulative release work.
