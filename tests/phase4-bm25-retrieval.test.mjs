import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  SqliteConversationRepository,
  buildFtsMatchQuery,
  initializeSqliteSchema,
} from '../src/services/sqliteDatabase.ts';

function createNodeSqliteExecutor() {
  const raw = new DatabaseSync(':memory:');
  return {
    async execAsync(sql) { raw.exec(sql); },
    async runAsync(sql, params = []) {
      const res = raw.prepare(sql).run(...params);
      return { changes: Number(res.changes || 0), lastInsertRowId: Number(res.lastInsertRowid || 0) };
    },
    async getAllAsync(sql, params = []) { return raw.prepare(sql).all(...params); },
    async getFirstAsync(sql, params = []) { return raw.prepare(sql).get(...params) ?? null; },
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

test('searchOlderMessagesForConversation enforces strict session & character isolation', async () => {
  const exec = createNodeSqliteExecutor();
  const { fts5Supported } = await initializeSqliteSchema(exec);
  const repo = new SqliteConversationRepository(exec, fts5Supported);

  await repo.upsertConversation({
    id: 'conv_married',
    userId: 'u1',
    characterId: 'char_aria',
    personaId: 'p1',
    providerId: 'prov_gemini',
    title: 'Married Timeline',
    messages: [
      { id: 'm_a1', characterId: 'char_aria', role: 'user', content: 'Remember our wedding ring under the cherry tree?', timestamp: 1000 },
      { id: 'm_a2', characterId: 'char_aria', role: 'assistant', content: 'Yes, I still wear that wedding ring every day.', timestamp: 2000 },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  await repo.upsertConversation({
    id: 'conv_strangers',
    userId: 'u1',
    characterId: 'char_aria',
    personaId: 'p1',
    providerId: 'prov_gemini',
    title: 'Strangers Timeline',
    messages: [
      { id: 'm_b1', characterId: 'char_aria', role: 'assistant', content: 'We just met at the station.', timestamp: 3000 },
    ],
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  });

  // Session B must NEVER see Session A's wedding ring memory
  const hitsB = await repo.searchOlderMessagesForConversation({
    conversationId: 'conv_strangers',
    characterId: 'char_aria',
    query: 'wedding ring cherry',
  });
  assert.equal(hitsB.length, 0);

  // Cross-character mismatch must return []
  const wrongChar = await repo.searchOlderMessagesForConversation({
    conversationId: 'conv_married',
    characterId: 'char_other',
    query: 'wedding ring',
  });
  assert.equal(wrongChar.length, 0);

  // Excluding recent message IDs prevents duplicating recent context
  const hitsA = await repo.searchOlderMessagesForConversation({
    conversationId: 'conv_married',
    characterId: 'char_aria',
    query: 'wedding ring',
    excludeMessageIds: ['m_a2'],
  });
  assert.equal(hitsA.length, 1);
  assert.equal(hitsA[0].messageId, 'm_a1');
});

test('searchOlderMessagesForConversation respects count/token caps and deduplicates', async () => {
  const exec = createNodeSqliteExecutor();
  const { fts5Supported } = await initializeSqliteSchema(exec);
  const repo = new SqliteConversationRepository(exec, fts5Supported);

  const msgs = [
    { id: 'm1', characterId: 'c1', role: 'user', content: 'The obsidian dagger is hidden in the cellar.', timestamp: 1 },
    { id: 'm2', characterId: 'c1', role: 'assistant', content: 'The obsidian dagger is hidden in the cellar.', timestamp: 2 }, // duplicate text
    { id: 'm3', characterId: 'c1', role: 'user', content: 'She forged the obsidian blade at midnight.', timestamp: 3 },
    { id: 'm4', characterId: 'c1', role: 'assistant', content: 'The obsidian hilt glows near magic.', timestamp: 4 },
    { id: 'm5', characterId: 'c1', role: 'user', content: 'Another obsidian clue in the library.', timestamp: 5 },
  ];

  await repo.upsertConversation({
    id: 'conv_1',
    userId: 'u1',
    characterId: 'c1',
    personaId: 'p1',
    providerId: 'prov_gemini',
    title: 'Test',
    messages: msgs,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const hits = await repo.searchOlderMessagesForConversation({
    conversationId: 'conv_1',
    characterId: 'c1',
    query: 'obsidian dagger',
    maxSnippets: 3,
    maxTokens: 300,
  });

  assert.ok(hits.length <= 3 && hits.length >= 2);
  // Duplicate content between m1 and m2 should only appear once
  const uniqueTexts = new Set(hits.map(h => h.content.toLowerCase()));
  assert.equal(uniqueTexts.size, hits.length);
});

test('buildFtsMatchQuery sanitizes FTS5 operators and punctuation', () => {
  const q = buildFtsMatchQuery('What about the "silver-locket"?! AND OR *');
  assert.match(q, /"silver"/);
  assert.match(q, /"locket"/);
  assert.doesNotMatch(q, /\*/);
});
