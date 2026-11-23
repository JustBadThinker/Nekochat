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
const { matchLorebookEntriesWithDiagnostics } = await import('../src/services/lorebookService.ts');
import { buildOpenAiChatPayload, buildTurns } from '../src/services/promptBudget.ts';

test('B05: Custom Prompt in systemInstruction is never trimmed when long history exceeds contextLimit', () => {
  const customRules = '[CHAT CUSTOM RULES & OVERRIDES]\n[Custom Chat Rules & Prompt: Always end replies with a cat pun.]';
  const systemInstruction = `Base roleplay prompt.\n\n${customRules}`;

  const longHistory = Array.from({ length: 30 }, (_, i) => ({
    id: `msg-${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Long roleplay paragraph ${i} `.repeat(25),
  }));

  const turns = buildTurns(longHistory, 'Latest user turn', {
    contextLimit: 2048,
    reservedTokens: 800,
    charName: 'Neko',
    userName: 'Rei',
  });

  assert.ok(turns.length < longHistory.length, 'Expected older turns to be trimmed under tight budget');

  const payload = buildOpenAiChatPayload({
    model: 'mistralai/mistral-nemo',
    systemInstruction,
    turns,
    config: { temperature: 0.85, topP: 0.95 },
    maxOutputTokens: 512,
    stream: true,
  });

  assert.equal(payload.messages[0].role, 'system');
  assert.ok(payload.messages[0].content.includes('Always end replies with a cat pun.'));
});

test('B06: Lorebook triggers entries with undefined enabled, selective keys, recursiveScanning, and emits diagnostics', () => {
  const lorebooks = [
    {
      id: 'lb_1',
      userId: 'user_local_01',
      title: 'Eldoria Codex',
      description: 'World lore',
      scanDepth: 4,
      tokenBudget: 1024,
      recursiveScanning: true,
      isPublic: true,
      createdAt: new Date().toISOString(),
      entries: [
        {
          id: 'e1',
          title: 'Silver Spire',
          keys: ['spire'],
          content: 'The Silver Spire houses the Arcane Guild.',
          priority: 100,
          // enabled intentionally omitted (undefined) to verify it is not skipped
        },
        {
          id: 'e2',
          title: 'Arcane Guild',
          keys: ['arcane guild'],
          content: 'Mages led by Archon Vael.',
          priority: 90,
          enabled: true,
        },
        {
          id: 'e3',
          title: 'Secret Vault',
          keys: ['vault'],
          secondaryKeys: ['keycard'],
          selective: true,
          content: 'Hidden beneath the spire.',
          priority: 80,
          enabled: true,
        },
        {
          id: 'e4',
          title: 'Disabled Entry',
          keys: ['spire'],
          content: 'Should never appear.',
          priority: 70,
          enabled: false,
        },
      ],
    },
  ];

  const result = matchLorebookEntriesWithDiagnostics(
    lorebooks,
    [{ id: 'm1', characterId: 'c1', role: 'user', content: 'We approach the vault.', timestamp: 1 }],
    'Tell me about the spire.',
    { charName: 'Hailey', userName: 'Rei' }
  );

  const titles = result.selected.map(s => s.title);
  assert.ok(titles.includes('Silver Spire'));
  assert.ok(titles.includes('Arcane Guild'), 'Recursive scan should trigger Arcane Guild from Silver Spire content');
  assert.ok(!titles.includes('Secret Vault'), 'Selective entry missing secondary key should not trigger');
  assert.ok(!titles.includes('Disabled Entry'), 'Explicitly disabled entry must not trigger');

  assert.equal(result.diagnostics.scannedBooks, 1);
  assert.equal(result.diagnostics.matchedCount, 2);
  assert.ok(result.diagnostics.entries.some(e => e.entryTitle === 'Disabled Entry' && e.status === 'disabled'));
  assert.ok(result.diagnostics.entries.some(e => e.entryTitle === 'Secret Vault' && e.status === 'secondary_key_miss'));
});
