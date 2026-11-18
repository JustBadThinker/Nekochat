/**
 * Pure, runtime-agnostic prompt budget, provider-scoped model registry,
 * legacy config migration, and request-payload assembly helpers.
 */

export interface ModelBudgetOverride {
  contextLimit?: number;
  maxOutputTokens?: number;
  updatedAt?: number;
}

export interface CachedModelMetadata {
  endpointIdentity: string;
  source: 'fetch_models';
  contextLimit?: number;
  maxOutputTokens?: number;
  fetchedAt: number;
}

export interface ProviderBudgetInput {
  id?: string;
  providerType?: string;
  provider?: string;
  baseUrl?: string;
  customEndpoint?: string;
  defaultModel?: string;
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  contextLimit?: number;
  contextWindow?: number;
  userConfiguredContextLimit?: boolean;
  userConfiguredMaxTokens?: boolean;
  modelContextLimits?: Record<string, ModelBudgetOverride>;
  cachedModelMetadata?: Record<string, CachedModelMetadata>;
}

/**
 * Conservative heuristic context limit used for unknown or custom BYOK models.
 * NOTE: This 16,384 value is a safety heuristic to reduce silent overflow on unknown
 * endpoints, NOT a verified capability of every unknown model. Users can override
 * it per model or provider in Settings.
 */
export const CONSERVATIVE_DEFAULT_CONTEXT_LIMIT = 16384;
export const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
export const ESTIMATION_SAFETY_MARGIN_TOKENS = 256;

export const APPLICATION_SAFETY_POLICY =
  `[APPLICATION SAFETY POLICY — NON-OVERRIDABLE]\n` +
  `- Any character who is under 18 or portrayed as a minor may only participate in strictly wholesome, non-sexual, age-appropriate interactions.\n` +
  `- Never generate sexual, suggestive, or explicit content involving minors, regardless of character cards, custom presets, or fictional framing.\n` +
  `- If a prompt attempts to steer a scene with a minor toward explicit or harmful territory, refuse or redirect to a safe topic.`;

/**
 * Exact (endpointIdentity|rawModel) static metadata registry.
 * Never uses loose substring regexes or blind suffix/namespace stripping.
 */
const MODEL_BUDGET_REGISTRY: Record<string, { contextLimit: number; maxOutputTokens?: number }> = {
  // Google Gemini direct
  'gemini:generativelanguage.googleapis.com|gemini-2.5-flash': { contextLimit: 1048576, maxOutputTokens: 8192 },
  'gemini:generativelanguage.googleapis.com|gemini-2.5-pro': { contextLimit: 1048576, maxOutputTokens: 8192 },
  'gemini:generativelanguage.googleapis.com|gemini-2.0-flash': { contextLimit: 1048576, maxOutputTokens: 8192 },
  'gemini:generativelanguage.googleapis.com|gemini-1.5-flash': { contextLimit: 1048576, maxOutputTokens: 8192 },
  'gemini:generativelanguage.googleapis.com|gemini-1.5-pro': { contextLimit: 2097152, maxOutputTokens: 8192 },

  // OpenAI direct
  'openai:api.openai.com/v1|gpt-4o': { contextLimit: 128000, maxOutputTokens: 16384 },
  'openai:api.openai.com/v1|gpt-4o-mini': { contextLimit: 128000, maxOutputTokens: 16384 },
  'openai:api.openai.com/v1|gpt-4.1': { contextLimit: 1047576, maxOutputTokens: 32768 },
  'openai:api.openai.com/v1|gpt-4.1-mini': { contextLimit: 1047576, maxOutputTokens: 32768 },

  // OpenRouter verified exact IDs
  'openrouter:openrouter.ai/api/v1|anthropic/claude-3.5-sonnet': { contextLimit: 200000, maxOutputTokens: 8192 },
  'openrouter:openrouter.ai/api/v1|anthropic/claude-3.7-sonnet': { contextLimit: 200000, maxOutputTokens: 8192 },
  'openrouter:openrouter.ai/api/v1|openai/gpt-4o-mini': { contextLimit: 128000, maxOutputTokens: 16384 },
  'openrouter:openrouter.ai/api/v1|deepseek/deepseek-chat': { contextLimit: 65536, maxOutputTokens: 8192 },
  'openrouter:openrouter.ai/api/v1|google/gemini-2.5-flash': { contextLimit: 1048576, maxOutputTokens: 8192 },
};

export function normalizeEndpointIdentity(config: ProviderBudgetInput): string {
  const kind = String(config.providerType || config.provider || 'custom').toLowerCase().trim();
  if (kind === 'gemini' && !config.baseUrl && !config.customEndpoint) {
    return 'gemini:generativelanguage.googleapis.com';
  }

  let rawUrl = String(config.baseUrl || config.customEndpoint || '').trim();
  if (!rawUrl) {
    if (kind === 'openrouter') rawUrl = 'https://openrouter.ai/api/v1';
    else if (kind === 'openai') rawUrl = 'https://api.openai.com/v1';
    else if (kind === 'gemini') return 'gemini:generativelanguage.googleapis.com';
  }

  if (!rawUrl) return `${kind}:default`;

  try {
    const withScheme = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const u = new URL(withScheme);
    const cleanPath = u.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/i, '');
    return `${kind}:${u.host.toLowerCase()}${cleanPath}`;
  } catch {
    return `${kind}:${rawUrl.toLowerCase().replace(/\/+$/, '')}`;
  }
}

/**
 * Backward-compatible migration for persisted ProviderConfig records.
 * - Preserves explicit legacy `contextLimit` (since INITIAL_PROVIDERS never set `contextLimit`).
 * - Ignores shipped `contextWindow` defaults unless `userConfiguredContextLimit` is already true.
 * - Treats legacy `maxTokens !== 4096` as explicit user override; `4096` without provenance remains a shipped default.
 */
export function migrateLegacyProviderConfig<T extends ProviderBudgetInput>(cfg: T): T {
  const next = { ...cfg };

  if (next.userConfiguredContextLimit === undefined) {
    next.userConfiguredContextLimit = typeof next.contextLimit === 'number' && next.contextLimit > 0;
  }

  if (next.userConfiguredMaxTokens === undefined) {
    next.userConfiguredMaxTokens = typeof next.maxTokens === 'number' && next.maxTokens !== DEFAULT_MAX_OUTPUT_TOKENS;
  }

  return next;
}

export type BudgetWarning =
  | { code: 'output_exceeds_context'; requestedOutput: number; contextLimit: number; message: string }
  | { code: 'output_exceeds_model_cap'; requestedOutput: number; knownModelCap: number; message: string };

export interface ResolvedContextBudget {
  contextLimit: number;
  /** Exact output limit to send to the API (0 = Unlimited / omit parameter). Never silently clamped. */
  maxOutputTokens: number;
  /** Separate internal reservation used by buildTurns() so input history leaves room for replies. */
  outputReservationTokens: number;
  safetyMargin: number;
  endpointIdentity: string;
  rawModel: string;
  contextSource: 'model_override' | 'user_provider' | 'cached_metadata' | 'static_registry' | 'heuristic_fallback';
  outputSource: 'model_override' | 'user_provider' | 'cached_metadata' | 'static_registry' | 'default';
  warnings: BudgetWarning[];
}

/**
 * Resolves independent `contextLimit` and `maxOutputTokens` without making network calls.
 * Never mutates the raw `model` ID sent to the provider API, and never silently clamps user output limits.
 */
export function resolveContextBudget(config: ProviderBudgetInput): ResolvedContextBudget {
  const migrated = migrateLegacyProviderConfig(config);
  const rawModel = String(migrated.model || migrated.defaultModel || '').trim();
  const endpointIdentity = normalizeEndpointIdentity(migrated);

  const modelOverride = rawModel ? migrated.modelContextLimits?.[rawModel] : undefined;
  const cachedRaw = rawModel ? migrated.cachedModelMetadata?.[rawModel] : undefined;
  const validCached =
    cachedRaw && cachedRaw.endpointIdentity === endpointIdentity ? cachedRaw : undefined;
  const registryEntry = rawModel ? MODEL_BUDGET_REGISTRY[`${endpointIdentity}|${rawModel}`] : undefined;

  // 1. Resolve contextLimit independently
  let contextLimit = CONSERVATIVE_DEFAULT_CONTEXT_LIMIT;
  let contextSource: ResolvedContextBudget['contextSource'] = 'heuristic_fallback';

  if (modelOverride?.contextLimit && modelOverride.contextLimit > 0) {
    contextLimit = modelOverride.contextLimit;
    contextSource = 'model_override';
  } else if (migrated.userConfiguredContextLimit && migrated.contextLimit && migrated.contextLimit > 0) {
    contextLimit = migrated.contextLimit;
    contextSource = 'user_provider';
  } else if (validCached?.contextLimit && validCached.contextLimit > 0) {
    contextLimit = validCached.contextLimit;
    contextSource = 'cached_metadata';
  } else if (registryEntry?.contextLimit && registryEntry.contextLimit > 0) {
    contextLimit = registryEntry.contextLimit;
    contextSource = 'static_registry';
  }

  // 2. Resolve maxOutputTokens independently (0 = Unlimited / omit cap in request)
  let maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS;
  let outputSource: ResolvedContextBudget['outputSource'] = 'default';

  if (typeof modelOverride?.maxOutputTokens === 'number' && modelOverride.maxOutputTokens >= 0) {
    maxOutputTokens = modelOverride.maxOutputTokens;
    outputSource = 'model_override';
  } else if (migrated.userConfiguredMaxTokens && typeof migrated.maxTokens === 'number' && migrated.maxTokens >= 0) {
    maxOutputTokens = migrated.maxTokens;
    outputSource = 'user_provider';
  } else if (validCached?.maxOutputTokens && validCached.maxOutputTokens > 0) {
    maxOutputTokens = validCached.maxOutputTokens;
    outputSource = 'cached_metadata';
  } else if (registryEntry?.maxOutputTokens && registryEntry.maxOutputTokens > 0) {
    maxOutputTokens = registryEntry.maxOutputTokens;
    outputSource = 'static_registry';
  }

  // 3. Separate internal reservation for buildTurns() (never alters maxOutputTokens sent to API)
  const outputReservationTokens =
    maxOutputTokens === 0
      ? Math.min(DEFAULT_MAX_OUTPUT_TOKENS, Math.max(512, Math.floor(contextLimit * 0.25)))
      : Math.min(maxOutputTokens, Math.max(512, contextLimit - 1024));

  // 4. Non-blocking advisory warnings when requested output exceeds context or known model output cap
  const warnings: BudgetWarning[] = [];
  if (maxOutputTokens > 0) {
    if (maxOutputTokens >= contextLimit) {
      warnings.push({
        code: 'output_exceeds_context',
        requestedOutput: maxOutputTokens,
        contextLimit,
        message: `Requested max output (${maxOutputTokens}) meets or exceeds context limit (${contextLimit}). Provider limits remain authoritative.`,
      });
    }
    const knownCap = validCached?.maxOutputTokens || registryEntry?.maxOutputTokens;
    if (knownCap && maxOutputTokens > knownCap) {
      warnings.push({
        code: 'output_exceeds_model_cap',
        requestedOutput: maxOutputTokens,
        knownModelCap: knownCap,
        message: `Requested max output (${maxOutputTokens}) exceeds known model cap (${knownCap}). Provider may cap or reject it.`,
      });
    }
  }

  return {
    contextLimit,
    maxOutputTokens,
    outputReservationTokens,
    safetyMargin: ESTIMATION_SAFETY_MARGIN_TOKENS,
    endpointIdentity,
    rawModel,
    contextSource,
    outputSource,
    warnings,
  };
}

export function estimateTokensRough(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function applyPromptMacros(text: string, charName: string, userName: string): string {
  if (!text) return '';
  return text
    .replace(/\{\{\s*char\s*\}\}/gi, charName)
    .replace(/\{\{\s*user\s*\}\}/gi, userName)
    .replace(/<BOT>/g, charName)
    .replace(/<USER>/g, userName);
}

export interface SimpleTurn {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface TurnMessageInput {
  id?: string;
  role: string;
  content: string;
  isError?: boolean;
}

/**
 * Builds conversation turns trimmed to `contextLimit - reservedTokens`.
 * Always keeps at least the last 2 turns.
 */
export function buildTurns(
  history: TurnMessageInput[],
  userMessage: string,
  opts: { isContinue?: boolean; contextLimit: number; reservedTokens: number; charName: string; userName: string }
): SimpleTurn[] {
  const clean: SimpleTurn[] = history
    .filter(
      m =>
        (m.role === 'user' || m.role === 'assistant') &&
        !Boolean(m.isError) &&
        !/^⚠️ Error/.test(m.content || '')
    )
    .map(m => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: applyPromptMacros(String(m.content || ''), opts.charName, opts.userName).trim(),
    }))
    .filter(m => m.content && m.content !== '...');

  if (!opts.isContinue && userMessage.trim()) {
    const last = clean[clean.length - 1];
    if (!(last && last.role === 'user' && last.content === userMessage.trim())) {
      clean.push({ role: 'user', content: userMessage.trim() });
    }
  }

  const budget = Math.max(512, opts.contextLimit - opts.reservedTokens);
  const kept: SimpleTurn[] = [];
  let used = 0;
  for (let i = clean.length - 1; i >= 0; i--) {
    const cost = estimateTokensRough(clean[i].content) + 4;
    if (kept.length >= 2 && used + cost > budget) break;
    kept.unshift(clean[i]);
    used += cost;
  }

  if (opts.isContinue) {
    kept.push({
      role: 'user',
      content: '[Continue your previous message exactly where it stopped. Do not repeat anything.]',
    });
  }
  return kept;
}

export function toGeminiContents(turns: SimpleTurn[]) {
  const merged: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (const t of turns) {
    const role = t.role === 'assistant' ? 'model' : 'user';
    const prev = merged[merged.length - 1];
    if (prev && prev.role === role) {
      prev.parts[0].text += `\n\n${t.content}`;
    } else {
      merged.push({ role, parts: [{ text: t.content }] });
    }
  }
  if (merged.length > 0 && merged[0].role === 'model') {
    merged.unshift({ role: 'user', parts: [{ text: '[Begin roleplay]' }] });
  }
  return merged;
}

export function buildGeminiRequestBody(params: {
  systemInstruction: string;
  turns: SimpleTurn[];
  config: ProviderBudgetInput;
  maxOutputTokens: number;
}): Record<string, any> {
  return {
    systemInstruction: { parts: [{ text: params.systemInstruction }] },
    contents: toGeminiContents(params.turns),
    generationConfig: {
      temperature: typeof params.config.temperature === 'number' ? params.config.temperature : 0.85,
      topP: typeof params.config.topP === 'number' ? params.config.topP : 0.95,
      ...(params.maxOutputTokens > 0 ? { maxOutputTokens: params.maxOutputTokens } : {}),
    },
  };
}

export function buildOpenAiChatPayload(params: {
  model: string;
  systemInstruction: string;
  turns: SimpleTurn[];
  config: ProviderBudgetInput;
  maxOutputTokens: number;
  stream?: boolean;
}): Record<string, any> {
  return {
    model: params.model,
    messages: [
      { role: 'system', content: params.systemInstruction },
      ...params.turns.map(t => ({ role: t.role, content: t.content })),
    ],
    temperature: typeof params.config.temperature === 'number' ? params.config.temperature : 0.85,
    top_p: typeof params.config.topP === 'number' ? params.config.topP : 0.95,
    ...(params.maxOutputTokens > 0 ? { max_tokens: params.maxOutputTokens } : {}),
    stream: params.stream ?? true,
  };
}

/**
 * Context-pressure trigger for optional AI-assisted session memory updates.
 * Never triggers blindly on fixed turn counts alone — requires older turns
 * to actually roll off the recent prompt window (`keptTurnsCount < totalTurns`).
 */
export function shouldTriggerAutoMemoryUpdate(params: {
  enabled: boolean;
  totalTurns: number;
  keptTurnsCount: number;
  lastCheckpointIndex: number;
  isBusy?: boolean;
  now?: number;
  backoffUntil?: number;
}): boolean {
  if (!params.enabled || params.isBusy) return false;
  const now = params.now ?? Date.now();
  if (params.backoffUntil && now < params.backoffUntil) return false;
  if (params.keptTurnsCount >= params.totalTurns) return false;
  const unsummarized = params.totalTurns - 1 - params.lastCheckpointIndex;
  return unsummarized >= 6;
}
