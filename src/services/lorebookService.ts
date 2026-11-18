/**
 * Lorebook & JanitorAI Script JSON Service
 *
 * - Parses pasted JanitorAI Scripts / SillyTavern V2 Lorebook JSON (`entries` object or array).
 * - Matches entries with `scanDepth`, `selective` + `secondaryKeys`, `constant`,
 *   `probability`, `priority`, and `tokenBudget`.
 */

import type { ChatMessage, Lorebook, LorebookEntry } from '../types';
import { estimateTokens } from './tokenOptimizerService';

function toKeyArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(k => String(k).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeEntry(raw: any, idx: number): LorebookEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const content = String(raw.content || '').trim();
  if (!content) return null;

  const keys = toKeyArray(raw.keys ?? raw.key);
  const secondaryKeys = toKeyArray(raw.secondaryKeys ?? raw.keysecondary);
  const title =
    String(raw.title || raw.comment || raw.name || keys[0] || `Entry #${idx + 1}`).trim();

  const probabilityRaw = typeof raw.probability === 'number' ? raw.probability : 100;
  const probability = Math.max(0, Math.min(100, probabilityRaw));

  return {
    id: String(raw.id ?? raw.uid ?? `lb_entry_${Date.now()}_${idx}`),
    title,
    keys,
    secondaryKeys: secondaryKeys.length > 0 ? secondaryKeys : undefined,
    content,
    priority: Number(raw.priority ?? raw.order ?? 100),
    enabled: raw.disable === true ? false : raw.enabled !== false,
    selective: Boolean(raw.selective) && secondaryKeys.length > 0,
    constant: Boolean(raw.constant),
    position: raw.position === 'before_char' ? 'before_char' : 'after_char',
    probability,
    useProbability: Boolean(raw.useProbability ?? (probability < 100)),
  };
}

/**
 * Safely extracts string arrays and note strings from a JanitorAI JavaScript Script
 * (e.g. `var triggers = [...]`, `var note = "..."`, `context.character.scenario = ...`)
 * WITHOUT using eval() or executing untrusted code.
 */
function parseJanitorJsScriptToLorebook(
  rawScript: string,
  titleOverride?: string
): { success: boolean; lorebook?: Lorebook; error?: string } {
  const stringVars = new Map<string, string>();
  const varStrRegex = /\b(?:var|let|const)\s+([a-zA-Z_$][\w$]*)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = varStrRegex.exec(rawScript)) !== null) {
    try {
      const rawLit = m[2];
      const val = rawLit.startsWith('"')
        ? JSON.parse(rawLit)
        : rawLit.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, '\n');
      if (val && val.length >= 12) {
        stringVars.set(m[1], val);
      }
    } catch {}
  }

  const keys: string[] = [];
  const arrRegex = /\b(?:var|let|const)\s+[a-zA-Z_$][\w$]*\s*=\s*\[([\s\S]*?)\]\s*;/g;
  while ((m = arrRegex.exec(rawScript)) !== null) {
    const itemRegex = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g;
    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemRegex.exec(m[1])) !== null) {
      const token = itemMatch[0].slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'").trim();
      if (token && !keys.includes(token)) keys.push(token);
    }
  }

  // Pick the longest descriptive note/rule string (or one referenced in scenario/personality assignment)
  let content = '';
  for (const [varName, val] of stringVars.entries()) {
    if (
      new RegExp(`context\\.character\\.(?:scenario|personality)[\\s\\S]{0,80}\\b${varName}\\b`).test(rawScript) ||
      val.length > content.length
    ) {
      if (val.length > content.length) content = val;
    }
  }

  if (!content) {
    return {
      success: false,
      error: 'Could not find a system note / lore content string in this JanitorAI JS script.',
    };
  }

  const entry: LorebookEntry = {
    id: `lb_script_${Date.now()}`,
    title: (titleOverride || 'Script Rule').trim(),
    keys,
    content,
    priority: 100,
    enabled: true,
    constant: keys.length === 0,
    position: 'after_char',
  };

  const lorebook: Lorebook = {
    id: `lb_import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId: 'user_local_01',
    title: (titleOverride || `Janitor Script (${keys.length} triggers)`).trim(),
    description: `Converted safely from JanitorAI JS Script (${keys.length} trigger keywords)`,
    scanDepth: /last_message/.test(rawScript) ? 1 : 6,
    tokenBudget: 1500,
    recursiveScanning: false,
    entries: [entry],
    isPublic: true,
    createdAt: new Date().toISOString(),
  };

  return { success: true, lorebook };
}

/**
 * Parses pasted JanitorAI Lorebook JSON, SillyTavern V2 JSON, or JanitorAI JS Script.
 */
export function parseJanitorLorebookJson(
  rawJson: string,
  titleOverride?: string
): { success: boolean; lorebook?: Lorebook; error?: string } {
  const trimmed = String(rawJson || '').trim();
  if (!trimmed) {
    return { success: false, error: 'Please paste your JanitorAI Lorebook JSON or Script.' };
  }

  // Detect JanitorAI JS Script (starts with var/let/const/function/comment or references context.chat/character)
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    if (/\b(?:var|let|const)\b|context\.(?:chat|character)/.test(trimmed)) {
      return parseJanitorJsScriptToLorebook(trimmed, titleOverride);
    }
  }

  let parsed: any;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err: any) {
    return { success: false, error: `Invalid JSON: ${err?.message || 'parse error'}` };
  }

  let rawList: any[] = [];
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.entries)) {
      rawList = parsed.entries;
    } else if (parsed.entries && typeof parsed.entries === 'object') {
      rawList = Object.values(parsed.entries);
    }
  }

  const entries = rawList
    .map((item, idx) => normalizeEntry(item, idx))
    .filter((e): e is LorebookEntry => Boolean(e));

  if (entries.length === 0) {
    return {
      success: false,
      error: 'No valid lorebook entries found (expected JanitorAI `entries` object or array with `content`).',
    };
  }

  const firstDepth = rawList.find(r => typeof r?.depth === 'number')?.depth;
  const scanDepth =
    typeof parsed?.scanDepth === 'number'
      ? parsed.scanDepth
      : typeof firstDepth === 'number'
        ? Math.max(1, firstDepth)
        : 6;

  const lorebook: Lorebook = {
    id: `lb_import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId: 'user_local_01',
    title:
      (titleOverride || parsed?.title || parsed?.name || `Janitor Lorebook (${entries.length})`).trim(),
    description:
      String(parsed?.description || `Imported JanitorAI / Script lorebook (${entries.length} entries)`).trim(),
    scanDepth,
    tokenBudget: typeof parsed?.tokenBudget === 'number' ? parsed.tokenBudget : 1024,
    recursiveScanning: Boolean(parsed?.recursiveScanning),
    entries,
    isPublic: true,
    createdAt: new Date().toISOString(),
  };

  return { success: true, lorebook };
}

function applyLoreMacros(text: string, charName: string, userName: string): string {
  return text
    .replace(/\{\{\s*char\s*\}\}/gi, charName)
    .replace(/\{\{\s*user\s*\}\}/gi, userName)
    .replace(/<BOT>/g, charName)
    .replace(/<USER>/g, userName);
}

export function matchLorebookEntries(
  lorebooks: Lorebook[],
  history: ChatMessage[],
  userMessage: string,
  opts: { charName: string; userName: string; attachedIds?: string[] }
): { title: string; content: string; priority: number }[] {
  if (!lorebooks || lorebooks.length === 0) return [];

  const attachedSet = opts.attachedIds && opts.attachedIds.length > 0 ? new Set(opts.attachedIds) : null;
  const activeBooks = attachedSet
    ? lorebooks.filter(lb => attachedSet.has(lb.id) || lb.isPublic)
    : lorebooks;

  const candidates: { title: string; content: string; priority: number; budget: number }[] = [];

  for (const lb of activeBooks) {
    const depth = Math.max(1, lb.scanDepth || 6);
    const scanText = (
      history
        .slice(-depth)
        .map(m => m.content)
        .join(' ') +
      ' ' +
      userMessage
    ).toLowerCase();

    for (const entry of lb.entries || []) {
      if (!entry.enabled) continue;

      let triggered = Boolean(entry.constant);
      if (!triggered) {
        const primaryHit = entry.keys.some(k => k.trim() && scanText.includes(k.trim().toLowerCase()));
        if (primaryHit) {
          if (entry.selective && entry.secondaryKeys && entry.secondaryKeys.length > 0) {
            triggered = entry.secondaryKeys.some(
              sk => sk.trim() && scanText.includes(sk.trim().toLowerCase())
            );
          } else {
            triggered = true;
          }
        }
      }

      if (!triggered) continue;
      if (entry.useProbability && typeof entry.probability === 'number' && entry.probability < 100) {
        if (Math.random() * 100 > entry.probability) continue;
      }

      candidates.push({
        title: entry.title,
        content: applyLoreMacros(entry.content, opts.charName, opts.userName),
        priority: entry.priority || 10,
        budget: lb.tokenBudget || 1024,
      });
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);

  const selected: { title: string; content: string; priority: number }[] = [];
  let usedTokens = 0;
  const maxBudget = Math.max(...activeBooks.map(b => b.tokenBudget || 1024), 512);

  for (const item of candidates) {
    const cost = estimateTokens(`${item.title}: ${item.content}`) + 4;
    if (selected.length > 0 && usedTokens + cost > maxBudget) break;
    selected.push({ title: item.title, content: item.content, priority: item.priority });
    usedTokens += cost;
  }

  return selected;
}
