import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  SqliteConversationRepository,
  initializeSqliteSchema,
} from '../src/services/sqliteDatabase.ts';
import { shouldTriggerAutoMemoryUpdate } from '../src/services/promptBudget.ts';

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

test('Structured state slots supersede prior values and stay isolated per session', async () => {
  const exec = createNodeSqliteExecutor();
  const { fts5Supported } = await initializeSqliteSchema(exec);
  const repo = new SqliteConversationRepository(exec, fts5Supported);

  await repo.upsertConversation({
    id: 'conv_1',
    userId: 'u1',
    characterId: 'char_1',
    personaId: 'p1',
    providerId: 'prov_gemini',
    title: 'Session 1',
    messages: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  await repo.upsertStructuredStateSlot({
    conversationId: 'conv_1',
    characterId: 'char_1',
    slotKey: 'location',
    content: 'Rainy train station',
    sourceMessageIds: ['m1'],
  });

  // Supersede location with newer confirmed state
  await repo.upsertStructuredStateSlot({
    conversationId: 'conv_1',
    characterId: 'char_1',
    slotKey: 'location',
    content: 'Cozy upstairs apartment',
    sourceMessageIds: ['m5'],
  });

  const all = await repo.getSessionMemories('conv_1', 'char_1');
  assert.equal(all.length, 1);
  assert.equal(all[0].content, 'Cozy upstairs apartment');
});

test('Editing/deleting a source message marks non-pinned stale and pinned needs_review', async () => {
  const exec = createNodeSqliteExecutor();
  const { fts5Supported } = await initializeSqliteSchema(exec);
  const repo = new SqliteConversationRepository(exec, fts5Supported);

  await repo.upsertConversation({
    id: 'conv_1',
    userId: 'u1',
    characterId: 'char_1',
    personaId: 'p1',
    providerId: 'prov_gemini',
    title: 'Session 1',
    messages: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const ev = await repo.addSessionMemory({
    conversationId: 'conv_1',
    characterId: 'char_1',
    memoryType: 'event',
    content: 'Aria promised to meet at midnight.',
    sourceMessageIds: ['m3'],
  });

  const pin = await repo.addSessionMemory({
    conversationId: 'conv_1',
    characterId: 'char_1',
    memoryType: 'pinned',
    content: 'User allergic to lilies.',
    isPinned: true,
    sourceMessageIds: ['m3'],
  });

  const affected = await repo.invalidateMemoriesForMessage({
    conversationId: 'conv_1',
    characterId: 'char_1',
    messageId: 'm3',
    action: 'edit',
  });
  assert.equal(affected, 2);

  const mems = await repo.getSessionMemories('conv_1', 'char_1');
  const evAfter = mems.find(m => m.id === ev?.id);
  const pinAfter = mems.find(m => m.id === pin?.id);
  assert.equal(evAfter?.status, 'stale');
  assert.equal(pinAfter?.status, 'needs_review');

  // Prompt formatting excludes stale event, preserves user-pinned fact
  const promptText = await repo.formatSessionMemoriesForPrompt('conv_1', 'char_1', 350);
  assert.doesNotMatch(promptText, /meet at midnight/);
  assert.match(promptText, /allergic to lilies/);
});

test('shouldTriggerAutoMemoryUpdate triggers only on context pressure and respects 429 backoff', () => {
  // Disabled by default
  assert.equal(
    shouldTriggerAutoMemoryUpdate({
      enabled: false,
      totalTurns: 30,
      keptTurnsCount: 10,
      lastCheckpointIndex: -1,
    }),
    false
  );

  // Enabled, but all turns still fit in prompt window -> no extra API call
  assert.equal(
    shouldTriggerAutoMemoryUpdate({
      enabled: true,
      totalTurns: 12,
      keptTurnsCount: 12,
      lastCheckpointIndex: -1,
    }),
    false
  );

  // Enabled, older turns rolled off, >= 6 unsummarized turns -> trigger
  assert.equal(
    shouldTriggerAutoMemoryUpdate({
      enabled: true,
      totalTurns: 25,
      keptTurnsCount: 14,
      lastCheckpointIndex: 10,
      now: 10000,
      backoffUntil: 5000,
    }),
    true
  );

  // Rate-limit backoff active -> skip
  assert.equal(
    shouldTriggerAutoMemoryUpdate({
      enabled: true,
      totalTurns: 25,
      keptTurnsCount: 14,
      lastCheckpointIndex: 10,
      now: 10000,
      backoffUntil: 60000,
    }),
    false
  );
});
