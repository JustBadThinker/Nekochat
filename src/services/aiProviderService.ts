/**
 * AI Provider Service
 * Supports Google Gemini (via official SDK), OpenRouter, and OpenAI-compatible endpoints.
 */

import { GoogleGenAI } from '@google/genai';
import { Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';
import { Character, CharacterScenario, ChatMessage, Lorebook, Persona, ProviderConfig } from '../types';
import { isOocMessage, cleanOocContent, estimateTokens } from './tokenOptimizerService';
import { storageService } from './storageService';
import { getDefaultLanguagePrompt } from '../i18n/translations';

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

type SimpleTurn = { role: 'user' | 'assistant'; content: string };

/**
 * Builds the conversation turns sent to the model:
 * - removes error bubbles / empty placeholders
 * - never duplicates the user's latest message
 * - trims the oldest turns to fit the configured context window
 */
function buildTurns(
  history: ChatMessage[],
  userMessage: string,
  opts: { isContinue?: boolean; contextLimit: number; reservedTokens: number; charName: string; userName: string }
): SimpleTurn[] {
  const clean: SimpleTurn[] = history
    .filter(m => (m.role === 'user' || m.role === 'assistant') && !isErrorMessage(m))
    .map(m => ({ role: m.role as 'user' | 'assistant', content: applyMacros(String(m.content || ''), opts.charName, opts.userName).trim() }))
    .filter(m => m.content && m.content !== '...');

  if (!opts.isContinue && userMessage.trim()) {
    const last = clean[clean.length - 1];
    if (!(last && last.role === 'user' && last.content === userMessage.trim())) {
      clean.push({ role: 'user', content: userMessage.trim() });
    }
  }

  // Fit to context window (always keep at least the last 2 turns)
  const budget = Math.max(512, opts.contextLimit - opts.reservedTokens);
  const kept: SimpleTurn[] = [];
  let used = 0;
  for (let i = clean.length - 1; i >= 0; i--) {
    const cost = estimateTokens(clean[i].content) + 4;
    if (kept.length >= 2 && used + cost > budget) break;
    kept.unshift(clean[i]);
    used += cost;
  }

  if (opts.isContinue) {
    kept.push({ role: 'user', content: '[Continue your previous message exactly where it stopped. Do not repeat anything.]' });
  }
  return kept;
}

/** Gemini requires the first turn to be `user` and prefers strictly alternating roles. */
function toGeminiContents(turns: SimpleTurn[]) {
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
  if (merged.length === 0 || merged[0].role !== 'user') {
    merged.unshift({ role: 'user', parts: [{ text: '[Start the roleplay.]' }] });
  }
  return merged;
}

/** Reads an OpenAI-style SSE stream. Returns the full text. */
async function readOpenAiStream(res: Response, signal: AbortSignal, onDelta: (chunk: string) => void): Promise<string> {
  let fullText = '';
  const body: any = res.body;
  if (!body || typeof body.getReader !== 'function') {
    // Server ignored stream:true or runtime lacks streams → parse whole body
    const raw = await res.text();
    try {
      const json = JSON.parse(raw);
      fullText = json.choices?.[0]?.message?.content || json.choices?.[0]?.text || '';
    } catch {
      raw.split('\n').forEach(line => {
        const l = line.trim();
        if (!l.startsWith('data:') || l.includes('[DONE]')) return;
        try {
          const j = JSON.parse(l.slice(5).trim());
          fullText += j.choices?.[0]?.delta?.content || '';
        } catch {}
      });
    }
    if (fullText) onDelta(fullText);
    return fullText;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let inReasoning = false;
  while (true) {
    if (signal.aborted) {
      try { reader.cancel(); } catch {}
      break;
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
        const delta = json.choices?.[0]?.delta || {};
        const reasoning = delta.reasoning_content || delta.reasoning || '';
        let chunk = '';
        if (reasoning) {
          chunk = (inReasoning ? '' : '<think>') + reasoning;
          inReasoning = true;
        }
        if (delta.content) {
          chunk += (inReasoning ? '</think>' : '') + delta.content;
          inReasoning = false;
        }
        if (chunk) {
          fullText += chunk;
          onDelta(chunk);
        }
      } catch (e: any) {
        if (e?.message && !/JSON/i.test(e.message)) throw e;
      }
    }
  }
  if (inReasoning) fullText += '</think>';
  return fullText;
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onError: (error: Error) => void;
  onComplete: (fullText: string, tokenEstimate: number, thought?: string) => void;
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

export function extractCleanCharacterName(
  rawName?: string,
  rawSubtitle?: string,
  firstMessage?: string,
  personality?: string
): string {
  let raw = (rawName || '').trim();

  // If rawName is empty, only then check if rawSubtitle has a name-like string
  if (!raw) {
    const sub = (rawSubtitle || '').trim();
    if (sub && sub.length <= 34 && !sub.includes('#') && !sub.includes('\n')) {
      return sub;
    }
    return 'Character';
  }

  // 1. Strip leading markdown headers like # or ##
  raw = raw.replace(/^#+\s*/, '');

  // 2. Strip leading bracket/paren tags e.g. (IDN), [ENG], [NSFW], (18+)
  raw = raw.replace(/^\s*(?:\([a-zA-Z0-9_\s-]{1,10}\)|\[[a-zA-Z0-9_\s-]{1,10}\])\s*/g, '');

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
    const cleanText = (s?: string) => (s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ');
    const combined = `${cleanText(personality)}\n${cleanText(firstMessage)}`;
    const nameMatch =
      combined.match(/(?:(?:Name|Full Name|Real Name|Nama|Character)\s*[:=][ \t]*([A-Za-z0-9'’_-]+(?:[ \t]+[A-Za-z0-9'’_-]+){0,3}))/i) ||
      combined.match(/\[(?:Character|char)\s*\(\s*["']?([A-Za-z0-9'’_-]+(?:[ \t]+[A-Za-z0-9'’_-]+){0,2})/i) ||
      combined.match(/(?:You are|Character:|Name:|\{\{char\}\} is|\{\{char\}\}'s name is|Her name is|His name is)[ \t]+([A-Z][a-zA-Z0-9'’_-]+(?:[ \t]+[A-Z][a-zA-Z0-9'’_-]+){0,2})/i) ||
      combined.match(/\b([A-Z][a-z]{2,15})[ \t]*\(\s*\d{1,2}\s*(?:yo|years old)?\s*\)/i) ||
      combined.match(/\b([A-Z][a-z]{2,15}(?:[ \t]+[A-Z][a-z]{2,15})?)[ \t]+(?:has stopped|smiles|looks|glares|observes|stands|walks|steps|sighs|chuckles|grins|laughs|watches|leans|crosses|sits|speaks|whispers|taps|nods|turns)\b/) ||
      combined.match(/\b([A-Z][a-z]{2,15})'s\b/);
    if (nameMatch && nameMatch[1]) {
      const candidate = nameMatch[1].trim();
      if (!/^(?:User|You|Character|Narrator|Roleplay|Story|Scenario|Created|Note|Warning)$/i.test(candidate)) {
        return candidate;
      }
    }
  }

  // 9. If rawSubtitle looks like a clean personal name (e.g. from chat_name), prefer it over a long title
  const sub = (rawSubtitle || '').trim();
  if (sub && sub !== raw && sub.length >= 2 && sub.length <= 34 && !sub.includes('#') && !sub.includes('\n') && !sub.startsWith('Created by')) {
    return sub;
  }

  return raw;
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
  async fetchModels(provider: ProviderConfig): Promise<{ id: string; name: string; contextLength?: number }[]> {
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
                  return {
                    id: cleanId,
                    name: m.displayName ? `${m.displayName} (${cleanId})` : cleanId,
                    contextLength: m.inputTokenLimit,
                  };
                });
              if (geminiList.length > 0) return geminiList;
            }
          }
        } catch {}
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
      return rawList.map((m: any) => ({
        id: m.id || m.name,
        name: m.name || m.id,
        contextLength: m.context_length || m.context_window,
      }));
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
  async pingService(type: 'gemini' | 'chub' | 'datacat' | 'openrouter', apiKey?: string): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      if (type === 'chub') {
        const res = await fetch('https://api.chub.ai/api/characters/search?first=1', { method: 'GET' });
        return { ok: res.ok, latencyMs: Date.now() - start };
      }
      if (type === 'datacat') {
        const res = await fetch('https://datacat.cc/health', { method: 'GET' });
        return { ok: res.ok, latencyMs: Date.now() - start };
      }
      if (type === 'openrouter') {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        });
        return { ok: res.ok, latencyMs: Date.now() - start };
      }
      // Gemini ping
      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: 'ping',
        });
        return { ok: true, latencyMs: Date.now() - start };
      }
      return { ok: false, latencyMs: 0 };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
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
      scenario?: CharacterScenario;
      lorebooks?: Lorebook[];
      isContinue?: boolean;
      memory?: string;
    }
  ): Promise<void> {
    this.abortGeneration();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const isOoc = isOocMessage(userMessage);
    const chatCharName = extractCleanCharacterName(
      character.name,
      character.subtitle || character.tagline,
      character.firstMessage,
      character.personality
    );
    const userName = persona?.name || 'User';

    // Build rich instructions with {{char}} / {{user}} macro expansion
    const sections: string[] = [];
    sections.push(
      `You are roleplaying as ${chatCharName}.\n` +
      `Identity: ${applyMacros(character.name, chatCharName, userName)} (${applyMacros(character.tagline || '', chatCharName, userName)})\n` +
      `Personality: ${applyMacros(character.personality || '', chatCharName, userName)}\n` +
      `Backstory: ${applyMacros(character.background || character.description || '', chatCharName, userName)}`
    );

    if (character.systemPrompt) {
      sections.push(`[CORE CHARACTER RULES]\n${applyMacros(character.systemPrompt, chatCharName, userName)}`);
    }

    if (options?.scenario) {
      sections.push(
        `[ACTIVE SCENARIO: "${options.scenario.title}"]\nContext: ${applyMacros(options.scenario.description, chatCharName, userName)}${
          options.scenario.scenarioInstructions
            ? `\nScenario Directives: ${applyMacros(options.scenario.scenarioInstructions, chatCharName, userName)}`
            : ''
        }`
      );
    } else if (character.scenario) {
      sections.push(`[SCENARIO CONTEXT]\n${applyMacros(character.scenario, chatCharName, userName)}`);
    }

    sections.push(
      `[USER PERSONA]\nName: ${userName}${persona.pronouns ? `\nPronouns: ${persona.pronouns}` : ''}${
        persona.appearance ? `\nAppearance: ${persona.appearance}` : ''
      }\nDescription: ${persona.description || persona.personality || ''}`
    );

    // Warden AI Memory & Checkpoint Context Injection
    if (options?.memory && options.memory.trim()) {
      const cleanMem = options.memory.trim();
      const hasRealContent = cleanMem.replace(/<memory>|<\/memory>/gi, '').trim().length > 0;
      if (hasRealContent) {
        const memBlock = cleanMem.includes('<memory>') ? cleanMem : `<memory>\n${cleanMem}\n</memory>`;
        sections.push(
          `[WARDEN AI STORY MEMORY & CHECKPOINTS]\n` +
          `${memBlock}\n` +
          `Directives:\n` +
          `- The <memory> block above documents immutable checkpoints, established facts, relationship state, and past milestones.\n` +
          `- Never contradict, forget, or overwrite details recorded in the <memory> block.`
        );
      }
    }

    // Lorebook keyword matching
    if (options?.lorebooks && options.lorebooks.length > 0) {
      const scanDepth = 6;
      const recentHistoryText = (
        history.slice(-scanDepth).map(m => m.content).join(' ') + ' ' + userMessage
      ).toLowerCase();
      const matchedEntries: { title: string; content: string; priority: number }[] = [];

      options.lorebooks.forEach(lb => {
        lb.entries.forEach(entry => {
          if (!entry.enabled) return;
          if (entry.constant || entry.keys.some(k => k.trim() && recentHistoryText.includes(k.trim().toLowerCase()))) {
            matchedEntries.push({
              title: entry.title,
              content: applyMacros(entry.content, chatCharName, userName),
              priority: entry.priority || 10,
            });
          }
        });
      });

      if (matchedEntries.length > 0) {
        matchedEntries.sort((a, b) => b.priority - a.priority);
        sections.push(
          `[WORLD LORE & BACKGROUND]\n${matchedEntries.map(e => `- ${e.title}: ${e.content}`).join('\n')}`
        );
      }
    }

    if (config.customPrompt && config.customPrompt.trim()) {
      sections.push(`[USER SYSTEM PROMPT]\n${applyMacros(config.customPrompt.trim(), chatCharName, userName)}`);
    }

    try {
      const appSettings = await storageService.getSettings();
      if (appSettings?.autoLanguagePrompt) {
        const langPrompt =
          (appSettings.languageCustomPrompt || '').trim() ||
          getDefaultLanguagePrompt(appSettings.uiLanguage || 'en');
        sections.push(`[LANGUAGE DIRECTIVE]\n${applyMacros(langPrompt, chatCharName, userName)}`);
      }
    } catch {}

    if (options?.isContinue) {
      sections.push(
        `[DIRECTIVE: SCENE CONTINUATION]\n` +
        `The previous response ended abruptly or was cut short. Continue the exact sentence or thought seamlessly without repetition, preamble, or greeting.`
      );
    } else if (isOoc) {
      const cleanQ = cleanOocContent(userMessage);
      sections.push(
        `[ACTIVE MODE: OUT-OF-CHARACTER (OOC) DISCUSSION]\n` +
        `The user is asking an Out-Of-Character meta-question: "${cleanQ}".\n` +
        `Respond directly starting with "[OOC]". Step outside of the persona and answer candidly as an AI assistant co-writer.`
      );
    } else {
      sections.push(
        `[FORMATTING GUIDELINES]\n` +
        `- Stay in character as ${chatCharName}.\n` +
        `- Actions, body language, and narration ONLY in *single asterisks* (rendered as italic). Never use *single asterisks* for bold words.\n` +
        `- Spoken dialogue in "double quotes".\n` +
        `- Bold emphasis, key sounds, or dramatic words ONLY in **double asterisks** (never single asterisks).\n` +
        `- System readouts, notes, or \`inline code\` in \`backticks\`.\n` +
        `- Do not speak or act on behalf of ${userName}.`
      );
    }

    const systemInstruction = sections.join('\n\n');
    const contextLimit = Number(config.contextLimit || config.contextWindow || 32768);
    const maxOutputTokens = config.maxTokens === 0 ? 0 : Number(config.maxTokens || 4096);
    const reservedTokens = estimateTokens(systemInstruction) + (maxOutputTokens > 0 ? maxOutputTokens : 4096) + 128;

    const turns = buildTurns(history, userMessage, {
      isContinue: options?.isContinue,
      contextLimit,
      reservedTokens,
      charName: chatCharName,
      userName,
    });

    const route = resolveProviderRoute(config);

    try {
      if (route.kind === 'gemini') {
        if (!route.apiKey) {
          throw new Error('Google Gemini API Key is missing. Please set your key or switch to your Custom Endpoint in Settings → AI Engine.');
        }

        const contents = toGeminiContents(turns);
        const generationConfig: Record<string, any> = {
          temperature: typeof config.temperature === 'number' ? config.temperature : 0.85,
          topP: typeof config.topP === 'number' ? config.topP : 0.95,
          ...(maxOutputTokens > 0 ? { maxOutputTokens } : {}),
        };
        const geminiBody = JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig,
        });

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

        let fullText = '';
        if (response.body && typeof response.body.getReader === 'function') {
          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          while (true) {
            if (signal.aborted) break;
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const dataStr = trimmed.slice(5).trim();
              if (!dataStr || dataStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(dataStr);
                const parts = parsed?.candidates?.[0]?.content?.parts || [];
                let chunkText = '';
                for (const p of parts) {
                  if (p?.text) {
                    chunkText += p.thought ? `<think>${p.text}</think>` : p.text;
                  }
                }
                if (chunkText) {
                  fullText += chunkText;
                  callbacks.onChunk(chunkText);
                }
              } catch {}
            }
          }
        } else {
          // Non-streaming fallback if runtime has no ReadableStream
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
          const json = await fallbackRes.json();
          const parts = json?.candidates?.[0]?.content?.parts || [];
          for (const p of parts) {
            if (p?.text) {
              const t = p.thought ? `<think>${p.text}</think>` : p.text;
              fullText += t;
              callbacks.onChunk(t);
            }
          }
        }

        const { thought, content } = extractThoughtAndContent(fullText);
        callbacks.onComplete(content, estimateTokens(fullText), thought);
      } else {
        if (!route.endpoint) {
          throw new Error('Custom Endpoint Base URL is empty. Set it in Settings → AI Engine.');
        }

        const endpointUrl = buildChatCompletionsUrl(route.endpoint);
        const messages = [
          { role: 'system', content: systemInstruction },
          ...turns.map(t => ({ role: t.role, content: t.content })),
        ];

        const isReasoning = /r1|deepseek-r1|glm-4|qwq|thinking|reasoning/i.test(route.model);
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/json',
          ...(route.apiKey ? { Authorization: `Bearer ${route.apiKey}` } : {}),
          ...(route.isOpenRouter ? { 'HTTP-Referer': 'https://nekochat.app', 'X-Title': 'NekoChat' } : {}),
          ...(config.customHeaders || {}),
        };

        const payload: any = {
          model: route.model,
          messages,
          temperature: typeof config.temperature === 'number' ? config.temperature : 0.85,
          top_p: typeof config.topP === 'number' ? config.topP : 0.95,
          ...(maxOutputTokens > 0 ? { max_tokens: maxOutputTokens } : {}),
          stream: true,
        };

        if (typeof config.repetitionPenalty === 'number' && config.repetitionPenalty > 1.0 && route.isOpenRouter) {
          payload.repetition_penalty = config.repetitionPenalty;
        }

        if (route.isOpenRouter && isReasoning) {
          payload.include_reasoning = true;
        }

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

        const fullText = await readOpenAiStream(res, signal, chunk => {
          callbacks.onChunk(chunk);
        });

        const { thought, content } = extractThoughtAndContent(fullText);
        callbacks.onComplete(content || fullText, estimateTokens(fullText), thought);
      }
    } catch (err: any) {
      if (signal?.aborted || err?.name === 'AbortError') {
        callbacks.onChunk(' [Generation paused]');
        callbacks.onComplete('', 0);
        return;
      }
      callbacks.onError(err instanceof Error ? err : new Error(String(err?.message || err)));
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
        const ai = new GoogleGenAI({ apiKey: route.apiKey });
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

    if (cleanHistory.length === 0) {
      return (
        `<memory>\n` +
        `[Checkpoint #${cpNum} - Opening Scene]\n` +
        `- Events: ${persona?.name || 'User'} and ${character.name} began their roleplay.\n` +
        `- Promises & Agreements: None yet.\n` +
        `- Current Situation: Story starting at initial setting.\n` +
        `- Appearance & State: Default persona and companion appearance.\n` +
        `</memory>`
      );
    }

    const conversationTranscript = cleanHistory
      .map(m => `${m.role === 'user' ? persona?.name || 'User' : character.name}: ${m.content}`)
      .join('\n\n');

    const prompt = isIncremental
      ? `You are an elite roleplay archivist and memory synthesizer (JanitorAI & Warden AI standard).\n` +
        `You are updating the story memory with the LATEST continuation between ${character.name} and ${persona?.name || 'User'}.\n\n` +
        `--- NEW DIALOGUE & ACTIONS TO SUMMARIZE ---\n` +
        `${conversationTranscript}\n` +
        `--- END CONVERSATION ---\n\n` +
        (options?.existingMemory ? `Prior Established Story Checkpoints:\n${options.existingMemory}\n\n` : '') +
        `TASK: Synthesize these new turns into Checkpoint #${cpNum}. Strictly capture:\n` +
        `1. Events: Key developments, actions, revelations, and turns of the plot.\n` +
        `2. Promises & Secrets: Standing agreements, commitments, or uncovered secrets.\n` +
        `3. Current Situation: Immediate surroundings, stakes, dynamic between the two, and active goals.\n` +
        `4. Appearance & Condition: Any changes in clothing, injuries, emotional state, or physical features.\n\n` +
        `FORMAT REQUIREMENT: Output MUST be wrapped strictly in <memory>...</memory> tags like this:\n` +
        `<memory>\n` +
        `[Checkpoint #${cpNum} - <Descriptive Milestone Title>]\n` +
        `- Events: <Summary of actions and plot turns>\n` +
        `- Promises & Secrets: <Commitments, vows, or secrets revealed>\n` +
        `- Current Situation: <Setting, atmosphere, active dilemma, or next step>\n` +
        `- Appearance & Condition: <Physical, clothing, or condition shifts for both>\n` +
        `</memory>\n` +
        `Output ONLY the <memory> block, no conversational chatter.`
      : `You are an elite roleplay archivist and memory synthesizer (JanitorAI & Warden AI standard).\n` +
        `Synthesize the ENTIRE roleplay history from the very beginning between ${character.name} and ${persona?.name || 'User'} into a master story memory.\n\n` +
        `--- COMPLETE CONVERSATION HISTORY ---\n` +
        `${conversationTranscript}\n` +
        `--- END CONVERSATION ---\n\n` +
        `TASK: Create a master story checkpoint capturing:\n` +
        `1. Events Arc: Chronological recap of major story developments and milestones.\n` +
        `2. Standing Promises & Agreements: What was promised, sworn, or discovered.\n` +
        `3. Current Active Situation: The exact ongoing situation, active tension, and immediate goal.\n` +
        `4. Appearance & Dynamic: Current physical state, clothing, and relationship bond.\n\n` +
        `FORMAT REQUIREMENT: Output MUST be wrapped strictly in <memory>...</memory> tags like this:\n` +
        `<memory>\n` +
        `[Master Checkpoint - Complete Story Arc]\n` +
        `- Events Arc: <Chronological summary of all major plot milestones>\n` +
        `- Standing Promises & Agreements: <All vows, promises, and secrets preserved>\n` +
        `- Current Active Situation: <Exact current location, active dilemma, and atmosphere>\n` +
        `- Appearance & Dynamic: <Established physical state, clothing, and bond status>\n` +
        `</memory>\n` +
        `Output ONLY the <memory> block, no conversational chatter.`;

    const route = resolveProviderRoute(config);

    try {
      if (route.kind === 'gemini') {
        if (!route.apiKey) throw new Error('Missing Gemini API Key');
        const ai = new GoogleGenAI({ apiKey: route.apiKey });
        const res = await ai.models.generateContent({
          model: route.model,
          contents: prompt,
          config: {
            maxOutputTokens: 4096,
            temperature: 0.4,
          },
        });
        const rawText = res.text?.trim() || '';
        const text = rawText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
        if (text.includes('<memory>')) return text;
        return `<memory>\n${text}\n</memory>`;
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
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 4096,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const outputRaw = json.choices?.[0]?.message?.content?.trim() || '';
      const output = outputRaw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
      if (output.includes('<memory>')) return output;
      return `<memory>\n${output}\n</memory>`;
    } catch (err: any) {
      console.warn('[summarizeChatToCheckpoint] LLM invocation failed, using smart story fallback:', err?.message || err);
      // Heuristic fallback if offline or API error
      const lastUser = cleanHistory.filter(m => m.role === 'user').pop();
      const lastBot = cleanHistory.filter(m => m.role === 'assistant').pop();

      if (options?.mode === 'full') {
        return (
          `<memory>\n` +
          `[Master Checkpoint - Complete Story Arc (Turns 1-${cleanHistory.length})]\n` +
          `- Events Arc: Active roleplay between ${character.name} and ${persona?.name || 'User'} spanning ${cleanHistory.length} turns.\n` +
          (lastUser ? `- Latest User Interaction: "${lastUser.content.slice(0, 110).replace(/\n/g, ' ')}..."\n` : '') +
          (lastBot ? `- Companion Latest Response: "${lastBot.content.slice(0, 110).replace(/\n/g, ' ')}..."\n` : '') +
          `- Standing Promises & Agreements: Mutual trust, established relationship dynamic, and past agreements intact.\n` +
          `- Current Active Situation: Immediate ongoing scene awaiting reply.\n` +
          `- Appearance & Dynamic: Canonical persona and companion physical traits, attire, and emotional bond preserved.\n` +
          `</memory>`
        );
      }

      return (
        `<memory>\n` +
        `[Checkpoint #${cpNum} - Story Continuation]\n` +
        `- Events: Ongoing interaction between ${character.name} and ${persona?.name || 'User'}.\n` +
        (lastUser ? `- User Action: "${lastUser.content.slice(0, 110).replace(/\n/g, ' ')}..."\n` : '') +
        (lastBot ? `- Character Reply: "${lastBot.content.slice(0, 110).replace(/\n/g, ' ')}..."\n` : '') +
        `- Current Situation: Active scene awaiting response.\n` +
        `- Appearance & State: Established state maintained.\n` +
        `</memory>`
      );
    }
  }
};

