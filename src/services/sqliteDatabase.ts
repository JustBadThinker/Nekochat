/**
 * Versioned SQLite Database & Repository Layer (Phase 2)
 *
 * - Provides normalized tables: `schema_migrations`, `conversations`, `messages`,
 *   `messages_fts` (FTS5 when supported), and `session_memories`.
 * - Uses a driver-agnostic `SqlExecutor` interface so the exact same schema,
 *   migration, and repository queries can run on `expo-sqlite` (Android/iOS)
 *   and be tested directly in Node.
 * - On Web (`Platform.OS === 'web'`), gracefully returns `null` so `storageService`
 *   continues using `AsyncStorage` without requiring COOP/COEP WASM headers.
 */

import type {
  CastFactRecord,
  CastKnowledgeBoundary,
  CastPresenceStatus,
  CastProfileField,
  ChatMessage,
  Conversation,
  DynamicCastMember,
  SceneContinuityState,
} from '../types';

export const SQLITE_DB_NAME = 'nekochat.db';
export const CURRENT_SCHEMA_VERSION = 3;

export interface SqlQueryExecutor {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: any[]): Promise<{ changes?: number; lastInsertRowId?: number }>;
  getAllAsync<T = any>(sql: string, params?: any[]): Promise<T[]>;
  getFirstAsync<T = any>(sql: string, params?: any[]): Promise<T | null>;
}

export interface SqlExecutor extends SqlQueryExecutor {
  withExclusiveTransactionAsync(task: (tx?: SqlQueryExecutor) => Promise<void>): Promise<void>;
}

export function stripThinkingForIndex(text: string): string {
  if (!text) return '';
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, ' ')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isErrorTurn(m: Pick<ChatMessage, 'content'> & { isError?: boolean }): boolean {
  return Boolean(m.isError) || /^⚠️ Error/.test(m.content || '');
}

export interface SchemaInitResult {
  version: number;
  fts5Supported: boolean;
}

/**
 * Applies versioned DDL migrations idempotently and detects FTS5 support.
 */
export async function initializeSqliteSchema(db: SqlExecutor): Promise<SchemaInitResult> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedCurrent = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_migrations WHERE version = ?',
    [CURRENT_SCHEMA_VERSION]
  );

  if (!appliedCurrent) {
    const appliedV1 = await db.getFirstAsync<{ version: number }>(
      'SELECT version FROM schema_migrations WHERE version = 1'
    );

    await db.withExclusiveTransactionAsync(async tx => {
      const q = tx ?? db;
      if (!appliedV1) {
        await q.execAsync(`
          CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            character_id TEXT NOT NULL,
            scenario_id TEXT,
            scenario_title TEXT,
            persona_id TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            title TEXT NOT NULL,
            model_name TEXT,
            message_count INTEGER NOT NULL DEFAULT 0,
            is_archived INTEGER NOT NULL DEFAULT 0,
            is_pinned INTEGER NOT NULL DEFAULT 0,
            summary TEXT,
            key_memories_json TEXT,
            last_summary_at TEXT,
            memory_checkpoint INTEGER,
            custom_prompt TEXT,
            token_optimizer TEXT,
            cumulative_usage_json TEXT,
            parent_conversation_id TEXT,
            branched_from_message_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );

          CREATE INDEX IF NOT EXISTS idx_conversations_char_updated
            ON conversations(character_id, updated_at DESC);

          CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            character_id TEXT NOT NULL,
            turn_index INTEGER NOT NULL,
            role TEXT NOT NULL,
            sender TEXT,
            sender_role TEXT,
            content TEXT NOT NULL,
            thought TEXT,
            swipes_json TEXT,
            swipe_index INTEGER,
            is_error INTEGER NOT NULL DEFAULT 0,
            image_url TEXT,
            image_prompt TEXT,
            image_style TEXT,
            image_error TEXT,
            timestamp TEXT NOT NULL,
            token_count INTEGER,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_messages_conv_turn
            ON messages(conversation_id, turn_index ASC);

          CREATE TABLE IF NOT EXISTS session_memories (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            character_id TEXT NOT NULL,
            memory_type TEXT NOT NULL,
            slot_key TEXT,
            content TEXT NOT NULL,
            is_pinned INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active',
            source_message_ids_json TEXT,
            is_dirty INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_session_memories_conv
            ON session_memories(conversation_id, status);
        `);
      }

      // Idempotent v2 column check for existing v1 databases (or retried migrations)
      const cols = await q.getAllAsync<{ name: string }>('PRAGMA table_info(conversations)');
      const colNames = new Set(cols.map(c => c.name));
      if (!colNames.has('parent_conversation_id')) {
        await q.execAsync('ALTER TABLE conversations ADD COLUMN parent_conversation_id TEXT');
      }
      if (!colNames.has('branched_from_message_id')) {
        await q.execAsync('ALTER TABLE conversations ADD COLUMN branched_from_message_id TEXT');
      }

      // v3: Dynamic Cast & Scene Continuity tables (idempotent across fresh & v1/v2 DBs)
      await q.execAsync(`
        CREATE TABLE IF NOT EXISTS cast_members (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          character_id TEXT NOT NULL,
          name TEXT NOT NULL,
          aliases_json TEXT,
          is_primary INTEGER NOT NULL DEFAULT 0,
          presence TEXT NOT NULL DEFAULT 'unknown',
          ai_controlled INTEGER NOT NULL DEFAULT 1,
          profile_status TEXT NOT NULL DEFAULT 'stub',
          unknown_fields_json TEXT,
          knowledge_json TEXT,
          introduced_at_message_id TEXT,
          introduced_turn_index INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_cast_members_conv
          ON cast_members(conversation_id, character_id);

        CREATE TABLE IF NOT EXISTS cast_facts (
          id TEXT PRIMARY KEY,
          cast_member_id TEXT NOT NULL,
          conversation_id TEXT NOT NULL,
          field TEXT NOT NULL,
          value TEXT NOT NULL,
          source_type TEXT NOT NULL,
          confirmed INTEGER NOT NULL DEFAULT 0,
          source_message_id TEXT,
          turn_index INTEGER,
          status TEXT NOT NULL DEFAULT 'active',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (cast_member_id) REFERENCES cast_members(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_cast_facts_member
          ON cast_facts(cast_member_id, status);

        CREATE TABLE IF NOT EXISTS scene_states (
          conversation_id TEXT PRIMARY KEY,
          character_id TEXT NOT NULL,
          current_location TEXT NOT NULL DEFAULT '',
          established_time TEXT NOT NULL DEFAULT '',
          ongoing_activities_json TEXT,
          unresolved_actions_json TEXT,
          last_transition_message_id TEXT,
          last_transition_turn_index INTEGER,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );
      `);

      await q.runAsync(
        'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        [CURRENT_SCHEMA_VERSION, new Date().toISOString()]
      );
    });
  }

  let fts5Supported = false;
  try {
    await db.execAsync(`
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        message_id UNINDEXED,
        conversation_id UNINDEXED,
        character_id UNINDEXED,
        content
      );
    `);
    fts5Supported = true;
  } catch {
    fts5Supported = false;
  }

  return { version: CURRENT_SCHEMA_VERSION, fts5Supported };
}

export interface SessionMemoryRecord {
  id: string;
  conversationId: string;
  characterId: string;
  memoryType: 'state' | 'event' | 'pinned' | 'legacy_summary';
  slotKey?: string;
  content: string;
  isPinned: boolean;
  status: 'active' | 'resolved' | 'stale' | 'needs_review';
  sourceMessageIds: string[];
  isDirty: boolean;
  createdAt: number;
  updatedAt: number;
}

export class SqliteConversationRepository {
  private readonly db: SqlExecutor;
  private readonly fts5Supported: boolean;

  constructor(db: SqlExecutor, fts5Supported: boolean) {
    this.db = db;
    this.fts5Supported = fts5Supported;
  }

  private async syncMessageFts(
    msg: ChatMessage,
    conversationId: string,
    characterId: string,
    hadExistingRow: boolean,
    q: SqlQueryExecutor = this.db
  ): Promise<void> {
    if (!this.fts5Supported) return;
    if (hadExistingRow) {
      await q.runAsync('DELETE FROM messages_fts WHERE message_id = ?', [msg.id]);
    }
    if (isErrorTurn(msg)) return;
    const searchable = stripThinkingForIndex(msg.content || '');
    if (!searchable) return;
    await q.runAsync(
      'INSERT INTO messages_fts (message_id, conversation_id, character_id, content) VALUES (?, ?, ?, ?)',
      [msg.id, conversationId, characterId, searchable]
    );
  }

  private mapRowToConversation(row: any, messages: ChatMessage[]): Conversation {
    return {
      id: row.id,
      userId: row.user_id,
      characterId: row.character_id,
      scenarioId: row.scenario_id ?? undefined,
      scenarioTitle: row.scenario_title ?? undefined,
      personaId: row.persona_id,
      providerId: row.provider_id,
      title: row.title,
      modelName: row.model_name ?? undefined,
      messages,
      messageCount: Number(row.message_count ?? messages.length),
      isArchived: Boolean(row.is_archived),
      isPinned: Boolean(row.is_pinned),
      summary: row.summary ?? undefined,
      keyMemories: row.key_memories_json ? JSON.parse(row.key_memories_json) : undefined,
      lastSummaryAt: row.last_summary_at ?? undefined,
      memoryCheckpoint: row.memory_checkpoint ?? undefined,
      customPrompt: row.custom_prompt ?? undefined,
      tokenOptimizer: row.token_optimizer ?? undefined,
      cumulativeUsage: row.cumulative_usage_json ? JSON.parse(row.cumulative_usage_json) : undefined,
      parentConversationId: row.parent_conversation_id ?? undefined,
      branchedFromMessageId: row.branched_from_message_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToMessage(row: any): ChatMessage {
    const tsNum = Number(row.timestamp);
    return {
      id: row.id,
      conversationId: row.conversation_id,
      characterId: row.character_id,
      role: row.role,
      sender: row.sender ?? undefined,
      senderRole: row.sender_role ?? undefined,
      content: row.content,
      thought: row.thought ?? undefined,
      swipes: row.swipes_json ? JSON.parse(row.swipes_json) : undefined,
      swipeIndex: typeof row.swipe_index === 'number' ? row.swipe_index : undefined,
      imageUrl: row.image_url ?? undefined,
      imagePrompt: row.image_prompt ?? undefined,
      imageStyle: row.image_style ?? undefined,
      imageError: row.image_error ?? undefined,
      timestamp: !Number.isNaN(tsNum) && String(tsNum) === String(row.timestamp) ? tsNum : row.timestamp,
      tokenCount: typeof row.token_count === 'number' ? row.token_count : undefined,
    };
  }

  private async upsertConversationRow(conv: Conversation, q: SqlQueryExecutor = this.db): Promise<void> {
    await q.runAsync(
      `INSERT INTO conversations (
        id, user_id, character_id, scenario_id, scenario_title, persona_id, provider_id,
        title, model_name, message_count, is_archived, is_pinned, summary, key_memories_json,
        last_summary_at, memory_checkpoint, custom_prompt, token_optimizer,
        cumulative_usage_json, parent_conversation_id, branched_from_message_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        character_id = excluded.character_id,
        scenario_id = excluded.scenario_id,
        scenario_title = excluded.scenario_title,
        persona_id = excluded.persona_id,
        provider_id = excluded.provider_id,
        title = excluded.title,
        model_name = excluded.model_name,
        message_count = excluded.message_count,
        is_archived = excluded.is_archived,
        is_pinned = excluded.is_pinned,
        summary = excluded.summary,
        key_memories_json = excluded.key_memories_json,
        last_summary_at = excluded.last_summary_at,
        memory_checkpoint = excluded.memory_checkpoint,
        custom_prompt = excluded.custom_prompt,
        token_optimizer = excluded.token_optimizer,
        cumulative_usage_json = excluded.cumulative_usage_json,
        parent_conversation_id = excluded.parent_conversation_id,
        branched_from_message_id = excluded.branched_from_message_id,
        updated_at = excluded.updated_at`,
      [
        conv.id,
        conv.userId || 'user_local_01',
        conv.characterId,
        conv.scenarioId ?? null,
        conv.scenarioTitle ?? null,
        conv.personaId || 'default',
        conv.providerId || 'prov_gemini',
        conv.title || 'Chat',
        conv.modelName ?? null,
        conv.messages?.length ?? conv.messageCount ?? 0,
        conv.isArchived ? 1 : 0,
        conv.isPinned ? 1 : 0,
        conv.summary ?? null,
        conv.keyMemories ? JSON.stringify(conv.keyMemories) : null,
        conv.lastSummaryAt ?? null,
        typeof conv.memoryCheckpoint === 'number' ? conv.memoryCheckpoint : null,
        conv.customPrompt ?? null,
        conv.tokenOptimizer ?? null,
        conv.cumulativeUsage ? JSON.stringify(conv.cumulativeUsage) : null,
        conv.parentConversationId ?? null,
        conv.branchedFromMessageId ?? null,
        conv.createdAt || new Date().toISOString(),
        conv.updatedAt || new Date().toISOString(),
      ]
    );
  }

  private async upsertMessageRow(
    msg: ChatMessage,
    conversationId: string,
    characterId: string,
    turnIndex: number,
    q: SqlQueryExecutor = this.db
  ): Promise<void> {
    const existing = this.fts5Supported
      ? await q.getFirstAsync<{ id: string }>('SELECT id FROM messages WHERE id = ?', [msg.id])
      : null;
    await q.runAsync(
      `INSERT INTO messages (
        id, conversation_id, character_id, turn_index, role, sender, sender_role,
        content, thought, swipes_json, swipe_index, is_error,
        image_url, image_prompt, image_style, image_error, timestamp, token_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        conversation_id = excluded.conversation_id,
        character_id = excluded.character_id,
        turn_index = excluded.turn_index,
        role = excluded.role,
        sender = excluded.sender,
        sender_role = excluded.sender_role,
        content = excluded.content,
        thought = excluded.thought,
        swipes_json = excluded.swipes_json,
        swipe_index = excluded.swipe_index,
        is_error = excluded.is_error,
        image_url = excluded.image_url,
        image_prompt = excluded.image_prompt,
        image_style = excluded.image_style,
        image_error = excluded.image_error,
        timestamp = excluded.timestamp,
        token_count = excluded.token_count`,
      [
        msg.id,
        conversationId,
        characterId,
        turnIndex,
        msg.role,
        msg.sender ?? null,
        msg.senderRole ?? null,
        msg.content ?? '',
        msg.thought ?? null,
        msg.swipes ? JSON.stringify(msg.swipes) : null,
        typeof msg.swipeIndex === 'number' ? msg.swipeIndex : null,
        isErrorTurn(msg) ? 1 : 0,
        msg.imageUrl ?? null,
        msg.imagePrompt ?? null,
        msg.imageStyle ?? null,
        msg.imageError ?? null,
        String(msg.timestamp ?? Date.now()),
        typeof msg.tokenCount === 'number' ? msg.tokenCount : null,
      ]
    );
    await this.syncMessageFts(msg, conversationId, characterId, Boolean(existing), q);
  }

  async getConversations(userId?: string): Promise<Conversation[]> {
    const convRows = userId
      ? await this.db.getAllAsync<any>(
          'SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC',
          [userId]
        )
      : await this.db.getAllAsync<any>('SELECT * FROM conversations ORDER BY updated_at DESC');

    if (convRows.length === 0) return [];

    const msgRows = await this.db.getAllAsync<any>(
      'SELECT * FROM messages ORDER BY conversation_id ASC, turn_index ASC'
    );
    const byConv = new Map<string, ChatMessage[]>();
    for (const r of msgRows) {
      const list = byConv.get(r.conversation_id) || [];
      list.push(this.mapRowToMessage(r));
      byConv.set(r.conversation_id, list);
    }

    return convRows.map(r => this.mapRowToConversation(r, byConv.get(r.id) || []));
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const row = await this.db.getFirstAsync<any>('SELECT * FROM conversations WHERE id = ?', [id]);
    if (!row) return null;
    const msgRows = await this.db.getAllAsync<any>(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY turn_index ASC',
      [id]
    );
    return this.mapRowToConversation(
      row,
      msgRows.map(r => this.mapRowToMessage(r))
    );
  }

  async getConversationsForCharacter(characterId: string): Promise<Conversation[]> {
    const convRows = await this.db.getAllAsync<any>(
      'SELECT * FROM conversations WHERE character_id = ? ORDER BY updated_at DESC',
      [characterId]
    );
    if (convRows.length === 0) return [];
    const results: Conversation[] = [];
    for (const r of convRows) {
      const msgRows = await this.db.getAllAsync<any>(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY turn_index ASC',
        [r.id]
      );
      results.push(this.mapRowToConversation(r, msgRows.map(m => this.mapRowToMessage(m))));
    }
    return results;
  }

  async upsertConversation(conv: Conversation): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async () => {
      await this.upsertConversationRow(conv);
      const msgs = conv.messages || [];
      const existingRows = await this.db.getAllAsync<{ id: string }>(
        'SELECT id FROM messages WHERE conversation_id = ?',
        [conv.id]
      );
      const incomingIds = new Set(msgs.map(m => m.id));
      for (const oldRow of existingRows) {
        if (!incomingIds.has(oldRow.id)) {
          await this.db.runAsync('DELETE FROM messages WHERE id = ?', [oldRow.id]);
          if (this.fts5Supported) {
            await this.db.runAsync('DELETE FROM messages_fts WHERE message_id = ?', [oldRow.id]);
          }
        }
      }
      for (let i = 0; i < msgs.length; i++) {
        await this.upsertMessageRow(msgs[i], conv.id, conv.characterId, i);
      }
    });
  }

  async appendMessageToConversation(conversationId: string, message: ChatMessage): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async () => {
      const conv = await this.db.getFirstAsync<any>(
        'SELECT id, character_id FROM conversations WHERE id = ?',
        [conversationId]
      );
      if (!conv) return;

      const maxTurnRow = await this.db.getFirstAsync<{ maxTurn: number | null }>(
        'SELECT MAX(turn_index) AS maxTurn FROM messages WHERE conversation_id = ?',
        [conversationId]
      );
      const nextTurn = typeof maxTurnRow?.maxTurn === 'number' ? maxTurnRow.maxTurn + 1 : 0;

      const msgWithConv: ChatMessage = { ...message, conversationId };
      await this.upsertMessageRow(msgWithConv, conversationId, conv.character_id, nextTurn);

      const countRow = await this.db.getFirstAsync<{ cnt: number }>(
        'SELECT COUNT(*) AS cnt FROM messages WHERE conversation_id = ?',
        [conversationId]
      );
      await this.db.runAsync(
        'UPDATE conversations SET message_count = ?, updated_at = ? WHERE id = ?',
        [countRow?.cnt ?? nextTurn + 1, new Date().toISOString(), conversationId]
      );
    });
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async () => {
      if (this.fts5Supported) {
        await this.db.runAsync('DELETE FROM messages_fts WHERE conversation_id = ?', [conversationId]);
      }
      await this.db.runAsync('DELETE FROM cast_facts WHERE conversation_id = ?', [conversationId]);
      await this.db.runAsync('DELETE FROM cast_members WHERE conversation_id = ?', [conversationId]);
      await this.db.runAsync('DELETE FROM scene_states WHERE conversation_id = ?', [conversationId]);
      await this.db.runAsync('DELETE FROM session_memories WHERE conversation_id = ?', [conversationId]);
      await this.db.runAsync('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
      await this.db.runAsync('DELETE FROM conversations WHERE id = ?', [conversationId]);
    });
  }

  async deleteConversationsForCharacter(characterId: string): Promise<void> {
    const convs = await this.db.getAllAsync<{ id: string }>(
      'SELECT id FROM conversations WHERE character_id = ?',
      [characterId]
    );
    for (const c of convs) {
      await this.deleteConversation(c.id);
    }
  }

  /**
   * Atomically branches a conversation up to `branchMessageId` (inclusive).
   * Prevents future-state leakage:
   * - Only copies messages with `turn_index <= branchTurnIndex` with fresh IDs and FTS5 rows.
   * - Copies only `active` `session_memories` whose `sourceMessageIds` are non-empty and all <= branchTurnIndex.
   * - Excludes overwritten state slots or unattributed memories whose provenance extends past the branch point.
   */
  async branchConversationAtMessage(params: {
    sourceConversationId: string;
    characterId: string;
    branchMessageId: string;
    title?: string;
  }): Promise<{
    conversation: Conversation;
    branchTurnIndex: number;
    sourceMessageCount: number;
    copiedMemoriesCount: number;
    excludedMemoriesCount: number;
  } | null> {
    let result: {
      conversation: Conversation;
      branchTurnIndex: number;
      sourceMessageCount: number;
      copiedMemoriesCount: number;
      excludedMemoriesCount: number;
    } | null = null;

    await this.db.withExclusiveTransactionAsync(async tx => {
      const q = tx ?? this.db;

      const sourceConvRow = await q.getFirstAsync<any>(
        'SELECT * FROM conversations WHERE id = ? AND character_id = ? LIMIT 1',
        [params.sourceConversationId, params.characterId]
      );
      if (!sourceConvRow) return;

      const targetMsgRow = await q.getFirstAsync<{ turn_index: number }>(
        'SELECT turn_index FROM messages WHERE id = ? AND conversation_id = ? LIMIT 1',
        [params.branchMessageId, params.sourceConversationId]
      );
      if (!targetMsgRow || typeof targetMsgRow.turn_index !== 'number') return;

      const branchTurnIndex = targetMsgRow.turn_index;
      const countRow = await q.getFirstAsync<{ cnt: number }>(
        'SELECT COUNT(*) AS cnt FROM messages WHERE conversation_id = ?',
        [params.sourceConversationId]
      );
      const sourceMessageCount = Number(countRow?.cnt ?? 0);

      const keptRows = await q.getAllAsync<any>(
        'SELECT * FROM messages WHERE conversation_id = ? AND turn_index <= ? ORDER BY turn_index ASC, rowid ASC',
        [params.sourceConversationId, branchTurnIndex]
      );

      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const randSuffix = Math.random().toString(36).slice(2, 7);
      const newConvId = `conv_br_${nowMs}_${randSuffix}`;

      const idMap = new Map<string, string>();
      const copiedMessages: ChatMessage[] = keptRows.map((row, idx) => {
        const mapped = this.mapRowToMessage(row);
        const newMsgId = `msg_br_${nowMs}_${idx}_${Math.random().toString(36).slice(2, 7)}`;
        idMap.set(mapped.id, newMsgId);
        return {
          ...mapped,
          id: newMsgId,
          conversationId: newConvId,
        };
      });

      const baseConv = this.mapRowToConversation(sourceConvRow, []);
      const branchedConv: Conversation = {
        ...baseConv,
        id: newConvId,
        title: (params.title || `${baseConv.title} · Branch ${branchTurnIndex + 1}`).trim(),
        messages: copiedMessages,
        messageCount: copiedMessages.length,
        isArchived: false,
        isPinned: false,
        summary: undefined,
        keyMemories: undefined,
        lastSummaryAt: undefined,
        memoryCheckpoint: undefined,
        cumulativeUsage: undefined,
        parentConversationId: sourceConvRow.id,
        branchedFromMessageId: params.branchMessageId,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await this.upsertConversationRow(branchedConv, q);
      for (let i = 0; i < copiedMessages.length; i++) {
        await this.upsertMessageRow(copiedMessages[i], newConvId, branchedConv.characterId, i, q);
      }

      const memRows = await q.getAllAsync<any>(
        'SELECT * FROM session_memories WHERE conversation_id = ? AND character_id = ?',
        [params.sourceConversationId, params.characterId]
      );

      let copiedMemoriesCount = 0;
      let excludedMemoriesCount = 0;

      for (const memRow of memRows) {
        let sourceIds: string[] = [];
        try {
          const parsed = memRow.source_message_ids_json ? JSON.parse(memRow.source_message_ids_json) : [];
          sourceIds = Array.isArray(parsed) ? parsed : [];
        } catch {
          sourceIds = [];
        }

        const hasStrictProvenance =
          memRow.status === 'active' &&
          sourceIds.length > 0 &&
          sourceIds.every(id => idMap.has(id));

        if (!hasStrictProvenance) {
          excludedMemoriesCount++;
          continue;
        }

        const remappedIds = sourceIds.map(id => idMap.get(id)!);
        const newMemId =
          memRow.memory_type === 'state' && memRow.slot_key
            ? `mem_slot_${newConvId}_${memRow.slot_key}`
            : `mem_br_${nowMs}_${copiedMemoriesCount}_${Math.random().toString(36).slice(2, 7)}`;

        await q.runAsync(
          `INSERT INTO session_memories (
            id, conversation_id, character_id, memory_type, slot_key, content,
            is_pinned, status, source_message_ids_json, is_dirty, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newMemId,
            newConvId,
            branchedConv.characterId,
            memRow.memory_type,
            memRow.slot_key ?? null,
            memRow.content,
            memRow.is_pinned ? 1 : 0,
            'active',
            JSON.stringify(remappedIds),
            0,
            memRow.created_at,
            nowMs,
          ]
        );
        copiedMemoriesCount++;
      }

      // Copy provenance-safe Dynamic Cast members, facts, and scene continuity
      const castRows = await q.getAllAsync<any>(
        'SELECT * FROM cast_members WHERE conversation_id = ? AND character_id = ?',
        [params.sourceConversationId, params.characterId]
      );
      const castIdMap = new Map<string, string>();
      for (const cRow of castRows) {
        const introTurn = typeof cRow.introduced_turn_index === 'number' ? cRow.introduced_turn_index : null;
        if (introTurn !== null && introTurn > branchTurnIndex) {
          continue;
        }
        const newCastId = `cast_br_${nowMs}_${castIdMap.size}_${Math.random().toString(36).slice(2, 6)}`;
        castIdMap.set(cRow.id, newCastId);
        const remappedIntroMsg =
          cRow.introduced_at_message_id && idMap.has(cRow.introduced_at_message_id)
            ? idMap.get(cRow.introduced_at_message_id)!
            : null;
        await q.runAsync(
          `INSERT INTO cast_members (
            id, conversation_id, character_id, name, aliases_json, is_primary,
            presence, ai_controlled, profile_status, unknown_fields_json, knowledge_json,
            introduced_at_message_id, introduced_turn_index, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newCastId,
            newConvId,
            branchedConv.characterId,
            cRow.name,
            cRow.aliases_json ?? '[]',
            cRow.is_primary ? 1 : 0,
            cRow.presence ?? 'unknown',
            cRow.ai_controlled ? 1 : 0,
            cRow.profile_status ?? 'stub',
            cRow.unknown_fields_json ?? '[]',
            cRow.knowledge_json ?? '{}',
            remappedIntroMsg,
            introTurn,
            cRow.created_at,
            nowMs,
          ]
        );
      }

      const castFactRows = await q.getAllAsync<any>(
        'SELECT * FROM cast_facts WHERE conversation_id = ?',
        [params.sourceConversationId]
      );
      let copiedCastFacts = 0;
      for (const fRow of castFactRows) {
        const mappedCastId = castIdMap.get(fRow.cast_member_id);
        if (!mappedCastId || fRow.status !== 'active') continue;
        if (!fRow.source_message_id || !idMap.has(fRow.source_message_id)) continue;
        const newFactId = `cf_br_${nowMs}_${copiedCastFacts++}_${Math.random().toString(36).slice(2, 6)}`;
        await q.runAsync(
          `INSERT INTO cast_facts (
            id, cast_member_id, conversation_id, field, value, source_type,
            confirmed, source_message_id, turn_index, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newFactId,
            mappedCastId,
            newConvId,
            fRow.field,
            fRow.value,
            fRow.source_type,
            fRow.confirmed ? 1 : 0,
            idMap.get(fRow.source_message_id)!,
            typeof fRow.turn_index === 'number' ? fRow.turn_index : null,
            'active',
            fRow.created_at,
            nowMs,
          ]
        );
      }

      const sceneRow = await q.getFirstAsync<any>(
        'SELECT * FROM scene_states WHERE conversation_id = ? AND character_id = ?',
        [params.sourceConversationId, params.characterId]
      );
      if (
        sceneRow &&
        (sceneRow.last_transition_turn_index === null ||
          sceneRow.last_transition_turn_index === undefined ||
          sceneRow.last_transition_turn_index <= branchTurnIndex)
      ) {
        const remappedTransitionMsg =
          sceneRow.last_transition_message_id && idMap.has(sceneRow.last_transition_message_id)
            ? idMap.get(sceneRow.last_transition_message_id)!
            : null;
        await q.runAsync(
          `INSERT INTO scene_states (
            conversation_id, character_id, current_location, established_time,
            ongoing_activities_json, unresolved_actions_json,
            last_transition_message_id, last_transition_turn_index, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newConvId,
            branchedConv.characterId,
            sceneRow.current_location ?? '',
            sceneRow.established_time ?? '',
            sceneRow.ongoing_activities_json ?? '[]',
            sceneRow.unresolved_actions_json ?? '[]',
            remappedTransitionMsg,
            typeof sceneRow.last_transition_turn_index === 'number' ? sceneRow.last_transition_turn_index : null,
            nowMs,
          ]
        );
      }

      result = {
        conversation: branchedConv,
        branchTurnIndex,
        sourceMessageCount,
        copiedMemoriesCount,
        excludedMemoriesCount,
      };
    });

    return result;
  }

  async saveAllConversations(conversations: Conversation[]): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async () => {
      const existing = await this.db.getAllAsync<{ id: string }>('SELECT id FROM conversations');
      const keepIds = new Set(conversations.map(c => c.id));
      for (const row of existing) {
        if (!keepIds.has(row.id)) {
          if (this.fts5Supported) {
            await this.db.runAsync('DELETE FROM messages_fts WHERE conversation_id = ?', [row.id]);
          }
          await this.db.runAsync('DELETE FROM session_memories WHERE conversation_id = ?', [row.id]);
          await this.db.runAsync('DELETE FROM messages WHERE conversation_id = ?', [row.id]);
          await this.db.runAsync('DELETE FROM conversations WHERE id = ?', [row.id]);
        }
      }

      for (const conv of conversations) {
        await this.upsertConversationRow(conv);
        const msgs = conv.messages || [];
        const existingMsgs = await this.db.getAllAsync<{ id: string }>(
          'SELECT id FROM messages WHERE conversation_id = ?',
          [conv.id]
        );
        const msgIds = new Set(msgs.map(m => m.id));
        for (const m of existingMsgs) {
          if (!msgIds.has(m.id)) {
            await this.db.runAsync('DELETE FROM messages WHERE id = ?', [m.id]);
            if (this.fts5Supported) {
              await this.db.runAsync('DELETE FROM messages_fts WHERE message_id = ?', [m.id]);
            }
          }
        }
        for (let i = 0; i < msgs.length; i++) {
          await this.upsertMessageRow(msgs[i], conv.id, conv.characterId, i);
        }
      }
    });
  }

  /**
   * Idempotent migration from AsyncStorage `Conversation[]` into SQLite.
   * Verifies row counts and IDs before returning success.
   */
  async migrateFromLegacyConversations(legacyConversations: Conversation[]): Promise<{
    verified: boolean;
    sourceConversations: number;
    sourceMessages: number;
    destConversations: number;
    destMessages: number;
  }> {
    const sourceConversations = legacyConversations.length;
    const sourceMessages = legacyConversations.reduce((acc, c) => acc + (c.messages?.length || 0), 0);

    if (sourceConversations > 0) {
      await this.db.withExclusiveTransactionAsync(async () => {
        for (const conv of legacyConversations) {
          await this.upsertConversationRow(conv);
          const msgs = conv.messages || [];
          for (let i = 0; i < msgs.length; i++) {
            await this.upsertMessageRow(msgs[i], conv.id, conv.characterId, i);
          }
        }
      });
    }

    const convCountRow = await this.db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM conversations');
    const msgCountRow = await this.db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM messages');
    const destConversations = Number(convCountRow?.cnt || 0);
    const destMessages = Number(msgCountRow?.cnt || 0);

    let allIdsPresent = true;
    for (const conv of legacyConversations) {
      const found = await this.db.getFirstAsync<{ id: string }>('SELECT id FROM conversations WHERE id = ?', [conv.id]);
      if (!found) {
        allIdsPresent = false;
        break;
      }
    }

    const verified =
      allIdsPresent &&
      destConversations >= sourceConversations &&
      destMessages >= sourceMessages;

    return {
      verified,
      sourceConversations,
      sourceMessages,
      destConversations,
      destMessages,
    };
  }

  /**
   * Searches older messages in ONE conversation using SQLite FTS5/BM25.
   * - Strictly scoped to `conversationId` + `characterId` (rejects cross-character mismatch).
   * - Excludes `excludeMessageIds` (already in recent prompt window).
   * - Applies relevance threshold, deduplication, count limit (max 3), and token cap (max 300).
   */
  async searchOlderMessagesForConversation(params: {
    conversationId: string;
    characterId: string;
    query: string;
    excludeMessageIds?: string[];
    maxSnippets?: number;
    maxTokens?: number;
    minBm25Magnitude?: number;
  }): Promise<{ messageId: string; role: string; turnIndex: number; content: string; bm25Score: number }[]> {
    if (!this.fts5Supported || !params.conversationId || !params.query?.trim()) {
      return [];
    }

    // Verify conversation belongs to expected characterId
    const owner = await this.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM conversations WHERE id = ? AND character_id = ? LIMIT 1',
      [params.conversationId, params.characterId]
    );
    if (!owner) return [];

    const ftsQuery = buildFtsMatchQuery(params.query);
    if (!ftsQuery) return [];

    const maxSnippets = params.maxSnippets ?? 3;
    const maxTokens = params.maxTokens ?? 300;
    const minMagnitude = params.minBm25Magnitude ?? 0;
    const excluded = new Set(params.excludeMessageIds || []);

    try {
      const rows = await this.db.getAllAsync<{
        message_id: string;
        role: string;
        turn_index: number;
        content: string;
        bm25_score: number;
      }>(
        `SELECT messages_fts.message_id, m.role, m.turn_index, messages_fts.content, bm25(messages_fts) AS bm25_score
         FROM messages_fts
         JOIN messages m ON m.id = messages_fts.message_id
         WHERE messages_fts.conversation_id = ?
           AND m.conversation_id = ?
           AND m.character_id = ?
           AND m.is_error = 0
           AND messages_fts MATCH ?
         ORDER BY bm25_score ASC, m.turn_index DESC
         LIMIT 20`,
        [params.conversationId, params.conversationId, params.characterId, ftsQuery]
      );

      const results: {
        messageId: string;
        role: string;
        turnIndex: number;
        content: string;
        bm25Score: number;
      }[] = [];
      const seenNormalized = new Set<string>();
      let usedTokens = 0;

      for (const row of rows) {
        if (results.length >= maxSnippets) break;
        if (excluded.has(row.message_id)) continue;

        // SQLite FTS5 bm25() returns negative scores; more negative = stronger relevance
        const score = Number(row.bm25_score ?? 0);
        if (score >= 0 || (minMagnitude > 0 && Math.abs(score) < minMagnitude)) continue;

        const snippetText = String(row.content || '').trim().slice(0, 420);
        const normKey = snippetText.toLowerCase().replace(/\s+/g, ' ');
        if (!normKey || seenNormalized.has(normKey)) continue;

        const estTokens = Math.ceil(snippetText.length / 4) + 8;
        if (results.length > 0 && usedTokens + estTokens > maxTokens) continue;
        if (estTokens > maxTokens) {
          const allowedChars = Math.max(80, (maxTokens - 8) * 4);
          const clipped = `${snippetText.slice(0, allowedChars).trim()}...`;
          seenNormalized.add(normKey);
          results.push({
            messageId: row.message_id,
            role: row.role,
            turnIndex: Number(row.turn_index),
            content: clipped,
            bm25Score: score,
          });
          usedTokens += Math.ceil(clipped.length / 4) + 8;
          continue;
        }

        seenNormalized.add(normKey);
        results.push({
          messageId: row.message_id,
          role: row.role,
          turnIndex: Number(row.turn_index),
          content: snippetText,
          bm25Score: score,
        });
        usedTokens += estTokens;
      }

      return results;
    } catch {
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 5: Structured Per-Session Memory Lifecycle & Invalidation
  // ═══════════════════════════════════════════════════════════════════════

  private mapRowToMemory(row: any): SessionMemoryRecord {
    let sourceIds: string[] = [];
    try {
      sourceIds = row.source_message_ids_json ? JSON.parse(row.source_message_ids_json) : [];
    } catch {
      sourceIds = [];
    }
    return {
      id: row.id,
      conversationId: row.conversation_id,
      characterId: row.character_id,
      memoryType: row.memory_type,
      slotKey: row.slot_key ?? undefined,
      content: row.content,
      isPinned: Boolean(row.is_pinned),
      status: row.status,
      sourceMessageIds: Array.isArray(sourceIds) ? sourceIds : [],
      isDirty: Boolean(row.is_dirty),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }

  async getSessionMemories(conversationId: string, characterId: string): Promise<SessionMemoryRecord[]> {
    const owner = await this.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM conversations WHERE id = ? AND character_id = ? LIMIT 1',
      [conversationId, characterId]
    );
    if (!owner) return [];
    const rows = await this.db.getAllAsync<any>(
      'SELECT * FROM session_memories WHERE conversation_id = ? AND character_id = ? ORDER BY is_pinned DESC, updated_at DESC',
      [conversationId, characterId]
    );
    return rows.map(r => this.mapRowToMemory(r));
  }

  async upsertStructuredStateSlot(params: {
    conversationId: string;
    characterId: string;
    slotKey: string;
    content: string;
    sourceMessageIds?: string[];
  }): Promise<SessionMemoryRecord | null> {
    const owner = await this.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM conversations WHERE id = ? AND character_id = ? LIMIT 1',
      [params.conversationId, params.characterId]
    );
    if (!owner) return null;

    const now = Date.now();
    const id = `mem_slot_${params.conversationId}_${params.slotKey}`;
    const srcJson = JSON.stringify(params.sourceMessageIds || []);

    await this.db.runAsync(
      `INSERT INTO session_memories (
        id, conversation_id, character_id, memory_type, slot_key, content,
        is_pinned, status, source_message_ids_json, is_dirty, created_at, updated_at
      ) VALUES (?, ?, ?, 'state', ?, ?, 0, 'active', ?, 0, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        status = 'active',
        source_message_ids_json = excluded.source_message_ids_json,
        is_dirty = 0,
        updated_at = excluded.updated_at`,
      [id, params.conversationId, params.characterId, params.slotKey, params.content.trim(), srcJson, now, now]
    );

    const row = await this.db.getFirstAsync<any>('SELECT * FROM session_memories WHERE id = ?', [id]);
    return row ? this.mapRowToMemory(row) : null;
  }

  async addSessionMemory(params: {
    id?: string;
    conversationId: string;
    characterId: string;
    memoryType: 'event' | 'pinned' | 'legacy_summary';
    content: string;
    isPinned?: boolean;
    sourceMessageIds?: string[];
  }): Promise<SessionMemoryRecord | null> {
    const owner = await this.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM conversations WHERE id = ? AND character_id = ? LIMIT 1',
      [params.conversationId, params.characterId]
    );
    if (!owner) return null;

    const now = Date.now();
    const id = params.id || `mem_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const isPinned = params.isPinned || params.memoryType === 'pinned' ? 1 : 0;
    const srcJson = JSON.stringify(params.sourceMessageIds || []);

    await this.db.runAsync(
      `INSERT INTO session_memories (
        id, conversation_id, character_id, memory_type, slot_key, content,
        is_pinned, status, source_message_ids_json, is_dirty, created_at, updated_at
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, 'active', ?, 0, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        is_pinned = excluded.is_pinned,
        status = 'active',
        source_message_ids_json = excluded.source_message_ids_json,
        is_dirty = 0,
        updated_at = excluded.updated_at`,
      [id, params.conversationId, params.characterId, params.memoryType, params.content.trim(), isPinned, srcJson, now, now]
    );

    const row = await this.db.getFirstAsync<any>('SELECT * FROM session_memories WHERE id = ?', [id]);
    return row ? this.mapRowToMemory(row) : null;
  }

  async updateSessionMemoryStatus(
    memoryId: string,
    status: 'active' | 'resolved' | 'stale' | 'needs_review'
  ): Promise<void> {
    await this.db.runAsync(
      'UPDATE session_memories SET status = ?, is_dirty = ?, updated_at = ? WHERE id = ?',
      [status, status === 'stale' || status === 'needs_review' ? 1 : 0, Date.now(), memoryId]
    );
  }

  async togglePinSessionMemory(memoryId: string, isPinned: boolean): Promise<void> {
    await this.db.runAsync(
      'UPDATE session_memories SET is_pinned = ?, updated_at = ? WHERE id = ?',
      [isPinned ? 1 : 0, Date.now(), memoryId]
    );
  }

  async deleteSessionMemory(memoryId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM session_memories WHERE id = ?', [memoryId]);
  }

  // ── Phase 7: Dynamic Cast & Scene Continuity CRUD ──

  async getCastMembers(conversationId: string, characterId: string): Promise<DynamicCastMember[]> {
    const owner = await this.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM conversations WHERE id = ? AND character_id = ? LIMIT 1',
      [conversationId, characterId]
    );
    if (!owner) return [];

    const memberRows = await this.db.getAllAsync<any>(
      'SELECT * FROM cast_members WHERE conversation_id = ? AND character_id = ? ORDER BY is_primary DESC, created_at ASC',
      [conversationId, characterId]
    );
    const factRows = await this.db.getAllAsync<any>(
      'SELECT * FROM cast_facts WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversationId]
    );

    const factsByMember = new Map<string, CastFactRecord[]>();
    for (const f of factRows) {
      const list = factsByMember.get(f.cast_member_id) || [];
      list.push({
        id: f.id,
        castMemberId: f.cast_member_id,
        conversationId: f.conversation_id,
        field: f.field as CastProfileField,
        value: f.value,
        sourceType: f.source_type,
        confirmed: Boolean(f.confirmed),
        sourceMessageId: f.source_message_id ?? undefined,
        turnIndex: typeof f.turn_index === 'number' ? f.turn_index : undefined,
        status: f.status,
        createdAt: Number(f.created_at),
        updatedAt: Number(f.updated_at),
      });
      factsByMember.set(f.cast_member_id, list);
    }

    return memberRows.map(r => {
      let aliases: string[] = [];
      let unknownFields: CastProfileField[] = [];
      let knowledge: CastKnowledgeBoundary = { witnessed: [], communicated: [], unknown: [] };
      let singleTurnOnly = false;
      try {
        aliases = r.aliases_json ? JSON.parse(r.aliases_json) : [];
      } catch {}
      try {
        unknownFields = r.unknown_fields_json ? JSON.parse(r.unknown_fields_json) : [];
      } catch {}
      try {
        const k = r.knowledge_json ? JSON.parse(r.knowledge_json) : {};
        singleTurnOnly = Boolean(k.singleTurnOnly);
        knowledge = {
          witnessed: Array.isArray(k.witnessed) ? k.witnessed : [],
          communicated: Array.isArray(k.communicated) ? k.communicated : [],
          unknown: Array.isArray(k.unknown) ? k.unknown : [],
        };
      } catch {}

      return {
        id: r.id,
        conversationId: r.conversation_id,
        characterId: r.character_id,
        name: r.name,
        aliases: Array.isArray(aliases) ? aliases : [],
        isPrimary: Boolean(r.is_primary),
        presence: (r.presence || 'unknown') as CastPresenceStatus,
        aiControlled: Boolean(r.ai_controlled),
        singleTurnOnly,
        profileStatus: (r.profile_status || 'stub') as DynamicCastMember['profileStatus'],
        unknownFields: Array.isArray(unknownFields) ? unknownFields : [],
        facts: factsByMember.get(r.id) || [],
        knowledge,
        introducedAtMessageId: r.introduced_at_message_id ?? undefined,
        introducedTurnIndex: typeof r.introduced_turn_index === 'number' ? r.introduced_turn_index : undefined,
        createdAt: Number(r.created_at),
        updatedAt: Number(r.updated_at),
      };
    });
  }

  async upsertCastMember(member: DynamicCastMember): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async tx => {
      const q = tx ?? this.db;
      await q.runAsync(
        `INSERT INTO cast_members (
          id, conversation_id, character_id, name, aliases_json, is_primary,
          presence, ai_controlled, profile_status, unknown_fields_json, knowledge_json,
          introduced_at_message_id, introduced_turn_index, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          aliases_json = excluded.aliases_json,
          is_primary = excluded.is_primary,
          presence = excluded.presence,
          ai_controlled = excluded.ai_controlled,
          profile_status = excluded.profile_status,
          unknown_fields_json = excluded.unknown_fields_json,
          knowledge_json = excluded.knowledge_json,
          introduced_at_message_id = excluded.introduced_at_message_id,
          introduced_turn_index = excluded.introduced_turn_index,
          updated_at = excluded.updated_at`,
        [
          member.id,
          member.conversationId,
          member.characterId,
          member.name.trim(),
          JSON.stringify(member.aliases || []),
          member.isPrimary ? 1 : 0,
          member.presence,
          member.aiControlled ? 1 : 0,
          member.profileStatus,
          JSON.stringify(member.unknownFields || []),
          JSON.stringify({
            ...(member.knowledge || { witnessed: [], communicated: [], unknown: [] }),
            singleTurnOnly: Boolean(member.singleTurnOnly),
          }),
          member.introducedAtMessageId ?? null,
          typeof member.introducedTurnIndex === 'number' ? member.introducedTurnIndex : null,
          member.createdAt,
          member.updatedAt,
        ]
      );

      for (const fact of member.facts || []) {
        await q.runAsync(
          `INSERT INTO cast_facts (
            id, cast_member_id, conversation_id, field, value, source_type,
            confirmed, source_message_id, turn_index, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            field = excluded.field,
            value = excluded.value,
            source_type = excluded.source_type,
            confirmed = excluded.confirmed,
            source_message_id = excluded.source_message_id,
            turn_index = excluded.turn_index,
            status = excluded.status,
            updated_at = excluded.updated_at`,
          [
            fact.id,
            member.id,
            member.conversationId,
            fact.field,
            fact.value.trim(),
            fact.sourceType,
            fact.confirmed ? 1 : 0,
            fact.sourceMessageId ?? null,
            typeof fact.turnIndex === 'number' ? fact.turnIndex : null,
            fact.status || 'active',
            fact.createdAt,
            fact.updatedAt,
          ]
        );
      }
    });
  }

  async deleteCastMember(castMemberId: string): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async tx => {
      const q = tx ?? this.db;
      await q.runAsync('DELETE FROM cast_facts WHERE cast_member_id = ?', [castMemberId]);
      await q.runAsync('DELETE FROM cast_members WHERE id = ?', [castMemberId]);
    });
  }

  async getSceneState(conversationId: string, characterId: string): Promise<SceneContinuityState | null> {
    const row = await this.db.getFirstAsync<any>(
      'SELECT * FROM scene_states WHERE conversation_id = ? AND character_id = ? LIMIT 1',
      [conversationId, characterId]
    );
    if (!row) return null;
    let ongoingActivities: string[] = [];
    let unresolvedActions: string[] = [];
    try {
      ongoingActivities = row.ongoing_activities_json ? JSON.parse(row.ongoing_activities_json) : [];
    } catch {}
    try {
      unresolvedActions = row.unresolved_actions_json ? JSON.parse(row.unresolved_actions_json) : [];
    } catch {}
    return {
      conversationId: row.conversation_id,
      characterId: row.character_id,
      currentLocation: row.current_location || '',
      establishedTime: row.established_time || '',
      ongoingActivities: Array.isArray(ongoingActivities) ? ongoingActivities : [],
      unresolvedActions: Array.isArray(unresolvedActions) ? unresolvedActions : [],
      lastTransitionMessageId: row.last_transition_message_id ?? undefined,
      lastTransitionTurnIndex:
        typeof row.last_transition_turn_index === 'number' ? row.last_transition_turn_index : undefined,
      updatedAt: Number(row.updated_at),
    };
  }

  async upsertSceneState(scene: SceneContinuityState): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO scene_states (
        conversation_id, character_id, current_location, established_time,
        ongoing_activities_json, unresolved_actions_json,
        last_transition_message_id, last_transition_turn_index, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(conversation_id) DO UPDATE SET
        current_location = excluded.current_location,
        established_time = excluded.established_time,
        ongoing_activities_json = excluded.ongoing_activities_json,
        unresolved_actions_json = excluded.unresolved_actions_json,
        last_transition_message_id = excluded.last_transition_message_id,
        last_transition_turn_index = excluded.last_transition_turn_index,
        updated_at = excluded.updated_at`,
      [
        scene.conversationId,
        scene.characterId,
        scene.currentLocation.trim(),
        scene.establishedTime.trim(),
        JSON.stringify(scene.ongoingActivities || []),
        JSON.stringify(scene.unresolvedActions || []),
        scene.lastTransitionMessageId ?? null,
        typeof scene.lastTransitionTurnIndex === 'number' ? scene.lastTransitionTurnIndex : null,
        scene.updatedAt,
      ]
    );
  }

  async invalidateCastFactsForMessage(params: {
    conversationId: string;
    messageId: string;
  }): Promise<number> {
    const rows = await this.db.getAllAsync<{ id: string; confirmed: number }>(
      'SELECT id, confirmed FROM cast_facts WHERE conversation_id = ? AND source_message_id = ?',
      [params.conversationId, params.messageId]
    );
    const now = Date.now();
    for (const r of rows) {
      const nextStatus = r.confirmed ? 'needs_review' : 'stale';
      await this.db.runAsync(
        'UPDATE cast_facts SET status = ?, updated_at = ? WHERE id = ?',
        [nextStatus, now, r.id]
      );
    }
    return rows.length;
  }

  /**
   * Invalidates memories derived from a modified, deleted, or regenerated message.
   * - Non-pinned dependent memories become 'stale' (excluded from prompt injection).
   * - Pinned user facts are never silently deleted; they become 'needs_review'.
   */
  async invalidateMemoriesForMessage(params: {
    conversationId: string;
    characterId: string;
    messageId: string;
    action: 'edit' | 'delete' | 'regenerate';
  }): Promise<number> {
    const memories = await this.getSessionMemories(params.conversationId, params.characterId);
    let affected = 0;
    const now = Date.now();

    for (const mem of memories) {
      if (!mem.sourceMessageIds.includes(params.messageId)) continue;
      const nextStatus = mem.isPinned ? 'needs_review' : 'stale';
      await this.db.runAsync(
        'UPDATE session_memories SET status = ?, is_dirty = 1, updated_at = ? WHERE id = ?',
        [nextStatus, now, mem.id]
      );
      affected++;
    }
    return affected;
  }

  /**
   * Formats active structured state and pinned facts for prompt injection within `maxTokens`.
   * Never injects 'stale' or 'resolved' memories.
   */
  async formatSessionMemoriesForPrompt(
    conversationId: string,
    characterId: string,
    maxTokens = 350
  ): Promise<string> {
    const all = await this.getSessionMemories(conversationId, characterId);
    const eligible = all.filter(m => m.status === 'active' || (m.isPinned && m.status === 'needs_review'));
    if (eligible.length === 0) return '';

    const lines: string[] = [];
    let usedTokens = 0;

    for (const m of eligible) {
      const prefix = m.isPinned
        ? '[Pinned Fact]'
        : m.slotKey
          ? `[${m.slotKey}]`
          : '[Event]';
      const line = `- ${prefix} ${m.content}`;
      const cost = Math.ceil(line.length / 4) + 2;
      if (lines.length > 0 && usedTokens + cost > maxTokens) break;
      lines.push(line);
      usedTokens += cost;
    }

    return lines.join('\n');
  }
}

export function resolveBranchCheckpointState(params: {
  chatMemory: string;
  lastCheckpointIndex: number;
  branchTurnIndex: number;
  sourceMessageCount: number;
}): { chatMemory: string; lastCheckpointIndex: number; excludedFutureCheckpoint: boolean } {
  const hasValidMem = (params.chatMemory || '').replace(/<memory>|<\/memory>/gi, '').trim().length > 0;
  if (!hasValidMem) {
    return { chatMemory: '', lastCheckpointIndex: -1, excludedFutureCheckpoint: false };
  }
  const isSafe =
    params.lastCheckpointIndex >= 0 &&
    params.lastCheckpointIndex <= params.branchTurnIndex &&
    params.lastCheckpointIndex < params.sourceMessageCount;
  if (isSafe) {
    return {
      chatMemory: params.chatMemory,
      lastCheckpointIndex: params.lastCheckpointIndex,
      excludedFutureCheckpoint: false,
    };
  }
  return { chatMemory: '', lastCheckpointIndex: -1, excludedFutureCheckpoint: true };
}

const FTS_STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'you', 'your', 'are', 'was', 'were',
  'have', 'has', 'had', 'not', 'but', 'from', 'they', 'she', 'her', 'him', 'his',
  'what', 'when', 'where', 'why', 'how', 'can', 'will', 'just', 'about', 'into',
  'yang', 'dan', 'ini', 'itu', 'aku', 'kamu', 'dia', 'dari', 'untuk', 'dengan', 'tidak',
]);

export function buildFtsMatchQuery(rawQuery: string): string {
  const tokens = String(rawQuery || '')
    .toLowerCase()
    .match(/[\p{L}\p{N}_]{2,}/gu);
  if (!tokens || tokens.length === 0) return '';

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const tok of tokens) {
    if (FTS_STOP_WORDS.has(tok) || seen.has(tok)) continue;
    seen.add(tok);
    unique.push(`"${tok.replace(/"/g, '')}"`);
    if (unique.length >= 8) break;
  }
  return unique.join(' OR ');
}

let cachedRepoPromise: Promise<SqliteConversationRepository | null> | null = null;

/**
 * Lazily opens `nekochat.db` via `expo-sqlite` on native platforms (Android/iOS).
 * Returns `null` on Web or if SQLite initialization fails, allowing safe AsyncStorage fallback.
 */
export async function getSqliteConversationRepository(): Promise<SqliteConversationRepository | null> {
  const { Platform } = await import('react-native');
  if (Platform.OS === 'web') return null;
  if (cachedRepoPromise) return cachedRepoPromise;

  cachedRepoPromise = (async () => {
    try {
      const SQLite = await import('expo-sqlite');
      const nativeDb = await SQLite.openDatabaseAsync(SQLITE_DB_NAME);
      const executor: SqlExecutor = {
        execAsync: sql => nativeDb.execAsync(sql),
        runAsync: (sql, params = []) => nativeDb.runAsync(sql, params),
        getAllAsync: (sql, params = []) => nativeDb.getAllAsync(sql, params),
        getFirstAsync: (sql, params = []) => nativeDb.getFirstAsync(sql, params),
        withExclusiveTransactionAsync: task =>
          nativeDb.withExclusiveTransactionAsync(txn =>
            task({
              execAsync: sql => txn.execAsync(sql),
              runAsync: (sql, params = []) => txn.runAsync(sql, params),
              getAllAsync: (sql, params = []) => txn.getAllAsync(sql, params),
              getFirstAsync: (sql, params = []) => txn.getFirstAsync(sql, params),
            })
          ),
      };
      const init = await initializeSqliteSchema(executor);
      return new SqliteConversationRepository(executor, init.fts5Supported);
    } catch (err) {
      console.warn('[SQLite] Falling back to AsyncStorage:', (err as any)?.message || err);
      cachedRepoPromise = null;
      return null;
    }
  })();

  return cachedRepoPromise;
}
