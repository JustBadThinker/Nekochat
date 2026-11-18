import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  CURRENT_SCHEMA_VERSION,
  SqliteConversationRepository,
  initializeSqliteSchema,
  resolveBranchCheckpointState,
} from '../src/services/sqliteDatabase.ts';

function createNodeSqliteExecutor(opts = {}) {
  const raw = new DatabaseSync(':memory:');
  const outerCalls = [];
  let inTx = false;

  const makeRunner = (isTx) => ({
    async execAsync(sql) {
      if (inTx && !isTx) outerCalls.push({ op: 'execAsync', sql });
      raw.exec(sql);
    },
    async runAsync(sql, params = []) {
      if (inTx && !isTx) outerCalls.push({ op: 'runAsync', sql });
      const stmt = raw.prepare(sql);
      const res = stmt.run(...params);
      return { changes: Number(res.changes || 0), lastInsertRowId: Number(res.lastInsertRowid || 0) };
    },
    async getAllAsync(sql, params = []) {
      if (inTx && !isTx) outerCalls.push({ op: 'getAllAsync', sql });
      return raw.prepare(sql).all(...params);
    },
    async getFirstAsync(sql, params = []) {
      if (inTx && !isTx) outerCalls.push({ op: 'getFirstAsync', sql });
      const row = raw.prepare(sql).get(...params);
      return row ?? null;
    },
  });

  const outer = makeRunner(false);
  const txRunner = makeRunner(true);

  return {
    raw,
    outerCalls,
    ...outer,
    async withExclusiveTransactionAsync(task) {
      raw.exec('BEGIN IMMEDIATE');
      inTx = true;
      try {
        await task(opts.passTx === false ? undefined : txRunner);
        raw.exec('COMMIT');
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      } finally {
        inTx = false;
      }
    },
  };
}

function makeConv(id, messages, extra = {}) {
  const now = new Date().toISOString();
  return {
    id,
    userId: 'user_local_01',
    characterId: 'char_neko',
    personaId: 'persona_1',
    providerId: 'prov_gemini',
    title: 'Neko Session',
    messages,
    messageCount: messages.length,
    summary: 'Future summary up to turn 5',
    memoryCheckpoint: 4,
    cumulativeUsage: {
      totalInputTokens: 1200,
      totalOutputTokens: 450,
      totalCostUsd: 0.02,
      totalCostIdr: 320,
      turnCount: 5,
    },
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

test('schema migration handles fresh v2 DB and v1->v2 upgrade idempotently', async () => {
  // 1. Fresh DB
  const freshExec = createNodeSqliteExecutor();
  const freshRes = await initializeSqliteSchema(freshExec);
  assert.equal(freshRes.version, CURRENT_SCHEMA_VERSION);
  const freshMigs = await freshExec.getAllAsync('SELECT * FROM schema_migrations');
  assert.equal(freshMigs.length, 1);
  assert.equal(freshMigs[0].version, 2);

  // Retry fresh DB
  await initializeSqliteSchema(freshExec);
  const freshMigsAfter = await freshExec.getAllAsync('SELECT * FROM schema_migrations');
  assert.equal(freshMigsAfter.length, 1);

  // 2. Simulated v1 DB without v2 columns
  const v1Exec = createNodeSqliteExecutor();
  await v1Exec.execAsync(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE conversations (
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE messages (
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
      token_count INTEGER
    );
    CREATE TABLE session_memories (
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
      updated_at INTEGER NOT NULL
    );
  `);
  await v1Exec.runAsync('INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)', [new Date().toISOString()]);

  const upgraded = await initializeSqliteSchema(v1Exec);
  assert.equal(upgraded.version, 2);
  const cols = await v1Exec.getAllAsync('PRAGMA table_info(conversations)');
  const colNames = new Set(cols.map(c => c.name));
  assert.equal(colNames.has('parent_conversation_id'), true);
  assert.equal(colNames.has('branched_from_message_id'), true);

  // Retry v2 migration must not fail with duplicate column
  await initializeSqliteSchema(v1Exec);
  const migRows = await v1Exec.getAllAsync('SELECT * FROM schema_migrations ORDER BY version ASC');
  assert.deepEqual(migRows.map(r => r.version), [1, 2]);
});

test('branchConversationAtMessage uses tx executor exclusively and prevents future-state leakage', async () => {
  const exec = createNodeSqliteExecutor();
  const { fts5Supported } = await initializeSqliteSchema(exec);
  const repo = new SqliteConversationRepository(exec, fts5Supported);

  const msgs = [
    { id: 'm0', characterId: 'char_neko', role: 'assistant', content: 'Welcome to the tavern.', timestamp: 1000 },
    { id: 'm1', characterId: 'char_neko', role: 'user', content: 'I order a jasmine tea.', timestamp: 2000 },
    { id: 'm2', characterId: 'char_neko', role: 'assistant', content: 'She slides a warm cup across the counter.', timestamp: 3000 },
    { id: 'm3', characterId: 'char_neko', role: 'user', content: 'Let us travel to the obsidian citadel.', timestamp: 4000 },
    { id: 'm4', characterId: 'char_neko', role: 'assistant', content: 'We arrive at the obsidian citadel gates.', timestamp: 5000 },
  ];
  await repo.upsertConversation(makeConv('conv_parent', msgs));

  // Past event memory (m1 -> kept)
  await repo.addSessionMemory({
    id: 'mem_past',
    conversationId: 'conv_parent',
    characterId: 'char_neko',
    memoryType: 'event',
    content: 'User ordered jasmine tea.',
    sourceMessageIds: ['m1'],
  });

  // Pinned memory from m1 created at a later wall-clock time (must STILL be kept via provenance)
  await repo.addSessionMemory({
    id: 'mem_pinned_past',
    conversationId: 'conv_parent',
    characterId: 'char_neko',
    memoryType: 'pinned',
    content: 'Favorite drink is jasmine tea.',
    isPinned: true,
    sourceMessageIds: ['m1'],
  });

  // Future event memory (m3 -> excluded)
  await repo.addSessionMemory({
    id: 'mem_future',
    conversationId: 'conv_parent',
    characterId: 'char_neko',
    memoryType: 'event',
    content: 'Visited the obsidian citadel.',
    sourceMessageIds: ['m3'],
  });

  // State slot overwritten at m4 (cannot reconstruct earlier value -> excluded)
  await repo.upsertStructuredStateSlot({
    conversationId: 'conv_parent',
    characterId: 'char_neko',
    slotKey: 'location',
    content: 'Obsidian Citadel',
    sourceMessageIds: ['m4'],
  });

  // Unattributed memory (sourceMessageIds: [] -> excluded)
  await repo.addSessionMemory({
    id: 'mem_unattributed',
    conversationId: 'conv_parent',
    characterId: 'char_neko',
    memoryType: 'pinned',
    content: 'Unattributed future spoiler note.',
    isPinned: true,
    sourceMessageIds: [],
  });

  exec.outerCalls.length = 0;
  const branched = await repo.branchConversationAtMessage({
    sourceConversationId: 'conv_parent',
    characterId: 'char_neko',
    branchMessageId: 'm2',
    title: 'Branch · Turn 3',
  });

  // Every query inside branchConversationAtMessage must use `tx`, never outer `db`
  assert.equal(exec.outerCalls.length, 0);
  assert.ok(branched);
  assert.equal(branched.branchTurnIndex, 2);
  assert.equal(branched.sourceMessageCount, 5);
  assert.equal(branched.copiedMemoriesCount, 2);
  assert.equal(branched.excludedMemoriesCount, 3);

  const bConv = branched.conversation;
  assert.equal(bConv.messages.length, 3);
  assert.deepEqual(bConv.messages.map(m => m.content), [
    'Welcome to the tavern.',
    'I order a jasmine tea.',
    'She slides a warm cup across the counter.',
  ]);
  // Fresh message IDs
  for (const m of bConv.messages) {
    assert.ok(!['m0', 'm1', 'm2', 'm3', 'm4'].includes(m.id));
  }
  assert.equal(bConv.parentConversationId, 'conv_parent');
  assert.equal(bConv.branchedFromMessageId, 'm2');
  assert.equal(bConv.summary, undefined);
  assert.equal(bConv.memoryCheckpoint, undefined);
  assert.equal(bConv.cumulativeUsage, undefined);

  // FTS5 must not recall future keyword 'obsidian' in the branch, while parent still has it
  const branchRecall = await repo.searchOlderMessagesForConversation({
    conversationId: bConv.id,
    characterId: 'char_neko',
    query: 'obsidian citadel',
    excludeMessageIds: [],
  });
  assert.equal(branchRecall.length, 0);

  const parentRecall = await repo.searchOlderMessagesForConversation({
    conversationId: 'conv_parent',
    characterId: 'char_neko',
    query: 'obsidian citadel',
    excludeMessageIds: [],
  });
  assert.ok(parentRecall.length >= 1);

  // Branch memories contain only the 2 past provenance-verified memories, with remapped IDs
  const bMemories = await repo.getSessionMemories(bConv.id, 'char_neko');
  assert.equal(bMemories.length, 2);
  assert.ok(bMemories.every(mem => mem.sourceMessageIds.every(id => bConv.messages.some(m => m.id === id))));
  const promptMemText = await repo.formatSessionMemoriesForPrompt(bConv.id, 'char_neko', 500);
  assert.ok(promptMemText.includes('jasmine tea'));
  assert.ok(!promptMemText.includes('Obsidian Citadel'));
  assert.ok(!promptMemText.includes('Unattributed'));
});

test('branch edits, deletes, nested branches, and parent deletion remain completely independent', async () => {
  const exec = createNodeSqliteExecutor();
  const { fts5Supported } = await initializeSqliteSchema(exec);
  const repo = new SqliteConversationRepository(exec, fts5Supported);

  const parentMsgs = [
    { id: 'p0', characterId: 'char_neko', role: 'assistant', content: 'Turn 0', timestamp: 100 },
    { id: 'p1', characterId: 'char_neko', role: 'user', content: 'Turn 1', timestamp: 200 },
    { id: 'p2', characterId: 'char_neko', role: 'assistant', content: 'Turn 2', timestamp: 300 },
    { id: 'p3', characterId: 'char_neko', role: 'user', content: 'Turn 3', timestamp: 400 },
  ];
  await repo.upsertConversation(makeConv('conv_a', parentMsgs));
  await repo.addSessionMemory({
    id: 'mem_a1',
    conversationId: 'conv_a',
    characterId: 'char_neko',
    memoryType: 'event',
    content: 'Parent turn 1 memory',
    sourceMessageIds: ['p1'],
  });

  // A -> B at p2
  const branchBRes = await repo.branchConversationAtMessage({
    sourceConversationId: 'conv_a',
    characterId: 'char_neko',
    branchMessageId: 'p2',
  });
  assert.ok(branchBRes);
  const convB = branchBRes.conversation;

  // Edit message 1 in B
  const editedB = {
    ...convB,
    messages: convB.messages.map((m, idx) => (idx === 1 ? { ...m, content: 'Edited B Turn 1' } : m)),
  };
  await repo.upsertConversation(editedB);

  // Parent A must remain unchanged
  const parentAfterEdit = await repo.getConversation('conv_a');
  assert.equal(parentAfterEdit.messages[1].content, 'Turn 1');
  assert.equal(parentAfterEdit.messages.length, 4);

  // Nested branch B -> C at B's turn 1, then add a new turn to B
  const branchCRes = await repo.branchConversationAtMessage({
    sourceConversationId: convB.id,
    characterId: 'char_neko',
    branchMessageId: convB.messages[1].id,
  });
  assert.ok(branchCRes);
  const convC = branchCRes.conversation;
  assert.equal(convC.messages.length, 2);
  assert.equal(convC.messages[1].content, 'Edited B Turn 1');

  await repo.appendMessageToConversation(convB.id, {
    id: 'b_extra',
    characterId: 'char_neko',
    role: 'user',
    content: 'Extra turn only in B',
    timestamp: 900,
  });

  // Delete message in B (truncate to 1 message) -> Parent A and Child C remain intact
  const bAfterTruncate = { ...editedB, messages: editedB.messages.slice(0, 1) };
  await repo.upsertConversation(bAfterTruncate);

  const parentAfterDelete = await repo.getConversation('conv_a');
  assert.equal(parentAfterDelete.messages.length, 4);
  const childCAfterDelete = await repo.getConversation(convC.id);
  assert.equal(childCAfterDelete.messages.length, 2);

  // Delete parent A -> B and C remain intact
  await repo.deleteConversation('conv_a');
  assert.equal(await repo.getConversation('conv_a'), null);
  assert.ok(await repo.getConversation(convB.id));
  assert.ok(await repo.getConversation(convC.id));
});

test('resolveBranchCheckpointState strips future or out-of-range checkpoints and preserves safe ones', () => {
  const safe = resolveBranchCheckpointState({
    chatMemory: '<memory>[Checkpoint #1] Met at tavern.</memory>',
    lastCheckpointIndex: 2,
    branchTurnIndex: 2,
    sourceMessageCount: 5,
  });
  assert.equal(safe.excludedFutureCheckpoint, false);
  assert.equal(safe.lastCheckpointIndex, 2);
  assert.ok(safe.chatMemory.includes('Checkpoint #1'));

  const future = resolveBranchCheckpointState({
    chatMemory: '<memory>[Checkpoint #2] Entered citadel.</memory>',
    lastCheckpointIndex: 4,
    branchTurnIndex: 2,
    sourceMessageCount: 5,
  });
  assert.equal(future.excludedFutureCheckpoint, true);
  assert.equal(future.chatMemory, '');
  assert.equal(future.lastCheckpointIndex, -1);

  const unknownIdx = resolveBranchCheckpointState({
    chatMemory: '<memory>Legacy unindexed summary</memory>',
    lastCheckpointIndex: -1,
    branchTurnIndex: 2,
    sourceMessageCount: 5,
  });
  assert.equal(unknownIdx.excludedFutureCheckpoint, true);
  assert.equal(unknownIdx.chatMemory, '');
  assert.equal(unknownIdx.lastCheckpointIndex, -1);
});
