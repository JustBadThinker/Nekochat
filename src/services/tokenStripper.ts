import type { TokenOptimizerLevel } from '../types';
import { estimateTokensRough, type TurnMessageInput } from './promptBudget';

export interface StripperPreviewSegment {
  text: string;
  state: 'kept' | 'stripped' | 'compressed';
}

export interface TokenStripperPreviewData {
  level: TokenOptimizerLevel;
  label: string;
  savingsBadge: string;
  recommendation: string;
  memoryTip: string;
  segments: StripperPreviewSegment[];
}

export interface StripHistoryResult {
  history: TurnMessageInput[];
  rawTokens: number;
  strippedTokens: number;
  savedTokens: number;
}

/**
 * Strips `<think>...</think>` blocks and normalizes whitespace/HTML bloat
 * for outgoing prompt assembly without mutating saved chat history.
 */
export function stripPromptText(text: string, level: TokenOptimizerLevel): string {
  if (!text || level === 'off') return text || '';

  let out = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[═─━▬┄┅┈┉╌╍⎯⏤=*_~░▒▓█]{4,}/g, '')
    .replace(/"\s*\+\s*"/g, ', ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (level === 'medium' || level === 'aggressive') {
    out = out
      .replace(/!\[(.*?)\]\(\s*(?:https?:\/\/[^\s)]+|data:image\/[^\s)]+)\s*\)/g, (_, alt) =>
        alt && alt.trim() ? `[Visual: ${alt.trim()}]` : ''
      )
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  if (level === 'aggressive' && out.length > 900) {
    const sentences = out.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
    const kept: string[] = [];
    let len = 0;
    for (const s of sentences) {
      if (len + s.length > 820 && kept.length >= 3) break;
      kept.push(s);
      len += s.length + 1;
    }
    out = kept.join(' ').trim();
  }

  return out;
}

/**
 * Compresses a single older turn while keeping spoken dialogue intact.
 */
function compressOlderTurnContent(content: string, level: 'medium' | 'aggressive'): string {
  const cleaned = stripPromptText(content, level);
  const limit = level === 'aggressive' ? 160 : 280;
  if (cleaned.length <= limit) return cleaned;

  const dialogues = cleaned.match(/"[^"]{2,180}"|“[^”]{2,180}”|「[^」]{2,180}」/g) || [];
  if (level === 'aggressive') {
    if (dialogues.length > 0) {
      const joined = dialogues.slice(0, 3).join(' ');
      const tail = cleaned.slice(-70).trim();
      return joined.includes(tail) ? joined : `${joined} ... ${tail}`;
    }
    return `${cleaned.slice(0, limit - 3).trim()}...`;
  }

  const head = cleaned.slice(0, 120).trim();
  const tail = cleaned.slice(-120).trim();
  const midDialogue = dialogues.find(d => !head.includes(d) && !tail.includes(d));
  return midDialogue ? `${head} ... ${midDialogue} ... ${tail}` : `${head} ... ${tail}`;
}

/**
 * Applies pre-send Token Stripper rules to older history turns while
 * keeping the most recent turns verbatim for continuity.
 */
export function stripHistoryForPrompt(
  history: TurnMessageInput[],
  level: TokenOptimizerLevel
): StripHistoryResult {
  const rawTokens = history.reduce((acc, m) => acc + estimateTokensRough(m.content || ''), 0);
  if (level === 'off' || history.length === 0) {
    return { history, rawTokens, strippedTokens: rawTokens, savedTokens: 0 };
  }

  const verbatimTailCount = level === 'aggressive' ? 2 : 4;
  const cutoff = Math.max(0, history.length - verbatimTailCount);

  const nextHistory = history.map((m, idx) => {
    if (idx >= cutoff) {
      const cleanRecent = (m.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      return cleanRecent === m.content ? m : { ...m, content: cleanRecent };
    }
    if (level === 'easy') {
      return { ...m, content: stripPromptText(m.content || '', 'easy') };
    }
    return { ...m, content: compressOlderTurnContent(m.content || '', level) };
  });

  const strippedTokens = nextHistory.reduce((acc, m) => acc + estimateTokensRough(m.content || ''), 0);
  return {
    history: nextHistory,
    rawTokens,
    strippedTokens,
    savedTokens: Math.max(0, rawTokens - strippedTokens),
  };
}

/**
 * Generates a short, color-coded sample preview for the Token Stripper UI
 * so users can see exactly what fades out at each tier.
 */
export function getTokenStripperPreview(level: TokenOptimizerLevel): TokenStripperPreviewData {
  const isEasyPlus = level === 'easy' || level === 'medium' || level === 'aggressive';
  const isMedPlus = level === 'medium' || level === 'aggressive';
  const isAgg = level === 'aggressive';

  const segments: StripperPreviewSegment[] = [
    { text: '[Card] ', state: 'kept' },
    { text: '<b>', state: isEasyPlus ? 'stripped' : 'kept' },
    { text: 'Warm, teasing rival who secretly cares.', state: 'kept' },
    { text: '</b>\n', state: isEasyPlus ? 'stripped' : 'kept' },
    { text: '================\n\n\n', state: isEasyPlus ? 'stripped' : 'kept' },
    { text: '[Older Turn]\n', state: 'kept' },
    { text: '<think>Plan next beat carefully...</think>\n', state: isEasyPlus ? 'stripped' : 'kept' },
    { text: '![Room](https://cdn.example/bg.png)\n', state: isMedPlus ? 'stripped' : 'kept' },
    {
      text: '*Rain tapped against the tall glass windows while the neon sign flickered outside the quiet café.* ',
      state: isAgg ? 'stripped' : isMedPlus ? 'compressed' : 'kept',
    },
    { text: '"Stay close to me," ', state: 'kept' },
    {
      text: '*he murmured softly, adjusting his coat.*',
      state: isAgg ? 'compressed' : 'kept',
    },
  ];

  const metaByLevel: Record<
    TokenOptimizerLevel,
    { label: string; savingsBadge: string; recommendation: string }
  > = {
    off: {
      label: 'Off',
      savingsBadge: '0% saved',
      recommendation:
        'Full fidelity — sends every word of your card and chat history untouched.',
    },
    easy: {
      label: 'Easy',
      savingsBadge: '~15–20% saved',
      recommendation:
        'Recommended for strict RP — strips <think>, HTML tags & extra whitespace while preserving your card & story text.',
    },
    medium: {
      label: 'Medium',
      savingsBadge: '~35% saved',
      recommendation:
        'Balanced — keeps your card, dialogue, and last 4 turns intact while trimming older filler.',
    },
    aggressive: {
      label: 'Aggressive',
      savingsBadge: '~55–65% saved',
      recommendation:
        'Max savings — best for long chats or tight token limits; compresses older turns to dialogue + key beats.',
    },
  };

  const meta = metaByLevel[level];
  return {
    level,
    ...meta,
    memoryTip:
      'Tip: Update Session Memory every ~20 messages (or enable Auto-Update Memory) so key plot facts stay intact when older turns are stripped.',
    segments,
  };
}
