# Changelog

All notable changes to NekoChat are documented in this file.

## [0.2.4] - 2026-11-26

### Added
- **Dedicated On-Device Taste Engine (`tasteEngineLogic.ts` & `tasteEngineService.ts`):**
  - Split recommendation learning into an isolated 100% local module (zero external analytics).
  - Added 14-day exponential weight decay, explicit `genderFocus` (`Auto` / `Female` / `Male` / `All`), pinned & muted tags, RP token-depth matching, implicit creator affinity, search keyword extraction, category tag-tap boosts, and quick-skip tracking in `For You`.
  - Upgraded `matchAlgorithmService` to fetch Datacat/Chub candidates dynamically using learned tags and real Datacat tag IDs (`resolveRemoteTagIds`), and fixed neutral RPG cards skewing toward female recommendations.
- **Settings → For You & Taste:** Transparent on-device control center to view interaction insights, pause learning, switch Character Focus, boost or remove learned tags, mute unwanted tags, and reset taste or seen deck history.
- **One-Tap In-Chat Persona Switcher (`ChatRoomScreen`):** Redesigned the chat-room persona modal into a compact, vertically centered `[Avatar] [Name + Preview] [Check]` list adapted faithfully across all 4 skins.
- **Direct GitHub Releases Updater (`githubUpdateService.ts` & About NekoChat):** Added **Check for Updates** right inside **Settings → About NekoChat** to query `JustBadThinker/nekochat` releases, compare semver versions, show release highlights, and surface direct `.apk` download links.
- **Hardened External Link Validation (`urlSafety.ts`, `safeExternalUrl.ts`) & Image Gen Key Storage (`imageGenService.ts`):** Migrated Image Gen API keys into `expo-secure-store` on native builds and enforced `http(s)` protocol allowlisting for external links.

### Changed & Polished
- **Neko Bento:** Added tactile `3.5px` keycap bottom lips, asymmetric Settings Bento grid, balanced contrast bubbles, and a **2×2 Bento Macro-Pad Composer**.
- **HIG Liquid Glass:** Enabled live Android 12+ GPU blur (`BlurView` + `BlurTargetView` via `dimezisBlurViewSdk31Plus`), specular 3D rims, and feathered SVG radial ambient glows in Settings.
- **Material 3 Expressive:** Dynamic accent-tinted tonal surfaces (`getM3TonalContainer`), Android 16 segmented list radii, thick expressive sliders (`SmoothSlider`), morphing `NekoSwitch`, spring capsule dock indicator, and floating pill composer.
- **Classic:** Floating frosted glass pill with smooth timing-based liquid merge on focus, frosted chat chrome & bubbles, and reliable persona-pill blur debouncing.
- **Bottom Sheets & Profile Modals:** Fixed native Android/iOS `ScrollView` gesture conflicts in `BottomSheetModal`, and converted `CommunityCharacterModal` and `CreatorProfileModal` into slide-up sheets with top-zone swipe-to-dismiss.

## [0.2.3] - 2026-11-24

### Added & Changed
- Modular UI Skins (`Neko Bento`, `Classic`, `Material 3 Expressive`, `HIG Liquid Glass`) with skin-driven transitions, 6-message initial chat fade-in, and ABI-split Android APKs.

## [0.2.2] - 2026-11-22

### Added & Changed
- Token Stripper & prompt budget telemetry, live SSE streaming diagnostics (`openAiStream`), capability matrix probes, performance optimizations, and `8×10` Desk Neko pixel sprite sheet.

## [0.2.1] - 2026-11-18

### Added & Changed
- In-app Help Center (`HelpCenterModal`), per-character Codex Lorebooks, `ChatBackgroundLayer` with smart wallpaper darkening, SQLite FTS5/BM25 long-term memory, Timeline Branching, Dynamic Cast, and Android APK release pipeline.
