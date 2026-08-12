# Production Test Architecture

`tests/` is the repository-owned execution namespace for the contract-defined JARVIS test layers.

## Canonical layers

`tests/test-layers.json` contains exactly the 15 layers from Verification Contract §7. Each layer has a stable directory under `tests/layers/<layer-id>/`.

The Phase-0 harness activates deterministic foundation coverage for unit, property/state-machine, schema/contract, platform-architecture, and safety/adversarial behavior. Later owning sections add real integration, UI, recovery, persistence, performance, voice, packaging, provider, tool, and module tests to their reserved layers.

`node tools/test/run-tests.mjs --profile qualification` intentionally fails while any canonical layer has no tests. An empty future layer therefore cannot be interpreted as release qualification.

## Normal-change execution

`node tools/test/run-tests.mjs --profile normal`

Normal-change tests:
- run in deterministic sorted order;
- receive a scrubbed environment rather than arbitrary developer/CI credentials;
- run with outbound Node network primitives disabled;
- never blind-rerun failed files;
- use a stable `JARVIS_TEST_SEED` (override only to reproduce/expand a property failure);
- require every Phase-0 harness layer to contain executable coverage.

Use `--layer <canonical-layer-id>` for a focused run.

## Qualification execution

`node tools/test/run-tests.mjs --profile qualification`

Qualification mode does not install mocks or silently skip empty layers. It requires executable tests in all 15 layers and leaves real integration/network/device access to the owning qualification tests. Real Windows, SQLite/SQLCipher, Tauri, Codex, updater, GitHub/Proxmox, voice/device, and UI/DPI qualification must remain real where the contracts require it.

## Fixtures

`tests/fixtures/manifest.json` indexes small synthetic JSON fixtures used by deterministic tests. `loadSyntheticJsonFixture()` enforces:
- synthetic provenance;
- explicit `containsRealCredentials: false`;
- fixture-root confinement;
- regular non-symlink files;
- a 1 MiB bound;
- SHA-256 integrity before JSON parsing.

Large/binary/media/release fixtures are owned by the later feature layers and require their own explicit bounded loader/metadata; do not weaken the small synthetic JSON loader to accommodate them.

Synthetic fixtures never contain real credentials.

## Flakiness policy

A failure is a failure. The runner executes each selected file once and reports the result. Blind rerun-to-green is intentionally absent; nondeterminism must be investigated and fixed.
