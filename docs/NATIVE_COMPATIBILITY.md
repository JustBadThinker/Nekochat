# NEKOCHAT NATIVE COMPATIBILITY SPECIFICATION

**Purpose:** Document the architectural transition from Warden AI's browser/Capacitor runtime to genuine native React Native & Expo SDK 58 modules.

---

## 1. Runtime & Platform Bridges

| Web / Browser API (Warden AI) | Native Equivalent (NekoChat) | Package / Module | Verification Method |
|---|---|---|---|
| `localStorage` | `AsyncStorage` | `@react-native-async-storage/async-storage` | Persists JSON across application restarts. |
| `window.fetch` | Native `fetch` (Hermes engine) | Built-in | Tested with live `api.chub.ai` and `datacat.run`. |
| Browser `File` & `Blob` | Native File System | `expo-file-system` | Reads and writes binary `.png` and `.warden` files. |
| `<input type="file">` | Document Picker | `expo-document-picker` | Native file picker intent for cards and backups. |
| Image Picker | Native Photo Gallery | `expo-image-picker` | User artwork upload for Custom Studio & Personas. |
| `a.download` / Object URLs | Sharing & Intent Manager | `expo-sharing` | Exports `.warden` backups and PNG character cards. |
| `window.speechSynthesis` | Native Speech Engine | `expo-speech` | Speech synthesis on Android / iOS devices. |
| `new Audio(url)` | Native Media Player | `expo-audio` / `expo-av` | Local audio playback for TTS waveforms. |
| Web CSS `cursor`, `overflow` | React Native `StyleSheet` | Built-in | Validated with strict TypeScript compilation. |
| Web Drag / Mouse Events | Gesture Handlers | `PanResponder` / `react-native-gesture-handler` | Tested 60/120Hz continuous swipe tracking. |
| HTML DOM Elements (`div`, `span`) | Native Views (`View`, `Text`) | `react-native` | Native Android view hierarchy. |
| Browser Dialogs (`alert`, `prompt`)| Custom Native Bento Modals | React Native `Modal` / Bottom Sheets | High-contrast OLED theme dialogs. |

---

## 2. Network & Proxy Architecture

### Environment-Aware Network Resolvers
Inside Android APK builds and emulators, `localhost` points to the device itself.
NekoChat uses an environment-aware resolver:

- **Android Emulator:** `http://10.0.2.2:3001`
- **Physical Device (LAN):** `http://<DEV_MACHINE_IP>:3001` (configured via Settings)
- **Direct Web / Fallback:** Direct public endpoints with session tokens (`https://datacat.run/api/liberator/identify` and `https://api.chub.ai`).
- **Production Proxy:** Configurable custom remote proxy URL in Settings.

---

## 3. Strict Zero-Mock Rule Enforcement

1. **No Fake Latency Measurements:**
   - Latencies are calculated via `Date.now() - startTime` on actual network responses.
   - If a request fails, the error status (`HTTP 404`, `Network Timeout`, `Unreachable`) is displayed with a red indicator.
   - No hardcoded 78ms, 145ms, 168ms, or 112ms placeholder numbers.
2. **No Hardcoded Community Character Inventories:**
   - All community characters are fetched directly from live endpoints.
   - If an endpoint fails, the catalog shows an explicit error state with a "Retry Connection" button.
3. **No Fabricated Creator Profiles:**
   - Followed creators are loaded from genuine saved state and live catalog cards.
   - No placeholder Unsplash portraits or fake companion counts.

