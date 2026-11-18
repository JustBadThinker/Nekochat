/**
 * Reproducible Synthetic Benchmark (Phase 7)
 * Fixture: 50 characters, 90 conversations, 300 messages/session (27,000 messages total).
 * Runs against a temporary on-disk SQLite database via Node's built-in `node:sqlite`.
 *
 * Usage: node tests/phase7-sqlite-benchmark.mjs
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';
import {
  SqliteConversationRepository,
  initializeSqliteSchema,
} from '../src/services/sqliteDatabase.ts';

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nekochat-bench-'));
const dbFile = path.join(tmpDir, 'bench.db');
const raw = new DatabaseSync(dbFile);

const exec = {
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

try {
  const { fts5Supported } = await initializeSqliteSchema(exec);
  const repo = new SqliteConversationRepository(exec, fts5Supported);

  const NUM_CHARACTERS = 50;
  const NUM_CONVERSATIONS = 90;
  const MSGS_PER_CONV = 300;

  const legacy = [];
  for (let c = 0; c < NUM_CONVERSATIONS; c++) {
    const charId = `char_${c % NUM_CHARACTERS}`;
    const convId = `conv_${c}`;
    const msgs = [];
    for (let m = 0; m < MSGS_PER_CONV; m++) {
      const marker = m === 42 ? 'silver locket promise moonlight' : 'general roleplay dialogue';
      msgs.push({
        id: `${convId}_m_${m}`,
        conversationId: convId,
        characterId: charId,
        role: m % 2 === 0 ? 'user' : 'assistant',
        content: `Turn ${m} in ${convId}: ${marker} across the quiet courtyard.`,
        timestamp: 1700000000000 + c * 100000 + m,
      });
    }
    legacy.push({
      id: convId,
      userId: 'user_local_01',
      characterId: charId,
      personaId: 'p1',
      providerId: 'prov_gemini',
      title: `Session ${c}`,
      messages: msgs,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: new Date(1700000000000 + c * 1000).toISOString(),
    });
  }

  const t0 = performance.now();
  const mig = await repo.migrateFromLegacyConversations(legacy);
  const migMs = performance.now() - t0;

  const tRead0 = performance.now();
  const singleConv = await repo.getConversation('conv_45');
  const readMs = performance.now() - tRead0;

  const tAppend0 = performance.now();
  await repo.appendMessageToConversation('conv_45', {
    id: 'conv_45_m_new',
    characterId: 'char_45',
    role: 'user',
    content: 'Do you remember the silver locket promise?',
    timestamp: Date.now(),
  });
  const appendMs = performance.now() - tAppend0;

  const tFts0 = performance.now();
  const hits = await repo.searchOlderMessagesForConversation({
    conversationId: 'conv_45',
    characterId: 'char_45',
    query: 'silver locket promise',
    excludeMessageIds: ['conv_45_m_new'],
    maxSnippets: 3,
    maxTokens: 300,
  });
  const ftsMs = performance.now() - tFts0;

  const tDel0 = performance.now();
  await repo.deleteConversation('conv_45');
  const delMs = performance.now() - tDel0;

  const stat = await fs.stat(dbFile);

  console.log(JSON.stringify({
    runtime: `Node ${process.version} (${os.platform()} ${os.arch()})`,
    fixture: {
      characters: NUM_CHARACTERS,
      conversations: mig.destConversations,
      messages: mig.destMessages,
      verified: mig.verified,
    },
    timingsMs: {
      initialMigration27k: Number(migMs.toFixed(2)),
      getSingleConversation300Msgs: Number(readMs.toFixed(2)),
      appendMessagePlusFts: Number(appendMs.toFixed(2)),
      ftsBm25SearchScoped: Number(ftsMs.toFixed(2)),
      deleteConversationTransactional: Number(delMs.toFixed(2)),
    },
    singleConvMsgCount: singleConv?.messages.length,
    ftsHitsReturned: hits.length,
    dbSizeMB: Number((stat.size / (1024 * 1024)).toFixed(2)),
  }, null, 2));
} finally {
  raw.close();
  await fs.rm(tmpDir, { recursive: true, force: true });
}
