# NEKOCHAT DATA SCHEMA MAPPING — WARDEN AI COMPATIBILITY SPECIFICATION

**Purpose:** Ensure seamless, non-destructive data parity and bidirectional compatibility between Warden AI storage schemas and NekoChat native persistence.

---

## 1. Character Model (`Character`)

| Field | Warden Type | NekoChat Current | Target Native Parity | Notes / Transformation Rule |
|---|---|---|---|---|
| `id` | `string` | `string` | `string` | Preserved verbatim (e.g. `char_xxx` or `creator/slug`). |
| `name` | `string` | `string` | `string` | Required name of the character. |
| `subtitle` / `tagline` | `string?` | `string` (`tagline`) | `string?` | Aliased: map `subtitle` <-> `tagline`. |
| `creatorId` | `string` | `creatorId?` | `string` | Defaults to `'user_creator_03'` or imported creator ID. |
| `creatorUsername` | `string` | `creator: string` | `string` | Cleaned handle without `@` or URL prefix. |
| `creatorAvatar` | `string` | (missing) | `string?` | Creator portrait URL or initial letter fallback. |
| `avatarUrl` | `string` | `avatar: string` | `string` | Normalized high-res image URL (`/card.webp`). |
| `coverUrl` | `string?` | (missing) | `string?` | Hero banner image for profile / chat background. |
| `shortDescription` | `string` | `description: string`| `string` | Concise synopsis (max 260 chars). |
| `personality` | `string` | `personality: string`| `string` | Full personality description. |
| `background` | `string` | (missing) | `string?` | Detailed lore/backstory. |
| `systemPrompt` | `string` | (missing) | `string?` | Bot guidance instructions. |
| `exampleDialogue` | `string` | `exampleDialogue?` | `string?` | `{{user}}` / `{{char}}` dialogue examples. |
| `firstMessage` | `string?` | `firstMessage: string`| `string` | Initial greeting message. |
| `alternateGreetings` | (in scenarios) | `alternateGreetings?`| `string[]?` | Array of alternate opening messages. |
| `scenarios` | `CharacterScenario[]` | (missing) | `CharacterScenario[]` | Full multi-scenario support with opening messages. |
| `tagSlugs` / `tags` | `string[]` | `string[]` | `string[]` | Preserved tag identifiers. |
| `contentRating` | `'SFW' \| 'Mature' \| 'NSFW'` | `'SFW' \| 'NSFW'` | `'SFW' \| 'Mature' \| 'NSFW'` | Preserve 3-tier rating. |
| `visibility` | `'public' \| 'unlisted' \| 'private'` | (missing) | `'public' \| 'unlisted' \| 'private'` | Local cards default to `'private'`. |
| `publicationStatus` | `PublicationStatus` | (missing) | `PublicationStatus` | Preserved for creator studio parity. |
| `lorebookIds` | `string[]?` | (missing) | `string[]?` | Associated lorebooks for this character. |
| `totalTokens` | (in detail) | `totalTokens?: number` | `number?` | Total character card token estimate. |
| `chatCount` | `number` | `totalChats?: number` | `number` | Aggregated conversation/turn count. |
| `likeCount` / `isFavorite` | `number` | `isFavorite?: boolean`| `number` + `boolean` | Bookmark/favorite status. |

---

## 2. Conversation & Multi-Session Model (`Conversation`)

> **Critical Gap:** NekoChat currently stores messages by `characterId` directly in `@nekochat:messages:<charId>`. This prevents having multiple distinct chats with the same bot, switching scenarios, or archiving. Parity requires migrating to Warden's `Conversation` model.

| Field | Warden Type | NekoChat Current | Target Native Parity | Notes / Transformation Rule |
|---|---|---|---|---|
| `id` | `string` | (missing) | `string` | Unique conversation ID (`conv_<timestamp>_<rand>`). |
| `userId` | `string` | (missing) | `string` | Active user identifier. |
| `characterId` | `string` | `characterId` | `string` | Linked character ID. |
| `scenarioId` | `string?` | (missing) | `string?` | Active scenario selected for this chat session. |
| `scenarioTitle` | `string?` | (missing) | `string?` | Cached title of the active scenario. |
| `personaId` | `string` | (global setting) | `string` | Persona linked to this conversation session. |
| `providerId` | `string` | (global setting) | `string` | AI provider profile used for this session. |
| `title` | `string` | (missing) | `string` | Conversation title (defaults to character name). |
| `modelName` | `string?` | (missing) | `string?` | Specific model used (e.g. `'gemini-2.5-flash'`). |
| `messages` | `ChatMessage[]` | `ChatMessage[]` | `ChatMessage[]` | Full message turn history. |
| `isArchived` | `boolean?` | (missing) | `boolean?` | Archived state. |
| `isPinned` | `boolean?` | (missing) | `boolean?` | Pinned to top of My Chats. |
| `summary` | `string?` | (missing) | `string?` | Long-term memory checkpoint summary. |
| `tokenOptimizer` | `TokenOptimizerLevel` | (missing) | `TokenOptimizerLevel` | Per-conversation compression level. |
| `cumulativeUsage` | `CumulativeTokenUsage?` | (missing) | `CumulativeTokenUsage?` | Session spend accounting (USD & IDR). |
| `createdAt` | `string` | (missing) | `string` | ISO 8601 creation timestamp. |
| `updatedAt` | `string` | `lastActive: number` | `string` | ISO 8601 last update timestamp. |

---

## 3. Chat Message Model (`ChatMessage`)

| Field | Warden Type | NekoChat Current | Target Native Parity | Notes / Transformation Rule |
|---|---|---|---|---|
| `id` | `string` | `string` | `string` | Unique message ID (`msg_<timestamp>`). |
| `conversationId` | `string?` | (missing) | `string` | Linked parent conversation session. |
| `sender` | `'user' \| 'character' \| 'system'` | `'user' \| 'assistant' \| 'system'` | `'user' \| 'character' \| 'system'` | Map `'assistant'` <-> `'character'`. |
| `content` | `string` | `string` | `string` | Message text content with formatting. |
| `rawTemplate` | `string?` | (missing) | `string?` | Preserves original `{{user}}` template. |
| `thought` | `string?` | `thought?: string` | `string?` | Deep reasoning / `<thought>` segment. |
| `imageUrl` | `string?` | `imageUrl?: string` | `string?` | Scene illustration URL or file URI. |
| `imagePrompt` | `string?` | (missing) | `string?` | Prompt used to generate illustration. |
| `imageStyle` | `string?` | (missing) | `string?` | Style preset used for illustration. |
| `timestamp` | `string` (ISO) | `number` | `string` | Normalized to ISO string (`new Date().toISOString()`). |
| `tokenCount` | `number?` | `tokenCount?: number` | `number?` | Estimated token count for this turn. |

---

## 4. Persona Model (`Persona`)

| Field | Warden Type | NekoChat Current | Target Native Parity | Notes / Transformation Rule |
|---|---|---|---|---|
| `id` | `string` | `string` | `string` | Preserved verbatim (e.g. `per_01`). |
| `userId` | `string` | (missing) | `string` | Linked user profile ID. |
| `name` | `string` | `string` | `string` | Persona display name. |
| `avatarUrl` | `string` | `avatar?: string` | `string` | Avatar image URL or local file URI. |
| `shortDescription` | `string` | `description: string`| `string` | Concise description. |
| `appearance` | `string` | (missing) | `string` | Physical appearance details for AI. |
| `personality` | `string` | (missing) | `string` | Personality traits and demeanor. |
| `background` | `string` | (missing) | `string` | Backstory, occupation, relationship. |
| `genderPronouns` | `string?` | `pronouns?: string` | `string?` | Map `genderPronouns` <-> `pronouns`. |
| `roleInstructions` | `string?` | (missing) | `string?` | Direct instructions for how AI interacts with user. |
| `isDefault` | `boolean` | `isDefault?: boolean`| `boolean` | Default persona flag. |
| `createdAt` | `string` | (missing) | `string` | ISO 8601 creation timestamp. |

---

## 5. Lorebook Models (`Lorebook` & `LorebookEntry`)

| Model | Field | Type | Description |
|---|---|---|---|
| `Lorebook` | `id` | `string` | Unique lorebook ID (`lb_<name>`). |
| `Lorebook` | `userId` | `string` | Owner user ID. |
| `Lorebook` | `title` | `string` | Lorebook title (e.g. "Cyberpunk Sector Codex"). |
| `Lorebook` | `description` | `string` | Synopsis of world lore. |
| `Lorebook` | `scanDepth` | `number?` | How many recent message turns to scan for triggers (default 4). |
| `Lorebook` | `tokenBudget` | `number?` | Maximum tokens allowed for lorebook injection. |
| `Lorebook` | `recursiveScanning` | `boolean?` | Scan matched entry content for secondary triggers. |
| `Lorebook` | `entries` | `LorebookEntry[]` | List of entries. |
| `LorebookEntry` | `id` | `string` | Unique entry ID. |
| `LorebookEntry` | `title` | `string` | Entry heading (e.g. "OmniCorp Security"). |
| `LorebookEntry` | `keys` | `string[]` | Trigger keywords / phrases. |
| `LorebookEntry` | `secondaryKeys`| `string[]?` | Secondary selective triggers. |
| `LorebookEntry` | `content` | `string` | Lore text injected into LLM context when triggered. |
| `LorebookEntry` | `priority` | `number` | Ordering priority (higher = closer to active context). |
| `LorebookEntry` | `enabled` | `boolean` | Active flag. |
| `LorebookEntry` | `selective` | `boolean?` | Requires both primary and secondary keys. |
| `LorebookEntry` | `constant` | `boolean?` | Always injected regardless of keyword matching. |

---

## 6. Migration Storage Namespace Mapping

| Entity | Warden Browser Key | NekoChat Native Key (`@react-native-async-storage`) |
|---|---|---|
| Characters | `warden_characters_v9` | `@nekochat:characters` |
| Conversations | `warden_conversations_v9` | `@nekochat:conversations` |
| Personas | `warden_personas_v7` | `@nekochat:personas` |
| Lorebooks | `warden_lorebooks_v7` | `@nekochat:lorebooks` |
| AI Providers | `warden_providers_v7` | `@nekochat:providers` |
| Bot Rule Presets | `warden_bot_rule_presets_v1` | `@nekochat:bot_rules` |
| Followed Creators | `warden_followed_creators_<id>` | `@nekochat:followed_creators` |
| Community Favorites | `warden_community_favorites_v1` | `@nekochat:community_favorites` |
| App Settings | (scattered localStorage keys) | `@nekochat:app_settings` |

