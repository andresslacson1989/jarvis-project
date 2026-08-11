# JARVIS Brand Assets

This directory contains the canonical production source assets for the JARVIS brand defined by `docs/implementation/JARVIS-UI-IDENTITY-DESIGN-SYSTEM-CONTRACT.md`.

Current canonical sources:

- `jarvis-mark.svg` — standalone symbol mark;
- `jarvis-lockup.svg` — symbol + JARVIS wordmark lockup;
- `jarvis-app-icon.svg` — application-icon master source.

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

These files are product assets. Generated platform artifacts may differ in file format or required padding but SHALL preserve the canonical identity.
