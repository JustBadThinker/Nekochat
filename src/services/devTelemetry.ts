/**
 * Pure, runtime-agnostic Developer Mode telemetry ring buffers.
 * Tracks:
 * 1. Live prompt & token budget breakdown (last 5 generations)
 * 2. Network / stream & backend probe telemetry (last 25 requests)
 *
 * Automatically strips/masks API keys and tokens from recorded URLs.
 */

export interface PromptSectionBreakdown {
  label: string;
  tokens: number;
  chars: number;
}

export interface LastPromptSnapshot {
  id: string;
  timestamp: number;
  conversationId?: string;
  characterName: string;
  model: string;
  endpointIdentity: string;
  contextLimit: number;
  contextSource: string;
  maxOutputTokens: number;
  totalInputTokens: number;
  turnsKept: number;
  turnsTrimmed: number;
  recallEngine: string;
  recalledTurns: number[];
  tokenOptimizer: string;
  savedTokens: number;
  lorebookSummary: string;
  sections: PromptSectionBreakdown[];
  fullSystemPrompt: string;
}

export interface NetworkTelemetryEntry {
  id: string;
  timestamp: number;
  kind: 'llm_stream' | 'llm_summary' | 'backend_health' | 'proxy_probe';
  label: string;
  endpoint: string;
  model?: string;
  status?: number;
  ok: boolean;
  streamMode?: string;
  ttfbMs?: number;
  ttftMs?: number;
  totalMs?: number;
  promptTokens?: number;
  outputTokens?: number;
  thoughtsTokens?: number;
  finishReason?: string;
  error?: string;
}

const MAX_PROMPT_SNAPSHOTS = 5;
const MAX_NETWORK_ENTRIES = 25;

let promptSnapshots: LastPromptSnapshot[] = [];
let networkTelemetry: NetworkTelemetryEntry[] = [];
let seqCounter = 0;

function nextTelemetryId(prefix: string): string {
  seqCounter += 1;
  return `${prefix}_${Date.now()}_${seqCounter}`;
}

/**
 * Strips or masks API keys, access tokens, and bearer secrets in logged endpoints.
 */
export function redactTelemetryUrl(rawUrl: string): string {
  const input = String(rawUrl || '').trim();
  if (!input) return '';
  return input
    .replace(/([?&](?:key|api_key|apikey|token|access_token|secret)=)([^&#\s]+)/gi, '$1[REDACTED]')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[REDACTED]')
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{12,})\b/g, '[REDACTED]');
}

export function recordPromptSnapshot(
  snap: Omit<LastPromptSnapshot, 'id' | 'timestamp'>
): LastPromptSnapshot {
  const full: LastPromptSnapshot = {
    ...snap,
    id: nextTelemetryId('prompt'),
    timestamp: Date.now(),
  };
  promptSnapshots = [full, ...promptSnapshots].slice(0, MAX_PROMPT_SNAPSHOTS);
  return full;
}

export function recordNetworkTelemetry(
  entry: Omit<NetworkTelemetryEntry, 'id' | 'timestamp'>
): NetworkTelemetryEntry {
  const full: NetworkTelemetryEntry = {
    ...entry,
    endpoint: redactTelemetryUrl(entry.endpoint),
    error: entry.error ? redactTelemetryUrl(entry.error) : undefined,
    id: nextTelemetryId('net'),
    timestamp: Date.now(),
  };
  networkTelemetry = [full, ...networkTelemetry].slice(0, MAX_NETWORK_ENTRIES);
  return full;
}

export function getLastPromptSnapshot(): LastPromptSnapshot | null {
  return promptSnapshots[0] || null;
}

export function getPromptSnapshots(): LastPromptSnapshot[] {
  return promptSnapshots.slice();
}

export function getNetworkTelemetry(): NetworkTelemetryEntry[] {
  return networkTelemetry.slice();
}

export function clearDevTelemetry(): void {
  promptSnapshots = [];
  networkTelemetry = [];
}
