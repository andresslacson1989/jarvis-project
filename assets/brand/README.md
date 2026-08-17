# JARVIS Brand Assets

This directory contains the canonical production source assets for the JARVIS brand defined by `docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md`.

Current canonical sources:

- `jarvis-mark.svg` — standalone symbol mark;
- `jarvis-lockup.svg` — symbol + JARVIS wordmark lockup;
- `jarvis-app-icon.svg` — application-icon master source.

Packaged identity inputs:

- `fonts/InterVariable.woff2` — offline primary UI typeface, Inter v4.1;
- `third-party/Inter-OFL.txt` — the required SIL Open Font License 1.1 notice;
- `third-party/provenance.json` — machine-readable source, license, and SHA-256 records.

## Brand colors

Only these colors are part of the JARVIS brand identity:

```text
JARVIS Blue  #2D7BFF
Pure White   #FFFFFF
Deep Slate   #0B0F14
```

Functional UI status colors are not logo colors.

## Production rules

- Raster/ICO/installer variants SHALL be generated from the canonical vector sources rather than redrawn independently.
- Do not rotate, stretch, recolor with semantic status colors, add permanent glow/bevel/texture, or alter the segmented-ring/core geometry for production variants.
- The lockup uses the release-owned Inter UI typeface with the contract fallback stack. Production packaging SHALL provide the qualified font locally; it SHALL NOT depend on a network/CDN fetch.
- Font, icon, and other third-party visual dependencies SHALL have recorded source/license/provenance and required notices included in release artifacts.
- If the wordmark is later converted to outlined vector paths, the visual result SHALL preserve the approved lockup proportions and requires a normal synchronous design-contract update.

The Windows ICO is generated from `jarvis-app-icon.svg` by
`tools/assets/generate-brand-icons.mjs`. The generator is deterministic, validates
the approved three-color source palette, and emits PNG-compressed layers at the
qualified Windows sizes. Run `pnpm brand:icons` after changing the canonical app-icon source.

These files are product assets. Generated platform artifacts may differ in file format or required padding but SHALL preserve the canonical identity.
