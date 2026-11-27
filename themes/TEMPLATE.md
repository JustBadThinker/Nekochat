# Creating a NekoChat Community Theme Pack

NekoChat supports **Decoupled Full Theme Packs** hosted in this repository (`themes/packs/*.json`). A single Theme Pack can customize **layout**, **surfaces**, **geometry**, and **every app animation**, AND optionally ship **1–12 custom color schemes** (`palettes`) while still working cleanly with all built-in NekoChat color schemes!

## Quick 3-Step Guide

1. **Copy the annotated starter template:**
   Start from [`themes/STARTER_TEMPLATE.jsonc`](./STARTER_TEMPLATE.jsonc) — every field (`palettes`, `layout`, `surfaces`, `geometry`, and every `animation` slot) is documented inline with valid options and safe value ranges.
2. **Create your clean `.json` pack:**
   Save your finished theme (without `//` comments) to `themes/packs/<your-theme-id>.json`.
   - Include `palettes: [...]` to add 1 or more new color schemes into **Settings → Appearance → Color Scheme**.
   - Or omit `palettes` completely to publish a **Skin-Only Pack** (pure shapes, surfaces, layout & animations that pair with NekoChat's built-in colors).
3. **Register it in the catalog & validate:**
   Add a manifest entry in [`themes/index.json`](./index.json) pointing `packUrl` to:
   `https://raw.githubusercontent.com/JustBadThinker/Nekochat/main/themes/packs/<your-theme-id>.json`

   Then verify everything passes the strict validator:
   ```bash
   node --test tests/theme-pack-schema.test.mjs
   ```

## Safety Clamps (Applied Automatically)
- **CSS colors:** Hex `#RGB`, `#RRGGBB`, `#RRGGBBAA`, `rgb(...)`, or `rgba(...)`. (`accentRgb` is auto-derived if you use hex for `accent`.)
- **URLs:** Only `https://` URLs are allowed for `previewImage` and `packUrl`.
- **Bounds:** Radii `0–999`, border widths `0–6`, opacities `0–1`, glow radius `0–32`, durations `40–700ms`, `speedScale` `0.4–1.6`, spring friction `3–20`, spring tension `40–320`.
