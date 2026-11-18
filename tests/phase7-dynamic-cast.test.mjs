import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  CURRENT_SCHEMA_VERSION,
  SqliteConversationRepository,
  initializeSqliteSchema,
} from '../src/services/sqliteDatabase.ts';
import {
  appendCastFact,
  buildDynamicCastPromptSection,
  createPrimaryCastMember,
  createProvisionalCastMember,
  detectCastCandidates,
} from '../src/services/dynamicCastService.ts';

function createNodeSqliteExecutor() {
  const raw = new DatabaseSync(':memory:');
  const runner = {
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
  };
  return {
    ...runner,
    async withExclusiveTransactionAsync(task) {
      raw.exec('BEGIN IMMEDIATE');
      try {
        await task(runner);
        raw.exec('COMMIT');
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

test('detectCastCandidates distinguishes interaction, introduction, and mention without auto-creating', () => {
  const interaction = detectCastCandidates({
    message: "whoaa, today was very nice isn't it clara?",
    primaryCharName: 'Penelope',
    userName: 'Rei',
    existingCast: [],
  });
  assert.equal(interaction.length, 1);
  assert.equal(interaction[0].name, 'Clara');
  assert.equal(interaction[0].signal, 'interaction');
  assert.equal(interaction[0].suggestedPresence, 'present');
  assert.equal(interaction[0].suggestedAiControlled, true);

  const intro = detectCastCandidates({
    message: 'then i just chatting with clara to meet up with her',
    primaryCharName: 'Penelope',
    userName: 'Rei',
    existingCast: [],
  });
  assert.equal(intro.length, 1);
  assert.equal(intro[0].name, 'Clara');
  assert.equal(intro[0].signal, 'introduction');

  const mention = detectCastCandidates({
    message: 'I remembered Marcus from yesterday.',
    primaryCharName: 'Penelope',
    userName: 'Rei',
    existingCast: [],
  });
  assert.equal(mention.length, 1);
  assert.equal(mention[0].name, 'Marcus');
  assert.equal(mention[0].signal, 'mention');
  assert.equal(mention[0].suggestedPresence, 'unknown');
  assert.equal(mention[0].suggestedAiControlled, false);
});

test('provisional profiles never promote ai_inferred facts and prompt enforces presence, attribution, and anti-timeskip', () => {
  const penelope = createPrimaryCastMember({
    conversationId: 'conv_1',
    characterId: 'char_penelope',
    name: 'Penelope',
    presence: 'away',
    aiControlled: true,
  });

  let clara = createProvisionalCastMember({
    conversationId: 'conv_1',
    characterId: 'char_penelope',
    name: 'Clara',
    presence: 'present',
    aiControlled: true,
    characteristics: 'Kind highschool friend from the library, older than Rei',
    sourceMessageId: 'msg_1',
    turnIndex: 1,
  });

  // Unconfirmed AI assumption must NOT appear as canonical truth
  clara = appendCastFact(clara, {
    field: 'appearance',
    value: 'Secretly a vampire',
    sourceType: 'ai_inferred',
    sourceMessageId: 'msg_2',
    turnIndex: 2,
  });

  const aiFact = clara.facts.find(f => f.sourceType === 'ai_inferred');
  assert.equal(aiFact?.confirmed, false);

  const prompt = buildDynamicCastPromptSection({
    primaryCharName: 'Penelope',
    userName: 'Rei',
    castMembers: [penelope, clara],
    sceneState: {
      conversationId: 'conv_1',
      characterId: 'char_penelope',
      currentLocation: 'Arcade & Cafe',
      establishedTime: 'Afternoon',
      ongoingActivities: ['Hanging out with Clara'],
      unresolvedActions: ['Waiting for Clara reply'],
      updatedAt: Date.now(),
    },
  });

  assert.ok(prompt.includes('Arcade & Cafe'));
  assert.ok(prompt.includes('Do NOT time-skip ahead'));
  assert.ok(prompt.includes('Keep Rei exclusively under user control'));
  assert.ok(prompt.includes('Kind highschool friend from the library'));
  assert.ok(!prompt.includes('Secretly a vampire'));
  assert.ok(prompt.includes('Penelope (away)'));
  assert.ok(prompt.includes('Does NOT know events happening in the current off-screen scene'));

  // Multi-character attribution when 2+ AI-controlled cast are present
  const penelopePresent = { ...penelope, presence: 'present' };
  const multiPrompt = buildDynamicCastPromptSection({
    primaryCharName: 'Penelope',
    userName: 'Rei',
    castMembers: [penelopePresent, clara],
  });
  assert.ok(multiPrompt.includes('Multi-Character Attribution'));
});

test('SQLite v3 migration, fact invalidation, and branching isolation prevent future cast leakage', async () => {
  const exec = createNodeSqliteExecutor();
  const init = await initializeSqliteSchema(exec);
  assert.equal(init.version, CURRENT_SCHEMA_VERSION);
  const migs = await exec.getAllAsync('SELECT * FROM schema_migrations');
  assert.equal(migs.length, 1);

  const repo = new SqliteConversationRepository(exec, init.fts5Supported);
  const now = new Date().toISOString();
  await repo.upsertConversation({
    id: 'conv_p',
    userId: 'user_local_01',
    characterId: 'char_penelope',
    personaId: 'p1',
    providerId: 'prov_gemini',
    title: 'Penelope',
    messages: [
      { id: 'm0', characterId: 'char_penelope', role: 'assistant', content: 'See you tonight.', timestamp: 100 },
      { id: 'm1', characterId: 'char_penelope', role: 'user', content: 'Hey Clara!', timestamp: 200 },
      { id: 'm2', characterId: 'char_penelope', role: 'assistant', content: 'Clara smiles.', timestamp: 300 },
      { id: 'm3', characterId: 'char_penelope', role: 'user', content: 'Meet Elena too!', timestamp: 400 },
    ],
    createdAt: now,
    updatedAt: now,
  });

  const clara = createProvisionalCastMember({
    conversationId: 'conv_p',
    characterId: 'char_penelope',
    name: 'Clara',
    characteristics: 'Kind library friend',
    sourceMessageId: 'm1',
    turnIndex: 1,
  });
  const elena = createProvisionalCastMember({
    conversationId: 'conv_p',
    characterId: 'char_penelope',
    name: 'Elena',
    characteristics: 'Introduced later at turn 3',
    sourceMessageId: 'm3',
    turnIndex: 3,
  });
  await repo.upsertCastMember(clara);
  await repo.upsertCastMember(elena);

  await repo.upsertSceneState({
    conversationId: 'conv_p',
    characterId: 'char_penelope',
    currentLocation: 'Future Rooftop',
    establishedTime: 'Midnight',
    ongoingActivities: [],
    unresolvedActions: [],
    lastTransitionMessageId: 'm3',
    lastTransitionTurnIndex: 3,
    updatedAt: Date.now(),
  });

  // Branch at m2 (turn 2): Clara (turn 1) MUST be kept; Elena (turn 3) & Rooftop scene (turn 3) MUST be excluded
  const branched = await repo.branchConversationAtMessage({
    sourceConversationId: 'conv_p',
    characterId: 'char_penelope',
    branchMessageId: 'm2',
  });
  assert.ok(branched);
  const bCast = await repo.getCastMembers(branched.conversation.id, 'char_penelope');
  assert.equal(bCast.length, 1);
  assert.equal(bCast[0].name, 'Clara');
  assert.equal(bCast[0].facts.length, 1);
  assert.equal(bCast[0].facts[0].value, 'Kind library friend');

  const bScene = await repo.getSceneState(branched.conversation.id, 'char_penelope');
  assert.equal(bScene, null);

  // Invalidate fact on m1 in parent
  const affected = await repo.invalidateCastFactsForMessage({ conversationId: 'conv_p', messageId: 'm1' });
  assert.equal(affected, 1);
  const pCastAfter = await repo.getCastMembers('conv_p', 'char_penelope');
  const claraAfter = pCastAfter.find(m => m.name === 'Clara');
  assert.equal(claraAfter?.facts[0].status, 'needs_review');
});
