<div align="center">

# 🐾 NekoChat `(Beta)`

### **Your AI Roleplay World**

*An open-source mobile-first roleplay chat client built with Expo, React Native, and TypeScript.*  
*No accounts. No remote database. Your chats, memories, character cards, and API keys never leave your device.*

<p>
  <img src="https://img.shields.io/badge/Expo-React_Native-000020?style=for-the-badge&logo=expo&logoColor=white" alt="Expo React Native" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Memory-SQLite_%2B_FTS5-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite FTS5" />
  <img src="https://img.shields.io/badge/BYOK-Zero_Login-10B981?style=for-the-badge" alt="BYOK Zero Login" />
  <img src="https://img.shields.io/badge/License-MIT_with_Attribution-F59E0B?style=for-the-badge" alt="MIT License" />
</p>

<p>
  <a href="#-why-nekochat">Why NekoChat</a> •
  <a href="#-core-features">Core Features</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-verification--tests">Tests</a>
</p>

</div>

---

## ✨ Why NekoChat?

| Pillar | What It Means for You |
| :--- | :--- |
| 🔑 **True Unrestricted BYOK** | Plug in **Gemini, OpenRouter, OpenAI, or any OpenAI-compatible endpoint** (cloud or local LAN). No artificial 15K output cap — enter custom token limits or pick **`Unlimited (0)`** to let your provider decide. |
| 🚫 **Zero Login, Zero Cloud DB** | Clone, add your API key, and chat immediately. No user accounts, no MySQL/backend setup, and no remote chat storage. |
| 🧠 **On-Device SQLite + FTS5 Memory** | Native Android/iOS builds store conversations, structured state slots, and pinned facts in **SQLite** with **FTS5/BM25** recall for older rolled-off turns (`AsyncStorage` fallback on Web). |
| 🌿 **Isolated Chat Branching** | Fork any conversation at any turn inside an atomic SQLite transaction (`withExclusiveTransactionAsync`) with **zero future-state leakage**. |

---

## 🚀 Core Features

### 💬 Chats, Memory & Timeline Branching (`ChatsScreen` & `ChatRoomScreen`)
- **Bento Grid & Dropdown Accordion:** Switch between a 2-column character grid and a single-focus accordion list with multi-session support per character.
- **FTS5 / BM25 Long-Term Recall:** Older messages that roll off the active context window are searched locally per session and injected cleanly under `[RECALLED EARLIER IN THIS SESSION]`.
- **Clean Timeline Branching (Native SQLite):** Tap **Branch** on any message to fork a new timeline (`Branch · Turn N`):
  - Copies only messages up to the branch point with **fresh unique IDs** and FTS5 rows.
  - Filters `session_memories` strictly by turn provenance — excluding future memories, unattributed notes, and state slots overwritten after the branch point.
  - Strips future `<memory>` checkpoints so branches never get spoiled by later turns.
- **Memory Lifecycle Invalidation:** Editing, deleting, or regenerating a message automatically marks dependent non-pinned memories `stale` and flags pinned facts as `needs_review`.
- **Novel & Bubble Reading Modes:** Switch between full-width novel prose and chat bubbles, with clickable avatars and a fullscreen image lightbox.
- **Roleplay Polish:** Collapsible `<think>` / `<thought>` / `<reasoning>` blocks, word-by-word text reveal, configurable dialogue/action/thought colors, `{{user}}` / `{{char}}` macros, alternate greeting cycling, custom chat wallpapers/blur, and TTS (`expo-speech`).
- **Desk Neko:** Optional pixel Neko companion on the input bar with an inline timing mini-game.

<details>
<summary><b>🔍 Discover & Community Catalogs (<code>DiscoverScreen</code>)</b></summary>

- **JanitorAI (Datacat) & Chub.ai:** Browse community characters and creators with infinite scroll, tag filtering, `Trending` / `Popular` / `Latest` sorting, `All` / `Following` / `Favorites` scope, and `NSFW` / `SFW` toggle.
- **Rich Profiles:** HTML/Markdown description rendering, inline gallery extraction, and alternate greetings preview.
- **Match Mode (`TinderDeck`):** Swipe-to-match character deck with Undo, Favorite, Info, and instant Chat.

</details>

<details>
<summary><b>🛠️ BYOK Engine, Security & User Studio (<code>SettingsScreen</code> & <code>UserStudioScreen</code>)</b></summary>

- **Independent Context & Output Budgets (`promptBudget.ts`):** Separate `contextLimit` and `maxOutputTokens` with per-model overrides and endpoint-scoped metadata caching. Presets (`1K`, `4K`, `8K`, `15K`, `Unlimited`) plus custom values above `15K` and non-blocking budget warnings.
- **Hardware-Backed Key Hygiene (`secureKeyStore.ts`):** Native API keys are stored in `expo-secure-store` with readback verification before stripping plaintext keys; `.neko` Data Vault exports strip `providers` and `apiKey` secrets.
- **First-Time Onboarding:** Guided setup for UI language, AI provider/key presets (Gemini, OpenRouter, OpenAI, Anoman, Sumopod, local LAN), optional 4-digit passcode lock, and a skippable tour.
- **User Studio:** Create, edit, and import character cards (`.json` / `.png` SillyTavern cards), manage User Personas, and build keyword-triggered Codex Lorebooks.
- **Languages & Themes:** UI translations (`en`, `id`, `ja`, `es`, `zh`, `ko`) with optional AI language directives, plus dark palettes (`Midnight Cyber`, `Sakura Dusk`, `Warm Slate`, `Cyan`).

</details>

---

## 🏗️ How It Works

```text
┌───────────────────────────────────────────────────────────────────┐
│                      Your Device (Expo App)                       │
│                                                                   │
│  • Chats, Personas & Memories ──▶ Local SQLite + FTS5 (Native)    │
│  • API Keys                   ──▶ Expo SecureStore (Native)       │
│  • Prompt & Token Budget      ──▶ promptBudget.ts (On-Device)     │
└───────────────┬───────────────────────────────────┬───────────────┘
                │ Direct BYOK API Calls             │ Optional (Web CORS / Catalogs)
                ▼                                   ▼
   ┌─────────────────────────┐         ┌────────────────────────────┐
   │    Your AI Provider     │         │  server.mjs (Port 3001)    │
   │  Gemini / OpenRouter /  │◀────────│  Stateless Passthrough     │
   │  OpenAI / Custom / LAN  │  /llm-  │  • Zero Accounts / Zero DB │
   └─────────────────────────┘  proxy  │  • Datacat Catalog Proxy   │
                                       └────────────────────────────┘
```

---

## ⚡ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) `v20+`
- `npm`
- [Expo Go](https://expo.dev/go) on Android or iOS (or a native development build)

### Run Locally

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Start the stateless community catalog & Web CORS proxy (port 3001)
npm run proxy

# 3. In another terminal, start the Expo development server
npm start
```

### Platform Commands
| Target | Command |
| :--- | :--- |
| 🤖 **Android** | `npm run android` |
| 🍎 **iOS** | `npm run ios` |
| 🌐 **Web** | `npm run web` |

---

## 🧪 Verification & Tests

```bash
# Typecheck
npx tsc --noEmit

# Lint
npx expo lint

# Run unit & integration suites (Phases 1–6)
node --test tests/phase1-memory-prompt.test.mjs tests/phase2-sqlite-migration.test.mjs tests/phase3-security-privacy.test.mjs tests/phase4-bm25-retrieval.test.mjs tests/phase5-memory-lifecycle.test.mjs tests/phase6-chat-branching.test.mjs
```

---

## 🤝 Contributing & License

Contributions, bug reports, and translations are welcome!  
See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and [our PR template](.github/pull_request_template.md).

Licensed under the **MIT License with Attribution** — see [LICENSE](LICENSE) for details.
