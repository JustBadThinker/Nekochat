/**
 * Pure Lorebook activation resolver & keyword matcher.
 * Zero React Native / Expo dependencies for direct unit testing.
 */

import type { Lorebook } from '../types';

export function toKeyArray(raw: unknown): string[] {
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

export function applyLoreMacros(text: string, charName: string, userName: string): string {
  return text
    .replace(/\{\{\s*char\s*\}\}/gi, charName)
    .replace(/\{\{\s*user\s*\}\}/gi, userName)
    .replace(/<BOT>/g, charName)
    .replace(/<USER>/g, userName);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchesKeyword(
  haystack: string,
  rawKey: string,
  opts?: { caseSensitive?: boolean; matchWholeWords?: boolean }
): boolean {
  const key = rawKey.trim();
  if (!key || !haystack) return false;

  if (opts?.matchWholeWords) {
    const flags = opts.caseSensitive ? '' : 'i';
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(key)}($|[^\\p{L}\\p{N}_])`, flags + 'u');
    return pattern.test(haystack);
  }

  if (opts?.caseSensitive) {
    return haystack.includes(key);
  }
  return haystack.toLowerCase().includes(key.toLowerCase());
}

export function resolveActiveLorebooks(
  lorebooks: Lorebook[],
  opts?: { attachedIds?: string[]; chatLorebookIds?: string[] }
): { activeBooks: Lorebook[]; inactiveBooks: { title: string; reason: 'disabled' | 'unattached' }[] } {
  const activeBooks: Lorebook[] = [];
  const inactiveBooks: { title: string; reason: 'disabled' | 'unattached' }[] = [];

  const boundSet = new Set<string>([
    ...(opts?.attachedIds || []),
    ...(opts?.chatLorebookIds || []),
  ]);
  const hasExplicitBindings = boundSet.size > 0;

  for (const lb of lorebooks || []) {
    if (lb.enabled === false) {
      inactiveBooks.push({ title: lb.title, reason: 'disabled' });
      continue;
    }
    if (hasExplicitBindings && !boundSet.has(lb.id) && !lb.isPublic) {
      inactiveBooks.push({ title: lb.title, reason: 'unattached' });
      continue;
    }
    activeBooks.push(lb);
  }

  return { activeBooks, inactiveBooks };
}
