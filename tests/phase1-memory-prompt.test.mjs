import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APPLICATION_SAFETY_POLICY,
  CONSERVATIVE_DEFAULT_CONTEXT_LIMIT,
  buildGeminiRequestBody,
  buildOpenAiChatPayload,
  buildTurns,
  migrateLegacyProviderConfig,
  normalizeEndpointIdentity,
  resolveContextBudget,
} from '../src/services/promptBudget.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('Anoman-style model IDs fall back to 16384 heuristic unless cached or overridden', () => {
  const cfg = {
    id: 'prov_custom',
    provider: 'custom',
    providerType: 'custom',
    baseUrl: 'https://api.anoman.io/v1',
    model: 'deepseek-v4-flash-0731',
  };
  const budget = resolveContextBudget(cfg);
  assert.equal(budget.contextLimit, CONSERVATIVE_DEFAULT_CONTEXT_LIMIT);
  assert.equal(budget.contextLimit, 16384);
  assert.equal(budget.contextSource, 'heuristic_fallback');
  assert.equal(budget.rawModel, 'deepseek-v4-flash-0731');
  assert.equal(budget.endpointIdentity, 'custom:api.anoman.io/v1');
});

test('OpenRouter namespaces and route suffixes do not blindly strip modifiers', () => {
  const verified = resolveContextBudget({
    provider: 'openrouter',
    providerType: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-3.5-sonnet',
  });
  assert.equal(verified.contextLimit, 200000);
  assert.equal(verified.maxOutputTokens, 8192);
  assert.equal(verified.contextSource, 'static_registry');

  // Unverified :beta or :free route suffix without cache/override must not blindly assume 200k
  const suffixed = resolveContextBudget({
    provider: 'openrouter',
    providerType: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-3.5-sonnet:beta',
  });
  assert.equal(suffixed.contextLimit, 16384);
  assert.equal(suffixed.contextSource, 'heuristic_fallback');
  assert.equal(suffixed.rawModel, 'anthropic/claude-3.5-sonnet:beta');
});

test('Custom endpoints do not falsely inherit Google/OpenAI direct limits', () => {
  const sumopod = resolveContextBudget({
    provider: 'custom',
    providerType: 'custom',
    baseUrl: 'https://ai.sumopod.com/v1',
    model: 'gemini-2.5-flash',
  });
  assert.equal(sumopod.contextLimit, 16384);
  assert.equal(sumopod.contextSource, 'heuristic_fallback');

  const googleDirect = resolveContextBudget({
    provider: 'gemini',
    providerType: 'gemini',
    model: 'gemini-2.5-flash',
  });
  assert.equal(googleDirect.contextLimit, 1048576);
  assert.equal(googleDirect.maxOutputTokens, 8192);
  assert.equal(googleDirect.contextSource, 'static_registry');
});

test('Misleading fine-tuned or unknown model names fall back safely to 16384', () => {
  for (const model of ['my-deepseek-finetune-8k', 'custom-qwen-lora', 'local-gguf-v2']) {
    const budget = resolveContextBudget({
      provider: 'custom',
      baseUrl: 'http://192.168.1.10:11434/v1',
      model,
    });
    assert.equal(budget.contextLimit, 16384, `Expected 16384 fallback for ${model}`);
    assert.equal(budget.contextSource, 'heuristic_fallback');
  }
});

test('Per-model overrides are scoped to exact model ID on the provider profile', () => {
  const baseProfile = {
    id: 'prov_openrouter',
    provider: 'openrouter',
    providerType: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelContextLimits: {
      'custom/model-a': { contextLimit: 32768, maxOutputTokens: 16384 },
    },
  };

  const budgetA = resolveContextBudget({ ...baseProfile, model: 'custom/model-a' });
  assert.equal(budgetA.contextLimit, 32768);
  assert.equal(budgetA.maxOutputTokens, 16384);
  assert.equal(budgetA.contextSource, 'model_override');
  assert.equal(budgetA.outputSource, 'model_override');

  const budgetB = resolveContextBudget({ ...baseProfile, model: 'custom/model-b' });
  assert.equal(budgetB.contextLimit, 16384);
  assert.equal(budgetB.maxOutputTokens, 4096);
  assert.equal(budgetB.contextSource, 'heuristic_fallback');
});

test('Cached metadata is used when endpointIdentity matches and invalidated when endpoint changes', () => {
  const cached = {
    'deepseek-v4-flash-0731': {
      endpointIdentity: 'custom:api.anoman.io/v1',
      source: 'fetch_models',
      contextLimit: 65536,
      maxOutputTokens: 8192,
      fetchedAt: Date.now(),
    },
  };

  const sameEndpoint = resolveContextBudget({
    provider: 'custom',
    providerType: 'custom',
    baseUrl: 'https://api.anoman.io/v1',
    model: 'deepseek-v4-flash-0731',
    cachedModelMetadata: cached,
  });
  assert.equal(sameEndpoint.contextLimit, 65536);
  assert.equal(sameEndpoint.maxOutputTokens, 8192);
  assert.equal(sameEndpoint.contextSource, 'cached_metadata');

  // Changing baseUrl invalidates cached metadata automatically
  const changedEndpoint = resolveContextBudget({
    provider: 'custom',
    providerType: 'custom',
    baseUrl: 'https://ai.sumopod.com/v1',
    model: 'deepseek-v4-flash-0731',
    cachedModelMetadata: cached,
  });
  assert.equal(changedEndpoint.contextLimit, 16384);
  assert.equal(changedEndpoint.maxOutputTokens, 4096);
  assert.equal(changedEndpoint.contextSource, 'heuristic_fallback');
  assert.notEqual(
    normalizeEndpointIdentity({ provider: 'custom', baseUrl: 'https://api.anoman.io/v1' }),
    normalizeEndpointIdentity({ provider: 'custom', baseUrl: 'https://ai.sumopod.com/v1' })
  );
});

test('Legacy migration ignores shipped contextWindow and 4096 default, but preserves user contextLimit & non-default maxTokens', () => {
  // 1. Untouched legacy INITIAL_PROVIDERS record
  const legacyDefault = migrateLegacyProviderConfig({
    id: 'prov_openrouter',
    provider: 'openrouter',
    providerType: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'unknown-free-model',
    contextWindow: 128000,
    maxTokens: 4096,
  });
  assert.equal(legacyDefault.userConfiguredContextLimit, false);
  assert.equal(legacyDefault.userConfiguredMaxTokens, false);
  const defaultBudget = resolveContextBudget(legacyDefault);
  assert.equal(defaultBudget.contextLimit, 16384);

  // 2. Legacy record where user explicitly configured contextLimit & custom maxTokens in SettingsScreen
  const legacyUserEdited = migrateLegacyProviderConfig({
    id: 'prov_openrouter',
    provider: 'openrouter',
    providerType: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'unknown-free-model',
    contextWindow: 128000,
    contextLimit: 24576,
    maxTokens: 8192,
  });
  assert.equal(legacyUserEdited.userConfiguredContextLimit, true);
  assert.equal(legacyUserEdited.userConfiguredMaxTokens, true);
  const userBudget = resolveContextBudget(legacyUserEdited);
  assert.equal(userBudget.contextLimit, 24576);
  assert.equal(userBudget.maxOutputTokens, 8192);
});

test('Max Response Tokens: custom > 15k, Unlimited (0), no silent clamping, and warnings', () => {
  // Custom output > 15,000 passes through unclamped
  const highOut = resolveContextBudget({
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1',
    maxTokens: 32768,
    userConfiguredMaxTokens: true,
  });
  assert.equal(highOut.contextLimit, 1047576);
  assert.equal(highOut.maxOutputTokens, 32768);
  assert.equal(highOut.warnings.length, 0);

  // Requested output exceeding context warns without silently clamping
  const oversizedOut = resolveContextBudget({
    provider: 'custom',
    baseUrl: 'https://api.anoman.io/v1',
    model: 'custom-rp',
    contextLimit: 8192,
    userConfiguredContextLimit: true,
    maxTokens: 20000,
    userConfiguredMaxTokens: true,
  });
  assert.equal(oversizedOut.maxOutputTokens, 20000);
  assert.ok(oversizedOut.warnings.some(w => w.code === 'output_exceeds_context'));
  assert.ok(oversizedOut.outputReservationTokens < oversizedOut.contextLimit);

  // Unlimited (0) reserves conservative input buffer and omits output limit from payloads
  const unlimited = resolveContextBudget({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    maxTokens: 0,
    userConfiguredMaxTokens: true,
  });
  assert.equal(unlimited.maxOutputTokens, 0);
  assert.ok(unlimited.outputReservationTokens > 0);
});

test('Generation path integration: buildTurns and request payloads respect resolved budgets and keep raw model ID', () => {
  const config = {
    provider: 'openrouter',
    providerType: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'my-router/custom-rp-model:free',
    contextLimit: 2048,
    userConfiguredContextLimit: true,
    maxTokens: 24000,
    userConfiguredMaxTokens: true,
  };

  const budget = resolveContextBudget(config);
  assert.equal(budget.maxOutputTokens, 24000);

  // Long history should be trimmed to fit 2048 contextLimit
  const longHistory = Array.from({ length: 20 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Turn ${i}: ` + 'word '.repeat(60),
  }));

  const turns = buildTurns(longHistory, 'Latest user turn', {
    contextLimit: budget.contextLimit,
    reservedTokens: 300 + budget.outputReservationTokens + budget.safetyMargin,
    charName: 'Aria',
    userName: 'Ren',
  });
  assert.ok(turns.length >= 2 && turns.length < longHistory.length);

  const openAiPayload = buildOpenAiChatPayload({
    model: config.model,
    systemInstruction: APPLICATION_SAFETY_POLICY,
    turns,
    config,
    maxOutputTokens: budget.maxOutputTokens,
  });
  assert.equal(openAiPayload.model, 'my-router/custom-rp-model:free');
  assert.equal(openAiPayload.max_tokens, 24000);

  // Unlimited (0) omits max_tokens / maxOutputTokens
  const openAiUnlimited = buildOpenAiChatPayload({
    model: config.model,
    systemInstruction: APPLICATION_SAFETY_POLICY,
    turns,
    config,
    maxOutputTokens: 0,
  });
  assert.equal('max_tokens' in openAiUnlimited, false);

  const geminiUnlimited = buildGeminiRequestBody({
    systemInstruction: APPLICATION_SAFETY_POLICY,
    turns,
    config,
    maxOutputTokens: 0,
  });
  assert.equal('maxOutputTokens' in geminiUnlimited.generationConfig, false);
});

test('ChatRoomScreen scopes memory and checkpoint keys to conversationId and avoids duplicate injection', async () => {
  const chatRoomSrc = await fs.readFile(path.join(ROOT, 'src/screens/ChatRoomScreen.tsx'), 'utf8');

  assert.match(chatRoomSrc, /getSessionMemoryKey\s*=\s*\(convId:\s*string\)\s*=>\s*`@nekochat:chat_memory_\$\{convId\}`/);
  assert.match(chatRoomSrc, /getSessionCheckpointKey\s*=\s*\(convId:\s*string\)\s*=>\s*`@nekochat:chat_checkpoint_idx_\$\{convId\}`/);

  const legacyMatches = chatRoomSrc.match(/@nekochat:chat_memory_\$\{character\.id\}/g) || [];
  assert.equal(legacyMatches.length, 1);

  assert.doesNotMatch(chatRoomSrc, /\[Permanent Roleplay Memory Notes:/);
});
