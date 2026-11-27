# NekoChat Theme Pack Template (`schemaVersion: 1`)

NekoChat supports optional, downloadable **Theme Packs** hosted right in this repository (`themes/packs/*.json`). Theme Packs are pure validated JSON (no executable code) and can customize **Colors**, **Surfaces**, **Geometry**, and **Every App Animation**.

## 1. JSON Structure

```json
{
  "schemaVersion": 1,
  "id": "my-theme-id",
  "name": "My Custom Theme",
  "author": "YourHandle",
  "version": "1.0.0",
  "description": "Short summary shown in the Theme Store detail modal.",
  "badge": "Badge",
  "baseSkin": "bento",
  "tags": ["Pastel", "Neon"],
  "previewImage": "https://raw.githubusercontent.com/.../preview.png",
  "palette": {
    "accent": "#CBA6F7",
    "accentMuted": "#B4BEFE",
    "accentRgb": "203, 166, 247",
    "bgDark": "#11111B",
    "bgSurface": "#1E1E2E",
    "bgSurfaceSubtle": "#313244",
    "webFrameBg": "#0B0B12",
    "dockBg": "rgba(24, 24, 37, 0.92)"
  },
  "surfaces": {
    "surfaceMode": "oled",
    "cardBorderAccentMix": 0.16,
    "cardGlowOpacity": 0.14,
    "cardGlowRadius": 12,
    "keycapLipWidth": 3.5,
    "specularRimOpacity": 0.5,
    "userBubbleBg": "rgba(203, 166, 247, 0.18)",
    "aiBubbleBg": "#1E1E2E"
  },
  "geometry": {
    "cardRadius": 22,
    "cardBorderWidth": 1.25,
    "buttonRadius": 16,
    "pillRadius": 999,
    "inputRadius": 24,
    "sheetRadius": 28,
    "grabberWidth": 38,
    "grabberHeight": 4.5,
    "bubbleRadius": 20,
    "bubbleTailRadius": 6,
    "bubbleBorderWidth": 1.25,
    "dockRadius": 30,
    "dockBorderWidth": 1.25,
    "pressScale": 0.95
  },
  "animation": {
    "mode": "spring",
    "speedScale": 1.0,
    "easing": "cubicOut",
    "enterDuration": 240,
    "enterTranslateY": 12,
    "enterScaleFrom": 0.94,
    "springFriction": 6,
    "springTension": 145,
    "pressScale": 0.95,
    "pressFriction": 5.5,
    "pressTension": 210,
    "pressDuration": 120,
    "dockSpringFriction": 6.5,
    "dockSpringTension": 150,
    "sheetOpenDuration": 260,
    "sheetCloseDuration": 210,
    "sheetSnapFriction": 8,
    "sheetSnapTension": 120,
    "screenEnterFriction": 9,
    "screenEnterTension": 90,
    "screenExitDuration": 210,
    "switchFriction": 7,
    "switchTension": 130,
    "tabFadeDuration": 170,
    "composerDuration": 210,
    "collapsibleDuration": 160
  }
}
```

## 2. Field Reference & Clamps

- **`baseSkin`**: `"bento" | "janitor" | "material" | "ios"` (controls layout architecture & fallback tokens).
- **`animation.easing`**: `"cubicOut" | "quadOut" | "expoOut" | "backOut" | "iosStandard" | "m3Emphasized" | "linear"` OR a 4-number cubic bezier array `[x1, y1, x2, y2]`.
- **`animation.speedScale`**: `0.4` (very fast) to `1.6` (relaxed), default `1.0`.
- **Radii**: `0`–`999`; **Durations**: `40`–`700` ms; **Spring friction**: `3`–`20`; **Spring tension**: `40`–`320`.
- **`previewImage`**: Optional `https://` screenshot URL shown above the live miniature preview in the Theme Store modal.
