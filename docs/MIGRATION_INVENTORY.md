# NEKOCHAT MIGRATION INVENTORY — WARDEN AI SOURCE PARITY

**Source Donor:** Warden AI (`C:\Users\kanto\Documents\Work\Apps\Wardenai` @ `47b91cb`)  
**Target Project:** NekoChat (`C:\Users\kanto\Documents\Work\Apps\NekoChat` @ `17fb7b7`)  
**Audit Date:** 2026-11-11  

---

## 1. Feature Migration Classification Matrix

| Feature | Warden Source | Dependencies | Existing Behavior | NekoChat Destination | Migration Method | Data Compatibility | Verification | Status |
|---|---|---|---|---|---|---|---|---|
| **Acid Lime Design System** | `src/index.css` | Tailwind CSS v4, Lucide React | Purple-accented dark theme | `src/theme/colors.ts` | NATIVE ADAPTATION | Visual tokens | Verified rendering & contrast ratio | VERIFIED |
| **Catalog Grid (2-Column Bento)** | `src/views/DiscoverView.tsx` | Lucide, CSS Grid, custom cards | 2-column card layout with tags, search, and infinite pagination | `src/screens/DiscoverScreen.tsx`, `CommunityCharacterCard.tsx` | NATIVE ADAPTATION | `CommunityCharacter` | Real catalog fetch, zero-mock display | VERIFIED |
| **Swipe Match Deck** | Concept / Custom | Framer Motion | Tinder-style swipe cards | `src/components/TinderDeck.tsx` | NATIVE ADAPTATION | `CommunityCharacter` | Smooth PanResponder gesture handling | VERIFIED |
| **Story Tray & Viewer** | Concept / Custom | Motion React | Instagram-style 24h stories | `src/components/StoryTray.tsx`, `StoryViewerModal.tsx` | NATIVE ADAPTATION | `CommunityCharacter` | Tap avatar, segmented 5-story cycle | VERIFIED |
| **Capsule Dock Navigation** | `src/components/navigation/MobileBottomBar.tsx` | Lucide React | Fixed bottom navbar | `src/components/CapsuleDock.tsx` | NATIVE ADAPTATION | Navigation state | Floating capsule with safe area inset | VERIFIED |
| **My Chats Screen** | `src/views/ChatsListView.tsx` | StorageService | List of active conversations | `src/screens/ChatsScreen.tsx`, `BentoChatCard.tsx` | NATIVE ADAPTATION | `Character`, `ChatMessage` | Clean empty state & 2-column bento | VERIFIED |
| **Datacat Community Proxy** | `server.ts`, `server/datacatService.ts` | Express, Node.js | Local proxy on port 3001 | `server.mjs` | DIRECT PORT | Datacat JSON | Real proxy queries to datacat.run | VERIFIED |
| **Live Service Health Monitor** | `src/views/SettingsView.tsx` | aiProviderService | Tests LLM, Chub, Datacat, ImageGen latency | `src/screens/SettingsScreen.tsx`, `aiProviderService.ts` | NATIVE ADAPTATION | Health status object | Real probes without fake latencies | VERIFIED |
| **Chub.ai Live Catalog & Detail** | `src/services/communityCatalogService.ts` | Fetch API | Queries api.chub.ai/search and characters/{id}?full=true | `src/services/communityCatalogService.ts` | DIRECT PORT | `CommunityCharacter`, `CommunityCharacterDetail` | Live JSON response parsing & detail display | VERIFIED |
| **Multi-Provider AI Engine** | `src/services/aiProviderService.ts` | @google/genai, fetch | Supports Gemini, OpenAI, OpenRouter, Custom endpoints, streaming | `src/services/aiProviderService.ts` | NATIVE ADAPTATION | `ProviderConfig[]`, `ChatMessage[]` | Multi-profile switching & streaming | VERIFIED |
| **Multi-Session Conversations** | `src/views/ChatView.tsx`, `storageService.ts` | LocalStorage | Multi-chat per bot, scenario forks, memory checkpoints | `storageService.ts`, `ChatRoomScreen.tsx` | NATIVE ADAPTATION | `Conversation`, `CharacterScenario` | Create 2+ independent sessions for 1 bot | VERIFIED |
| **Character Card Importer (PNG & JSON)** | `src/services/characterImportService.ts` | PNG chunk parser, URL scraper | Extracts tEXt/iTXt from PNG, V1/V2/V3 JSON, W++ text | `src/services/characterImportService.ts` | DIRECT PORT / NATIVE ADAPTATION | `Character`, `ImportedCardData` | Import SillyTavern PNG, Chara Card V2, W++ text, URL | VERIFIED |
| **Lorebook Context Engine** | `src/views/LorebooksView.tsx`, `storageService.ts` | Regex matcher, token budget | Keywords scanning, priority injection, constant entries | `src/services/storageService.ts`, `src/services/aiProviderService.ts` | DIRECT PORT / NATIVE ADAPTATION | `Lorebook`, `LorebookEntry` | Triggered keyword insertion in context | VERIFIED |
| **Advanced Token Optimizer** | `src/services/tokenOptimizerService.ts` | Regex compressor | 4 compression levels, OOC detection, bloat removal | `src/services/tokenOptimizerService.ts` | DIRECT PORT | `TokenOptimizerLevel`, `ConversationTokenStats` | Compression ratio & OOC handling | VERIFIED |
| **Token Cost & Currency Calculator** | `src/services/tokenPriceService.ts` | Math formulas | USD & IDR token calculations for Indo Routers & OpenAI | `src/services/tokenPriceService.ts` | DIRECT PORT | `TokenPriceConfig` | Accurate Rupiah/Dollar turn estimates | VERIFIED |
| **Encrypted Warden Vault** | `src/services/wardenVaultService.ts` | CryptoJS, PBKDF2 | AES-256 .warden encrypted export/import (excludes keys) | `src/services/wardenVaultService.ts` | NATIVE ADAPTATION | `WardenVaultPayload`, `WardenEncryptedEnvelope` | Export & import .warden file across apps | VERIFIED |
| **In-Chat Audio / Native TTS** | `src/services/ttsService.ts`, `kokoroWorker.ts` | Kokoro-82M, WASM, Web Worker, SpeechSynthesis | Audio synthesis for dialogue turns | `src/services/ttsService.ts`, `ChatRoomScreen.tsx` | NATIVE ADAPTATION | `TtsConfig`, `VoiceProfile` | Native expo-speech synthesis with smart quotes | VERIFIED |
| **AI Scene Illustration** | `src/services/imageGenService.ts` | Pollinations, OpenAI DALL-E | Generates scene images with style presets & prompt enhancers | `src/services/imageGenService.ts`, `ChatRoomScreen.tsx` | NATIVE ADAPTATION | `ImageGenConfig`, `ChatMessage.imageUrl` | Scene render with Pollinations & Custom | VERIFIED |
| **Character Studio & Multi-Scenario** | `src/views/CharacterStudioView.tsx` | StorageService | Full character editor with multi-scenario and prompt rules | `src/screens/UserStudioScreen.tsx` | NATIVE ADAPTATION | `Character`, `CharacterScenario[]` | Create, edit, and delete custom cards & scenarios | VERIFIED |
| **Persona Studio** | `src/views/PersonaStudioView.tsx` | StorageService | Multi-persona manager with appearance, pronouns, instructions | `src/screens/UserStudioScreen.tsx` | NATIVE ADAPTATION | `Persona[]` | Switch personas in chat, detailed visual traits | VERIFIED |
| **Codex Lorebook Manager** | `src/views/LorebooksView.tsx` | StorageService | Lorebook creation, entry editing, keywords & priorities | `src/screens/UserStudioScreen.tsx` | NATIVE ADAPTATION | `Lorebook[]` | Full CRUD for lorebooks and entries | VERIFIED |

---

## 2. Migration Execution Phases Summary

1. **Phase 0 — Reconnaissance & Stabilization [COMPLETED]:**
   - Source audit of Warden AI (`C:\Users\kanto\Documents\Work\Apps\Wardenai`).
   - Audit of NekoChat (`C:\Users\kanto\Documents\Work\Apps\NekoChat`).
   - Restored missing dependencies in `package.json`.
   - Fixed all TypeScript errors (`npx tsc --noEmit` exits with 0).
   - Purged all 5 mock-data & fake-health violations.
2. **Phase 1 — Core Data Models & Native Services [COMPLETED]:**
   - Implement `Conversation` multi-session schema, `CharacterScenario`, and `Lorebook` in `src/types/index.ts`.
   - Port `characterImportService.ts` (PNG chunk binary parser, JSON card V1/V2/V3).
   - Port `tokenOptimizerService.ts` (4 compression tiers & OOC engine).
   - Port `tokenPriceService.ts` (Indonesian Rupiah & USD pricing presets).
   - Port `wardenVaultService.ts` (AES-256 .warden backup & restore).
3. **Phase 2 — Multi-Provider AI Engine & Chat Experience [COMPLETED]:**
   - Multi-provider configuration (`ProviderConfig[]`) supporting Gemini, OpenRouter, OpenAI, and Custom proxies.
   - Multi-session chat room with scenario selection, alternate greetings, and persona docking.
   - Lorebook keyword scanning & context injection into LLM prompts.
   - Message action toolbar (Copy, Edit, Regenerate, Continue, Delete, Stop Generation).
4. **Phase 3 — Media, Audio & Advanced Creative Tools [COMPLETED]:**
   - Native Speech Synthesis engine (`ttsService.ts`) powered by `expo-speech` with Smart Quote Extraction.
   - Native Image Generation engine (`imageGenService.ts`) with Pollinations AI, OpenAI DALL-E, and Custom Flux/SD presets.
   - Character Studio with Multi-Scenario and Alternate Greetings authoring.
   - Persona Studio with detailed visual appearance and personality attributes.
   - Lorebook Codex Manager with keyword trigger management.
5. **Phase 4 — Native Packaging & Verification [COMPLETED]:**
   - Zero-Mock and Zero-Capacitor compliance verified.
   - Dependency health confirmed via `npx expo-doctor` (20/20 checks passed).
   - Android bundle generation confirmed via `npx expo export --platform android`.
