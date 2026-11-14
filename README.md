# 🐾 NekoChat (Beta)

> **Free & Open-Source AI Roleplay & Companion Client**  
> *Mobile-first, local-first AI roleplay app built with Expo, React Native, and TypeScript.*

---

## ✨ Implemented Features

### 💬 Chats & Immersion (`ChatsScreen` & `ChatRoomScreen`)
- **2-Column Bento Chat Grid**: Active companion cards with progressive dark gradients, frosted glassmorphism, and quick multi-session resume.
- **Trending 24h Stories**: Story tray and viewer modal to jump straight into trending community characters.
- **Novel Mode & Bubble Mode**: Toggle between full-width visual novel reading and messenger-style chat bubbles, with clickable profile avatars and a fullscreen image lightbox.
- **Roleplay Formatting & Macros**: Custom colors for spoken dialogue, italicized actions, and thoughts, plus dynamic `{{user}}` and `{{char}}` macro replacement and character RP name extraction (`chat_name`).
- **Reasoning Isolation & Word Reveal**: Keeps `<think>` / `<thought>` / `<reasoning>` blocks out of the visible reply inside a collapsible `Thinking` peek window, with smooth word-by-word reveal.
- **Chat Controls**: Multi-session switching, scenario & alternate greeting cycling, `<memory>` story checkpoints, custom chat wallpaper/blur/overlay settings, in-chat message editing/regeneration/continuation, and text-to-speech (`expo-speech`).
- **Desk Neko & Opt-In Fidget**: A 4×4 pixel Neko pet perched on the input bar (walking, idling, paw-licking, and reacting while you type) — tap her anytime to open the compact timing fidget & 4×1 interactive Neko card.

### 🧭 Discover (`DiscoverScreen`)
- **Catalog Grid**: Browse live community characters and creators (JanitorAI / Datacat & Chub.ai) with infinite scroll, tag drawer filtering, `Trending` / `Popular` / `Latest` sorting, `All` / `Following` / `Favorites` scope, and `NSFW` / `SFW` toggle.
- **Rich Character & Creator Profiles**: Renders creator HTML bios, inline description artwork (also collected in the Gallery tab), and merged greeting + alternate greetings accordion.
- **Match Mode (`TinderDeck`)**: One-hand swipe-to-match character deck with Undo/Rewind, Favorite, Info, and instant Chat, backed by local seen-ID tracking and tag affinity scoring.

### 🛠️ Studio & Settings (`UserStudioScreen` & `SettingsScreen`)
- **User Studio**: Create, edit, and import character cards, manage multiple User Personas (with quick in-chat switching), and create Codex Lorebooks.
- **BYOK AI Engine**: Connect your own API keys/endpoints (Google Gemini, OpenRouter, DeepSeek, or custom OpenAI-compatible endpoints) stored locally on your device via `AsyncStorage`.
- **Dark OLED Themes**: Switch between `Midnight Cyber`, `Sakura Dusk`, `Warm Slate`, and `Cyan`.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer)
- npm
- [Expo Go](https://expo.dev/go) on Android or iOS (optional, for testing on a physical device)

### Installation & Running

```bash
# Install dependencies
npm install

# (Optional) Start the local community catalog proxy (port 3001)
npm run proxy

# In another terminal, start the Expo development server
npm start
```

### Platform Commands
- **Android:** `npm run android` (or scan the Expo Go QR code)
- **iOS:** `npm run ios` (or scan the Expo Go QR code)
- **Web:** `npm run web`
- **Lint:** `npm run lint`

---

## 📜 License & Attribution

This project is open-source under the terms of the MIT License with Attribution.  
You are free to fork, modify, and redistribute this software, provided that clear attribution to the **NekoChat Project** is preserved.
