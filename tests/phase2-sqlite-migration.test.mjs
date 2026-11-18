import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  CURRENT_SCHEMA_VERSION,
  SqliteConversationRepository,
  initializeSqliteSchema,
  stripThinkingForIndex,
} from '../src/services/sqliteDatabase.ts';

function createNodeSqliteExecutor() {
  const raw = new DatabaseSync(':memory:');
  return {
    raw,
    async execAsync(sql) {
      raw.exec(sql);
    },
    async runAsync(sql, params = []) {
      const stmt = raw.prepare(sql);
      const res = stmt.run(...params);
      return { changes: Number(res.changes || 0), lastInsertRowId: Number(res.lastInsertRowid || 0) };
    },
    async getAllAsync(sql, params = []) {
      return raw.prepare(sql).all(...params);
    },
    async getFirstAsync(sql, params = []) {
      const row = raw.prepare(sql).get(...params);
      return row ?? null;
    },
    async withExclusiveTransactionAsync(task) {
      raw.exec('BEGIN IMMEDIATE');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

test('initializeSqliteSchema creates tables, schema_migrations, and FTS5 idempotently', async () => {
  const exec = createNodeSqliteExecutor();
  const res1 = await initializeSqliteSchema(exec);
  assert.equal(res1.version, CURRENT_SCHEMA_VERSION);
  assert.equal(res1.fts5Supported, true);

  // Re-running must be idempotent
  const res2 = await initializeSqliteSchema(exec);
  assert.equal(res2.version, CURRENT_SCHEMA_VERSION);
  const migRows = await exec.getAllAsync('SELECT * FROM schema_migrations');
  assert.equal(migRows.length, 1);
});

test('migrateFromLegacyConversations is idempotent and verifies counts/IDs', async () => {
  const exec = createNodeSqliteExecutor();
  const { fts5Supported } = await initializeSqliteSchema(exec);
  const repo = new SqliteConversationRepository(exec, fts5Supported);

  const legacy = [
    {
      id: 'conv_a',
      userId: 'user_local_01',
      characterId: 'char_aria',
      personaId: 'p1',
      providerId: 'prov_gemini',
      title: 'Aria — Married',
      messages: [
        { id: 'm1', characterId: 'char_aria', role: 'assistant', content: 'Welcome home, darling.', timestamp: 1000 },
        { id: 'm2', characterId: 'char_aria', role: 'user', content: 'I brought the silver locket.', timestamp: 2000 },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:01:00.000Z',
    },
    {
      id: 'conv_b',
      userId: 'user_local_01',
      characterId: 'char_aria',
      personaId: 'p1',
      providerId: 'prov_openrouter',
      title: 'Aria — Strangers',
      messages: [
        { id: 'm3', characterId: 'char_aria', role: 'assistant', content: 'Who are you?', timestamp: 3000 },
      ],
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:01:00.000Z',
    },
  ];

  const firstRun = await repo.migrateFromLegacyConversations(legacy);
  assert.equal(firstRun.verified, true);
  assert.equal(firstRun.destConversations, 2);
  assert.equal(firstRun.destMessages, 3);

  // Run migration a second time to verify idempotency (no duplicates)
  const secondRun = await repo.migrateFromLegacyConversations(legacy);
  assert.equal(secondRun.verified, true);
  assert.equal(secondRun.destConversations, 2);
  assert.equal(secondRun.destMessages, 3);

  const loadedA = await repo.getConversation('conv_a');
  assert.equal(loadedA?.messages.length, 2);
  assert.equal(loadedA?.messages[1].content, 'I brought the silver locket.');
});

test('appendMessageToConversation strips <think> from FTS5 and deleteConversation cleans all tables', async () => {
  const exec = createNodeSqliteExecutor();
  const { fts5Supported } = await initializeSqliteSchema(exec);
  const repo = new SqliteConversationRepository(exec, fts5Supported);

  await repo.upsertConversation({
    id: 'conv_1',
    userId: 'user_local_01',
    characterId: 'char_1',
    personaId: 'p1',
    providerId: 'prov_gemini',
    title: 'Test',
    messages: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  await repo.appendMessageToConversation('conv_1', {
    id: 'msg_think',
    characterId: 'char_1',
    role: 'assistant',
    content: '<think>secret internal reasoning</think>She handed over the emerald key.',
    timestamp: 5000,
  });

  const ftsHitsKey = await exec.getAllAsync(
    "SELECT message_id, conversation_id FROM messages_fts WHERE conversation_id = ? AND messages_fts MATCH 'emerald'",
    ['conv_1']
  );
  assert.equal(ftsHitsKey.length, 1);

  const ftsHitsThink = await exec.getAllAsync(
    "SELECT message_id FROM messages_fts WHERE conversation_id = ? AND messages_fts MATCH 'secret'",
    ['conv_1']
  );
  assert.equal(ftsHitsThink.length, 0);
  assert.equal(stripThinkingForIndex('<think>abc</think>hello'), 'hello');

  // Transactional delete removes conversation, messages, and FTS rows
  await repo.deleteConversation('conv_1');
  assert.equal(await repo.getConversation('conv_1'), null);
  const remainingFts = await exec.getAllAsync('SELECT * FROM messages_fts WHERE conversation_id = ?', ['conv_1']);
  assert.equal(remainingFts.length, 0);
});
