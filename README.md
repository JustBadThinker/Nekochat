<div align="center">

# 🐾 NekoChat `(v0.2.4 Beta)`

### **Local-First AI Roleplay Client — Zero Login, Zero Remote Chat DB**

*Built with Expo, React Native, and TypeScript. Your chats, memories, character cards, taste profile, and API keys stay on your device.*  
*(Yes, it's an indie project — built with way too much coffee and a stubborn pixel cat.)*

<p>
  <a href="https://github.com/JustBadThinker/nekochat/releases/latest">
    <img src="https://img.shields.io/badge/Download_APK-Latest_Release-D4FF00?style=for-the-badge&logo=android&logoColor=black" alt="Download Latest Android APK" />
  </a>
  <img src="https://img.shields.io/badge/Expo-React_Native-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo React Native" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/BYOK-Zero_Login-10B981?style=for-the-badge" alt="BYOK Zero Login" />
  <img src="https://img.shields.io/badge/License-MIT_with_Attribution-F59E0B?style=for-the-badge" alt="MIT License" />
</p>

<p>
  <a href="#-for-users-beginners">For Users (Download)</a> •
  <a href="#-what-is-byok">What is BYOK?</a> •
  <a href="#-what-nekochat-actually-has">Features</a> •
  <a href="CHANGELOG.md">Changelog</a> •
  <a href="#-for-developers--contributors">For Developers</a> •
  <a href="#-credits--acknowledgements">Credits</a>
</p>

<br />

<img src="docs/screenshots/showcase-banner.png" alt="NekoChat Mobile Showcase — My Chats, Chat Room, Discover, and Settings" width="100%" />

<br /><br />

<img src="docs/screenshots/skins-showcase.png" alt="NekoChat UI Skins & Palettes — Neko Bento, Classic, Material 3 Expressive, and HIG Liquid Glass" width="100%" />

</div>

---

## 📱 For Users (Beginners)

Just want to install and chat? You don't need to touch any code.

<p align="left">
  <a href="https://github.com/JustBadThinker/nekochat/releases/latest">
    <img src="https://img.shields.io/badge/⬇️_Download_Android_APK-GitHub_Releases-10B981?style=for-the-badge" alt="Download Android APK" />
  </a>
</p>

1. **Download & Install** the latest `.apk` from [GitHub Releases](https://github.com/JustBadThinker/nekochat/releases/latest) (or check in-app via **Settings → About NekoChat → Check for Updates**).
2. **Add an API Key (BYOK)** during onboarding or in **Settings → AI Engine Suite** (Gemini has a free tier; OpenRouter, OpenAI, and local LAN endpoints also work).
3. **Pick a Character** from **Discover** (JanitorAI / Datacat or Chub.ai), import a `.json` / `.png` card, or make your own in **Studio** — then start chatting.

---

## 🔑 What is BYOK?

**BYOK = Bring Your Own Key.** You connect your own API key (Gemini, OpenRouter, OpenAI, or a local model server on your Wi-Fi) instead of paying a NekoChat subscription. *(NekoChat does not bundle free AI credits — you bring your own API key or local endpoint.)*

### Your Data, Your Device. Your AI Provider, Your Choice.

- **Local Storage:** Conversations, memories, character cards, taste preferences, and app settings are stored locally on your device.
- **No NekoChat Account:** NekoChat does not require an account or operate a centralized chat database.
- **Direct AI Connection:** When you send a message, the relevant conversation context is sent directly to your selected AI provider for generation.
- **Provider Privacy:** Data handling, retention, and logging depend on the AI provider's own privacy policy.
- **Secure API Keys & Links:** On native builds, both LLM provider keys and Image Gen API keys are stored using `expo-secure-store`. External links inside character cards and profiles are validated to `http(s)` URLs.

NekoChat does not operate a remote chat server. However, using a cloud AI provider means your prompts are transmitted to that provider.

---

## ✨ What NekoChat Actually Has

No buzzwords — here is what's actually built and working today:

### 💬 Chats, Reading & Roleplay
- **My Chats (`ChatsScreen`):** 3-column Bento grid or expandable Accordion list, multi-session support per character, **Smart Notifications & Followed Creator Drops** inbox, and Timeline Branching (**Branch · Turn N**) to fork stories cleanly without future memory leaking back.
- **Story/Novel & Bubble Modes (`ChatRoomScreen`):** Switch between full-width Novel prose and contained chat bubbles, with configurable dialogue/narration/thought colors and message font presets (`Default`, `Serif`, `Mono`, `Light`).
- **One-Tap Persona Switcher:** Switch active roleplay personas directly inside the chat room with an avatar + name + preview list tailored to every UI skin.
- **Response Length & Thinking Inspector:** Choose `Standard` (6–9 paragraphs) or `Shorter` (max 5 paragraphs). Tap **Thinking** above an AI reply to view the sanitized prompt and any `<think>` / reasoning tokens emitted by reasoning models.
- **Smart Auto-Darken Wallpapers:** Set a per-chat wallpaper or toggle **Apply background to all chats**. *(Note: on Web, brightness auto-sampling uses a 16×16 canvas and falls back to a 56% dark scrim if a remote image host blocks CORS.)*
- **On-Device Memory & TTS:** Native builds use **SQLite + FTS5/BM25** recall for older rolled-off turns (`AsyncStorage` fallback on Web), manual/auto checkpoints, `[OOC: ...]` mode, and device TTS (`expo-speech`).
- **Desk Neko:** A pixel cat that walks, grooms, and naps on top of the chat input bar — drag/toss her gently or tap her for a quick jump mini-game while waiting for replies.

### 🔍 Discover & Codex
- **Community Catalogs (`DiscoverScreen`):** Browse **JanitorAI (Datacat)** and **Chub.ai** across **Catalog Grid**, **For You**, and **Match Mode** with SFW/NSFW filtering and smart `#tag` search (maps aliases like `#dominance` → `#dominant` and strips literal `#` symbols).
- **100% On-Device Taste Engine (`tasteEngineService` & `Settings → For You & Taste`):** Learns strictly on your phone from likes, chats, search keywords, tag filter taps, RP token depth, and quick-skips with 14-day exponential decay. Inspect learned tags, boost or mute tags, override Character Focus (`Auto` / `Female` / `Male` / `All`), pause learning, or reset anytime.
- **Dynamic Cast (`dynamicCastService.ts`):** Detects extra characters from multi-character cards as one-tap `+ Name` chips, and switches RPG/world cards to **Narrator / Game Master** mode.
- **Studio & Codex Lorebooks:** Create or import SillyTavern V1/V2/V3 cards (`.json` / `.png`), manage User Personas, and attach keyword-triggered **Lorebooks** (SillyTavern JSON or JanitorAI static script extractor without `eval()`) to **any** character.
- **In-App Help Center (`HelpCenterModal.tsx`):** Searchable guides inside **Settings → Help & Guides** and **"What is a Lorebook?"** links.

### 🎨 Skins, Themes & Backups
- **4 Distinct UI Skins:**
  - **Neko Bento:** Tactile keycap cards and a **2×2 Bento macro-pad composer** with a detached Send/Expand stack.
  - **HIG Liquid Glass:** Live Android 12+ hardware GPU blur (`BlurTargetView` / `dimezisBlurViewSdk31Plus`), specular rims, and feathered radial backdrop glows.
  - **Material 3 Expressive:** Dynamic accent-tinted tonal surfaces (`getM3TonalContainer`), Android 16 segmented list geometry, thick expressive sliders, and pill-shaped floating composer.
  - **Classic:** Sleek dark frosted glass with a **liquid-merge frosted pill composer**.
- **8 Dark Color Palettes:** `Midnight Cyber`, `Sakura Dusk`, `Warm Slate`, `Cyber Cyan`, `Crimson Velvet`, `Amethyst Night`, `Matcha Forest`, and `Sunset Tangerine`.
- **Direct GitHub Release Checker & Vault:** Check for new APK releases directly inside **Settings → About NekoChat**, lock the app with Passcode Lock, and export/import sanitized `.neko` backups with API keys automatically stripped.

---

## 🛠️ For Developers & Contributors

Want to run NekoChat locally, poke at the code, or open a PR? Welcome!

### Prerequisites
- [Node.js](https://nodejs.org/) `v20+`
- `npm`
- [Expo Go](https://expo.dev/go) on Android/iOS, or an Android/iOS emulator / web browser

### Run Locally
```bash
# 1. Clone and install
git clone https://github.com/JustBadThinker/nekochat.git
cd nekochat
npm install

# 2. (Optional, needed for Web CORS / Datacat catalog proxy)
npm run proxy

# 3. Start Expo dev server
npm start
# or directly: npm run android | npm run ios | npm run web
```

### Verify Before Committing
```bash
# Typecheck
npx tsc --noEmit

# Lint
npx expo lint

# Unit & integration tests (85 tests across 15 suites)
node --test tests/*.test.mjs
```

### Project Map (Where Things Live)
| Folder | What's Inside |
| :--- | :--- |
| `src/screens/` | Main screens (`ChatsScreen`, `DiscoverScreen`, `ChatRoomScreen`, `UserStudioScreen`, `SettingsScreen`) |
| `src/components/chat/` | Extracted chat room modules (`ChatBackgroundLayer.tsx`, etc.) |
| `src/components/` | Shared UI (`BottomSheetModal`, `ChatComposerBar`, `HelpCenterModal`, `CapsuleDock`, `DeskNekoWalker`, `TinderDeck`, etc.) |
| `src/services/` | Storage (`SQLite` + `AsyncStorage`), `tasteEngineService` & `tasteEngineLogic`, `githubUpdateService`, AI/SSE streaming (`openAiStream`), Lorebooks, Dynamic Cast, Notifications, Passcode, Vault |
| `src/theme/` | UI Skins (`neko`, `classic`, `material`, `hig`) and 8 dark color palettes |
| `src/utils/` | Image helpers and safe external URL validation (`urlSafety.ts`, `safeExternalUrl.ts`) |
| `server.mjs` | Optional stateless local proxy on port `3001` for Web CORS & Datacat catalog requests |

---

## 🙏 Credits & Acknowledgements

NekoChat wouldn't exist without these open-source tools and community specs:
- **[Expo](https://expo.dev/) & [React Native](https://reactnative.dev/)** (`expo-sqlite`, `expo-secure-store`, `expo-blur`, `expo-linear-gradient`, `expo-speech`, `expo-file-system`, `expo-image-picker`, `expo-document-picker`)
- **[Lucide Icons (`lucide-react-native`)](https://lucide.dev/)** for crisp icons across every screen
- **[CryptoJS](https://github.com/brix/crypto-js)** for client-side Data Vault encryption helpers
- **Community Character Card Specs:** SillyTavern Character Card V1 / V2 / V3 (`chara` / `ccv3` PNG metadata & JSON) and Lorebook V2 format
- **Community Catalogs:** [Chub.ai](https://chub.ai/) and Datacat / JanitorAI public character ecosystems

---

## 🤝 Contributing & License

Pull requests, bug reports, UI polish, and translations are always welcome!  
Check [CONTRIBUTING.md](CONTRIBUTING.md) and our [PR template](.github/pull_request_template.md) before opening a PR.

Licensed under the **MIT License with Attribution** — see [LICENSE](LICENSE) for details.
