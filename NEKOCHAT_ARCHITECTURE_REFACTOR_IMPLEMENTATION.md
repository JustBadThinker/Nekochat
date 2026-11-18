# NekoChat — Architecture Refactor & Memory System Implementation Brief

> **Purpose:** One consolidated implementation brief for the NekoChat codebase, based on the architecture audit. Use this document as the single source of truth for the work described below instead of handling each issue through separate prompts.
>
> **Primary goals:** fix confirmed memory bugs, prevent cross-session contamination, reduce unnecessary prompt tokens, move conversation persistence to a scalable local database, improve credential handling, and establish a reliable local-first memory/retrieval system.
>
> **Important:** Re-inspect the current repository before changing anything. The findings below came from a previous code audit and may have changed. Verify each one against the current working tree.

---

## 0. Instructions for the coding agent

Act as the senior engineer responsible for implementing this refactor.

1. Read this entire document before making changes.
2. Inspect the current repository, current Git status, package versions, Expo SDK configuration, and the relevant source files.
3. Verify each reported issue before fixing it. Mark findings as **confirmed**, **already fixed**, **not reproducible**, or **needs clarification**.
4. Implement the work as a coordinated refactor. Do not wait for a separate prompt for every individual item.
5. Keep the application working throughout the refactor. Prefer small, reviewable phases and run relevant checks after each phase.
6. Do not rewrite unrelated screens or services. Preserve existing product behavior unless this brief explicitly changes it.
7. Do not invent benchmark results, security guarantees, or provider capabilities.
8. Do not log API keys, full prompts, raw chat messages, or memory contents.
9. Do not send conversation history, memory, embeddings, personas, or lorebooks to the NekoChat backend. These remain on the device. The only expected external transmission for chat generation is the selected prompt/context sent directly to the AI provider selected by the user.
10. If a migration or destructive operation cannot be made safe and reversible, stop that part, explain the blocker, and leave existing user data untouched. Do not silently discard or arbitrarily assign legacy memories.
11. Do not add a cloud vector database or server-side memory service.
12. Do not introduce local vector embeddings in this implementation unless the BM25 evaluation demonstrates a concrete unmet requirement and the additional model/runtime cost is justified. The initial target is SQLite FTS5/BM25 plus structured per-session memory.

### Required working method

- Create a short implementation checklist from this document before coding.
- Work through the phases in Section 12.
- After each phase, run TypeScript checks, lint/tests available in the repository, and the narrowest relevant runtime/build check.
- Keep a concise change log: files changed, behavior changed, checks run, and unresolved risks.
- At completion, report completed items, deferred items, migration behavior, test results, and any manual steps required.

---

## 1. Product and architecture constraints

NekoChat is a local-first, mobile-first AI roleplay application using Expo, React Native, and TypeScript. It supports BYOK providers, character cards, multiple conversations per character, personas, scenarios, lorebooks, streaming generation, checkpoints/memory, and community discovery.

### Non-negotiable privacy boundary

**Local on the user's device:**
- Conversation records and message bodies
- Character/session memories and checkpoints
- FTS indexes and any future embeddings
- Personas and lorebooks
- Local chat preferences
- Provider credentials, stored in platform secure storage where possible

**Sent externally:**
- The assembled prompt, selected retrieved memories, recent conversation context, and current user message sent directly to the AI provider selected by the user
- Any explicitly user-requested community/catalog data or uploads, according to the feature's separate privacy behavior

NekoChat cannot control whether an external AI provider logs, retains, or uses submitted prompts. Do not claim that external AI processing is zero-retention or fully private.

### Architectural principles

- A character's permanent profile can be shared across that character's conversations.
- Narrative memory and story state must be isolated per conversation/session.
- Retrieval must be scoped in the database, not merely instructed through the prompt.
- Local search and retrieval must not require an AI API call.
- AI-powered extraction/summarization may use API calls, so it must be transparent, configurable, and non-blocking.
- Memory must be concise, attributable to source messages, editable, and invalidatable.

---

## 2. Revalidate these reported findings

The previous audit reported the following. Re-open the current code and verify each point.

### 2.1 Conversation persistence is a monolithic AsyncStorage blob

Reported behavior:
- `KEYS.CONVERSATIONS` (`@nekochat_conversations`) stores an array of `Conversation` objects.
- Each conversation embeds the full `messages: ChatMessage[]` array.
- `appendMessageToConversation()` reads, parses, mutates, stringifies, and rewrites the whole conversations array.
- `createConversation()` and `appendMessageToConversation()` also mirror messages to a character-level legacy key such as `${KEYS.MESSAGES}:${characterId}`.

Required outcome:
- SQLite becomes the source of truth for conversation metadata and message rows.
- Avoid repeatedly parsing/stringifying all conversations and messages for each message append.
- The legacy character-level message key must no longer be authoritative for session history.
- Preserve existing data during migration; do not merge uncertain messages into the wrong session.

### 2.2 Memory and checkpoint keys are character-scoped instead of session-scoped

Reported keys:
- `@nekochat:chat_memory_${character.id}`
- `@nekochat:chat_checkpoint_idx_${character.id}`

Reported consequences:
- Different conversations using the same character read and overwrite the same memory.
- A checkpoint index from a long session can exceed the message count in a short session and corrupt incremental slicing/history selection.

Required outcome:
- Every narrative memory/checkpoint operation is scoped to the actual conversation ID (`conversationId` / canonical session ID used by the codebase).
- Store both `character_id` and `conversation_id` where useful for integrity checks, but always retrieve by the active conversation ID and verify the character ID matches.
- No implicit cross-session narrative recall.

### 2.3 Duplicate memory injection

Reported behavior:
- `buildExtraContext()` prepends a memory block to `effectiveChar.scenario`.
- The same memory is also passed separately as `options.memory` to `streamChat()`.
- `streamChat()` then adds it to `systemInstruction` again.

Required outcome:
- Establish one canonical memory-injection path.
- Do not place dynamic session memory in the character's persistent scenario field.
- Ensure each selected memory/state item is included at most once in the final request.
- Add a regression test or prompt-construction assertion that detects duplicate memory injection.

### 2.4 Memory update is currently manual and free-form

Reported behavior:
- Memory updates happen through manual Incremental Checkpoint or Full Rescan actions.
- Existing `Conversation` fields such as `summary`, `keyMemories`, `lastSummaryAt`, and `memoryCheckpoint` were reported as unused by the chat flow.

Required outcome:
- Reuse existing fields only if they fit the resulting data model; do not maintain duplicate competing memory stores.
- Introduce structured per-session state and user-pinned facts.
- Preserve manual update controls.
- Offer optional AI-assisted automatic updates with sensible triggers and clear quota implications.

### 2.5 Memory is not invalidated after message edits/deletions/regeneration

Reported behavior:
- Editing, deleting, swiping, or regenerating older messages can leave memory/checkpoint state stale.

Required outcome:
- Track which source messages support each memory item.
- Editing/deleting/replacing a source message marks affected memory as stale or triggers a safe recomputation.
- Never silently continue injecting a memory known to contradict the current message history.

### 2.6 Provider credentials and conversations are stored in AsyncStorage

Reported behavior:
- Provider API keys are included in serialized AsyncStorage configuration.
- Chat data is also stored there in plaintext.

Required outcome:
- Move provider API keys to `expo-secure-store` or the appropriate platform-backed secure storage supported by the actual Expo SDK/runtime.
- Keep non-secret provider preferences separate from secrets.
- Migrate credentials safely and remove old plaintext copies only after successful verification.
- Do not claim that SQLite automatically encrypts conversations at rest. Assess and document database-at-rest protection separately.

### 2.7 Context limit default may be too optimistic

Reported behavior:
- `buildTurns()` uses a default context limit of 32,768 tokens when no more specific value is supplied.

Required outcome:
- Avoid assuming every BYOK model supports 32k context.
- Resolve context/output limits from known provider/model metadata where available.
- Allow per-provider/per-model override.
- Use a conservative documented fallback for unknown models, and let users adjust it.
- Always reserve output tokens and keep a safety margin for estimation error.
- Do not silently assume an unknown model's true context window.

### 2.8 Prompt safety boundary is not clearly separated

Reported behavior:
- Application-level constraints, character instructions, and user custom prompts are assembled into the same system instruction without a clearly protected application-level section.

Required outcome:
- Separate application-owned constraints from user-editable character cards, presets, and custom prompts.
- Ensure user-provided character content cannot modify or erase application-owned rules in prompt construction.
- Treat this as a prompt-structure safeguard, not a guarantee that every third-party model will obey it.
- Keep the feature's policy behavior explicit and testable. Do not break ordinary SFW roleplay.

---

## 3. Target memory architecture

Use three primary data layers. Do not build separate redundant memory pipelines.

### Layer 1 — Shared character/profile context

Contains persistent character-level information:
- Character identity, personality, backstory, speech style, and permanent instructions
- Existing character scenario defaults, where genuinely persistent
- Active user persona and relevant lorebook content (these remain their existing domain objects)

Do not store session-specific plot events, temporary relationship developments, or a particular session's location here.

### Layer 2 — Per-session memory store

Strictly scoped to one conversation. It contains:

**Structured current state**, for example:
- Current location and scene/time marker
- Current relationship status/dynamic
- Active goals
- Important unresolved conflict
- Important current objects/items
- Active promises or commitments
- Other small state fields justified by the actual roleplay behavior

**Event/fact memories**, for example:
- Important past events
- Character development and relationship milestones
- Promises made or resolved
- Important objects and secrets
- User-pinned facts

Pinned facts should be stored in this same memory system with a lock/pinned flag; do not create a completely separate retrieval pipeline for them.

### Layer 3 — Per-session message log and FTS5/BM25 index

- Store each message as its own SQLite row.
- Index user-facing message content with SQLite FTS5.
- Search only messages belonging to the active conversation.
- Retrieve only older messages that are not already included in the recent conversation window.
- Use BM25 ranking and a strict retrieval limit.

### Explicitly defer local vector embeddings

Do not add an ONNX/TFLite/MediaPipe embedding runtime or download a local model as part of this refactor.

Reason: the initial architecture prioritizes low maintenance, predictable Android RAM/APK size, and cheap retrieval. Reconsider vector search only after a representative evaluation proves BM25 plus structured state fails on important paraphrase-based recall cases.

---

## 4. SQLite data and query requirements

Use `expo-sqlite` if the installed Expo SDK and runtime support the required SQLite and FTS5 features. Verify actual package versions and runtime compatibility; do not rely on assumed Expo Go compatibility.

A proposed logical schema (adapt names/types to existing code; preserve all required fields):

### `conversations`

Store conversation metadata without embedding the entire message array. Preserve existing conversation fields, including IDs, character/persona/provider IDs, title, model metadata, creation/update timestamps, archive/pin state, and other currently used metadata.

### `messages`

One row per message, keyed by stable message ID and associated with `conversation_id` and `character_id`.

Preserve all currently meaningful `ChatMessage` fields, including role, content, timestamp, token metadata, swipe/variant data, generation metadata, and any other data actually used by the UI or generation flow. Inspect the real type before deciding which fields can be normalized or omitted.

Create an index suitable for ordered session retrieval, such as `(conversation_id, turn_index)` or an equivalent ordering index.

### `messages_fts`

- FTS5 virtual table containing searchable user-facing message text and the identifiers needed to scope results.
- Include or join on `conversation_id` so every query is restricted to the active session.
- Use parameterized SQL; never interpolate user input into SQL statements.
- Create reliable insert/update/delete synchronization, preferably with SQLite triggers or a single well-tested repository layer.
- Validate FTS5 availability on the actual target runtime.
- Exclude internal reasoning/hidden `<think>` blocks and non-user-facing diagnostic content from the search index.

### `session_memories`

Store structured state and event/pinned memory with fields equivalent to:
- Stable memory ID
- `character_id`
- `conversation_id`
- Memory type/category
- Content or structured value
- Importance and confidence, if genuinely used
- Pinned/locked flag
- Active/resolved/stale status
- Source message ID(s)
- Created/updated timestamps
- Dirty/stale marker where needed

Do not add fields solely for appearance; every field must have a defined lifecycle and use.

### Isolation rule

Every read, write, update, retrieval, invalidation, and delete operation for narrative memory/messages must be scoped to the active `conversation_id`. Also verify that the conversation belongs to the expected `character_id`.

A memory belonging to Session A must never be returned for Session B just because both sessions use the same character.

---

## 5. Retrieval behavior and prompt assembly

### Retrieval sequence

When the user sends a message:

1. Identify the active `conversationId` and associated `characterId`.
2. Load the shared character/profile context and active persona.
3. Load the current structured session state and pinned facts for this conversation only.
4. Determine which recent messages will already be sent to the provider.
5. Search FTS5 only in older messages from the same conversation, excluding message IDs already present in recent context.
6. Rank results using BM25 and, if useful, a modest recency adjustment.
7. Apply a relevance threshold, deduplicate results, and enforce both a result-count limit and a token budget.
8. Assemble the prompt through one canonical builder.
9. Send the assembled prompt directly to the configured external AI provider.

### Initial retrieval limits

Use conservative configurable starting targets, not hard guarantees:
- Structured session state + pinned facts: target cap around 350 tokens.
- Past-message recall: no more than 2–3 snippets initially, target cap around 300 tokens.
- Scene anchor: optional, very short (around 60 tokens or less).

These are starting defaults to test and tune. They must not override the model's total context/output budget.

### Deduplication and relevance

- Do not retrieve messages already present in the recent chat window.
- Do not insert the same fact through both structured state and past-message recall unless there is a clear reason.
- Do not fill the memory budget with weakly relevant results just to reach a fixed count.
- Preserve proper nouns, names, locations, objects, and explicit promises accurately.
- BM25 is keyword-oriented and can miss pure paraphrases. Document this limitation; do not claim semantic search behavior.

### Canonical prompt sections

Use clearly separated prompt sections and one source of truth for each section. Suggested initial order for evaluation:

1. Application-owned constraints
2. Character identity and core character instructions
3. Active scenario and user persona
4. Relevant lorebook entries
5. Structured per-session state and pinned facts
6. Retrieved older-message snippets
7. Recent conversation turns
8. Optional compact scene anchor near the active turn

The exact order should be tested with representative providers/models. Do not assume every model follows the same attention pattern.

### Remove duplicate memory injection

Dynamic memory must not be added to `effectiveChar.scenario` and separately passed as `options.memory` at the same time. Choose one canonical prompt assembly path and test the final serialized request for duplication.

---

## 6. Memory creation, update, and invalidation

### Zero-API operations (always local)

These should not call an AI provider:
- Persist messages
- Maintain FTS5 index
- Retrieve and rank past messages
- Pin/unpin a message or memory
- Update simple metadata such as message counts and timestamps
- Apply explicit user edits to structured memory
- Delete session memory and its related index rows

### AI-assisted operations

Natural-language interpretation of implicit relationship changes, promises, emotional developments, and nuanced plot events may require an AI model. Do not pretend regex or keyword rules can reliably infer all of these.

### Default behavior and user control

- Automatic local retrieval should be enabled by default because it makes no extra AI API request.
- AI-powered automatic memory summarization/update must be a clearly configurable feature.
- Before enabling it, explain that it may make additional requests to the user's selected provider and consume their quota/tokens.
- Do not silently trigger repeated background calls on free-tier BYOK accounts.
- Preserve a manual “Update Memory” action.

### Smart update triggers

Do not use a blind fixed interval such as every 10–12 messages.

Prefer triggers based on context-window pressure / old turns about to roll out of the recent window, with configurable thresholds. A turn-count/token threshold may be used as a guard, not as the only signal.

Requirements:
- Debounce updates.
- Do not block the current chat response.
- Do not let a memory update failure prevent normal chat generation.
- Back off after rate-limit (`429`) or provider errors.
- Avoid repeated updates for the same unchanged message range.
- Record the last successfully processed message/checkpoint.
- Make pending/failed memory updates recoverable after app restart.

### Memory state semantics

- Current-state fields such as location or relationship status should replace older values when a newer confirmed state supersedes them.
- Historical events should remain historical records, not be overwritten as if they never occurred.
- Promises/conflicts should have active/resolved status where appropriate.
- Distinguish explicit facts from model-inferred facts. Store confidence/provenance if the system uses inference.
- Never silently turn uncertain model interpretation into confirmed canon.

### Provenance

Every generated or pinned memory should retain source message ID(s) where possible. This enables review, edit, delete, and safe invalidation.

### Edit/delete/swipe/regenerate invalidation

- Deleting a source message must remove it from the message table and FTS index and mark dependent memories for review/rebuild.
- Editing a message must update its FTS row and invalidate memories derived from its previous content.
- Regenerating/swiping an assistant response must treat the replaced response and downstream derived memories as potentially stale.
- If a change occurs before the last processed checkpoint, mark the relevant session memory dirty and rebuild from the affected point, or require review where safe reconstruction is unavailable.
- Pinned memories should not silently disappear when a source message is deleted; retain them as user-owned facts but mark their provenance as removed/needs review, or ask the user what to do.
- Do not continue injecting stale, contradicted memory without a clear status.

---

## 7. Context-window and token budgeting

The existing fixed 32,768-token fallback must not be treated as universally valid.

Implement a central context-budget resolver:

- Resolve known model limits from a maintained provider/model capability map where possible.
- Allow a user override for custom OpenAI-compatible endpoints and unknown models.
- Use a conservative documented fallback (16,384 may be a starting point if appropriate after checking the app's supported models).
- Reserve max output tokens before allocating input context.
- Reserve a safety margin for imperfect token estimation and provider-specific formatting overhead.
- Ensure the minimum recent-turn policy does not exceed the available budget.
- Report when the configured context budget is likely invalid or too small rather than silently building an oversized request.

Do not assume provider models expose identical context windows or tokenization. Do not claim a local token estimator is exact unless it uses the provider's tokenizer.

---

## 8. AsyncStorage-to-SQLite migration

This is a user-data migration and must be treated as high risk.

### Requirements

1. Inspect all current AsyncStorage keys and every read/write path before designing the migration.
2. Create a versioned SQLite schema and migration ledger.
3. Make migration idempotent: repeating it must not duplicate or corrupt records.
4. Run data copy and validation in transactions where possible.
5. Preserve stable IDs, timestamps, message order, conversation metadata, all user-created content, and all fields the UI still relies on.
6. Count and compare source/destination conversations and messages.
7. Keep the original AsyncStorage keys as a recoverable backup until verification succeeds and the new database has been opened/read successfully.
8. Never delete legacy data merely because a migration function returned without throwing.
9. Provide a safe recovery path if migration is interrupted or the app closes midway.
10. Do not introduce dual-write paths that can silently diverge indefinitely. If a temporary compatibility layer is necessary, define its removal condition.

### Legacy character-level memory ambiguity

Old memory stored under `character.id` cannot be safely assigned when that character has multiple conversations.

Use this conservative policy:
- If a character has exactly one conversation and the memory can be confidently associated with it, it may be migrated to that conversation.
- If multiple conversations exist, do not automatically copy the same legacy narrative memory into all sessions or arbitrarily assign it to the latest session.
- Preserve ambiguous legacy memory in a recoverable, non-injected legacy record and provide a way for the user to assign, export, or discard it later.
- Preserve the old checkpoint index only when its source conversation is unambiguous and the index is valid for that conversation's message history.

### Legacy message mirror

Treat the conversation's embedded `messages[]` array as the primary source if verified. Use legacy character-level message caches only to recover missing records where association is unambiguous. Deduplicate using stable message IDs and timestamps. Do not merge session-ambiguous messages into the wrong conversation.

### Migration completion

Only after successful verification should the app switch reads/writes to SQLite as the source of truth. Retain a rollback/backup strategy for at least the migration release cycle.

---

## 9. Credential storage and local privacy hardening

### API keys

- Move provider API keys from AsyncStorage to `expo-secure-store` or an equivalent supported secure storage.
- Keep provider name, model, endpoint, temperature, and other non-secret settings in ordinary app storage if appropriate.
- Migrate each key independently and verify it can be retrieved before removing its old plaintext copy.
- Handle secure-storage unavailability and restore scenarios gracefully. Never log keys.

### Conversation database

- SQLite is local storage, not automatic encryption.
- Document whether the database is plaintext at rest in the current implementation.
- Investigate encryption-at-rest options compatible with Expo and the app's supported build/runtime; do not add a complex native dependency without a clear security and maintenance assessment.
- Do not advertise encrypted local chats unless encryption is actually implemented and tested.

### OS backups

Review Android Auto Backup and iOS backup behavior for the database and secure credentials.

Do not blindly disable all backups. Decide explicitly whether chat data should:
- be excluded from automatic cloud/device backups for stronger local-only privacy, or
- be included with clear disclosure and user control.

If excluding sensitive data, preserve an explicit user-controlled export/backup path. Test restore behavior. Document that platform secure-storage keys may not be restorable on a different device.

### Logs and diagnostics

- Never log raw prompts, full message bodies, API keys, or complete memory contents.
- Error messages should be useful without exposing user content or secrets.
- Review debug logging in chat generation, proxy/network code, migration, and memory retrieval.

### Delete and export

- Deleting a conversation must transactionally delete conversation metadata, messages, FTS rows, and session memories.
- Ensure indexes and derived caches cannot retrieve deleted content.
- Export must never include provider API keys.
- If an export contains chat/memory data in plaintext, clearly disclose it. Offer encryption only if implemented correctly and tested.

---

## 10. Provider routing and request behavior

Audit the active provider resolution path while changing prompt construction.

- Verify whether `Conversation.providerId` is respected for the active conversation.
- Verify provider/model selection cannot accidentally fall back to a global provider when a conversation explicitly selects another provider.
- Ensure API keys are loaded from secure storage immediately before use and are not copied into logs or persisted prompt metadata.
- Keep chat generation direct from the device to the selected AI provider; do not route normal roleplay prompts through the NekoChat PHP/MySQL backend.
- Continue supporting existing providers and OpenAI-compatible endpoints unless a concrete compatibility issue is found.
- Maintain streaming, cancellation/abort, continue, regenerate, and error callback behavior.

---

## 11. Earlier UI issues to re-check

These were reported in an earlier review. Verify whether they still reproduce before fixing them. They are separate from the memory/database refactor, but should be included in the overall review if still present.

### 11.1 ChatsScreen view-mode flash

Reported issue:
- `viewMode` initially renders as `grid`, then AsyncStorage loads and changes it to `accordion`, producing a brief visual flash.

Expected behavior:
- Load the persisted preference before showing the final list layout, or use a deliberate loading state that avoids the wrong layout flashing.
- Preserve the user's saved preference.

### 11.2 CommunityCharacterModal description scrolling

Reported issue:
- Description `ScrollView` inside `BottomSheetModal` sometimes stops responding because the parent drag-to-close `PanResponder` captures vertical gestures.

Expected behavior:
- Resolve gesture arbitration so the description remains scrollable and the sheet can still be dragged/dismissed.
- Test on Android touch devices, not only web or simulator.
- Avoid disabling the sheet's close gesture as a crude fix.

Do not combine these UI changes with database migration logic. Keep them in a clearly separate change set/phase.

---

## 12. Phased implementation order

Implement in this order unless repository inspection reveals a dependency that requires a safe adjustment.

### Phase 0 — Re-audit and baseline

- Check `git status` and preserve unrelated user changes.
- Verify all findings in the current branch.
- Record current behavior and available checks/build commands.
- Confirm actual Expo SDK, `expo-sqlite`, and `expo-secure-store` versions and runtime compatibility.
- Produce a short plan and risk list.

### Phase 1 — Immediate correctness and token-waste fixes

- Fix memory and checkpoint scoping to `conversationId`.
- Implement safe handling of ambiguous legacy memory as specified above.
- Remove duplicate memory injection.
- Ensure dynamic session memory is not persisted inside character scenario/profile fields.
- Add regression tests for cross-session isolation and single memory injection.
- Add per-model context-budget resolution/fallback behavior.

### Phase 2 — Database foundation and safe migration

- Add versioned SQLite schema for conversations, messages, FTS5 index, and session memories.
- Add repository/service abstraction so screens do not issue ad hoc SQL.
- Implement idempotent migration from AsyncStorage.
- Validate counts, IDs, ordering, and metadata before switching source of truth.
- Keep rollback data until verification is complete.

### Phase 3 — Credential and privacy hardening

- Migrate provider keys to secure storage.
- Remove verified plaintext key copies from AsyncStorage.
- Review backup behavior, logs, export, deletion, and local database-at-rest claims.
- Verify no chat/memory data is sent to the NekoChat backend.

### Phase 4 — Retrieval and prompt-budget integration

- Implement per-session FTS5/BM25 indexing and retrieval.
- Restrict search to the active conversation and older-than-recent-window messages.
- Add deduplication, minimum relevance threshold, result limit, and token cap.
- Implement one canonical prompt assembly path.
- Add tests that prove the selected memory appears once and no foreign-session memory appears.

### Phase 5 — Structured memory lifecycle

- Add structured state, event records, pinned facts, provenance, and status handling.
- Add memory edit/pin/unpin controls where appropriate in the existing UI.
- Add stale-memory invalidation for edit/delete/swipe/regenerate.
- Keep automatic local retrieval enabled by default.
- Make AI-powered automatic updates configurable and transparent about extra API calls/quota.
- Trigger updates on context pressure/turn rolloff rather than a blind fixed number of turns.
- Ensure update failures and `429` responses never block normal chat.

### Phase 6 — Separate UI bug fixes

- Fix the ChatsScreen persisted view-mode flash if still reproducible.
- Fix CommunityCharacterModal scroll/drag gesture conflict if still reproducible.
- Keep these changes isolated from the storage migration.

### Phase 7 — Benchmark, test, and document

Run realistic functional and performance tests before declaring completion.

---

## 13. Required tests and acceptance criteria

### Session isolation

- Two conversations using the same character have independent memory and checkpoint state.
- A memory search in Session A never returns a message or memory from Session B.
- A conversation ID belonging to another character is rejected or returns no records.
- Long checkpoint indices from one session cannot affect another session's history slicing.

### Prompt assembly and token use

- Memory is injected exactly once.
- Recent messages are not duplicated in past-message recall.
- Weakly relevant results are omitted rather than filling the retrieval quota.
- Retrieval respects configured count and token limits.
- Context budgeting reserves output tokens and applies the configured model limit/fallback.

### Memory lifecycle

- Pinned facts persist across normal updates.
- Current-state fields can be superseded by newer confirmed state.
- Historical events remain historical and can be marked resolved where appropriate.
- Editing/deleting/regenerating source messages invalidates dependent memories.
- Failed memory updates do not block chat generation.
- Rate-limit errors trigger backoff and do not cause repeated background calls.

### Migration

- Migration can run more than once without creating duplicates.
- Interrupted migration can resume safely.
- Conversation/message counts and stable IDs match expected source records.
- Message order, timestamps, metadata, and conversation associations are preserved.
- Ambiguous legacy memory is preserved but not injected into arbitrary sessions.
- Old keys are not removed until destination verification succeeds.

### Privacy and credentials

- API keys are not present in ordinary AsyncStorage after successful migration.
- API keys and chat content never appear in logs.
- Export excludes API keys.
- Conversation deletion removes message, FTS, and session memory records transactionally.
- The app does not upload conversation or memory data to the NekoChat backend.
- Documentation accurately distinguishes local storage from encryption at rest and external AI provider retention.

### Performance benchmark fixture

Use a reproducible synthetic fixture such as:
- 50 characters
- 90 conversations/sessions
- 300 messages per session
- approximately 27,000 messages total

Measure on at least one representative mid-range Android device:
- Cold start and ChatsScreen load time (metadata only)
- SQLite message read/append latency
- FTS5 retrieval latency for one conversation
- FTS insertion/update/delete latency
- Memory use during session switching
- First-run migration duration and interruption recovery

Report actual measurements and device details. Do not write assumed values such as “5–10 ms” as if measured.

---

## 14. Out of scope for this refactor

Do not implement these unless later explicitly requested:

- Cloud-side chat or memory storage
- Server-side vector database
- Automatic upload/sync of memory or embeddings
- Local embedding model/runtime
- A large new AI orchestration framework
- A full redesign of the chat UI
- Unrelated community/catalog features

---

## 15. Final report expected from the coding agent

When the work is complete, provide:

1. **Verified audit:** which original findings were confirmed, already fixed, or not reproducible.
2. **Implemented changes:** grouped by phase, with file paths and concise explanations.
3. **Database design:** schema summary, indexes, FTS strategy, and migration version.
4. **Migration report:** counts before/after, ambiguous legacy-data handling, rollback behavior, and any unresolved cases.
5. **Memory behavior:** scope rules, retrieval ranking, token limits, update triggers, and invalidation behavior.
6. **Privacy report:** where data is stored, what leaves the device, credential migration, backup behavior, logging, and encryption limitations.
7. **Tests and benchmarks:** exact commands, results, device details, and failures.
8. **Deferred work:** anything not completed and why.
9. **Manual verification steps:** what I should test in the app before releasing it.

**Definition of done:** NekoChat has correctly isolated per-conversation narrative memory, no longer injects duplicate memory, stores conversation/message data in a verified local SQLite design with safe migration, supports local per-session BM25 recall and structured memory, handles stale memory safely, protects provider keys with secure storage, and passes the acceptance tests above without routing chats through the NekoChat backend.
