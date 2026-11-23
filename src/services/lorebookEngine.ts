/**
 * Glaze + SillyTavern-inspired Lorebook scanning, recursive activation,
 * sticky/cooldown/delay state, inclusion groups, token budgeting, and diagnostics.
 */

import type { ChatMessage, Lorebook, LorebookEntry } from '../types';
import { applyLoreMacros, matchesKeyword, resolveActiveLorebooks, toKeyArray } from './lorebookMatcher';

export type LorebookPosition = 'before_char' | 'after_char' | 'before_history';
export type ActivationSource = 'keyword' | 'constant' | 'sticky' | 'recursive';
export type SkipReason =
  | 'disabled'
  | 'inactive_book'
  | 'character_filtered'
  | 'delay_pending'
  | 'cooldown_active'
  | 'keyword_miss'
  | 'secondary_key_miss'
  | 'probability_skip'
  | 'recursion_excluded'
  | 'duplicate_entry'
  | 'group_conflict'
  | 'budget_exceeded'
  | 'max_entries_reached';

export interface LorebookEntryRuntime {
  stickyRemaining: number;
  cooldownRemaining: number;
}

export type LorebookRuntimeState = Record<string, LorebookEntryRuntime>;

export interface LorebookEntryDiagnostic {
  bookTitle: string;
  entryId: string;
  entryTitle: string;
  status: 'matched' | SkipReason;
  activationSource?: ActivationSource;
  matchedKeywords?: string[];
  recursionDepth?: number;
  estimatedTokens?: number;
}

export interface LorebookSelectedEntry {
  id: string;
  bookId: string;
  bookTitle: string;
  title: string;
  content: string;
  priority: number;
  position: LorebookPosition;
  depth?: number;
  activationSource: ActivationSource;
  matchedKeywords: string[];
  recursionDepth: number;
  estimatedTokens: number;
}

export interface LorebookMatchResult {
  selected: LorebookSelectedEntry[];
  byPosition: Record<LorebookPosition, LorebookSelectedEntry[]>;
  nextRuntimeState: LorebookRuntimeState;
  diagnostics: {
    scannedBooks: number;
    inactiveBooks: { title: string; reason: 'disabled' | 'unattached' }[];
    totalEntries: number;
    detectedCount: number;
    matchedCount: number;
    recursiveActivations: number;
    duplicateEntries: number;
    estimatedTokens: number;
    entries: LorebookEntryDiagnostic[];
  };
}

const estimateEntryTokens = (text: string): number => (text ? Math.ceil(text.length / 4) : 0);

interface CandidateEntry extends LorebookSelectedEntry {
  tokenBudget: number;
  ignoreBudget: boolean;
  group?: string;
  groupWeight: number;
  constant: boolean;
  preventRecursion: boolean;
  sticky?: number;
  cooldown?: number;
}

export function runLorebookEngine(
  lorebooks: Lorebook[],
  history: ChatMessage[],
  userMessage: string,
  opts: {
    charName: string;
    userName: string;
    attachedIds?: string[];
    chatLorebookIds?: string[];
    runtimeState?: LorebookRuntimeState;
    globalBudget?: number;
    maxEntries?: number;
    rng?: () => number;
  }
): LorebookMatchResult {
  const emptyByPos: Record<LorebookPosition, LorebookSelectedEntry[]> = {
    before_char: [],
    after_char: [],
    before_history: [],
  };

  if (!lorebooks || lorebooks.length === 0) {
    return {
      selected: [],
      byPosition: emptyByPos,
      nextRuntimeState: { ...(opts.runtimeState || {}) },
      diagnostics: {
        scannedBooks: 0,
        inactiveBooks: [],
        totalEntries: 0,
        detectedCount: 0,
        matchedCount: 0,
        recursiveActivations: 0,
        duplicateEntries: 0,
        estimatedTokens: 0,
        entries: [],
      },
    };
  }

  const { activeBooks, inactiveBooks } = resolveActiveLorebooks(lorebooks, {
    attachedIds: opts.attachedIds,
    chatLorebookIds: opts.chatLorebookIds,
  });

  const nextRuntime: LorebookRuntimeState = {};
  for (const [k, v] of Object.entries(opts.runtimeState || {})) {
    nextRuntime[k] = { ...v };
  }

  const totalTurns = history.length + (userMessage.trim() ? 1 : 0);
  const rng = opts.rng || Math.random;
  const candidates: CandidateEntry[] = [];
  const diagnostics: LorebookEntryDiagnostic[] = [];
  const seenKeys = new Set<string>();
  let totalEntries = 0;
  let duplicateEntries = 0;
  let recursiveActivations = 0;

  for (const lb of activeBooks) {
    const defaultDepth = Math.max(1, lb.scanDepth || 6);
    const maxRecDepth = lb.recursiveScanning ? Math.min(Math.max(1, lb.maxRecursionDepth ?? 5), 5) : 0;
    const entries = lb.entries || [];
    totalEntries += entries.length;

    const getScanText = (entryDepth?: number, extraText = '') => {
      const d = Math.max(1, entryDepth || defaultDepth);
      const histText = history.slice(-d).map(m => m.content).join('\n');
      return `${histText}\n${userMessage}${extraText ? `\n${extraText}` : ''}`;
    };

    const matchedIdsInBook = new Set<string>();
    const pendingEntries: LorebookEntry[] = [];
    const lastPendingMiss = new Map<string, LorebookEntryDiagnostic>();

    const tryActivate = (
      entry: LorebookEntry,
      recDepth: number,
      extraRecursiveText: string,
      recordMiss: boolean
    ): { activated: boolean; contentForRecursion?: string; preventRecursion?: boolean } => {
      const entryId = entry.id || entry.title;
      const recordSkip = (status: SkipReason) => {
        const diag: LorebookEntryDiagnostic = { bookTitle: lb.title, entryId, entryTitle: entry.title, status };
        if (recordMiss) diagnostics.push(diag);
        else lastPendingMiss.set(entryId, diag);
      };

      if (entry.enabled === false) {
        diagnostics.push({ bookTitle: lb.title, entryId, entryTitle: entry.title, status: 'disabled' });
        return { activated: false };
      }

      if (entry.characterFilter && entry.characterFilter.length > 0) {
        const charLower = opts.charName.toLowerCase();
        const allowed = entry.characterFilter.some(f => f.trim().toLowerCase() === charLower);
        if (!allowed) {
          recordSkip('character_filtered');
          return { activated: false };
        }
      }

      if (typeof entry.delay === 'number' && entry.delay > 0 && totalTurns < entry.delay) {
        recordSkip('delay_pending');
        return { activated: false };
      }

      const rt = nextRuntime[entryId];
      if (rt && rt.cooldownRemaining > 0 && !(rt.stickyRemaining > 0)) {
        nextRuntime[entryId] = { stickyRemaining: 0, cooldownRemaining: rt.cooldownRemaining - 1 };
        recordSkip('cooldown_active');
        return { activated: false };
      }

      if (recDepth > 0 && entry.excludeRecursion) {
        recordSkip('recursion_excluded');
        return { activated: false };
      }

      const keys = Array.isArray(entry.keys) ? entry.keys : toKeyArray((entry as any).keys ?? (entry as any).key);
      const secondaryKeys = Array.isArray(entry.secondaryKeys)
        ? entry.secondaryKeys
        : toKeyArray((entry as any).secondaryKeys ?? (entry as any).keysecondary);

      const scanText = getScanText(entry.scanDepth, extraRecursiveText);
      const matchOpts = { caseSensitive: entry.caseSensitive, matchWholeWords: entry.matchWholeWords };

      let source: ActivationSource = 'keyword';
      const matchedKeywords: string[] = [];

      if (entry.constant) {
        source = 'constant';
      } else {
        for (const k of keys) {
          if (matchesKeyword(scanText, k, matchOpts)) matchedKeywords.push(k.trim());
        }
        if (matchedKeywords.length > 0) {
          if (entry.selective && secondaryKeys.length > 0) {
            const secHits = secondaryKeys.filter(sk => matchesKeyword(scanText, sk, matchOpts));
            if (secHits.length === 0) {
              recordSkip('secondary_key_miss');
              return { activated: false };
            }
            matchedKeywords.push(...secHits.map(s => s.trim()));
          }
          source = recDepth > 0 ? 'recursive' : 'keyword';
        } else if (rt && rt.stickyRemaining > 0) {
          source = 'sticky';
        } else {
          recordSkip('keyword_miss');
          return { activated: false };
        }
      }

      if (source !== 'sticky' && entry.useProbability && typeof entry.probability === 'number' && entry.probability < 100) {
        if (rng() * 100 > entry.probability) {
          diagnostics.push({ bookTitle: lb.title, entryId, entryTitle: entry.title, status: 'probability_skip' });
          return { activated: false };
        }
      }

      const expanded = applyLoreMacros(entry.content, opts.charName, opts.userName);
      const dedupeKey = `${entry.title.toLowerCase()}::${expanded.toLowerCase()}`;
      if (seenKeys.has(dedupeKey)) {
        duplicateEntries += 1;
        diagnostics.push({ bookTitle: lb.title, entryId, entryTitle: entry.title, status: 'duplicate_entry' });
        return { activated: false };
      }
      seenKeys.add(dedupeKey);
      matchedIdsInBook.add(entryId);
      if (recDepth > 0) recursiveActivations += 1;

      if (typeof entry.sticky === 'number' && entry.sticky > 0) {
        const prevSticky = rt?.stickyRemaining || 0;
        const nextSticky = source === 'sticky' ? prevSticky - 1 : entry.sticky;
        nextRuntime[entryId] = {
          stickyRemaining: Math.max(0, nextSticky),
          cooldownRemaining: nextSticky <= 0 && entry.cooldown ? entry.cooldown : 0,
        };
      } else if (typeof entry.cooldown === 'number' && entry.cooldown > 0) {
        nextRuntime[entryId] = { stickyRemaining: 0, cooldownRemaining: entry.cooldown };
      }

      const pos: LorebookPosition =
        entry.position === 'before_char' || entry.position === 'before_history' ? entry.position : 'after_char';

      candidates.push({
        id: entryId,
        bookId: lb.id,
        bookTitle: lb.title,
        title: entry.title,
        content: expanded,
        priority: entry.priority ?? 10,
        position: pos,
        depth: entry.depth,
        activationSource: source,
        matchedKeywords,
        recursionDepth: recDepth,
        estimatedTokens: estimateEntryTokens(`${entry.title}: ${expanded}`) + 4,
        tokenBudget: lb.tokenBudget || 1024,
        ignoreBudget: Boolean(entry.ignoreBudget),
        group: entry.group?.trim() || undefined,
        groupWeight: entry.groupWeight ?? entry.priority ?? 10,
        constant: Boolean(entry.constant),
        preventRecursion: Boolean(entry.preventRecursion),
      });

      return { activated: true, contentForRecursion: expanded, preventRecursion: Boolean(entry.preventRecursion) };
    };

    let accumulatedRecursiveText = '';
    for (const entry of entries) {
      const res = tryActivate(entry, 0, '', !lb.recursiveScanning);
      if (res.activated && res.contentForRecursion && !res.preventRecursion) {
        accumulatedRecursiveText += `\n${res.contentForRecursion}`;
      } else if (!res.activated && lb.recursiveScanning && entry.enabled !== false) {
        pendingEntries.push(entry);
      }
    }

    for (let depth = 1; depth <= maxRecDepth && pendingEntries.length > 0 && accumulatedRecursiveText; depth++) {
      let nextLayerText = '';
      for (const entry of pendingEntries) {
        const entryId = entry.id || entry.title;
        if (matchedIdsInBook.has(entryId)) continue;
        const res = tryActivate(entry, depth, accumulatedRecursiveText, false);
        if (res.activated && res.contentForRecursion && !res.preventRecursion) {
          nextLayerText += `\n${res.contentForRecursion}`;
        }
      }
      if (!nextLayerText) break;
      accumulatedRecursiveText += nextLayerText;
    }

    for (const entry of pendingEntries) {
      const entryId = entry.id || entry.title;
      if (matchedIdsInBook.has(entryId)) continue;
      const diag = lastPendingMiss.get(entryId);
      if (diag) diagnostics.push(diag);
    }
  }

  const detectedCount = candidates.length;

  // Inclusion group resolution (highest groupWeight, then priority, then relevance)
  const groupWinners = new Map<string, CandidateEntry>();
  const afterGroupFilter: CandidateEntry[] = [];
  const sortScore = (c: CandidateEntry) =>
    (c.constant ? 10000 : 0) + c.groupWeight * 10 + c.priority + c.matchedKeywords.length * 5 - c.recursionDepth * 2;

  for (const c of candidates) {
    if (!c.group) {
      afterGroupFilter.push(c);
      continue;
    }
    const existing = groupWinners.get(c.group);
    if (!existing || sortScore(c) > sortScore(existing)) {
      if (existing) {
        diagnostics.push({
          bookTitle: existing.bookTitle,
          entryId: existing.id,
          entryTitle: existing.title,
          status: 'group_conflict',
        });
      }
      groupWinners.set(c.group, c);
    } else {
      diagnostics.push({ bookTitle: c.bookTitle, entryId: c.id, entryTitle: c.title, status: 'group_conflict' });
    }
  }
  for (const winner of groupWinners.values()) afterGroupFilter.push(winner);

  afterGroupFilter.sort((a, b) => sortScore(b) - sortScore(a));

  const maxEntries = opts.maxEntries ?? Math.min(...activeBooks.map(b => b.maxEntries || 999), 999);
  const globalBudget =
    opts.globalBudget ?? Math.max(...activeBooks.map(b => b.globalBudget || b.tokenBudget || 1024), 512);
  const perBookUsed = new Map<string, number>();
  let totalUsedTokens = 0;

  const selected: LorebookSelectedEntry[] = [];
  for (const item of afterGroupFilter) {
    if (!item.ignoreBudget) {
      if (selected.length >= maxEntries) {
        diagnostics.push({
          bookTitle: item.bookTitle,
          entryId: item.id,
          entryTitle: item.title,
          status: 'max_entries_reached',
        });
        continue;
      }
      const bookUsed = perBookUsed.get(item.bookId) || 0;
      if (selected.length > 0 && (totalUsedTokens + item.estimatedTokens > globalBudget || bookUsed + item.estimatedTokens > item.tokenBudget)) {
        diagnostics.push({
          bookTitle: item.bookTitle,
          entryId: item.id,
          entryTitle: item.title,
          status: 'budget_exceeded',
          estimatedTokens: item.estimatedTokens,
        });
        continue;
      }
      perBookUsed.set(item.bookId, bookUsed + item.estimatedTokens);
      totalUsedTokens += item.estimatedTokens;
    }

    selected.push(item);
    emptyByPos[item.position].push(item);
    diagnostics.push({
      bookTitle: item.bookTitle,
      entryId: item.id,
      entryTitle: item.title,
      status: 'matched',
      activationSource: item.activationSource,
      matchedKeywords: item.matchedKeywords,
      recursionDepth: item.recursionDepth,
      estimatedTokens: item.estimatedTokens,
    });
  }

  return {
    selected,
    byPosition: emptyByPos,
    nextRuntimeState: nextRuntime,
    diagnostics: {
      scannedBooks: activeBooks.length,
      inactiveBooks,
      totalEntries,
      detectedCount,
      matchedCount: selected.length,
      recursiveActivations,
      duplicateEntries,
      estimatedTokens: totalUsedTokens,
      entries: diagnostics,
    },
  };
}
