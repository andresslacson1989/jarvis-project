# Bootstrap Windows Build Icon

`icon.ico` is the canonical-derived Windows application icon for the current
desktop packaging foundation. It is generated from
`assets/brand/jarvis-app-icon.svg` by
`tools/assets/generate-brand-icons.mjs`; the generator emits PNG-compressed
16, 24, 32, 48, 64, and 256 pixel layers for the pinned Tauri resource path.

The canonical SVG remains the source of truth. Do not redraw or edit the ICO by
hand. Regenerate it after changing the source and keep the generated hash in
`assets/brand/third-party/provenance.json`.
