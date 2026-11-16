# Contributing to NekoChat

Thanks for taking the time to contribute to NekoChat.

## Ways to Contribute
- **Bug reports**: Open an issue with your device/OS, app version, steps to reproduce, and screenshots or error logs if available.
- **Code & UI fixes**: Fix bugs, improve mobile performance, or refine existing screens.
- **Translations (`i18n`)**: Add or improve UI strings in `src/i18n/translations.ts`.
- **Documentation**: Improve `README.md`, `CONTRIBUTING.md`, or technical notes in `docs/`.

---

## Local Development Setup

1. **Fork and clone** the repository:
   ```bash
   git clone https://github.com/JustBadThinker/nekochat.git
   cd nekochat
   ```
2. **Install dependencies** (use `npx expo install <pkg>` when adding Expo/RN packages so versions match the current SDK):
   ```bash
   npm install
   ```
3. **Run the app**:
   ```bash
   npm start
   ```
   Optional: run `npm run proxy` in a second terminal if testing the local JanitorAI/Datacat proxy on port `3001`.

---

## Guidelines Before Opening a Pull Request

- **Keep changes focused**: One fix or feature per PR makes review much easier.
- **No hardcoded secrets or mock data**: Never commit API keys, tokens, or fake placeholder responses.
- **Cross-platform compatibility**: Keep Android, iOS, and Web behavior in mind. For `expo-blur` on Android, ensure `<BlurView>` uses `blurMethod="dimezisBlurView"` paired with a sibling `<BlurTargetView>` ref (and avoid Android `<BlurView>` inside `<Modal>`).
- **Run checks before pushing**:
  ```bash
  npx tsc --noEmit
  npx expo lint
  ```
- **Fill out the PR template**: Describe what changed, why it was needed, and how you tested it.

---

## Architecture Notes

- `App.tsx` — Root app shell, navigation tabs, onboarding gate, and passcode lock gate.
- `src/screens/` — Main screens (`ChatsScreen`, `ChatRoomScreen`, `DiscoverScreen`, `UserStudioScreen`, `SettingsScreen`).
- `src/components/` — Shared UI components, modals, onboarding, and Desk Neko.
- `src/services/` — Local storage (`AsyncStorage`), AI provider clients, character import, and catalog fetching.
- `src/i18n/` — UI translations and language context.
- `docs/` — Schema mapping and migration/compatibility notes.
