/**
 * Pure, runtime-agnostic memory windowing, BM25 older-turn recall,
 * and sensitive-key redaction helpers.
 *
 * Designed to run identically on Android/iOS, Web (AsyncStorage fallback),
 * and Node unit tests without React Native or Expo runtime imports.
 */

export const RECENT_RAW_OVERLAP_TURNS = 6;

export interface RecalledOlderMessage {
  messageId: string;
  role: string;
  turnIndex: number;
  content: string;
  score: number;
  matchedTerms: string[];
  engine: 'sqlite_fts5' | 'memory_bm25';
}

export interface RecallHistoryMessageInput {
  id?: string;
  role: string;
  content: string;
  isError?: boolean;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'you', 'your', 'are', 'was', 'were',
  'have', 'has', 'had', 'not', 'but', 'from', 'they', 'she', 'her', 'him', 'his',
  'what', 'when', 'where', 'why', 'how', 'can', 'will', 'just', 'about', 'into',
  'there', 'their', 'them', 'then', 'than', 'only', 'also', 'very', 'some', 'more',
  'yang', 'dan', 'ini', 'itu', 'aku', 'kamu', 'dia', 'dari', 'untuk', 'dengan',
  'tidak', 'atau', 'juga', 'bisa', 'akan', 'sudah', 'lagi', 'kalau', 'karena', 'tapi',
]);

function stripThoughtBlocks(text: string): string {
  if (!text) return '';
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, ' ')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isEligibleTurn(msg: RecallHistoryMessageInput | undefined): msg is RecallHistoryMessageInput {
  if (!msg) return false;
  if (msg.role !== 'user' && msg.role !== 'assistant') return false;
  if (msg.isError || /^⚠️ Error/.test(msg.content || '')) return false;
  const trimmed = String(msg.content || '').trim();
  return trimmed.length > 0 && trimmed !== '...';
}

/**
 * Selects raw conversation history passed to `buildTurns` when
 * "Memory replaces old messages" is enabled.
 * Always preserves at least `minRecentRawTurns` (default 6) recent raw turns
 * so an immediate checkpoint never strips recent prose continuity.
 */
export function selectPromptHistoryWithMemory<T>(params: {
  fullHistory: T[];
  memoryReplacesOld: boolean;
  chatMemory: string;
  lastCheckpointIndex: number;
  minRecentRawTurns?: number;
}): T[] {
  const { fullHistory, memoryReplacesOld, chatMemory, lastCheckpointIndex } = params;
  const hasRealMemory = chatMemory.replace(/<\/?memory>/gi, '').trim().length > 0;
  if (
    !memoryReplacesOld ||
    !hasRealMemory ||
    lastCheckpointIndex < 0 ||
    lastCheckpointIndex >= fullHistory.length - 1
  ) {
    return fullHistory;
  }

  const keepRecent = Math.max(0, params.minRecentRawTurns ?? RECENT_RAW_OVERLAP_TURNS);
  const recentFloorIndex = Math.max(0, fullHistory.length - keepRecent);
  const sliceStart = Math.min(lastCheckpointIndex + 1, recentFloorIndex);
  return sliceStart > 0 ? fullHistory.slice(sliceStart) : fullHistory;
}

/**
 * Extracts normalized, deduplicated query keywords for BM25 recall.
 */
export function tokenizeRecallQuery(rawQuery: string): string[] {
  const tokens = String(rawQuery || '')
    .toLowerCase()
    .match(/[\p{L}\p{N}_]{2,}/gu);
  if (!tokens || tokens.length === 0) return [];

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const tok of tokens) {
    if (STOP_WORDS.has(tok) || seen.has(tok)) continue;
    seen.add(tok);
    unique.push(tok);
    if (unique.length >= 10) break;
  }
  return unique;
}

function tokenizeDocument(text: string): string[] {
  const tokens = String(text || '')
    .toLowerCase()
    .match(/[\p{L}\p{N}_]{2,}/gu);
  return tokens || [];
}

/**
 * Pure JavaScript BM25 search over older conversation turns from Turn #1 upward.
 * Serves as the Web / AsyncStorage fallback whenever native SQLite FTS5 is unavailable,
 * and powers the Developer Inspector's cross-platform Recall Lab.
 */
export function searchOlderMessagesInMemory(params: {
  history: RecallHistoryMessageInput[];
  query: string;
  excludeMessageIds?: string[];
  excludeAfterTurnIndex?: number;
  maxSnippets?: number;
  maxTokens?: number;
}): RecalledOlderMessage[] {
  const queryTerms = tokenizeRecallQuery(params.query);
  if (queryTerms.length === 0 || !Array.isArray(params.history) || params.history.length === 0) {
    return [];
  }

  const excluded = new Set(params.excludeMessageIds || []);
  const maxSnippets = params.maxSnippets ?? 3;
  const maxTokens = params.maxTokens ?? 300;
  const cutoff =
    typeof params.excludeAfterTurnIndex === 'number' && params.excludeAfterTurnIndex >= 0
      ? params.excludeAfterTurnIndex
      : params.history.length;

  interface IndexedDoc {
    messageId: string;
    role: string;
    turnIndex: number;
    cleanText: string;
    tf: Map<string, number>;
    len: number;
  }

  const docs: IndexedDoc[] = [];
  const df = new Map<string, number>();

  for (let i = 0; i < Math.min(params.history.length, cutoff); i++) {
    const msg = params.history[i];
    if (!isEligibleTurn(msg)) continue;
    const msgId = msg.id || `turn_${i}`;
    if (excluded.has(msgId)) continue;

    const cleanText = stripThoughtBlocks(String(msg.content || ''));
    if (!cleanText) continue;

    const tokens = tokenizeDocument(cleanText);
    if (tokens.length === 0) continue;

    const tf = new Map<string, number>();
    for (const tok of tokens) {
      tf.set(tok, (tf.get(tok) || 0) + 1);
    }
    for (const term of queryTerms) {
      if (tf.has(term)) {
        df.set(term, (df.get(term) || 0) + 1);
      }
    }

    docs.push({
      messageId: msgId,
      role: msg.role,
      turnIndex: i,
      cleanText,
      tf,
      len: tokens.length,
    });
  }

  if (docs.length === 0) return [];

  const avgDl = docs.reduce((sum, d) => sum + d.len, 0) / docs.length || 1;
  const k1 = 1.2;
  const b = 0.75;
  const totalDocs = docs.length;

  const scored: (RecalledOlderMessage & { cleanText: string })[] = [];

  for (const doc of docs) {
    let score = 0;
    const matchedTerms: string[] = [];

    for (const term of queryTerms) {
      const freq = doc.tf.get(term) || 0;
      if (freq <= 0) continue;
      matchedTerms.push(term);
      const docFreq = df.get(term) || 0;
      const idf = Math.log(1 + (totalDocs - docFreq + 0.5) / (docFreq + 0.5));
      const norm = freq * (k1 + 1) / (freq + k1 * (1 - b + b * (doc.len / avgDl)));
      score += idf * norm;
    }

    if (score <= 0 || matchedTerms.length === 0) continue;

    scored.push({
      messageId: doc.messageId,
      role: doc.role,
      turnIndex: doc.turnIndex,
      content: doc.cleanText.slice(0, 420),
      cleanText: doc.cleanText,
      score,
      matchedTerms,
      engine: 'memory_bm25',
    });
  }

  scored.sort((a, bDoc) => {
    if (Math.abs(bDoc.score - a.score) > 1e-6) return bDoc.score - a.score;
    return bDoc.turnIndex - a.turnIndex;
  });

  const results: RecalledOlderMessage[] = [];
  const seenNormalized = new Set<string>();
  let usedTokens = 0;

  for (const item of scored) {
    if (results.length >= maxSnippets) break;
    const snippetText = item.content.trim();
    const normKey = snippetText.toLowerCase().replace(/\s+/g, ' ');
    if (!normKey || seenNormalized.has(normKey)) continue;

    const estTokens = Math.ceil(snippetText.length / 4) + 8;
    if (results.length > 0 && usedTokens + estTokens > maxTokens) continue;

    if (estTokens > maxTokens) {
      const allowedChars = Math.max(80, (maxTokens - 8) * 4);
      const clipped = `${snippetText.slice(0, allowedChars).trim()}...`;
      seenNormalized.add(normKey);
      results.push({
        messageId: item.messageId,
        role: item.role,
        turnIndex: item.turnIndex,
        content: clipped,
        score: item.score,
        matchedTerms: item.matchedTerms,
        engine: 'memory_bm25',
      });
      usedTokens += Math.ceil(clipped.length / 4) + 8;
      continue;
    }

    seenNormalized.add(normKey);
    results.push({
      messageId: item.messageId,
      role: item.role,
      turnIndex: item.turnIndex,
      content: snippetText,
      score: item.score,
      matchedTerms: item.matchedTerms,
      engine: 'memory_bm25',
    });
    usedTokens += estTokens;
  }

  return results;
}

/**
 * Picks up to 3 distinctive words from a message (used for 1-tap "Test Turn #1" in Recall Lab).
 */
export function extractDistinctiveQueryFromMessage(content: string): string {
  const clean = stripThoughtBlocks(String(content || ''));
  const terms = tokenizeRecallQuery(clean);
  if (terms.length === 0) return '';
  const sorted = terms.slice().sort((a, b) => b.length - a.length);
  return sorted.slice(0, 3).join(' ');
}

const SENSITIVE_KEY_PATTERN = /(api.?key|secret|token|passcode|password|pin|hash|authorization|credential)/i;

function maskSecretString(val: string): string {
  const trimmed = val.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 6) return '[REDACTED]';
  return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)} (len=${trimmed.length})`;
}

function redactRecursive(node: unknown, keyHint = ''): unknown {
  if (typeof node === 'string') {
    if (SENSITIVE_KEY_PATTERN.test(keyHint) && node.trim().length > 0) {
      return maskSecretString(node);
    }
    return node.replace(/\b(sk-[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{12,})\b/g, m => maskSecretString(m));
  }
  if (Array.isArray(node)) {
    return node.map(item => redactRecursive(item, keyHint));
  }
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = redactRecursive(v, k);
    }
    return out;
  }
  return node;
}

/**
 * Safely masks credentials, API keys, PINs, and hashes before rendering
 * storage entries inside the Developer Inspector.
 */
export function redactSensitiveStorageValue(key: string, rawValue: string): string {
  const text = String(rawValue ?? '');
  if (!text) return '';

  try {
    const parsed = JSON.parse(text);
    const redacted = redactRecursive(parsed, key);
    return JSON.stringify(redacted, null, 2);
  } catch {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      return maskSecretString(text);
    }
    return text.replace(
      /(sk-[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{12,}|Bearer\s+[A-Za-z0-9._-]{8,})/gi,
      m => maskSecretString(m)
    );
  }
}
