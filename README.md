# NekoChat (Beta)

> **Yet another AI roleplay app.**  
> *An open-source, bring-your-own-key (BYOK) roleplay chat client built with Expo, React Native, and TypeScript. All chats, character cards, personas, and API keys are stored locally on your device.*

---

## Implemented Features

### Chats & Chat Room (`ChatsScreen` & `ChatRoomScreen`)
- **Bento Grid & Dropdown Accordion**: Switch between a 2-column character grid and a single-focus accordion list, with multi-session support per character.
- **Trending 24h Stories**: Story tray and viewer modal for jumping into trending community characters.
- **Novel Mode & Bubble Mode**: Switch between full-width text layout and chat-bubble layout, with clickable avatars and a fullscreen image viewer.
- **Roleplay Formatting & Macros**: Configurable colors for dialogue, actions, and thoughts, `{{user}}` / `{{char}}` replacement, and character RP name extraction.
- **Reasoning Block Separation**: Moves `<think>` / `<thought>` / `<reasoning>` blocks into a collapsible `Thinking` section, with word-by-word text reveal.
- **Chat Controls**: Session switching, alternate greeting cycling, `<memory>` checkpoints, custom chat wallpaper/blur/overlay settings, message editing/regeneration/continuation, and text-to-speech (`expo-speech`).
- **Desk Neko**: Optional pixel Neko sprite on the input bar with an inline timing mini-game.

### Discover (`DiscoverScreen`)
- **Catalog Grid**: Browse community characters and creators from JanitorAI (Datacat) and Chub.ai with infinite scroll, tag filtering, `Trending` / `Popular` / `Latest` sorting, `All` / `Following` / `Favorites` scope, and `NSFW` / `SFW` toggle.
- **Character & Creator Profiles**: HTML/Markdown description rendering, inline gallery extraction, and alternate greetings preview.
- **Match Mode (`TinderDeck`)**: Swipe-to-match character deck with Undo, Favorite, Info, and direct Chat.

### Studio, Onboarding & Settings (`UserStudioScreen`, `OnboardingFlow`, `SettingsScreen`)
- **First-Time Setup & Tour**: Step-by-step setup for UI language, AI provider/API key (with presets for Gemini, OpenRouter, OpenAI, Anoman, Sumopod, and local LAN servers), optional 4-digit passcode lock, and a skippable feature tour.
- **User Studio**: Create, edit, and import character cards (`.json` / `.png` SillyTavern cards), manage User Personas, and create keyword-triggered Codex Lorebooks.
- **BYOK AI Engine**: Connect Google Gemini, OpenRouter, OpenAI, or custom OpenAI-compatible endpoints (remote proxies or local phone/LAN models).
- **Multi-Language UI & Themes**: UI translations (`en`, `id`, `ja`, `es`, `zh`, `ko`) with optional AI response language prompts, plus dark themes (`Midnight Cyber`, `Sakura Dusk`, `Warm Slate`, `Cyan`).

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20 or newer)
- npm
- [Expo Go](https://expo.dev/go) on Android or iOS (or an Android/iOS development build)

### Installation & Running

```bash
# Install dependencies
npm install

# (Optional) Start the local community catalog proxy (port 3001)
npm run proxy

# In another terminal, start the Expo development server
npm start
```

### Platform & Check Commands
- **Android:** `npm run android`
- **iOS:** `npm run ios`
- **Web:** `npm run web`
- **Lint:** `npm run lint` (or `npx expo lint`)
- **Typecheck:** `npx tsc --noEmit`

---

## Contributing

Contributions, bug reports, and translations are welcome.  
See [CONTRIBUTING.md](CONTRIBUTING.md) for setup details, coding guidelines, and how to open a pull request using [our PR template](.github/pull_request_template.md).

---

## License & Attribution

This project is open-source under the terms of the MIT License with Attribution (see [LICENSE](LICENSE)).  
You are free to fork, modify, and redistribute this software, provided that attribution to the **NekoChat Project** is preserved.
