import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildStressTestConversationMessages,
  extractDistinctiveQueryFromMessage,
  RECENT_RAW_OVERLAP_TURNS,
  redactSensitiveStorageValue,
  searchOlderMessagesInMemory,
  selectPromptHistoryWithMemory,
  STRESS_TEST_PLANTED_FACTS,
} from '../src/services/memoryRecall.ts';
import {
  clearDevTelemetry,
  getLastPromptSnapshot,
  getNetworkTelemetry,
  getPromptSnapshots,
  recordNetworkTelemetry,
  recordPromptSnapshot,
  redactTelemetryUrl,
} from '../src/services/devTelemetry.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('selectPromptHistoryWithMemory keeps recent raw continuity turns when memoryReplacesOld is ON', () => {
  const fullHistory = Array.from({ length: 24 }, (_, i) => ({
    id: `m-${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Turn ${i + 1}`,
  }));

  // Right after checkpoint at index 22 (23rd message), only 1 new turn is after checkpoint (index 23).
  // Audit #2 fix guarantees at least RECENT_RAW_OVERLAP_TURNS (6) raw turns stay in the prompt.
  const sliced = selectPromptHistoryWithMemory({
    fullHistory,
    memoryReplacesOld: true,
    chatMemory: '<memory>\n[Checkpoint #1]\n- Events: Talked in cafe.\n</memory>',
    lastCheckpointIndex: 22,
  });
  assert.equal(sliced.length, RECENT_RAW_OVERLAP_TURNS);
  assert.equal(sliced[0].id, `m-${24 - RECENT_RAW_OVERLAP_TURNS}`);
  assert.equal(sliced[sliced.length - 1].id, 'm-23');

  // When memoryReplacesOld is OFF or memory is empty, full history is kept
  const fullOff = selectPromptHistoryWithMemory({
    fullHistory,
    memoryReplacesOld: false,
    chatMemory: '<memory>\n[Checkpoint #1]\n- Events: Talked.\n</memory>',
    lastCheckpointIndex: 22,
  });
  assert.equal(fullOff.length, 24);

  const emptyMem = selectPromptHistoryWithMemory({
    fullHistory,
    memoryReplacesOld: true,
    chatMemory: '<memory>   </memory>',
    lastCheckpointIndex: 22,
  });
  assert.equal(emptyMem.length, 24);
});

test('searchOlderMessagesInMemory recalls Turn #1 out of 120 messages even when recent turns are excluded', () => {
  const msgs = Array.from({ length: 120 }, (_, i) => {
    if (i === 0) {
      return {
        id: 'msg-1',
        role: 'assistant',
        content: '<think>hidden thought token</think>I hid the sapphire compass inside the lighthouse cellar.',
      };
    }
    if (i === 1) {
      return {
        id: 'msg-2',
        role: 'user',
        content: '⚠️ Error: network timeout',
        isError: true,
      };
    }
    return {
      id: `msg-${i + 1}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Routine turn #${i + 1} discussing dinner plans and rain outside.`,
    };
  });

  const excludedRecentIds = msgs.slice(-12).map(m => m.id);
  const hits = searchOlderMessagesInMemory({
    history: msgs,
    query: 'What did you hide in the lighthouse cellar with the sapphire compass?',
    excludeMessageIds: excludedRecentIds,
    maxSnippets: 3,
    maxTokens: 300,
  });

  assert.ok(hits.length >= 1, 'Expected Turn #1 to be recalled');
  assert.equal(hits[0].turnIndex, 0);
  assert.equal(hits[0].messageId, 'msg-1');
  assert.equal(hits[0].engine, 'memory_bm25');
  assert.ok(!hits[0].content.includes('hidden thought token'));

  // Turn #1 thinking keyword alone should NOT match because <think> is stripped
  const thinkHits = searchOlderMessagesInMemory({
    history: msgs,
    query: 'lighthouse cellar',
    excludeMessageIds: excludedRecentIds,
  });
  assert.equal(thinkHits.length, 1);

  const extracted = extractDistinctiveQueryFromMessage(msgs[0].content);
  assert.ok(extracted.length > 0);
});

test('redactSensitiveStorageValue masks API keys, PINs, tokens, and hashes in storage JSON', () => {
  const sample = JSON.stringify({
    provider: 'openai',
    apiKey: 'sk-proj-1234567890abcdef',
    passcodePin: '482910',
    passcodeHash: 'sha256_deadbeefcafe0123456789',
    nested: { accessToken: 'Bearer_tok_99887766' },
    safeLabel: 'Solar Command Gold',
  });

  const masked = redactSensitiveStorageValue('@nekochat:provider_config', sample);
  assert.ok(!masked.includes('sk-proj-1234567890abcdef'));
  assert.ok(!masked.includes('482910'));
  assert.ok(!masked.includes('sha256_deadbeefcafe0123456789'));
  assert.ok(!masked.includes('Bearer_tok_99887766'));
  assert.ok(masked.includes('Solar Command Gold'));
});

test('Source regressions: Audit #1..#4 fixes and Developer Mode wiring remain intact', async () => {
  const [aiSrc, chatSrc, settingsSrc] = await Promise.all([
    fs.readFile(path.join(ROOT, 'src/services/aiProviderService.ts'), 'utf8'),
    fs.readFile(path.join(ROOT, 'src/screens/ChatRoomScreen.tsx'), 'utf8'),
    fs.readFile(path.join(ROOT, 'src/screens/SettingsScreen.tsx'), 'utf8'),
  ]);

  // Audit #1: incremental checkpoint must explicitly avoid repeating prior checkpoints
  assert.ok(aiSrc.includes('DO NOT REPEAT OR RE-SUMMARIZE OLD EVENTS'));
  assert.ok(aiSrc.includes('let rollingMemory = isIncremental ? undefined : options?.existingMemory;'));

  // Audit #3: Web / fallback BM25 recall wired into streamChat
  assert.ok(aiSrc.includes('searchOlderMessagesInMemory('));
  assert.ok(aiSrc.includes('[RECALLED EARLIER IN THIS SESSION]'));

  // Audit #2 & #4: recent raw turn continuity + visibleMessageCount reset on session switch
  assert.ok(chatSrc.includes('selectPromptHistoryWithMemory('));
  const resetMatches = chatSrc.match(/setVisibleMessageCount\(6\)/g) || [];
  assert.ok(resetMatches.length >= 4, `Expected visibleMessageCount(6) in loadChat, handleStartNewSession, handleSwitchSession (got ${resetMatches.length})`);

  // Developer Mode wired in Settings & ChatRoom
  assert.ok(settingsSrc.includes('Developer Mode'));
  assert.ok(settingsSrc.includes('DeveloperInspectorModal'));
  assert.ok(chatSrc.includes('DeveloperInspectorModal'));

  // Step 3/4 telemetry & backend diagnostics wiring
  const backendSrc = await fs.readFile(path.join(ROOT, 'server/mysqlBackend.mjs'), 'utf8');
  assert.ok(aiSrc.includes('recordPromptSnapshot('));
  assert.ok(aiSrc.includes('recordNetworkTelemetry('));
  assert.ok(backendSrc.includes("pathname === '/api/dev/stats'"));
  const devStatsBlock = backendSrc.slice(
    backendSrc.indexOf("pathname === '/api/dev/stats'"),
    backendSrc.indexOf('// Only handle /api/auth/*')
  );
  assert.ok(!devStatsBlock.includes('password_hash'));
  assert.ok(!devStatsBlock.includes('SELECT *'));
});

test('devTelemetry redacts sensitive URL keys and caps ring buffers cleanly', () => {
  clearDevTelemetry();
  assert.equal(getLastPromptSnapshot(), null);
  assert.equal(getNetworkTelemetry().length, 0);

  const safeUrl = redactTelemetryUrl(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=AIzaSySecret1234567890'
  );
  assert.ok(!safeUrl.includes('AIzaSySecret1234567890'));
  assert.ok(safeUrl.includes('key=[REDACTED]'));

  for (let i = 0; i < 30; i++) {
    recordNetworkTelemetry({
      kind: 'llm_stream',
      label: `Call #${i + 1}`,
      endpoint: `https://api.example.com/v1/chat?api_key=sk-secret9999999999_${i}`,
      ok: i % 2 === 0,
      ttfbMs: 120 + i,
      totalMs: 450 + i,
    });
  }
  const logs = getNetworkTelemetry();
  assert.equal(logs.length, 25);
  assert.equal(logs[0].label, 'Call #30');
  assert.ok(!logs[0].endpoint.includes('sk-secret'));

  for (let i = 0; i < 7; i++) {
    recordPromptSnapshot({
      characterName: 'Lyra',
      model: 'gpt-4o-mini',
      endpointIdentity: 'openai:api.openai.com/v1',
      contextLimit: 128000,
      contextSource: 'static_registry',
      maxOutputTokens: 4096,
      totalInputTokens: 1000 + i,
      turnsKept: 12,
      turnsTrimmed: 108,
      recallEngine: 'memory_bm25',
      recalledTurns: [1, 25],
      tokenOptimizer: 'off',
      savedTokens: 0,
      lorebookSummary: 'none',
      sections: [{ label: 'Safety Policy', tokens: 100, chars: 400 }],
      fullSystemPrompt: 'prompt body',
    });
  }
  assert.equal(getPromptSnapshots().length, 5);
  assert.equal(getLastPromptSnapshot()?.totalInputTokens, 1006);

  clearDevTelemetry();
  assert.equal(getLastPromptSnapshot(), null);
  assert.equal(getNetworkTelemetry().length, 0);
});

test('120-message stress seeder plants Turn #1, #25, and #60 facts recallable past excluded tail', () => {
  const msgs = buildStressTestConversationMessages({
    conversationId: 'stress_test_1',
    characterId: 'char_1',
    charName: 'Sora',
    userName: 'Ren',
  });
  assert.equal(msgs.length, 120);

  const excludedRecentIds = msgs.slice(-20).map(m => m.id);
  for (const fact of STRESS_TEST_PLANTED_FACTS) {
    const hits = searchOlderMessagesInMemory({
      history: msgs,
      query: fact.query,
      excludeMessageIds: excludedRecentIds,
      excludeAfterTurnIndex: 100,
      maxSnippets: 3,
      maxTokens: 300,
    });
    assert.ok(hits.length >= 1, `Expected hit for ${fact.label}`);
    assert.equal(hits[0].turnIndex + 1, fact.turnNumber);
  }
});
