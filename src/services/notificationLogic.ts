import type { CreatorDropNotificationItem } from '../types';

export interface NotificationCopy {
  title: string;
  body: string;
}

/**
 * Adjusts a target local trigger timestamp so it avoids quiet hours (23:00–07:59).
 * If the hour falls in quiet hours, shifts to 09:00 local time (next morning if >= 23).
 */
export function adjustForQuietHours(targetMs: number, enabled: boolean): number {
  if (!enabled) return targetMs;
  const d = new Date(targetMs);
  const h = d.getHours();
  if (h >= 23) {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  }
  if (h < 8) {
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  }
  return targetMs;
}

export function isCharacterNsfw(char: {
  contentRating?: string;
  isNsfw?: boolean;
  tags?: string[];
}): boolean {
  if (char.isNsfw) return true;
  if (String(char.contentRating || '').toUpperCase() === 'NSFW') return true;
  return Array.isArray(char.tags)
    ? char.tags.some(t => /^nsfw$/i.test(String(t || '').trim()))
    : false;
}

export function pickEligibleCharacter<
  T extends { contentRating?: string; isNsfw?: boolean; tags?: string[] },
>(candidates: T[], discreetMode: boolean): T | null {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  if (!discreetMode) return candidates[0] || null;
  return candidates.find(c => !isCharacterNsfw(c)) || null;
}

export function formatMissYouNotification(name: string, discreetMode: boolean): NotificationCopy {
  if (discreetMode) {
    return {
      title: 'NekoChat',
      body: 'A companion message is waiting for you.',
    };
  }
  const cleanName = name.trim() || 'Your companion';
  return {
    title: `${cleanName} misses you`,
    body: `Hey, I miss you — pick up your story with ${cleanName}?`,
  };
}

export function formatAlgorithmPickNotification(name: string, discreetMode: boolean): NotificationCopy {
  if (discreetMode) {
    return {
      title: 'NekoChat',
      body: 'New match recommendation ready in Discover.',
    };
  }
  const cleanName = name.trim() || 'Someone new';
  return {
    title: `Hey, ${cleanName} wants to meet you`,
    body: 'Matched with your favorite roleplay vibes in NekoChat.',
  };
}

export function formatCreatorDropNotification(
  creatorHandle: string,
  characterName: string,
  discreetMode: boolean
): NotificationCopy {
  if (discreetMode) {
    return {
      title: 'NekoChat',
      body: 'A creator you follow published a new card.',
    };
  }
  const cleanHandle = creatorHandle.replace(/^@/, '').trim() || 'creator';
  const cleanChar = characterName.trim() || 'New character';
  return {
    title: `@${cleanHandle} posted a new card`,
    body: `Check out "${cleanChar}" in NekoChat.`,
  };
}

export interface CreatorFeedCandidate {
  id: string;
  name: string;
  avatarUrl?: string;
  shortDescription?: string;
  isNsfw?: boolean;
  source?: string;
  fullPath?: string;
}

/**
 * Diffs fetched creator cards against the persisted seen ID map.
 * On the first check for a creator (`!(handle in seenMap)`), seeds the baseline silently
 * without emitting flood notifications for old cards.
 */
export function diffNewCreatorDrops(
  creatorHandle: string,
  fetched: CreatorFeedCandidate[],
  seenMap: Record<string, string[]>,
  nowMs = Date.now()
): {
  drops: CreatorDropNotificationItem[];
  nextSeenMap: Record<string, string[]>;
  wasSeeded: boolean;
} {
  const cleanHandle = creatorHandle.replace(/^@/, '').trim();
  const nextSeenMap: Record<string, string[]> = { ...seenMap };
  const ids = fetched.map(c => String(c.id || '').trim()).filter(Boolean);

  if (!cleanHandle || ids.length === 0) {
    return { drops: [], nextSeenMap, wasSeeded: false };
  }

  const hasBaseline = Object.prototype.hasOwnProperty.call(seenMap, cleanHandle);
  if (!hasBaseline) {
    nextSeenMap[cleanHandle] = Array.from(new Set(ids)).slice(0, 60);
    return { drops: [], nextSeenMap, wasSeeded: true };
  }

  const prevSeen = new Set(seenMap[cleanHandle] || []);
  const drops: CreatorDropNotificationItem[] = [];

  for (const item of fetched) {
    const id = String(item.id || '').trim();
    if (!id || prevSeen.has(id)) continue;
    prevSeen.add(id);
    drops.push({
      id: `drop_${cleanHandle}_${id}`,
      creatorHandle: cleanHandle,
      characterId: id,
      characterName: item.name || 'New Companion',
      avatarUrl: item.avatarUrl,
      tagline: item.shortDescription,
      isNsfw: Boolean(item.isNsfw),
      discoveredAt: nowMs,
      read: false,
      source: item.source,
      fullPath: item.fullPath,
    });
  }

  nextSeenMap[cleanHandle] = Array.from(prevSeen).slice(-60);
  return { drops, nextSeenMap, wasSeeded: false };
}
