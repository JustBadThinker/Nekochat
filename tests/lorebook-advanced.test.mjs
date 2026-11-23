import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
const {
  matchLorebookEntriesWithDiagnostics,
  parseJanitorLorebookJson,
} = await import('../src/services/lorebookService.ts');
import { buildOpenAiChatPayload, buildTurns } from '../src/services/promptBudget.ts';

const mkMsg = (role, content, idx = 0) => ({
  id: `m-${idx}`,
  characterId: 'char-1',
  role,
  content,
  timestamp: idx,
});

const mkBook = (entries, overrides = {}) => ({
  id: 'lb-1',
  userId: 'u1',
  title: 'Test Codex',
  description: 'Test',
  scanDepth: 6,
  tokenBudget: 1024,
  recursiveScanning: false,
  isPublic: true,
  createdAt: '2026-01-01',
  entries,
  ...overrides,
});

test('1. Exact keyword activation', () => {
  const lb = mkBook([{ id: 'e1', title: 'Sword', keys: ['excalibur'], content: 'Holy blade.', priority: 50, enabled: true }]);
  const res = matchLorebookEntriesWithDiagnostics([lb], [], 'Draw Excalibur!', { charName: 'Arthur', userName: 'Rei' });
  assert.deepEqual(res.selected.map(s => s.title), ['Sword']);
});

test('2. Case-sensitive matching', () => {
  const lb = mkBook([{ id: 'e1', title: 'Order', keys: ['Order'], content: 'Secret society.', priority: 50, enabled: true, caseSensitive: true }]);
  assert.equal(matchLorebookEntriesWithDiagnostics([lb], [], 'in order to go', { charName: 'A', userName: 'B' }).selected.length, 0);
  assert.equal(matchLorebookEntriesWithDiagnostics([lb], [], 'The Order watches.', { charName: 'A', userName: 'B' }).selected.length, 1);
});

test('3. Whole-word matching', () => {
  const lb = mkBook([{ id: 'e1', title: 'Cat', keys: ['cat'], content: 'Feline.', priority: 50, enabled: true, matchWholeWords: true }]);
  assert.equal(matchLorebookEntriesWithDiagnostics([lb], [], 'A catastrophe!', { charName: 'A', userName: 'B' }).selected.length, 0);
  assert.equal(matchLorebookEntriesWithDiagnostics([lb], [], 'A black cat!', { charName: 'A', userName: 'B' }).selected.length, 1);
});

test('4. Secondary keyword activation (selective)', () => {
  const lb = mkBook([{ id: 'e1', title: 'Vault', keys: ['vault'], secondaryKeys: ['key'], selective: true, content: 'Locked.', priority: 50, enabled: true }]);
  const miss = matchLorebookEntriesWithDiagnostics([lb], [], 'Open the vault', { charName: 'A', userName: 'B' });
  assert.equal(miss.selected.length, 0);
  assert.ok(miss.diagnostics.entries.some(e => e.status === 'secondary_key_miss'));
  const hit = matchLorebookEntriesWithDiagnostics([lb], [], 'Use the key on the vault', { charName: 'A', userName: 'B' });
  assert.equal(hit.selected.length, 1);
});

test('5. Scan-depth behavior', () => {
  const lb = mkBook([{ id: 'e1', title: 'Relic', keys: ['relic'], content: 'Ancient.', priority: 50, enabled: true }], { scanDepth: 1 });
  const hist = [mkMsg('user', 'The relic is old', 1), mkMsg('assistant', 'Indeed.', 2), mkMsg('user', 'Moving on.', 3)];
  assert.equal(matchLorebookEntriesWithDiagnostics([lb], hist, 'Hello', { charName: 'A', userName: 'B' }).selected.length, 0);
  const deeper = mkBook([{ id: 'e1', title: 'Relic', keys: ['relic'], content: 'Ancient.', priority: 50, enabled: true }], { scanDepth: 3 });
  assert.equal(matchLorebookEntriesWithDiagnostics([deeper], hist, 'Hello', { charName: 'A', userName: 'B' }).selected.length, 1);
});

test('6. Constant entries', () => {
  const lb = mkBook([{ id: 'e1', title: 'WorldRule', keys: [], content: 'Magic exists.', priority: 50, enabled: true, constant: true }]);
  const res = matchLorebookEntriesWithDiagnostics([lb], [], 'Unrelated text', { charName: 'A', userName: 'B' });
  assert.equal(res.selected.length, 1);
  assert.equal(res.selected[0].activationSource, 'constant');
});

test('7. Probability activation', () => {
  const lb = mkBook([{ id: 'e1', title: 'Rumour', keys: ['tavern'], content: 'Gossip.', priority: 50, enabled: true, useProbability: true, probability: 30 }]);
  const skip = matchLorebookEntriesWithDiagnostics([lb], [], 'At the tavern', { charName: 'A', userName: 'B', rng: () => 0.9 });
  assert.equal(skip.selected.length, 0);
  assert.ok(skip.diagnostics.entries.some(e => e.status === 'probability_skip'));
  const pass = matchLorebookEntriesWithDiagnostics([lb], [], 'At the tavern', { charName: 'A', userName: 'B', rng: () => 0.1 });
  assert.equal(pass.selected.length, 1);
});

test('8. Sticky and cooldown behavior', () => {
  const lb = mkBook([{ id: 'e1', title: 'Storm', keys: ['storm'], content: 'Heavy rain.', priority: 50, enabled: true, sticky: 1, cooldown: 2 }]);
  const turn1 = matchLorebookEntriesWithDiagnostics([lb], [], 'A storm hits!', { charName: 'A', userName: 'B' });
  assert.equal(turn1.selected.length, 1);
  // Turn 2: keyword absent, sticky keeps it active
  const turn2 = matchLorebookEntriesWithDiagnostics([lb], [], 'We run inside.', { charName: 'A', userName: 'B', runtimeState: turn1.nextRuntimeState });
  assert.equal(turn2.selected.length, 1);
  assert.equal(turn2.selected[0].activationSource, 'sticky');
  // Turn 3: sticky expired -> cooldown active blocks even if keyword appears
  const turn3 = matchLorebookEntriesWithDiagnostics([lb], [], 'Another storm!', { charName: 'A', userName: 'B', runtimeState: turn2.nextRuntimeState });
  assert.equal(turn3.selected.length, 0);
  assert.ok(turn3.diagnostics.entries.some(e => e.status === 'cooldown_active'));
});

test('9 & 10. Recursive activation and recursion-loop prevention', () => {
  const lb = mkBook([
    { id: 'e1', title: 'Academy', keys: ['academy'], content: 'Governed by the Royal Council.', priority: 100, enabled: true },
    { id: 'e2', title: 'Royal Council', keys: ['royal council'], content: 'Meets in the Citadel.', priority: 90, enabled: true, preventRecursion: true },
    { id: 'e3', title: 'Citadel', keys: ['citadel'], content: 'Blocked by preventRecursion on e2.', priority: 80, enabled: true },
  ], { recursiveScanning: true, maxRecursionDepth: 5 });

  const res = matchLorebookEntriesWithDiagnostics([lb], [], 'I visit the Academy.', { charName: 'A', userName: 'B' });
  assert.deepEqual(res.selected.map(s => s.title), ['Academy', 'Royal Council']);
  assert.equal(res.diagnostics.recursiveActivations, 1);
  assert.ok(!res.selected.some(s => s.title === 'Citadel'));
});

test('11. Duplicate-entry prevention', () => {
  const lb = mkBook([
    { id: 'e1', title: 'Guild', keys: ['guild'], content: 'Traders union.', priority: 100, enabled: true },
    { id: 'e2', title: 'Guild', keys: ['union'], content: 'Traders union.', priority: 90, enabled: true },
  ]);
  const res = matchLorebookEntriesWithDiagnostics([lb], [], 'guild union', { charName: 'A', userName: 'B' });
  assert.equal(res.selected.length, 1);
  assert.equal(res.diagnostics.duplicateEntries, 1);
});

test('12. Inclusion groups', () => {
  const lb = mkBook([
    { id: 'e1', title: 'MoodHappy', keys: ['mood'], content: 'Happy', priority: 50, group: 'mood', groupWeight: 10, enabled: true },
    { id: 'e2', title: 'MoodDark', keys: ['mood'], content: 'Dark', priority: 50, group: 'mood', groupWeight: 50, enabled: true },
  ]);
  const res = matchLorebookEntriesWithDiagnostics([lb], [], 'mood check', { charName: 'A', userName: 'B' });
  assert.deepEqual(res.selected.map(s => s.title), ['MoodDark']);
  assert.ok(res.diagnostics.entries.some(e => e.entryTitle === 'MoodHappy' && e.status === 'group_conflict'));
});

test('13 & 14. Token-budget prioritization, ignoreBudget, and budget-exceeded diagnostics', () => {
  const lb = mkBook([
    { id: 'e1', title: 'LowPri', keys: ['city'], content: 'X '.repeat(200), priority: 10, enabled: true },
    { id: 'e2', title: 'HighPri', keys: ['city'], content: 'Capital city.', priority: 100, enabled: true },
    { id: 'e3', title: 'PinnedLaw', keys: ['city'], content: 'Always keep.', priority: 5, ignoreBudget: true, enabled: true },
  ], { tokenBudget: 60 });

  const res = matchLorebookEntriesWithDiagnostics([lb], [], 'Enter the city.', { charName: 'A', userName: 'B', globalBudget: 60 });
  const titles = res.selected.map(s => s.title);
  assert.ok(titles.includes('HighPri'));
  assert.ok(titles.includes('PinnedLaw'));
  assert.ok(!titles.includes('LowPri'));
  assert.ok(res.diagnostics.entries.some(e => e.entryTitle === 'LowPri' && e.status === 'budget_exceeded'));
});

test('15 & 16. Prompt injection positions and context-trimming preservation', () => {
  const lb = mkBook([
    { id: 'e1', title: 'Pre', keys: ['lore'], content: 'Before char.', priority: 90, position: 'before_char', enabled: true },
    { id: 'e2', title: 'Post', keys: ['lore'], content: 'After char.', priority: 80, position: 'after_char', enabled: true },
    { id: 'e3', title: 'Hist', keys: ['lore'], content: 'Before hist.', priority: 70, position: 'before_history', enabled: true },
  ]);
  const res = matchLorebookEntriesWithDiagnostics([lb], [], 'lore', { charName: 'A', userName: 'B' });
  assert.equal(res.byPosition.before_char[0].title, 'Pre');
  assert.equal(res.byPosition.after_char[0].title, 'Post');
  assert.equal(res.byPosition.before_history[0].title, 'Hist');

  const sys = `[WORLD LORE]\n- Pre: Before char.`;
  const turns = buildTurns(
    Array.from({ length: 20 }, (_, i) => mkMsg(i % 2 === 0 ? 'user' : 'assistant', 'Long '.repeat(40), i)),
    'lore',
    { contextLimit: 1500, reservedTokens: 600, charName: 'A', userName: 'B' }
  );
  const payload = buildOpenAiChatPayload({ model: 'm', systemInstruction: sys, turns, config: {}, maxOutputTokens: 256, stream: true });
  assert.ok(payload.messages[0].content.includes('Before char.'));
});

test('17 & 18. Cross-chat isolation and character-bound Lorebook activation', () => {
  const privateBook = mkBook(
    [{ id: 'e1', title: 'HaileySecret', keys: ['secret'], content: 'Hailey only.', priority: 50, characterFilter: ['Hailey'], enabled: true }],
    { id: 'lb-private', isPublic: false }
  );
  // Chat without binding -> skipped
  const unbound = matchLorebookEntriesWithDiagnostics([privateBook], [], 'secret', { charName: 'Hailey', userName: 'Rei', attachedIds: ['other-book'] });
  assert.equal(unbound.selected.length, 0);
  // Bound to Hailey -> matches Hailey, filtered out for another character
  const hailey = matchLorebookEntriesWithDiagnostics([privateBook], [], 'secret', { charName: 'Hailey', userName: 'Rei', attachedIds: ['lb-private'] });
  assert.equal(hailey.selected.length, 1);
  const otherChar = matchLorebookEntriesWithDiagnostics([privateBook], [], 'secret', { charName: 'Mina', userName: 'Rei', attachedIds: ['lb-private'] });
  assert.equal(otherChar.selected.length, 0);
  assert.ok(otherChar.diagnostics.entries.some(e => e.status === 'character_filtered'));
});

test('19. English Lorebook preserves original terminology regardless of response language', () => {
  const lb = mkBook([{ id: 'e1', title: 'AetherCore', keys: ['aether'], content: 'The AetherCore powers Skyforge.', priority: 50, enabled: true }]);
  const res = matchLorebookEntriesWithDiagnostics([lb], [], 'Apa itu aether?', { charName: 'A', userName: 'B' });
  assert.equal(res.selected[0].content, 'The AetherCore powers Skyforge.');
});

test('20. Prompt Inspector diagnostics & SillyTavern V2 import compatibility', () => {
  const imported = parseJanitorLorebookJson(JSON.stringify({
    name: 'ST V2',
    entries: {
      '0': {
        uid: 0,
        comment: 'ArcaneTower',
        key: ['tower'],
        content: 'Tall spire.',
        case_sensitive: true,
        match_whole_words: true,
        sticky: 2,
      },
    },
  }));
  assert.equal(imported.success, true);
  assert.equal(imported.lorebook.entries[0].caseSensitive, true);
  assert.equal(imported.lorebook.entries[0].matchWholeWords, true);
  assert.equal(imported.lorebook.entries[0].sticky, 2);

  const diag = matchLorebookEntriesWithDiagnostics([imported.lorebook], [], 'Visit the tower.', { charName: 'A', userName: 'B' });
  assert.equal(diag.diagnostics.detectedCount, 1);
  assert.equal(diag.diagnostics.matchedCount, 1);
  assert.deepEqual(diag.selected[0].matchedKeywords, ['tower']);
});

test('21. Top-level JSON array (NPC Generator) parses and hydrates 0-entry description fallback', () => {
  const rawNpcArray = JSON.stringify([
    {
      category: 'general',
      content: 'You are tasked with providing unique and realistic non-player characters (NPCs).',
      enabled: true,
      id: 'f5a6fd6f-8299-46ea-910f-fac46e85e0ad',
      key: ['NPC Generator'],
      priority: 1,
      probability: 100,
      constant: true,
    },
  ]);

  const parsed = parseJanitorLorebookJson(rawNpcArray, 'NPC Generator');
  assert.equal(parsed.success, true);
  assert.equal(parsed.lorebook.entries.length, 1);
  assert.equal(parsed.lorebook.entries[0].constant, true);

  // Also test already-saved 0-entry book where JSON was pasted into description
  const legacySavedBook = {
    id: 'lb-npc',
    userId: 'user',
    title: 'NPC Generator',
    description: rawNpcArray,
    entries: [],
    isPublic: true,
    createdAt: '2026-01-01',
  };
  const res = matchLorebookEntriesWithDiagnostics([legacySavedBook], [], 'Hello!', {
    charName: 'Hailey',
    userName: 'Rei',
  });
  assert.equal(res.selected.length, 1);
  assert.ok(res.selected[0].content.includes('unique and realistic non-player characters'));
});

test('22. JanitorAI JS script (Otomatopeia) in description hydrates and triggers on keyword "sex"', () => {
  const jsScript = `
    var lastMessage = context.chat.last_message.toLowerCase();
    var explicitSystemNote = "[SYSTEM NOTE: Balance explicit dialogue with onomatopoeias like \\"haahh~\\".]";
    var explicitTriggers = ["cock", "sex", "moan"];
  `;
  const savedScriptBook = {
    id: 'lb-oto',
    userId: 'user',
    title: 'Otomatopeia',
    description: jsScript,
    entries: [],
    isPublic: true,
    createdAt: '2026-01-01',
  };
  const res = matchLorebookEntriesWithDiagnostics([savedScriptBook], [], 'sex', {
    charName: 'Hailey',
    userName: 'Rei',
  });
  assert.equal(res.selected.length, 1);
  assert.ok(res.selected[0].content.includes('[SYSTEM NOTE:'));
  assert.deepEqual(res.selected[0].matchedKeywords, ['sex']);
});
