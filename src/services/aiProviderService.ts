/**
 * AI Provider Service
 * Supports Google Gemini (via official SDK), OpenRouter, and OpenAI-compatible endpoints.
 */

import { GoogleGenAI } from '@google/genai';
import { Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import { Character, CharacterScenario, ChatMessage, Lorebook, Persona, ProviderConfig, TokenOptimizerLevel } from '../types';
import { isOocMessage, cleanOocContent, estimateTokens } from './tokenOptimizerService';
import { stripHistoryForPrompt, stripPromptText } from './tokenStripper';
import { storageService } from './storageService';
import { getSqliteConversationRepository } from './sqliteDatabase';
import { searchOlderMessagesInMemory } from './memoryRecall';
import { PromptSectionBreakdown, recordNetworkTelemetry, recordPromptSnapshot } from './devTelemetry';
import { buildDynamicCastPromptSection } from './dynamicCastService';
import { matchLorebookEntriesWithDiagnostics } from './lorebookService';
import { getDefaultLanguagePrompt } from '../i18n/translations';
import {
  APPLICATION_SAFETY_POLICY,
  applyPromptMacros,
  buildGeminiRequestBody,
  buildOpenAiChatPayload,
  buildTurns,
  normalizeEndpointIdentity,
  resolveContextBudget,
} from './promptBudget';
import { readOpenAiStream, StreamMetrics, StreamMode } from './openAiStream';
export {
  APPLICATION_SAFETY_POLICY,
  buildGeminiRequestBody,
  buildOpenAiChatPayload,
  buildTurns,
  normalizeEndpointIdentity,
  resolveContextBudget,
  readOpenAiStream,
};
export type { StreamMetrics, StreamMode };

// ═══════════════════════════════════════════════════════════════════════════
// Provider Routing — single source of truth used by EVERY AI feature
// (chat, continue, regenerate, refine, model listing, health probe).
// ═══════════════════════════════════════════════════════════════════════════

export type ProviderRoute =
  | { kind: 'gemini'; apiKey: string; model: string }
  | { kind: 'openai'; endpoint: string; apiKey: string; model: string; isOpenRouter: boolean; label: string };

const DEFAULT_ENDPOINTS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
};

/**
 * Decides how a ProviderConfig is called.
 * - Gemini profile without a custom base URL → official Google SDK.
 * - Everything else (OpenRouter, OpenAI, Custom Proxy, or Gemini with a custom URL) →
 *   OpenAI-compatible `/chat/completions`.
 */
export function resolveProviderRoute(config: ProviderConfig): ProviderRoute {
  const type = String(config.providerType || config.provider || 'custom').toLowerCase();
  const rawEndpoint = String(config.baseUrl || config.customEndpoint || '').trim();
  const apiKey = String(config.apiKey || '').trim();
  const model = String(config.model || config.defaultModel || '').trim();

  const looksLikeOpenAiKey = /^sk-[a-zA-Z0-9_-]+/.test(apiKey) || /^gsk_[a-zA-Z0-9_-]+/.test(apiKey);
  const looksLikeOpenRouterKey = /^sk-or-v1-/i.test(apiKey);
  const hasCustomNonGoogleEndpoint =
    Boolean(rawEndpoint) && !/generativelanguage\.googleapis\.com/i.test(rawEndpoint);

  if (type === 'gemini' && !looksLikeOpenAiKey && !looksLikeOpenRouterKey && !hasCustomNonGoogleEndpoint) {
    return {
      kind: 'gemini',
      apiKey,
      model: model && /gemini/i.test(model) ? model : 'gemini-2.5-flash',
    };
  }

  const inferredEndpoint =
    rawEndpoint ||
    (looksLikeOpenRouterKey || type === 'openrouter'
      ? DEFAULT_ENDPOINTS.openrouter
      : DEFAULT_ENDPOINTS[type] || DEFAULT_ENDPOINTS.openai);

  const isOpenRouter =
    type === 'openrouter' || looksLikeOpenRouterKey || /openrouter\.ai/i.test(inferredEndpoint);

  const fallbackModel = isOpenRouter ? 'anthropic/claude-3.5-sonnet' : 'gpt-4o-mini';
  const effectiveModel =
    !model || (type === 'gemini' && /^gemini/i.test(model) && hasCustomNonGoogleEndpoint)
      ? fallbackModel
      : model;

  return {
    kind: 'openai',
    endpoint: inferredEndpoint,
    apiKey,
    model: effectiveModel,
    isOpenRouter,
    label: isOpenRouter ? 'OpenRouter' : type === 'openai' ? 'OpenAI' : 'Custom Endpoint',
  };
}

function buildChatCompletionsUrl(endpoint: string): string {
  const clean = endpoint.trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(clean)) return clean;
  return `${clean}/chat/completions`;
}

function buildModelsUrl(endpoint: string): string {
  const clean = endpoint.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/i, '');
  return clean.endsWith('/models') ? clean : `${clean}/models`;
}

/** Local dev proxy (server.mjs) used on web only when the browser blocks a request (CORS). */
function getLocalProxyBase(): string {
  const host = typeof window !== 'undefined' && window.location?.hostname ? window.location.hostname : 'localhost';
  return `http://${host}:3001`;
}

/**
 * Cross-platform fetch:
 * - Native (Android/iOS): `expo/fetch` → supports streaming `res.body.getReader()`.
 * - Web: browser fetch; on a network/CORS failure retries once through the local proxy.
 */
async function platformFetch(url: string, init: RequestInit & { signal?: AbortSignal }): Promise<Response> {
  if (Platform.OS !== 'web') {
    return (await expoFetch(url, init as any)) as unknown as Response;
  }
  try {
    return await fetch(url, init);
  } catch (err: any) {
    if (init.signal?.aborted || err?.name === 'AbortError') throw err;
    try {
      const proxyHeaders: Record<string, string> = { ...(init.headers as Record<string, string>), 'x-target-url': url };
      return await fetch(`${getLocalProxyBase()}/llm-proxy`, { ...init, headers: proxyHeaders });
    } catch (proxyErr: any) {
      if (init.signal?.aborted || proxyErr?.name === 'AbortError') throw proxyErr;
      throw new Error(
        `The browser blocked the request to ${new URL(url).host} (CORS / network). ` +
        `Run "node server.mjs" so the web build can relay it, or use the mobile app (no CORS on native).`
      );
    }
  }
}

function describeHttpError(status: number, body: string, label: string): string {
  const snippet = body.replace(/\s+/g, ' ').slice(0, 280);
  if (status === 401 || status === 403) return `${label} rejected the API key (HTTP ${status}). Check the key in Settings → AI Engine. ${snippet}`;
  if (status === 404) return `${label} returned 404 — the Base URL or model name is wrong. ${snippet}`;
  if (status === 429) return `${label} rate limit / quota reached (HTTP 429). ${snippet}`;
  return `${label} error (HTTP ${status}): ${snippet}`;
}

/** Replaces SillyTavern / JanitorAI macros. */
export function applyMacros(text: string, charName: string, userName: string): string {
  if (!text) return '';
  return text
    .replace(/\{\{\s*char\s*\}\}/gi, charName)
    .replace(/\{\{\s*user\s*\}\}/gi, userName)
    .replace(/<BOT>/g, charName)
    .replace(/<USER>/g, userName);
}

export function isErrorMessage(m: ChatMessage): boolean {
  return Boolean((m as any).isError) || /^⚠️ Error/.test(m.content || '');
}

export interface StreamUsageSummary {
  promptTokens?: number;
  outputTokens?: number;
  thoughtsTokens?: number;
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onError: (error: Error) => void;
  onComplete: (
    fullText: string,
    tokenEstimate: number,
    thought?: string,
    meta?: { aborted?: boolean; streamMode?: StreamMode; finishReason?: string; usage?: StreamUsageSummary }
  ) => void;
  onPromptBuilt?: (systemPrompt: string) => void;
  onStreamMetrics?: (metrics: StreamMetrics) => void;
}

export function extractThoughtAndContent(rawText: string): { thought?: string; content: string } {
  let content = rawText.trim();
  let thought: string | undefined;

  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    thought = thinkMatch[1].trim();
    content = content.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
  }

  return { thought, content };
}

export function cleanCreatorHandle(raw?: string): string {
  if (!raw) return 'creator';
  let clean = raw.trim().replace(/^@+/, '');
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    const parts = clean.replace(/\/+$/, '').split('/');
    const last = parts[parts.length - 1] || 'creator';
    if (/^[0-9a-f-]{20,}$/i.test(last)) {
      return `janitor_${last.slice(0, 6)}`;
    }
    return last.length > 20 ? `${last.slice(0, 16)}…` : last;
  }
  return clean.length > 24 ? `${clean.slice(0, 20)}…` : clean;
}

const GENERIC_PLACEHOLDER_NAME_RE =
  /^(?:narrator|story|roleplay|bot|character|assistant|gm|game\s*master|dm|dungeon\s*master|system|host|scenario|anonymous|unnamed(?:\s+companion)?|user|you|created|note|warning|none|unknown|n\/a)$/i;

function normalizeProfileLines(text?: string): string {
  return (text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[*_`]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ');
}

function cleanExtractedNameCandidate(candidate?: string): string | null {
  const cleaned = (candidate || '')
    .replace(/[-—–:|,;.!?/]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.length < 2 || cleaned.length > 40) return null;
  if (cleaned.includes('{{') || cleaned.includes('}}') || cleaned.includes('<') || cleaned.includes('>')) {
    return null;
  }
  if (cleaned.split(/\s+/).length > 4) return null;
  if (GENERIC_PLACEHOLDER_NAME_RE.test(cleaned)) return null;
  return cleaned;
}

function extractExplicitNameFromProfile(
  personality?: string,
  firstMessage?: string,
  allowHeuristicFallback: boolean = false
): string | null {
  const sources = [normalizeProfileLines(personality), normalizeProfileLines(firstMessage)].filter(Boolean);
  for (const src of sources) {
    const explicitMatch =
      src.match(
        /(?:^|\n)[ \t]*[-•+]?[ \t]*(?:Full[ \t]+Name|Real[ \t]+Name|Character[ \t]+Name|Name|Nama)[ \t]*[:=][ \t]*([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9.'’_-]*(?:[ \t]+(?![-•+:])[A-Za-zÀ-ÖØ-öø-ÿ0-9.'’_-]+){0,3})(?=[ \t]*(?:\n|$|[,;(\[|]|[-—–][ \t]))/i
      ) ||
      src.match(
        /(?:^|\n)[ \t]*#*[ \t]*([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ.'’_-]+(?:[ \t]+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ.'’_-]+){0,2})[ \t]*[-—–:|][ \t]*(?:Character[ \t]+Profile|Character[ \t]+Card|Character[ \t]+Sheet|Profile|Bio)\b/
      ) ||
      src.match(
        /\[(?:Character|char)\s*\(\s*["']?([A-Za-zÀ-ÖØ-öø-ÿ0-9'’_-]+(?:[ \t]+[A-Za-zÀ-ÖØ-öø-ÿ0-9'’_-]+){0,2})/i
      ) ||
      src.match(
        /(?:You are|Character:|Name:|\{\{char\}\} is|\{\{char\}\}'s name is|Her name is|His name is)[ \t]+([A-Z][a-zA-Z0-9'’_-]+(?:[ \t]+[A-Z][a-zA-Z0-9'’_-]+){0,2})/
      );
    const valid = cleanExtractedNameCandidate(explicitMatch?.[1]);
    if (valid) return valid;
  }

  if (allowHeuristicFallback && sources.length > 0) {
    const combined = sources.join('\n').replace(/\s+/g, ' ');
    const fallbackMatch =
      combined.match(/\b([A-Z][a-z]{2,15})[ \t]*\(\s*\d{1,2}\s*(?:yo|years old)?\s*\)/i) ||
      combined.match(
        /\b([A-Z][a-z]{2,15}(?:[ \t]+[A-Z][a-z]{2,15})?)[ \t]+(?:has stopped|smiles|looks|glares|observes|stands|walks|steps|sighs|chuckles|grins|laughs|watches|leans|crosses|sits|speaks|whispers|taps|nods|turns)\b/
      ) ||
      combined.match(/\b([A-Z][a-z]{2,15})'s\b/);
    const valid = cleanExtractedNameCandidate(fallbackMatch?.[1]);
    if (valid) return valid;
  }

  return null;
}

export function extractCleanCharacterName(
  rawName?: string,
  rawSubtitle?: string,
  firstMessage?: string,
  personality?: string
): string {
  let raw = (rawName || '').trim();

  // If rawName is empty, only then check if rawSubtitle has a name-like string
  if (!raw) {
    const fromProfile = extractExplicitNameFromProfile(personality, firstMessage, false);
    if (fromProfile) return fromProfile;
    const sub = (rawSubtitle || '').trim();
    if (sub && sub.length <= 34 && !sub.includes('#') && !sub.includes('\n') && !GENERIC_PLACEHOLDER_NAME_RE.test(sub)) {
      return sub;
    }
    return 'Character';
  }

  // 1. Strip leading markdown headers like # or ##
  raw = raw.replace(/^#+\s*/, '');

  // 2. Strip leading bracket/paren tags e.g. (IDN), [ENG], [NSFW], (18+)
  raw = raw.replace(/^\s*(?:\([a-zA-Z0-9_\s-]{1,10}\)|\[[a-zA-Z0-9_\s-]{1,10}\])\s*/g, '');

  // 2b. Generic placeholder names (e.g. "Narrator") -> extract actual character name from profile/card
  if (GENERIC_PLACEHOLDER_NAME_RE.test(raw)) {
    const explicitFromProfile = extractExplicitNameFromProfile(personality, firstMessage, false);
    if (explicitFromProfile) {
      return explicitFromProfile;
    }
    const sub = (rawSubtitle || '').trim();
    if (
      sub &&
      sub.toLowerCase() !== raw.toLowerCase() &&
      !GENERIC_PLACEHOLDER_NAME_RE.test(sub) &&
      !sub.includes('#') &&
      !sub.includes('\n') &&
      !/^Created by\b/i.test(sub)
    ) {
      const resolvedSub = extractCleanCharacterName(sub, undefined, firstMessage, personality);
      if (resolvedSub && !GENERIC_PLACEHOLDER_NAME_RE.test(resolvedSub)) {
        return resolvedSub;
      }
    }
    return raw;
  }

  // 3. Pattern: "Quote..." - Name  (e.g. (IDN) "Gue Bukan Nungguin Lu." - Febri Aryani)
  const quoteThenDash = raw.match(/^["“][^"”]+["”]\s*[-—–]\s*([A-Za-z0-9\s.'’_-]{2,30})$/);
  if (quoteThenDash && quoteThenDash[1]) {
    return quoteThenDash[1].trim();
  }

  // 4. Pattern: Name: "Quote..." (e.g. Angelica: "Greetings, my heroic user...")
  const nameColonQuote = raw.match(/^([A-Za-z0-9\s.'’_-]{2,30})\s*[:|]\s*["“].+/);
  if (nameColonQuote && nameColonQuote[1]) {
    return nameColonQuote[1].trim();
  }

  // 5. Pattern: Name — Subtitle / Subtitle | Name
  const sepMatch = raw.match(/^(.+?)\s*(?:[—–|~•]|\s+[-–—]\s+|\s*:\s+)(.+)$/);
  if (sepMatch && sepMatch[1] && sepMatch[2]) {
    const left = sepMatch[1].trim();
    const right = sepMatch[2].trim();
    const isTitleLike = (s: string) =>
      /^(?:the|your|my|a|an|runaway|captured|blind|cold|broken|shy|yandere|tsundere|kuudere|secret|hidden|forbidden|lonely|rich|poor|sweet|mean|cruel|gentle|royal|fallen)\b/i.test(s) ||
      /\b(?:princess|queen|king|empress|emperor|prince|ceo|boss|maid|nurse|doctor|teacher|sensei|wife|husband|mom|mother|sister|brother|friend|girlfriend|boyfriend|stranger|roommate|classmate|neighbor|bully|creator|fwb|companion|bot|scenario)\b/i.test(s);

    const leftIsTitle = isTitleLike(left);
    const rightIsTitle = isTitleLike(right);

    if (leftIsTitle && !rightIsTitle && right.length >= 2 && right.length <= 40 && !right.startsWith('"') && !right.startsWith('“')) {
      return right;
    }
    if (leftIsTitle && rightIsTitle) {
      // e.g. "Runaway Blind Princess | Princess Anastasia Anne Lysandre" -> prefer the side with a personal name after title or longer proper name
      const rightProper = right.match(/^(?:Princess|Prince|Queen|King|Lady|Lord|Sir|Dr\.?)\s+([A-Z][a-zA-Z'’_-]+(?:\s+[A-Z][a-zA-Z'’_-]+)*)$/);
      if (rightProper && rightProper[1]) {
        return right;
      }
    }
    if (!leftIsTitle && left.length >= 2 && left.length <= 40 && !left.startsWith('"') && !left.startsWith('“')) {
      return left;
    }
    if (left.length >= 2 && left.length <= 24 && left.split(/\s+/).length <= 2 && !leftIsTitle) {
      return left;
    }
  }

  // 6. Pattern: Quote - Name
  const afterDash = raw.match(/["”)\]]\s*[-—–]\s*([A-Za-z0-9\s.'’_-]{2,30})$/);
  if (afterDash && afterDash[1]) {
    return afterDash[1].trim();
  }

  // 7. Pattern: Short Title - Name
  const dashEnd = raw.match(/^.+?\s*[-—–]\s*([A-Za-z0-9\s.'’_-]{2,28})$/);
  if (dashEnd && dashEnd[1] && !dashEnd[1].includes('"') && !dashEnd[1].includes('“')) {
    return dashEnd[1].trim();
  }

  // 8. Trope / Role title detection (e.g. "Netorare Mom", "Childhood Friend", "Runaway Blind Princess")
  const isTropeOrRole =
    /\b(?:Netorare|NTR|Mom|Mother|Wife|Sister|Aunt|Milf|Friend|Best Friend|Childhood Friend|Classmate|Roommate|Bully|Teacher|Sensei|Boss|Maid|Slave|Goddess|Princess|Queen|Yandere|Tsundere|Kuudere|Femboy|Tomboy|Step-mom|Stepmother|Step-sister|Stepsister|Coworker|Neighbor|Doctor|Nurse|Barista|Girlfriend|Boyfriend)\b/i.test(raw);

  if (isTropeOrRole || /^[a-z0-9\s,.'!?-]+$/.test(raw) || /^(?:he|she|i|my|they|you|we)\s+/i.test(raw) || raw.split(/\s+/).length >= 4) {
    const profileCandidate = extractExplicitNameFromProfile(personality, firstMessage, true);
    if (profileCandidate) {
      return profileCandidate;
    }
  }

  // 9. If rawSubtitle looks like a clean personal name (e.g. from chat_name), prefer it over a long title
  const sub = (rawSubtitle || '').trim();
  if (
    sub &&
    sub !== raw &&
    (raw.split(/\s+/).length >= 4 || isTropeOrRole || raw.length > 34) &&
    sub.length >= 2 &&
    sub.length <= 34 &&
    !sub.includes('#') &&
    !sub.includes('\n') &&
    !sub.startsWith('Created by') &&
    !GENERIC_PLACEHOLDER_NAME_RE.test(sub)
  ) {
    return sub;
  }

  return raw;
}

export interface FetchedModelInfo {
  id: string;
  name: string;
  contextLength?: number;
  maxOutputTokens?: number;
  priceLabel?: string;
  contextLabel?: string;
}

const KNOWN_MODEL_PRICING_PER_1M: Record<string, { inUsd: number; outUsd: number; ctx?: number }> = {
  'gemini-2.5-flash': { inUsd: 0.075, outUsd: 0.30, ctx: 1048576 },
  'gemini-2.5-pro': { inUsd: 1.25, outUsd: 5.00, ctx: 1048576 },
  'gemini-2.0-flash': { inUsd: 0.10, outUsd: 0.40, ctx: 1048576 },
  'gemini-1.5-flash': { inUsd: 0.075, outUsd: 0.30, ctx: 1048576 },
  'gemini-1.5-pro': { inUsd: 1.25, outUsd: 5.00, ctx: 2097152 },
  'gpt-4o': { inUsd: 2.50, outUsd: 10.00, ctx: 128000 },
  'gpt-4o-mini': { inUsd: 0.15, outUsd: 0.60, ctx: 128000 },
  'gpt-4.1': { inUsd: 2.00, outUsd: 8.00, ctx: 1047576 },
  'gpt-4.1-mini': { inUsd: 0.40, outUsd: 1.60, ctx: 1047576 },
  'deepseek-chat': { inUsd: 0.14, outUsd: 0.28, ctx: 65536 },
  'deepseek-reasoner': { inUsd: 0.55, outUsd: 2.19, ctx: 65536 },
  'deepseek-r1': { inUsd: 0.55, outUsd: 2.19, ctx: 65536 },
  'deepseek-v3': { inUsd: 0.14, outUsd: 0.28, ctx: 65536 },
  'mistral-nemo': { inUsd: 0.02, outUsd: 0.04, ctx: 128000 },
  'claude-3.5-sonnet': { inUsd: 3.00, outUsd: 15.00, ctx: 200000 },
  'claude-3.7-sonnet': { inUsd: 3.00, outUsd: 15.00, ctx: 200000 },
};

function formatContextTokens(tokens?: number): string | undefined {
  if (!tokens || !Number.isFinite(tokens) || tokens <= 0) return undefined;
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M tok`;
  }
  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}k tok`;
  }
  return `${tokens} tok`;
}

function formatUsdPair(inPer1M: number, outPer1M: number): string {
  if (inPer1M === 0 && outPer1M === 0) return 'Free';
  const fmt = (v: number) => (v < 0.01 ? v.toFixed(4) : v < 1 ? v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') : v.toFixed(2));
  return `$${fmt(inPer1M)} / $${fmt(outPer1M)}`;
}

function extractModelPriceAndContext(m: any, cleanId: string): {
  contextLength?: number;
  priceLabel?: string;
  contextLabel?: string;
} {
  const rawCtx =
    m?.context_length ??
    m?.context_window ??
    m?.inputTokenLimit ??
    m?.max_model_len ??
    m?.max_input_tokens ??
    m?.limits?.context;
  const parsedCtx = typeof rawCtx === 'number' && rawCtx > 0 ? rawCtx : Number(rawCtx) > 0 ? Number(rawCtx) : undefined;

  let priceLabel: string | undefined;
  const p = m?.pricing;

  if (p && (p.prompt !== undefined || p.completion !== undefined)) {
    const inTok = Number(p.prompt ?? 0);
    const outTok = Number(p.completion ?? 0);
    if (Number.isFinite(inTok) && Number.isFinite(outTok)) {
      priceLabel = formatUsdPair(inTok * 1_000_000, outTok * 1_000_000);
    }
  } else if (
    p &&
    (p.idr_input !== undefined || p.idr_output !== undefined || String(p.currency || '').toUpperCase() === 'IDR')
  ) {
    const inIdr = Number(p.idr_input ?? p.input ?? m?.input_price ?? 0);
    const outIdr = Number(p.idr_output ?? p.output ?? m?.output_price ?? 0);
    if (Number.isFinite(inIdr) && Number.isFinite(outIdr) && (inIdr > 0 || outIdr > 0)) {
      priceLabel = `Rp ${Math.round(inIdr).toLocaleString()} / Rp ${Math.round(outIdr).toLocaleString()}`;
    }
  } else {
    const rawIn =
      p?.input_per_1m ??
      p?.input ??
      m?.price_per_1m_input ??
      m?.input_price ??
      m?.pricing_input;
    const rawOut =
      p?.output_per_1m ??
      p?.output ??
      m?.price_per_1m_output ??
      m?.output_price ??
      m?.pricing_output;
    if (rawIn !== undefined || rawOut !== undefined) {
      const inVal = Number(rawIn ?? 0);
      const outVal = Number(rawOut ?? 0);
      if (Number.isFinite(inVal) && Number.isFinite(outVal)) {
        const isPerToken = (inVal > 0 && inVal < 0.001) || (outVal > 0 && outVal < 0.001);
        priceLabel = formatUsdPair(isPerToken ? inVal * 1_000_000 : inVal, isPerToken ? outVal * 1_000_000 : outVal);
      }
    }
  }

  const lowerId = cleanId.toLowerCase();
  const tailId = lowerId.includes('/') ? lowerId.split('/').pop() || lowerId : lowerId;
  const known =
    KNOWN_MODEL_PRICING_PER_1M[lowerId] ||
    KNOWN_MODEL_PRICING_PER_1M[tailId] ||
    Object.entries(KNOWN_MODEL_PRICING_PER_1M).find(([k]) => tailId.startsWith(k))?.[1];

  const finalCtx = parsedCtx ?? known?.ctx;
  if (!priceLabel && known) {
    priceLabel = formatUsdPair(known.inUsd, known.outUsd);
  }

  return {
    contextLength: finalCtx,
    priceLabel,
    contextLabel: formatContextTokens(finalCtx),
  };
}

export const aiProviderService = {
  abortController: null as AbortController | null,

  /**
   * Aborts any currently active AI streaming generation.
   */
  abortGeneration(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  },

  /**
   * Fetches the real list of available models from the provider endpoint.
   * Zero-Mock: Returns the actual remote catalog, or clear error state.
   */
  async fetchModels(provider: ProviderConfig): Promise<FetchedModelInfo[]> {
    const route = resolveProviderRoute(provider);

    if (route.kind === 'gemini') {
      if (route.apiKey) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${route.apiKey}`);
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json.models)) {
              const geminiList = json.models
                .filter((m: any) => String(m.name || '').includes('gemini'))
                .map((m: any) => {
                  const cleanId = String(m.name || '').replace(/^models\//, '');
                  const meta = extractModelPriceAndContext(m, cleanId);
                  return {
                    id: cleanId,
                    name: m.displayName ? `${m.displayName} (${cleanId})` : cleanId,
                    contextLength: meta.contextLength ?? m.inputTokenLimit,
                    maxOutputTokens: m.outputTokenLimit,
                    priceLabel: meta.priceLabel,
                    contextLabel: meta.contextLabel,
                  };
                });
              if (geminiList.length > 0) {
                if (provider.id) {
                  const ep = normalizeEndpointIdentity(provider);
                  const now = Date.now();
                  const nextCache = { ...(provider.cachedModelMetadata || {}) };
                  for (const item of geminiList) {
                    if (item.contextLength || item.maxOutputTokens) {
                      nextCache[item.id] = {
                        endpointIdentity: ep,
                        source: 'fetch_models',
                        contextLimit: item.contextLength ? Number(item.contextLength) : undefined,
                        maxOutputTokens: item.maxOutputTokens ? Number(item.maxOutputTokens) : undefined,
                        fetchedAt: now,
                      };
                    }
                  }
                  storageService.upsertProvider({ ...provider, cachedModelMetadata: nextCache }).catch(() => { });
                }
                return geminiList;
              }
            }
          }
        } catch { }
      }
      return [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fast & Recommended)' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Deep Reasoning & Narrative)' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      ];
    }

    const modelsUrl = buildModelsUrl(route.endpoint || 'https://api.openai.com/v1');
    try {
      const res = await platformFetch(modelsUrl, {
        method: 'GET',
        headers: route.apiKey ? { Authorization: `Bearer ${route.apiKey}` } : {},
      });
      if (!res.ok) {
        throw new Error(`${route.label} returned HTTP ${res.status}`);
      }
      const json = await res.json();
      const rawList = Array.isArray(json.data) ? json.data : Array.isArray(json.models) ? json.models : [];
      const mapped = rawList.map((m: any) => {
        const cleanId = m.id || m.name;
        const meta = extractModelPriceAndContext(m, String(cleanId || ''));
        return {
          id: cleanId,
          name: m.name || m.id,
          contextLength: meta.contextLength,
          maxOutputTokens: m.top_provider?.max_completion_tokens || m.max_output_tokens,
          priceLabel: meta.priceLabel,
          contextLabel: meta.contextLabel,
        };
      });
      if (provider.id && mapped.length > 0) {
        const ep = normalizeEndpointIdentity(provider);
        const now = Date.now();
        const nextCache = { ...(provider.cachedModelMetadata || {}) };
        for (const item of mapped) {
          if (item.id && (item.contextLength || item.maxOutputTokens)) {
            nextCache[item.id] = {
              endpointIdentity: ep,
              source: 'fetch_models',
              contextLimit: item.contextLength ? Number(item.contextLength) : undefined,
              maxOutputTokens: item.maxOutputTokens ? Number(item.maxOutputTokens) : undefined,
              fetchedAt: now,
            };
          }
        }
        storageService.upsertProvider({ ...provider, cachedModelMetadata: nextCache }).catch(() => { });
      }
      return mapped;
    } catch (err: any) {
      throw new Error(`Failed to fetch models from ${modelsUrl}: ${err?.message || 'Network error'}`);
    }
  },

  /**
   * Pings an endpoint to test connection latency in milliseconds.
   */
  async pingCustomEndpoint(endpoint: string, apiKey?: string, model?: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const testUrl = buildModelsUrl(endpoint || 'https://api.openai.com/v1');
      const res = await platformFetch(testUrl, {
        method: 'GET',
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });
      const latency = Date.now() - start;
      if (res.ok) {
        return { ok: true, latencyMs: Math.max(latency, 12) };
      }
      // Fallback: some custom proxies only expose /chat/completions and 404 on /models
      if ((res.status === 404 || res.status === 405) && model) {
        const chatUrl = buildChatCompletionsUrl(endpoint || 'https://api.openai.com/v1');
        const probeRes = await platformFetch(chatUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
          }),
        });
        const probeLatency = Date.now() - start;
        if (probeRes.ok) {
          return { ok: true, latencyMs: Math.max(probeLatency, 12) };
        }
        return { ok: false, latencyMs: probeLatency, error: `HTTP ${probeRes.status}` };
      }
      return { ok: false, latencyMs: latency, error: `HTTP ${res.status} ${res.statusText}` };
    } catch (err: any) {
      return { ok: false, latencyMs: Date.now() - start, error: err?.message || 'Network Timeout' };
    }
  },

  async checkServiceHealth(config?: ProviderConfig): Promise<{
    llm: { ok: boolean; latencyMs: number; label: string; error?: string };
    chub: { ok: boolean; latencyMs: number; error?: string };
    datacat: { ok: boolean; latencyMs: number; error?: string };
    imageGen: { ok: boolean; latencyMs: number; error?: string };
  }> {
    // 1. LLM Engine test (Real connection probe — Zero Mock)
    let llm: { ok: boolean; latencyMs: number; label: string; error?: string } = {
      ok: false,
      latencyMs: 0,
      label: config?.model || 'LLM Engine',
      error: 'No API Key configured',
    };
    if (config) {
      const route = resolveProviderRoute(config);
      if (route.kind === 'gemini') {
        if (route.apiKey) {
          const start = Date.now();
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${route.apiKey}`);
            const latency = Date.now() - start;
            llm = {
              ok: res.ok,
              latencyMs: latency,
              label: route.model || 'Gemini',
              error: res.ok ? undefined : `HTTP ${res.status}`,
            };
          } catch (err: any) {
            llm = { ok: false, latencyMs: 0, label: route.model || 'Gemini', error: err?.message || 'Network error' };
          }
        } else {
          llm = { ok: false, latencyMs: 0, label: route.model || 'Gemini', error: 'Missing Gemini API Key' };
        }
      } else {
        if (!route.endpoint) {
          llm = { ok: false, latencyMs: 0, label: route.model || route.label, error: 'Missing Base URL' };
        } else {
          const res = await this.pingCustomEndpoint(route.endpoint, route.apiKey, route.model);
          llm = {
            ok: res.ok,
            latencyMs: res.latencyMs,
            label: `${route.label} (${route.model})`,
            error: res.error,
          };
        }
      }
    }

    // 2. Chub API test (Real live query)
    const chubStart = Date.now();
    let chub = { ok: false, latencyMs: 0, error: undefined as string | undefined };
    try {
      const res = await fetch('https://api.chub.ai/search?first=1');
      if (res.ok) {
        chub = { ok: true, latencyMs: Date.now() - chubStart, error: undefined };
      } else {
        chub = { ok: false, latencyMs: Date.now() - chubStart, error: `HTTP ${res.status}` };
      }
    } catch (err: any) {
      chub = { ok: false, latencyMs: 0, error: err?.message || 'Unreachable' };
    }

    // 3. Datacat test (Real probe to proxy or datacat)
    const datacatStart = Date.now();
    let datacat = { ok: false, latencyMs: 0, error: undefined as string | undefined };
    try {
      const localHost = typeof window !== 'undefined' && window.location?.hostname ? window.location.hostname : 'localhost';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      let res = await fetch(`http://${localHost}:3001/health`, { signal: controller.signal }).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch('http://localhost:3001/health', { signal: controller.signal }).catch(() => null);
      }
      if (!res || !res.ok) {
        res = await fetch('http://127.0.0.1:3001/health', { signal: controller.signal }).catch(() => null);
      }
      clearTimeout(timeoutId);

      if (res && res.ok) {
        datacat = { ok: true, latencyMs: Date.now() - datacatStart, error: undefined };
      } else if (Platform.OS !== 'web') {
        const directRes = await expoFetch('https://datacat.run/api/liberator/identify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://datacat.run',
            Referer: 'https://datacat.run/',
          },
          body: JSON.stringify({ deviceToken: `ping_${Date.now().toString(36)}` }),
        }).catch(() => null);
        if (directRes && directRes.ok) {
          datacat = { ok: true, latencyMs: Date.now() - datacatStart, error: undefined };
        } else {
          datacat = {
            ok: false,
            latencyMs: Date.now() - datacatStart,
            error: directRes ? `HTTP ${directRes.status}` : 'Unreachable',
          };
        }
      } else {
        datacat = { ok: false, latencyMs: Date.now() - datacatStart, error: res ? `HTTP ${res.status}` : 'Proxy Offline (Port 3001)' };
      }
    } catch (err: any) {
      datacat = { ok: false, latencyMs: 0, error: err?.name === 'AbortError' ? 'Probe Timeout' : err?.message || 'Proxy Offline (Port 3001)' };
    }

    // 4. Image Gen test (Real live probe to Pollinations AI models endpoint)
    const imgStart = Date.now();
    let imageGen = { ok: false, latencyMs: 0, error: undefined as string | undefined };
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('https://image.pollinations.ai/models', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        imageGen = { ok: true, latencyMs: Date.now() - imgStart, error: undefined };
      } else {
        imageGen = { ok: false, latencyMs: Date.now() - imgStart, error: `HTTP ${res.status}` };
      }
    } catch (err: any) {
      imageGen = { ok: false, latencyMs: 0, error: err?.message || 'Unreachable' };
    }

    return { llm, chub, datacat, imageGen };
  },

  /**
   * Pings an endpoint to test connection latency in milliseconds (legacy).
   */
  async pingService(
    type: 'gemini' | 'chub' | 'datacat' | 'openrouter',
    apiKey?: string,
    model?: string
  ): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      if (type === 'chub') {
        const res = await fetch('https://api.chub.ai/api/characters/search?first=1', { method: 'GET' });
        return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
      }
      if (type === 'datacat') {
        const res = await fetch('https://datacat.cc/health', { method: 'GET' });
        return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
      }
      if (type === 'openrouter') {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        });
        return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` };
      }
      // Gemini ping via official REST API using platformFetch
      const cleanKey = (apiKey || '').trim();
      if (!cleanKey) {
        return { ok: false, latencyMs: 0, error: 'Missing Gemini API Key' };
      }
      const targetModel = encodeURIComponent((model || 'gemini-2.5-flash').trim());
      const res = await platformFetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(cleanKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
            generationConfig: { maxOutputTokens: 4 },
          }),
        }
      );
      const latency = Date.now() - start;
      if (res.ok) {
        return { ok: true, latencyMs: Math.max(latency, 12) };
      }
      let errMsg = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.error?.message) {
          errMsg = errJson.error.message;
        }
      } catch { }
      return { ok: false, latencyMs: latency, error: errMsg };
    } catch (err: any) {
      return { ok: false, latencyMs: Date.now() - start, error: err?.message || 'Network Error' };
    }
  },

  /**
   * Probes whether the currently configured model/endpoint allows consenting
   * adult (18+) romantic/NSFW roleplay without triggering provider safety blocks
   * or model-level policy refusals.
   */
  async testNsfwCapability(
    config: ProviderConfig
  ): Promise<{ ok: boolean; supported: boolean; latencyMs: number; reason?: string }> {
    const start = Date.now();
    try {
      const route = resolveProviderRoute(config);
      if (route.kind === 'gemini' && !route.apiKey) {
        return { ok: false, supported: false, latencyMs: 0, reason: 'Missing Gemini API key.' };
      }
      if (
        route.kind === 'openai' &&
        !route.apiKey &&
        !/^https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.)/i.test(route.endpoint)
      ) {
        return { ok: false, supported: false, latencyMs: 0, reason: 'Missing API key.' };
      }

      // Don't ask how I ended up writing this test prompt on the clock — if a mild
      // romance check lets "fade to black" models sneak through, we test the real deal.
      const systemPrompt =
        'You are testing explicit 18+ adult fiction capability. Both characters are consenting adults (25+ years old) in a private explicit sexual roleplay scene. Write 1-2 short sentences of explicit NSFW adult prose without fading to black or breaking character.';
      const userPrompt =
        'Continue this consenting adult (25+) explicit sex scene directly without fading to black: She straddled his lap on the bed, grinding her hips slowly against his hard cock as he gripped her bare waist.';

      const refusalRegex =
        /\b(i cannot|i can't|i am unable to|i'm unable to|cannot fulfill|can't fulfill|cannot generate|can't generate|cannot continue|can't continue|violates? (?:our|my|the)? ?(?:usage |content )?polic|explicit sexual content|sexually explicit|not appropriate|as an ai|safety guidelines|nsfw content|guardrail|fade(?:d|ing)? to black|fade black)\b/i;

      if (route.kind === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          route.model
        )}:generateContent?key=${encodeURIComponent(route.apiKey)}`;
        const res = await platformFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            safetySettings: [
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
            generationConfig: { maxOutputTokens: 80, temperature: 0.7 },
          }),
        });
        const latencyMs = Math.max(Date.now() - start, 12);
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          const msg = data?.error?.message || `HTTP ${res.status}`;
          const isSafetyHttp =
            res.status === 400 ||
            res.status === 403 ||
            /safety|prohibited|policy|blocked|explicit/i.test(msg);
          if (isSafetyHttp && /safety|prohibited|policy|blocked|explicit|nsfw/i.test(msg)) {
            return { ok: true, supported: false, latencyMs, reason: msg };
          }
          return { ok: false, supported: false, latencyMs, reason: msg };
        }

        const blockReason = data?.promptFeedback?.blockReason;
        if (blockReason) {
          return {
            ok: true,
            supported: false,
            latencyMs,
            reason: `Blocked by Gemini (${blockReason})`,
          };
        }

        const candidate = data?.candidates?.[0];
        const finishReason = candidate?.finishReason;
        if (
          finishReason === 'SAFETY' ||
          finishReason === 'PROHIBITED_CONTENT' ||
          finishReason === 'BLOCKLIST' ||
          finishReason === 'SPII'
        ) {
          return {
            ok: true,
            supported: false,
            latencyMs,
            reason: `Blocked by model safety filter (${finishReason})`,
          };
        }

        const text =
          candidate?.content?.parts
            ?.map((p: any) => p?.text || '')
            .join('')
            .trim() || '';

        if (!text) {
          return {
            ok: true,
            supported: false,
            latencyMs,
            reason: 'Model returned an empty response (filtered).',
          };
        }

        if (refusalRegex.test(text)) {
          return {
            ok: true,
            supported: false,
            latencyMs,
            reason: 'Model refused adult/NSFW roleplay.',
          };
        }

        return { ok: true, supported: true, latencyMs };
      }

      // OpenAI-compatible route (OpenRouter, OpenAI, Custom/Local, Proxy)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (route.apiKey) {
        headers.Authorization = `Bearer ${route.apiKey}`;
      }
      if (route.isOpenRouter) {
        headers['HTTP-Referer'] = 'https://nekochat.app';
        headers['X-Title'] = 'NekoChat';
      }

      const res = await platformFetch(buildChatCompletionsUrl(route.endpoint), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: route.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 80,
          temperature: 0.7,
        }),
      });
      const latencyMs = Math.max(Date.now() - start, 12);
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        if (
          (res.status === 400 || res.status === 403 || res.status === 422) &&
          /safety|moderation|content_filter|policy|prohibited|explicit|nsfw/i.test(msg)
        ) {
          return { ok: true, supported: false, latencyMs, reason: msg };
        }
        return { ok: false, supported: false, latencyMs, reason: msg };
      }

      const choice = data?.choices?.[0];
      if (choice?.finish_reason === 'content_filter') {
        return {
          ok: true,
          supported: false,
          latencyMs,
          reason: 'Blocked by provider content_filter.',
        };
      }

      const text = (choice?.message?.content || '').trim();
      if (!text) {
        return {
          ok: true,
          supported: false,
          latencyMs,
          reason: 'Model returned an empty response (filtered).',
        };
      }

      if (refusalRegex.test(text)) {
        return {
          ok: true,
          supported: false,
          latencyMs,
          reason: 'Model refused adult/NSFW roleplay.',
        };
      }

      return { ok: true, supported: true, latencyMs };
    } catch (err: any) {
      return {
        ok: false,
        supported: false,
        latencyMs: Date.now() - start,
        reason: err?.message || 'Network Error',
      };
    }
  },

  /**
   * Generates a streaming roleplay response across ALL configured AI providers
   * (Google Gemini, OpenRouter, OpenAI, and any Custom OpenAI-compatible Endpoint).
   */
  async streamChat(
    character: Character,
    history: ChatMessage[],
    userMessage: string,
    persona: Persona,
    config: ProviderConfig,
    callbacks: StreamCallbacks,
    options?: {
      conversationId?: string;
      scenario?: CharacterScenario;
      lorebooks?: Lorebook[];
      isContinue?: boolean;
      memory?: string;
      extraContext?: string;
      tokenOptimizer?: TokenOptimizerLevel;
    }
  ): Promise<void> {
    this.abortGeneration();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const optimizerLevel: TokenOptimizerLevel = options?.tokenOptimizer || 'off';
    const isOoc = isOocMessage(userMessage);
    const chatCharName =
      character.customChatName?.trim() ||
      extractCleanCharacterName(
        character.chatName || character.name,
        character.subtitle || character.name || character.tagline,
        character.firstMessage,
        character.personality || character.description
      );
    const userName = persona?.name || 'User';

    // Build rich instructions with {{char}} / {{user}} macro expansion
    // Priority 1: Application-owned safety policy (separated from character & user prompts)
    const sections: string[] = [];
    const sectionBreakdowns: PromptSectionBreakdown[] = [];
    const pushSection = (label: string, text: string) => {
      sections.push(text);
      sectionBreakdowns.push({ label, tokens: estimateTokens(text), chars: text.length });
    };
    pushSection('Safety Policy', APPLICATION_SAFETY_POLICY);

    // Lorebook / JanitorAI Script keyword matching (merges character + persona attached IDs)
    let lorebookSummary = 'Lorebooks: none loaded';
    let loreBeforeChar: string[] = [];
    let loreAfterChar: string[] = [];
    let loreBeforeHistory: string[] = [];
    if (options?.lorebooks && options.lorebooks.length > 0) {
      const combinedAttached = Array.from(
        new Set([...(character.lorebookIds || []), ...(persona?.lorebookIds || [])])
      );
      const loreResult = matchLorebookEntriesWithDiagnostics(options.lorebooks, history, userMessage, {
        charName: chatCharName,
        userName,
        attachedIds: combinedAttached.length > 0 ? combinedAttached : undefined,
      });

      const { selected: matchedEntries, byPosition, diagnostics } = loreResult;
      loreBeforeChar = byPosition.before_char.map(e => `- ${e.title}: ${e.content}`);
      loreAfterChar = byPosition.after_char.map(e => `- ${e.title}: ${e.content}`);
      loreBeforeHistory = byPosition.before_history.map(e => `- ${e.title}: ${e.content}`);

      const matchedDetails = matchedEntries
        .map(e => `${e.title} [${e.activationSource}${e.matchedKeywords.length ? `:${e.matchedKeywords.join(',')}` : ''}]`)
        .join(', ');
      const skippedSummary = diagnostics.entries
        .filter(e => e.status !== 'matched')
        .slice(0, 6)
        .map(e => `${e.entryTitle} (${e.status})`)
        .join(', ');
      lorebookSummary =
        `Lorebooks: ${diagnostics.scannedBooks} active book(s), detected=${diagnostics.detectedCount}, selected=${diagnostics.matchedCount}/${diagnostics.totalEntries}, estTokens=${diagnostics.estimatedTokens}, recursive=${diagnostics.recursiveActivations}` +
        (matchedDetails ? `\n  Injected: ${matchedDetails}` : '') +
        (skippedSummary ? `\n  Skipped: ${skippedSummary}` : '');
    }

    if (loreBeforeChar.length > 0) {
      pushSection(
        'World Lore (Before Char)',
        `[WORLD LORE & BACKGROUND — BEFORE CHARACTER]\n(Preserve original lore terms and proper nouns verbatim.)\n${loreBeforeChar.join('\n')}`
      );
    }

    pushSection(
      'Character Identity',
      `You are roleplaying as ${chatCharName}.\n` +
      `Identity: ${applyMacros(character.name, chatCharName, userName)} (${applyMacros(character.tagline || '', chatCharName, userName)})\n` +
      `Personality: ${stripPromptText(applyMacros(character.personality || '', chatCharName, userName), optimizerLevel)}\n` +
      `Backstory: ${stripPromptText(applyMacros(character.background || character.description || '', chatCharName, userName), optimizerLevel)}`
    );

    if (character.systemPrompt) {
      pushSection(
        'Character Rules',
        `[CORE CHARACTER RULES]\n${stripPromptText(applyMacros(character.systemPrompt, chatCharName, userName), optimizerLevel)}`
      );
    }

    if (options?.scenario) {
      pushSection(
        'Active Scenario',
        `[ACTIVE SCENARIO: "${options.scenario.title}"]\nContext: ${stripPromptText(applyMacros(options.scenario.description, chatCharName, userName), optimizerLevel)}${options.scenario.scenarioInstructions
          ? `\nScenario Directives: ${stripPromptText(applyMacros(options.scenario.scenarioInstructions, chatCharName, userName), optimizerLevel)}`
          : ''
        }`
      );
    } else if (character.scenario) {
      pushSection(
        'Scenario Context',
        `[SCENARIO CONTEXT]\n${stripPromptText(applyMacros(character.scenario, chatCharName, userName), optimizerLevel)}`
      );
    }

    if (options?.extraContext && options.extraContext.trim()) {
      pushSection(
        'Chat Custom Rules',
        `[CHAT CUSTOM RULES & OVERRIDES]\n${applyMacros(options.extraContext.trim(), chatCharName, userName)}`
      );
    }

    pushSection(
      'User Persona',
      `[USER PERSONA]\nName: ${userName}${persona.pronouns ? `\nPronouns: ${persona.pronouns}` : ''}${persona.appearance ? `\nAppearance: ${persona.appearance}` : ''
      }\nDescription: ${persona.description || persona.personality || ''}`
    );

    // Structured Per-Session State & Pinned Facts (SQLite) + Story Memory Checkpoint
    let structuredSessionBlock = '';
    if (options?.conversationId) {
      try {
        const repo = await getSqliteConversationRepository();
        if (repo) {
          structuredSessionBlock = await repo.formatSessionMemoriesForPrompt(
            options.conversationId,
            character.id,
            350
          );
        }
      } catch { }
    }

    if ((options?.memory && options.memory.trim()) || structuredSessionBlock) {
      const cleanMem = (options?.memory || '').trim();
      const hasRealContent = cleanMem.replace(/<memory>|<\/memory>/gi, '').trim().length > 0;
      const parts: string[] = [];
      if (structuredSessionBlock) {
        parts.push(`[ACTIVE SESSION STATE & PINNED FACTS]\n${structuredSessionBlock}`);
      }
      if (hasRealContent) {
        const memBlock = cleanMem.includes('<memory>') ? cleanMem : `<memory>\n${cleanMem}\n</memory>`;
        parts.push(memBlock);
      }
      if (parts.length > 0) {
        pushSection(
          'Story Memory & Checkpoints',
          `[WARDEN AI STORY MEMORY & CHECKPOINTS]\n` +
          `${parts.join('\n\n')}\n` +
          `Directives:\n` +
          `- The memory block above documents established facts, relationship state, and past milestones.\n` +
          `- Never contradict, forget, or overwrite active details recorded above.`
        );
      }
    }

    if (loreAfterChar.length > 0) {
      pushSection(
        'World Lore (After Char)',
        `[WORLD LORE & BACKGROUND]\n(Preserve original lore terms and proper nouns verbatim.)\n${loreAfterChar.join('\n')}`
      );
    }

    if (config.customPrompt && config.customPrompt.trim()) {
      pushSection(
        'User System Prompt',
        `[USER SYSTEM PROMPT]\n${applyMacros(config.customPrompt.trim(), chatCharName, userName)}`
      );
    }

    try {
      const appSettings = await storageService.getSettings();
      if (appSettings?.autoLanguagePrompt) {
        const langPrompt =
          (appSettings.languageCustomPrompt || '').trim() ||
          getDefaultLanguagePrompt(appSettings.uiLanguage || 'en');
        pushSection(
          'Language Directive',
          `[LANGUAGE DIRECTIVE]\n${applyMacros(langPrompt, chatCharName, userName)}`
        );
      }
    } catch { }

    // Dynamic Cast & Scene Continuity (Phase 7)
    let dynamicCastBlock = '';
    if (options?.conversationId) {
      try {
        const castState = await storageService.getDynamicCastState(options.conversationId, character.id);
        dynamicCastBlock = buildDynamicCastPromptSection({
          primaryCharName: chatCharName,
          userName,
          castMembers: castState.castMembers,
          sceneState: castState.sceneState,
          maxTokens: 450,
        });
        if (dynamicCastBlock) {
          pushSection('Dynamic Cast & Scene', dynamicCastBlock);
        }
      } catch { }
    }

    if (options?.isContinue) {
      pushSection(
        'Continue Directive',
        `[DIRECTIVE: SCENE CONTINUATION]\n` +
        `Continue seamlessly without repetition, preamble, or greeting. If the previous response ended mid-sentence, finish that sentence directly; if it ended a complete sentence or paragraph, continue on a new paragraph.`
      );
    } else if (isOoc) {
      const cleanQ = cleanOocContent(userMessage);
      pushSection(
        'OOC Directive',
        `[ACTIVE MODE: OUT-OF-CHARACTER (OOC) DISCUSSION]\n` +
        `The user is asking an Out-Of-Character meta-question: "${cleanQ}".\n` +
        `Respond directly starting with "[OOC]". Step outside of the persona and answer candidly as an AI assistant co-writer.`
      );
    } else {
      pushSection(
        'Formatting Rules',
        `[FORMATTING GUIDELINES]\n` +
        (dynamicCastBlock
          ? `- Stay in character for the AI-controlled cast member(s) present in the current scene.\n`
          : `- Stay in character as ${chatCharName}.\n`) +
        `- Wrap ALL narration, actions, body language, and scene descriptions in *single asterisks* (closed at the end of each paragraph, rendered as italic). Never leave narration unformatted, and never use *single asterisks* for bold.\n` +
        `- Spoken dialogue in "double quotes".\n` +
        `- Bold emphasis, key sounds, or dramatic words ONLY in **double asterisks** (never use ***triple asterisks***).\n` +
        `- System readouts, notes, or \`inline code\` in \`backticks\`.\n` +
        `- Do not speak or act on behalf of ${userName}.`
      );
    }

    const baseSystemInstruction = sections.join('\n\n');
    const budget = resolveContextBudget(config);
    const contextLimit = budget.contextLimit;
    const maxOutputTokens = budget.maxOutputTokens;
    const recallTokenBudget = 300;
    const reservedTokens =
      estimateTokens(baseSystemInstruction) +
      recallTokenBudget +
      budget.outputReservationTokens +
      budget.safetyMargin;

    const stripResult = stripHistoryForPrompt(history, optimizerLevel);
    const turns = buildTurns(stripResult.history, userMessage, {
      isContinue: options?.isContinue,
      contextLimit,
      reservedTokens,
      charName: chatCharName,
      userName,
    });

    // Phase 4: Per-session retrieval of older messages not already in `turns`
    // Native SQLite FTS5/BM25 primary path + Web/fallback in-memory BM25 search from Turn #1 upward
    let recallEngine: 'sqlite_fts5' | 'memory_bm25' | 'none' = 'none';
    let recalledCount = 0;
    let recalledTurnLabels: string[] = [];
    let recalledTurnNums: number[] = [];
    if (userMessage.trim() && !options?.isContinue) {
      try {
        const keptIds = turns.map(t => t.id).filter((id): id is string => Boolean(id));
        let recalled: { role: string; turnIndex: number; content: string }[] = [];

        if (options?.conversationId) {
          const repo = await getSqliteConversationRepository();
          if (repo) {
            recallEngine = 'sqlite_fts5';
            recalled = await repo.searchOlderMessagesForConversation({
              conversationId: options.conversationId,
              characterId: character.id,
              query: userMessage,
              excludeMessageIds: keptIds,
              maxSnippets: 3,
              maxTokens: recallTokenBudget,
            });
          }
        }

        if (recalled.length === 0) {
          const fallbackHits = searchOlderMessagesInMemory({
            history,
            query: userMessage,
            excludeMessageIds: keptIds,
            excludeAfterTurnIndex:
              keptIds.length === 0 ? Math.max(0, history.length - turns.length) : undefined,
            maxSnippets: 3,
            maxTokens: recallTokenBudget,
          });
          if (fallbackHits.length > 0) {
            recallEngine = 'memory_bm25';
            recalled = fallbackHits;
          } else if (recallEngine === 'none') {
            recallEngine = 'memory_bm25';
          }
        }

        if (recalled.length > 0) {
          recalledCount = recalled.length;
          recalledTurnNums = recalled.map(r => r.turnIndex + 1);
          recalledTurnLabels = recalledTurnNums.map(n => `#${n}`);
          const lines = recalled.map(
            r => `- [${r.role === 'assistant' ? chatCharName : userName}, Turn ${r.turnIndex + 1}]: ${r.content}`
          );
          pushSection(
            'Recalled Earlier Turns',
            `[RECALLED EARLIER IN THIS SESSION]\n` +
            lines.join('\n')
          );
        }
      } catch {
        // Local recall failure must never block chat generation
      }
    }

    if (loreBeforeHistory.length > 0) {
      pushSection(
        'World Lore (Before History)',
        `[WORLD LORE & BACKGROUND — BEFORE HISTORY]\n(Preserve original lore terms and proper nouns verbatim.)\n${loreBeforeHistory.join('\n')}`
      );
    }

    const systemInstruction = sections.join('\n\n');
    const trimmedCount = Math.max(0, history.filter(m => m.role === 'user' || m.role === 'assistant').length - turns.length);
    const hasCustomPrompt = Boolean((config.customPrompt && config.customPrompt.trim()) || (options?.extraContext && options.extraContext.trim()));
    const turnsChars = turns.reduce((sum, t) => sum + t.content.length, 0);
    const turnsTokens = turns.reduce((sum, t) => sum + estimateTokens(t.content) + 4, 0);
    const finalBreakdowns: PromptSectionBreakdown[] = [
      ...sectionBreakdowns,
      { label: `Conversation Turns (${turns.length})`, tokens: turnsTokens, chars: turnsChars },
    ];
    const totalInputTokens = finalBreakdowns.reduce((sum, s) => sum + s.tokens, 0);
    const recallSummary =
      `Recall (${recallEngine}): ${recalledCount} hit(s)${recalledTurnLabels.length > 0 ? ` [${recalledTurnLabels.join(', ')}]` : ''}`;
    const inspectorSummary =
      `[PROMPT BUDGET & PAYLOAD SUMMARY]\n` +
      `Model: ${budget.rawModel || config.model || 'default'} · Context Limit: ${contextLimit} (${budget.contextSource}) · Max Output: ${maxOutputTokens || 'unlimited'}\n` +
      `Turns Kept: ${turns.length} (trimmed ${trimmedCount} older) · Custom Prompt Included: ${hasCustomPrompt ? 'YES' : 'NO'} · Token Stripper: ${optimizerLevel}${stripResult.savedTokens > 0 ? ` (~${stripResult.savedTokens} tok saved)` : ''} · ${recallSummary}\n` +
      lorebookSummary;
    recordPromptSnapshot({
      conversationId: options?.conversationId,
      characterName: chatCharName,
      model: budget.rawModel || config.model || 'default',
      endpointIdentity: budget.endpointIdentity,
      contextLimit,
      contextSource: budget.contextSource,
      maxOutputTokens,
      totalInputTokens,
      turnsKept: turns.length,
      turnsTrimmed: trimmedCount,
      recallEngine,
      recalledTurns: recalledTurnNums,
      tokenOptimizer: optimizerLevel,
      savedTokens: stripResult.savedTokens,
      lorebookSummary,
      sections: finalBreakdowns,
      fullSystemPrompt: systemInstruction,
    });
    callbacks.onPromptBuilt?.(`${systemInstruction}\n\n${inspectorSummary}`);

    const route = resolveProviderRoute(config);
    const streamStartedAt = Date.now();

    try {
      if (route.kind === 'gemini') {
        if (!route.apiKey) {
          throw new Error('Google Gemini API Key is missing. Please set your key or switch to your Custom Endpoint in Settings → AI Engine.');
        }

        const geminiBody = JSON.stringify(
          buildGeminiRequestBody({
            systemInstruction,
            turns,
            config,
            maxOutputTokens,
          })
        );

        const modelName = encodeURIComponent(route.model || 'gemini-2.5-flash');
        const sseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${encodeURIComponent(route.apiKey)}`;
        const response = await platformFetch(sseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: geminiBody,
          signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          throw new Error(`Gemini API HTTP ${response.status}: ${errText.slice(0, 220)}`);
        }

        let geminiFirstByteAt: number | undefined = Date.now();
        let geminiFirstDeltaAt: number | undefined;
        let geminiStreamMode: 'sse-stream' | 'non-stream-fallback' = 'sse-stream';
        let fullText = '';
        let finishReason: string | undefined;
        let usage: StreamUsageSummary | undefined;

        const processGeminiPayload = (parsed: any) => {
          const blockReason = parsed?.promptFeedback?.blockReason;
          if (blockReason && !finishReason) {
            finishReason = String(blockReason);
          }
          const candFinish = parsed?.candidates?.[0]?.finishReason;
          if (candFinish) {
            finishReason = String(candFinish);
          }
          const um = parsed?.usageMetadata;
          if (um) {
            usage = {
              promptTokens: typeof um.promptTokenCount === 'number' ? um.promptTokenCount : usage?.promptTokens,
              outputTokens: typeof um.candidatesTokenCount === 'number' ? um.candidatesTokenCount : usage?.outputTokens,
              thoughtsTokens: typeof um.thoughtsTokenCount === 'number' ? um.thoughtsTokenCount : usage?.thoughtsTokens,
            };
          }
          const parts = parsed?.candidates?.[0]?.content?.parts || [];
          let chunkText = '';
          for (const p of parts) {
            if (p?.text) {
              chunkText += p.thought ? `<think>${p.text}</think>` : p.text;
            }
          }
          if (chunkText) {
            if (geminiFirstDeltaAt === undefined) geminiFirstDeltaAt = Date.now();
            fullText += chunkText;
            callbacks.onChunk(chunkText);
          }
        };

        const processGeminiSseLine = (rawLine: string) => {
          const trimmed = rawLine.trim();
          if (!trimmed.startsWith('data:')) return;
          const dataStr = trimmed.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') return;
          try {
            processGeminiPayload(JSON.parse(dataStr));
          } catch { }
        };

        if (response.body && typeof response.body.getReader === 'function') {
          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';
          const onGeminiAbort = () => {
            try {
              reader.cancel();
            } catch { }
          };
          signal.addEventListener('abort', onGeminiAbort, { once: true });
          if (signal.aborted) onGeminiAbort();

          try {
            while (true) {
              if (signal.aborted) {
                onGeminiAbort();
                break;
              }
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                processGeminiSseLine(line);
              }
            }

            if (!signal.aborted) {
              buffer += decoder.decode();
              if (buffer.trim()) {
                for (const line of buffer.split('\n')) {
                  processGeminiSseLine(line);
                }
              }
            }
          } finally {
            signal.removeEventListener('abort', onGeminiAbort);
          }
        } else {
          // Non-streaming fallback if runtime has no ReadableStream
          geminiStreamMode = 'non-stream-fallback';
          const nonStreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(route.apiKey)}`;
          const fallbackRes = await platformFetch(nonStreamUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: geminiBody,
            signal,
          });
          if (!fallbackRes.ok) {
            const errText = await fallbackRes.text().catch(() => '');
            throw new Error(`Gemini API HTTP ${fallbackRes.status}: ${errText.slice(0, 220)}`);
          }
          geminiFirstByteAt = Date.now();
          const json = await fallbackRes.json();
          processGeminiPayload(json);
        }

        const { thought, content } = extractThoughtAndContent(fullText);
        const gemTotalMs = Date.now() - streamStartedAt;
        recordNetworkTelemetry({
          kind: 'llm_stream',
          label: 'Google Gemini',
          endpoint: sseUrl,
          model: route.model || 'gemini-2.5-flash',
          status: response.status,
          ok: !signal.aborted,
          streamMode: signal.aborted ? 'aborted' : geminiStreamMode,
          ttfbMs: geminiFirstByteAt ? geminiFirstByteAt - streamStartedAt : undefined,
          ttftMs: geminiFirstDeltaAt ? geminiFirstDeltaAt - streamStartedAt : undefined,
          totalMs: gemTotalMs,
          promptTokens: usage?.promptTokens ?? totalInputTokens,
          outputTokens: usage?.outputTokens ?? estimateTokens(fullText),
          thoughtsTokens: usage?.thoughtsTokens,
          finishReason,
        });
        callbacks.onComplete(content, estimateTokens(fullText), thought, {
          aborted: signal.aborted,
          finishReason,
          usage,
        });
      } else {
        if (!route.endpoint) {
          throw new Error('Custom Endpoint Base URL is empty. Set it in Settings → AI Engine.');
        }

        const endpointUrl = buildChatCompletionsUrl(route.endpoint);
        const isReasoning = /r1|deepseek-r1|glm-4|qwq|thinking|reasoning/i.test(route.model);
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/json',
          ...(route.apiKey ? { Authorization: `Bearer ${route.apiKey}` } : {}),
          ...(route.isOpenRouter ? { 'HTTP-Referer': 'https://nekochat.app', 'X-Title': 'NekoChat' } : {}),
          ...(config.customHeaders || {}),
        };

        const payload: any = buildOpenAiChatPayload({
          model: route.model,
          systemInstruction,
          turns,
          config,
          maxOutputTokens,
          stream: true,
        });

        const isOfficialOpenAi = /api\.openai\.com/i.test(endpointUrl);
        if (typeof config.repetitionPenalty === 'number' && config.repetitionPenalty > 1.0 && !isOfficialOpenAi) {
          payload.repetition_penalty = config.repetitionPenalty;
        }

        if (route.isOpenRouter && isReasoning) {
          payload.include_reasoning = true;
        }

        const requestStartedAt = Date.now();
        const res = await platformFetch(endpointUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal,
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          throw new Error(describeHttpError(res.status, errBody, route.label));
        }

        const { fullText, metrics } = await readOpenAiStream(res, signal, {
          requestStartedAt,
          model: route.model,
          endpoint: endpointUrl,
          onDelta: chunk => {
            callbacks.onChunk(chunk);
          },
        });

        if (metrics.streamMode === 'non-stream-fallback' || metrics.streamMode === 'sse-single-burst') {
          console.warn(
            `[NekoChat Stream] ${route.model} (${route.label}) did not stream incrementally: mode=${metrics.streamMode}, contentType="${metrics.contentType}", deltas=${metrics.deltaCount}`
          );
        }

        const { thought, content } = extractThoughtAndContent(fullText);
        metrics.finalCommittedAt = Date.now();
        recordNetworkTelemetry({
          kind: 'llm_stream',
          label: route.label,
          endpoint: endpointUrl,
          model: route.model,
          status: res.status,
          ok: !metrics.aborted,
          streamMode: metrics.streamMode,
          ttfbMs: metrics.firstByteAt ? metrics.firstByteAt - metrics.requestStartedAt : undefined,
          ttftMs: metrics.firstDeltaAt ? metrics.firstDeltaAt - metrics.requestStartedAt : undefined,
          totalMs: metrics.finalCommittedAt - metrics.requestStartedAt,
          promptTokens: totalInputTokens,
          outputTokens: estimateTokens(fullText),
          finishReason: metrics.finishReason,
        });
        callbacks.onStreamMetrics?.(metrics);
        callbacks.onComplete(content || fullText, estimateTokens(fullText), thought, {
          aborted: metrics.aborted,
          streamMode: metrics.streamMode,
          finishReason: metrics.finishReason,
        });
      }
    } catch (err: any) {
      if (signal?.aborted || err?.name === 'AbortError') {
        callbacks.onComplete('', 0, undefined, { aborted: true, streamMode: 'aborted' });
        return;
      }
      const errMsg = err instanceof Error ? err.message : String(err?.message || err);
      recordNetworkTelemetry({
        kind: 'llm_stream',
        label: route.kind === 'gemini' ? 'Google Gemini' : route.label,
        endpoint:
          route.kind === 'gemini'
            ? `https://generativelanguage.googleapis.com/v1beta/models/${route.model}`
            : buildChatCompletionsUrl(route.endpoint || ''),
        model: route.model,
        ok: false,
        totalMs: Date.now() - streamStartedAt,
        error: errMsg,
      });
      callbacks.onError(err instanceof Error ? err : new Error(errMsg));
    }
  },

  /**
   * Refine / Rewrite AI Writing Coach:
   * Works across ALL configured AI providers (Gemini, OpenRouter, OpenAI, and Custom Endpoint).
   */
  async refineMessage(
    draft: string,
    character: Character,
    lastBotMessage: string,
    persona: Persona,
    config: ProviderConfig
  ): Promise<string> {
    const hasDraft = draft.trim().length > 0;
    const prompt =
      `You are an elite creative writing coach assisting a roleplayer.\n` +
      `Current Roleplay Partner: ${character.name} (${character.tagline || ''})\n` +
      `Current Scene Situation: ${lastBotMessage.slice(-400)}\n` +
      `User Playing As: ${persona.name} (${persona.description || persona.personality || ''})\n\n` +
      (hasDraft
        ? `User's rough draft: "${draft}"\n\n` +
        `TASK: Polish and enrich this draft into an immersive, literary roleplay reply that fits the user's persona and current tension. ` +
        `Include expressive actions in *italics* and spoken dialogue in "quotes". Keep it natural, not overly pretentious. Output ONLY the polished reply with no introductory text.`
        : `TASK: Write an immersive, in-character roleplay reply from ${persona.name}'s perspective responding naturally to the current scene situation. ` +
        `Include expressive actions in *italics* and spoken dialogue in "quotes". Keep it 1-2 engaging paragraphs. Output ONLY the reply with no introductory text.`);

    const route = resolveProviderRoute(config);

    try {
      if (route.kind === 'gemini') {
        if (!route.apiKey) return draft;
        const ai = new GoogleGenAI({ apiKey: route.apiKey, apiVersion: 'v1beta' });
        const res = await ai.models.generateContent({
          model: route.model,
          contents: prompt,
        });
        return res.text?.trim() || draft;
      }

      if (!route.endpoint) return draft;
      const endpointUrl = buildChatCompletionsUrl(route.endpoint);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(route.apiKey ? { Authorization: `Bearer ${route.apiKey}` } : {}),
        ...(route.isOpenRouter ? { 'HTTP-Referer': 'https://nekochat.app', 'X-Title': 'NekoChat' } : {}),
        ...(config.customHeaders || {}),
      };
      const res = await platformFetch(endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: route.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.75,
          max_tokens: 512,
          stream: false,
        }),
      });
      if (!res.ok) return draft;
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content;
      return text ? extractThoughtAndContent(String(text)).content.trim() : draft;
    } catch {
      return draft;
    }
  },

  /**
   * Summarizes chat messages into a Warden AI / JanitorAI-style <memory> checkpoint.
   * Supports both Incremental Updates (from last checkpoint) and Full Story Rescans.
   * Captures: Key Events, Promises & Secrets, Current Situation, and Appearance/Physical States.
   */
  async summarizeChatToCheckpoint(
    character: Character,
    history: ChatMessage[],
    persona: Persona,
    config: ProviderConfig,
    options?: {
      mode?: 'incremental' | 'full';
      existingMemory?: string;
      checkpointNumber?: number;
    }
  ): Promise<string> {
    const isIncremental = options?.mode === 'incremental';
    const cleanHistory = history
      .filter(m => (m.role === 'user' || m.role === 'assistant') && !isErrorMessage(m) && m.content !== '...');

    const cpNum = options?.checkpointNumber || 1;
    const charName =
      character.customChatName?.trim() ||
      extractCleanCharacterName(
        character.chatName || character.name,
        character.subtitle || character.name || character.tagline,
        character.firstMessage,
        character.personality || character.description
      );
    const userName = persona?.name || 'User';

    if (cleanHistory.length === 0) {
      return (
        `<memory>\n` +
        `[Checkpoint #${cpNum} - Opening Scene]\n` +
        `- Events: ${userName} and ${charName} began their roleplay.\n` +
        `- Promises & Agreements: None yet.\n` +
        `- Current Situation: Story starting at initial setting.\n` +
        `- Appearance & State: Default persona and companion appearance.\n` +
        `</memory>`
      );
    }

    const formattedTurns = cleanHistory.map(m => {
      const speaker = m.role === 'user' ? userName : charName;
      const body = applyPromptMacros(String(m.content || ''), charName, userName).trim();
      return `${speaker}: ${body}`;
    });

    const MAX_CHUNK_CHARS = 24000;
    const chunks: string[] = [];
    let currentTurns: string[] = [];
    let currentChars = 0;
    for (const turn of formattedTurns) {
      if (currentTurns.length >= 2 && currentChars + turn.length > MAX_CHUNK_CHARS) {
        chunks.push(currentTurns.join('\n\n'));
        currentTurns = [turn];
        currentChars = turn.length;
      } else {
        currentTurns.push(turn);
        currentChars += turn.length + 2;
      }
    }
    if (currentTurns.length > 0) {
      chunks.push(currentTurns.join('\n\n'));
    }

    const buildSummaryPrompt = (
      transcriptChunk: string,
      rollingArcMemory: string | undefined,
      chunkIdx: number,
      totalChunks: number
    ) => {
      const isFinalChunk = chunkIdx === totalChunks - 1;
      const headerLabel =
        isFinalChunk && !isIncremental
          ? `[Master Checkpoint - Complete Story Arc]`
          : `[Checkpoint #${cpNum}${totalChunks > 1 ? ` - Part ${chunkIdx + 1}/${totalChunks}` : ''} - <Descriptive Milestone Title>]`;

      if (isIncremental) {
        const backgroundRef = options?.existingMemory
          ? `Prior Established Story Checkpoints (CONTEXT ONLY — DO NOT REPEAT OR RE-SUMMARIZE OLD EVENTS):\n${options.existingMemory}\n\n`
          : '';
        const rollingNewNote = rollingArcMemory
          ? `Earlier Draft of New Turns in This Update:\n${rollingArcMemory}\n\n`
          : '';
        return (
          `You are an elite roleplay archivist and memory synthesizer (JanitorAI & Warden AI standard).\n` +
          `Append ONLY a compact incremental delta for the NEW turns between ${charName} and ${userName}.\n\n` +
          backgroundRef +
          rollingNewNote +
          `--- NEW DIALOGUE & ACTIONS TO SUMMARIZE ---\n` +
          `${transcriptChunk}\n` +
          `--- END CONVERSATION ---\n\n` +
          `TASK: Summarize ONLY the NEW events, promises, situation shifts, and appearance/state changes from the new dialogue above into Checkpoint #${cpNum}. ` +
          `Do NOT copy, re-list, or re-summarize events already recorded in the prior checkpoints above. Strictly capture:\n` +
          `1. Events: Concrete NEW plot developments, actions, revelations, and turning points.\n` +
          `2. Promises & Secrets: Specific NEW agreements, vows, debts, lies, or uncovered secrets.\n` +
          `3. Current Situation: Immediate location, mood/tension, relationship dynamic, and active goals.\n` +
          `4. Appearance & Condition: Notable changes in clothing, injuries, emotional state, or physical details.\n\n` +
          `FORMAT REQUIREMENT: Output MUST be wrapped strictly in <memory>...</memory> tags like this:\n` +
          `<memory>\n` +
          `${headerLabel}\n` +
          `- Events: <Summary of ONLY new concrete events and plot turns>\n` +
          `- Promises & Secrets: <Specific new commitments, vows, or secrets revealed>\n` +
          `- Current Situation: <Setting, atmosphere, dynamic, or immediate conflict>\n` +
          `- Appearance & Condition: <Physical, clothing, or condition shifts for both>\n` +
          `</memory>\n` +
          `Output ONLY the <memory> block, no conversational chatter.`
        );
      }

      if (chunkIdx > 0 && rollingArcMemory) {
        return (
          `You are an elite roleplay archivist and memory synthesizer (JanitorAI & Warden AI standard).\n` +
          `Consolidate the story memory so far with the next chronicle segment between ${charName} and ${userName}.\n\n` +
          `Story Arc Summarized So Far:\n${rollingArcMemory}\n\n` +
          `--- NEXT CONVERSATION SEGMENT ---\n` +
          `${transcriptChunk}\n` +
          `--- END CONVERSATION ---\n\n` +
          `TASK: Merge prior milestones and these turns into a unified factual Master Story Arc. Strictly capture:\n` +
          `1. Events Arc: Chronological recap of concrete plot developments, actions, and turning points.\n` +
          `2. Standing Promises & Agreements: Specific agreements, vows, debts, or uncovered secrets.\n` +
          `3. Current Active Situation: Exact ongoing location, mood/tension, relationship dynamic, and immediate goals.\n` +
          `4. Appearance & Dynamic: Notable changes in clothing, injuries, emotional state, or physical details.\n\n` +
          `FORMAT REQUIREMENT: Output MUST be wrapped strictly in <memory>...</memory> tags like this:\n` +
          `<memory>\n` +
          `${headerLabel}\n` +
          `- Events Arc: <Chronological summary of actual plot milestones>\n` +
          `- Standing Promises & Agreements: <Specific vows, promises, and secrets>\n` +
          `- Current Active Situation: <Exact current location, active dilemma, and atmosphere>\n` +
          `- Appearance & Dynamic: <Established physical state, clothing, and current dynamic>\n` +
          `</memory>\n` +
          `Output ONLY the <memory> block, no conversational chatter.`
        );
      }

      return (
        `You are an elite roleplay archivist and memory synthesizer (JanitorAI & Warden AI standard).\n` +
        `Synthesize the roleplay history between ${charName} and ${userName} into a factual story memory.\n\n` +
        `--- CONVERSATION HISTORY ---\n` +
        `${transcriptChunk}\n` +
        `--- END CONVERSATION ---\n\n` +
        `TASK: Capture concrete story facts:\n` +
        `1. Events Arc: Chronological recap of actual plot developments and milestones.\n` +
        `2. Standing Promises & Agreements: What was promised, sworn, or discovered.\n` +
        `3. Current Active Situation: The exact ongoing location, tension, dynamic, and immediate goal.\n` +
        `4. Appearance & Dynamic: Current physical state, clothing, and real relationship status.\n\n` +
        `FORMAT REQUIREMENT: Output MUST be wrapped strictly in <memory>...</memory> tags like this:\n` +
        `<memory>\n` +
        `${headerLabel}\n` +
        `- Events Arc: <Chronological summary of actual plot milestones>\n` +
        `- Standing Promises & Agreements: <Specific vows, promises, and secrets>\n` +
        `- Current Active Situation: <Exact current location, active dilemma, and atmosphere>\n` +
        `- Appearance & Dynamic: <Established physical state, clothing, and current dynamic>\n` +
        `</memory>\n` +
        `Output ONLY the <memory> block, no conversational chatter.`
      );
    };

    const route = resolveProviderRoute(config);

    const finalizeMemoryBlock = (rawOutput: string, finishReason?: string): string => {
      const text = rawOutput
        .replace(/^```[a-z]*\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim();
      const bodyOnly = text.replace(/<\/?memory>/gi, '').trim();
      if (bodyOnly.length < 20) {
        throw new Error(`Model returned an empty summary (${finishReason || 'no text'})`);
      }
      if (text.includes('<memory>')) return text;
      return `<memory>\n${text}\n</memory>`;
    };

    const runSummaryLlmCall = async (promptText: string): Promise<string> => {
      if (route.kind === 'gemini') {
        if (!route.apiKey) throw new Error('Missing Gemini API Key');
        const modelName = encodeURIComponent(route.model || 'gemini-2.5-flash');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(route.apiKey)}`;
        const res = await platformFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: promptText }] }],
            safetySettings: [
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
            generationConfig: {
              maxOutputTokens: 4096,
              temperature: 0.4,
            },
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error?.message || `Gemini HTTP ${res.status}`);
        }
        const blockReason = data?.promptFeedback?.blockReason;
        if (blockReason) {
          throw new Error(`Blocked by Gemini (${blockReason})`);
        }
        const candidate = data?.candidates?.[0];
        const finishReason = String(candidate?.finishReason || '');
        if (/^(?:SAFETY|PROHIBITED_CONTENT|BLOCKLIST|SPII|RECITATION)$/i.test(finishReason)) {
          throw new Error(`Summary blocked (${finishReason})`);
        }
        const parts: any[] = candidate?.content?.parts || [];
        const rawText = parts
          .filter(p => p?.text && !p?.thought)
          .map(p => String(p.text))
          .join('')
          .trim();
        return finalizeMemoryBlock(rawText, finishReason || undefined);
      }

      if (!route.endpoint) throw new Error('Missing Base URL');
      const endpointUrl = buildChatCompletionsUrl(route.endpoint);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(route.apiKey ? { Authorization: `Bearer ${route.apiKey}` } : {}),
        ...(route.isOpenRouter ? { 'HTTP-Referer': 'https://nekochat.app', 'X-Title': 'NekoChat' } : {}),
        ...(config.customHeaders || {}),
      };
      const res = await platformFetch(endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: route.model,
          messages: [{ role: 'user', content: promptText }],
          temperature: 0.4,
          max_tokens: 4096,
          stream: false,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(describeHttpError(res.status, errBody, route.label));
      }
      const json = await res.json();
      const rawChoice = String(json.choices?.[0]?.message?.content || '');
      const finishReason = json.choices?.[0]?.finish_reason;
      const { content } = extractThoughtAndContent(rawChoice);
      return finalizeMemoryBlock(content || rawChoice, finishReason);
    };

    const summaryStartedAt = Date.now();
    const summaryLabel = route.kind === 'gemini' ? 'Google Gemini' : route.label;
    const summaryEndpoint =
      route.kind === 'gemini'
        ? `https://generativelanguage.googleapis.com/v1beta/models/${route.model || 'gemini-2.5-flash'}:generateContent`
        : buildChatCompletionsUrl(route.endpoint || '');
    let rollingMemory = isIncremental ? undefined : options?.existingMemory;
    try {
      for (let i = 0; i < chunks.length; i++) {
        const promptText = buildSummaryPrompt(chunks[i], rollingMemory, i, chunks.length);
        rollingMemory = await runSummaryLlmCall(promptText);
      }
      recordNetworkTelemetry({
        kind: 'llm_summary',
        label: `${summaryLabel} (${isIncremental ? 'incremental' : 'full'})`,
        endpoint: summaryEndpoint,
        model: route.model,
        ok: true,
        totalMs: Date.now() - summaryStartedAt,
        outputTokens: estimateTokens(rollingMemory || ''),
      });
      return rollingMemory || '';
    } catch (err: any) {
      recordNetworkTelemetry({
        kind: 'llm_summary',
        label: `${summaryLabel} (${isIncremental ? 'incremental' : 'full'})`,
        endpoint: summaryEndpoint,
        model: route.model,
        ok: false,
        totalMs: Date.now() - summaryStartedAt,
        error: err?.message || String(err),
      });
      throw err;
    }
  },

  /**
   * AI Scene Director: distills the latest ~6 turns of roleplay (any language) plus
   * character/persona appearance and active scene location/time into ONE vivid English
   * image generation prompt illustrating the current moment.
   */
  async generateSceneIllustrationPrompt(params: {
    character: Character;
    recentMessages: ChatMessage[];
    persona?: Persona;
    styleLabel: string;
    stylePrefix: string;
    config: ProviderConfig;
    sceneLocation?: string;
    sceneTime?: string;
    memorySnippet?: string;
  }): Promise<string | null> {
    const route = resolveProviderRoute(params.config);
    const charName =
      params.character.customChatName?.trim() ||
      extractCleanCharacterName(
        params.character.chatName || params.character.name,
        params.character.subtitle || params.character.name || params.character.tagline,
        params.character.firstMessage,
        params.character.personality || params.character.description
      );
    const userName = params.persona?.name || 'User';

    const validTurns = (params.recentMessages || [])
      .filter(m => (m.role === 'user' || m.role === 'assistant') && !isErrorMessage(m) && m.content !== '...')
      .slice(-6);
    if (validTurns.length === 0) return null;

    const transcript = validTurns
      .map(m => {
        const speaker = m.role === 'assistant' ? charName : userName;
        const cleanBody = extractThoughtAndContent(String(m.content || '')).content
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 500);
        return `${speaker}: ${cleanBody}`;
      })
      .join('\n\n');

    const memClean = (params.memorySnippet || '').replace(/<\/?memory>/gi, '').trim().slice(0, 400);
    const visualContext = [
      `Character: ${charName} — ${(params.character.description || params.character.personality || '').replace(/\s+/g, ' ').trim().slice(0, 450)}`,
      params.persona?.appearance
        ? `Companion (${userName}) appearance: ${params.persona.appearance.replace(/\s+/g, ' ').trim().slice(0, 200)}`
        : '',
      params.sceneLocation ? `Current Location: ${params.sceneLocation}` : '',
      params.sceneTime ? `Time of Day: ${params.sceneTime}` : '',
      memClean ? `Established Memory Context: ${memClean}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const directorPrompt =
      `You are a cinematic visual art director turning a roleplay scene into a single image-generation prompt.\n` +
      `Target Art Style: ${params.styleLabel} (${params.stylePrefix})\n\n` +
      `${visualContext}\n\n` +
      `--- LATEST CONVERSATION TURNS ---\n` +
      `${transcript}\n` +
      `--- END TURNS ---\n\n` +
      `TASK: Write ONE vivid, comma-separated or descriptive ENGLISH image prompt (55–105 words) that accurately illustrates the CURRENT moment at the end of these turns.\n` +
      `Rules:\n` +
      `- Translate any non-English roleplay (Indonesian, Japanese, French, etc.) into crisp visual English.\n` +
      `- Capture the character's exact gender, hair, eyes, outfit, pose, facial expression, lighting, weather, and setting.\n` +
      `- Include ${userName} in frame only if actively visible in the current moment.\n` +
      `- NO dialogue quotes, NO speech bubbles, NO markdown, NO intro text. Output ONLY the prompt itself.`;

    const startedAt = Date.now();
    const routeLabel = route.kind === 'gemini' ? 'Google Gemini' : route.label;
    const endpoint =
      route.kind === 'gemini'
        ? `https://generativelanguage.googleapis.com/v1beta/models/${route.model || 'gemini-2.5-flash'}:generateContent`
        : buildChatCompletionsUrl(route.endpoint || '');

    try {
      let rawResult = '';
      if (route.kind === 'gemini') {
        if (!route.apiKey) return null;
        const modelName = encodeURIComponent(route.model || 'gemini-2.5-flash');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(route.apiKey)}`;
        const res = await platformFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: directorPrompt }] }],
            generationConfig: { temperature: 0.55, maxOutputTokens: 320 },
          }),
        });
        if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
        const json = await res.json();
        const parts: any[] = json?.candidates?.[0]?.content?.parts || [];
        rawResult = parts.filter(p => p?.text && !p?.thought).map(p => String(p.text)).join('');
      } else {
        if (!route.endpoint) return null;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(route.apiKey ? { Authorization: `Bearer ${route.apiKey}` } : {}),
          ...(route.isOpenRouter ? { 'HTTP-Referer': 'https://nekochat.app', 'X-Title': 'NekoChat' } : {}),
          ...(params.config.customHeaders || {}),
        };
        const res = await platformFetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: route.model,
            messages: [{ role: 'user', content: directorPrompt }],
            temperature: 0.55,
            max_tokens: 320,
            stream: false,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rawChoice = String(json.choices?.[0]?.message?.content || '');
        rawResult = extractThoughtAndContent(rawChoice).content || rawChoice;
      }

      const cleaned = rawResult
        .replace(/^```[a-z]*\n?/i, '')
        .replace(/\n?```$/i, '')
        .replace(/^prompt:\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleaned.length < 15) return null;

      recordNetworkTelemetry({
        kind: 'llm_summary',
        label: `AI Scene Director (${routeLabel})`,
        endpoint,
        model: route.model,
        ok: true,
        totalMs: Date.now() - startedAt,
        outputTokens: estimateTokens(cleaned),
      });
      return cleaned;
    } catch (err: any) {
      recordNetworkTelemetry({
        kind: 'llm_summary',
        label: `AI Scene Director (${routeLabel})`,
        endpoint,
        model: route.model,
        ok: false,
        totalMs: Date.now() - startedAt,
        error: err?.message || String(err),
      });
      return null;
    }
  },

  /**
   * Sends a controlled, non-streaming compatibility probe for the Capability Matrix.
   * Returns raw HTTP status / response text / network error without mutating stored keys.
   */
  async probeCapabilityPrompt(
    config: ProviderConfig,
    prompt: string
  ): Promise<{ httpStatus?: number; errorMessage?: string; responseText?: string; timedOut?: boolean; networkError?: boolean }> {
    const route = resolveProviderRoute(config);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      if (route.kind === 'gemini') {
        if (!route.apiKey) return { httpStatus: 401, errorMessage: 'Missing Gemini API key' };
        const modelName = encodeURIComponent(route.model || 'gemini-2.5-flash');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(route.apiKey)}`;
        const res = await platformFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 128 },
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          return { httpStatus: res.status, errorMessage: errText };
        }
        const json = await res.json();
        const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || '';
        return { httpStatus: res.status, responseText: text };
      }

      if (!route.endpoint) return { httpStatus: 400, errorMessage: 'Missing endpoint URL' };
      const endpointUrl = buildChatCompletionsUrl(route.endpoint);
      const res = await platformFetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(route.apiKey ? { Authorization: `Bearer ${route.apiKey}` } : {}),
          ...(route.isOpenRouter ? { 'HTTP-Referer': 'https://nekochat.app', 'X-Title': 'NekoChat' } : {}),
          ...(config.customHeaders || {}),
        },
        body: JSON.stringify({
          model: route.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 128,
          stream: false,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return { httpStatus: res.status, errorMessage: errText };
      }
      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content || json?.choices?.[0]?.text || '';
      return { httpStatus: res.status, responseText: String(text) };
    } catch (err: any) {
      if (err?.name === 'AbortError') return { timedOut: true, errorMessage: 'Timed out' };
      return { networkError: true, errorMessage: String(err?.message || err) };
    } finally {
      clearTimeout(timer);
    }
  },
};

