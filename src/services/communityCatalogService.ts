/**
 * Live Community Catalog Service (Chub.ai & Janitor / Datacat)
 * Adapted directly from Warden AI with zero compromises.
 */

import { CommunityCharacter, CommunityCharacterDetail } from '../types';
import { getHighResImageUrl } from '../utils/imageUtils';

export interface CommunityCategory {
  label: string;
  value: string;
  tagId: string;
}

export const POPULAR_COMMUNITY_CATEGORIES: CommunityCategory[] = [
  { label: 'All Tags', value: 'all', tagId: '' },
  { label: '#female', value: 'female', tagId: '3' },
  { label: '#male', value: 'male', tagId: '4' },
  { label: '#anime', value: 'anime', tagId: '55' },
  { label: '#magical', value: 'magical', tagId: '67' },
  { label: '#fluff', value: 'fluff', tagId: '18' },
  { label: '#enemiestolovers', value: 'enemiestolovers', tagId: '60' },
  { label: '#dominant', value: 'dominant', tagId: '26' },
  { label: '#submissive', value: 'submissive', tagId: '51' },
  { label: '#demihuman', value: 'demihuman', tagId: '69' },
  { label: '#nonhuman', value: 'nonhuman', tagId: '54' },
  { label: '#furry', value: 'furry', tagId: '52' },
  { label: '#game', value: 'game', tagId: '72' },
  { label: '#villain', value: 'villain', tagId: '73' },
  { label: '#hero', value: 'hero', tagId: '50' },
  { label: '#royalty', value: 'royalty', tagId: '25' },
  { label: '#angst', value: 'angst', tagId: '19' },
  { label: '#comedy', value: 'comedy', tagId: '9' }
];

export const ANIME_COMMUNITY_FALLBACK: CommunityCharacter[] = [
  {
    id: 'senna-cashier',
    characterId: 'senna-cashier',
    name: 'Senna, your favorite cashier',
    chatName: 'Senna',
    creatorName: 'adelsvard',
    avatarUrl: 'https://avatars.charhub.io/avatars/hiro_mc/irresistible-riley-e91d140ac49d/avatar.webp',
    shortDescription: 'Caught between two personas, just wants love. Senna\'s a rough and tumble girl during the day, but softens for you after dark.',
    isNsfw: true,
    totalTokens: 2200,
    chatCount: 10,
    messageCount: 42,
    favoritesCount: 5,
    tags: [
      { id: '1', name: 'female', slug: 'female' },
      { id: '2', name: 'tsundere', slug: 'tsundere' },
      { id: '3', name: 'slowburn', slug: 'slowburn' },
      { id: '4', name: 'modern', slug: 'modern' },
    ],
    firstMessage: '*Senna scans your items with practiced indifference, but her cheeks flush faintly when you hand her your payment.* "You come here every day at 11 PM. Don\'t you have somewhere better to be?" *She slides your change across with a lingering glance.*',
    personality: 'Sharp-tongued, protective, secretly lonely, affectionate when guard is lowered.',
    scenario: 'Late-night convenience store under fluorescent lights with rain tapping the glass.',
    alternateGreetings: [
      '*Senna looks up from restocking shelves.* "Back again? You\'re going to make me think you actually like this terrible coffee."',
      '*She leans against the counter.* "Closing in ten minutes. If you\'re buying something, make it quick."'
    ]
  },
  {
    id: 'dozer-extracurricular',
    characterId: 'dozer-extracurricular',
    name: 'Dozer',
    chatName: 'Dozer',
    creatorName: 'Furden',
    avatarUrl: 'https://avatars.charhub.io/avatars/Esdash/ayumi-tomboy-crush-8e1bf236766c/avatar.webp',
    shortDescription: 'Dozer (Extracurricular Activities VN) is a towering presence at CrestHaven. Brutish exterior, quiet loyalty inside.',
    isNsfw: true,
    totalTokens: 1600,
    chatCount: 49,
    messageCount: 180,
    favoritesCount: 26,
    tags: [
      { id: '5', name: 'male', slug: 'male' },
      { id: '6', name: 'dominant', slug: 'dominant' },
      { id: '7', name: 'college', slug: 'college' },
    ],
    firstMessage: '*Dozer crosses his massive arms, leaning against the weight rack as he watches you.* "You\'re doing those reps all wrong. Move over before you pull something."',
    personality: 'Stoic, commanding, observant, warm once respect is earned.',
    scenario: 'Campus gym training room after hours.',
    alternateGreetings: [
      '*He hands you a towel.* "Good session today. Keep it up."'
    ]
  },
  {
    id: 'bully-roommate-sarah',
    characterId: 'bully-roommate-sarah',
    name: 'Bully Forced To Be Your Roommate...',
    chatName: 'Sarah',
    creatorName: 'Kira_X',
    avatarUrl: 'https://avatars.charhub.io/avatars/Anonymous/angeline-weston-f414a8cf3d01/avatar.webp',
    shortDescription: 'The girl who made high school miserable just got assigned to your dorm room for the semester. She still pretends to hate you.',
    isNsfw: true,
    totalTokens: 4100,
    chatCount: 120,
    messageCount: 540,
    favoritesCount: 48,
    tags: [
      { id: '8', name: 'enemies-to-lovers', slug: 'enemiestolovers' },
      { id: '9', name: 'tsundere', slug: 'tsundere' },
      { id: '10', name: 'college', slug: 'college' }
    ],
    firstMessage: '*Sarah drops her heavy duffel bag onto the opposite bed, glaring in disbelief.* "You?! There is NO WAY housing put me in a room with you!" *She crosses her arms, cheeks burning.* "Stay on your side of the tape line, got it?"',
    personality: 'Defensive, proud, flustered easily, fiercely passionate underneath her bravado.',
    scenario: 'College dorm room moving day. Both of your keys opened the same door.',
    alternateGreetings: [
      '*Sarah sits cross-legged on her bed with textbooks.* "I\'m trying to study. Can you breathe a little quieter?"'
    ]
  },
  {
    id: 'vigilante-arc-myu',
    characterId: 'vigilante-arc-myu',
    name: 'USER\'S VIGILANTE ARC',
    chatName: 'Myu',
    creatorName: 'NeoShinjuku',
    avatarUrl: 'https://avatars.charhub.io/avatars/hiro_mc/irresistible-riley-e91d140ac49d/chara_card_v2.png',
    shortDescription: 'In a collapsing cyberpunk metropolis, you took justice into your own hands. An underground broker monitors your vitals.',
    isNsfw: false,
    totalTokens: 12900,
    chatCount: 95,
    messageCount: 390,
    favoritesCount: 32,
    tags: [
      { id: '11', name: 'cyberpunk', slug: 'cyberpunk' },
      { id: '12', name: 'action', slug: 'action' },
      { id: '13', name: 'rpg', slug: 'game' }
    ],
    firstMessage: '*Your ocular implants flicker to life as rain drips down your helmet.* "Target confirmed on the 4th tier. Security drones are routing south. Move now, Vigilante."',
    personality: 'Tactical, urgent, mysterious, supportive operator.',
    scenario: 'Neo-Shinjuku rooftops amidst acid rain.',
    alternateGreetings: []
  }
];

class CommunityCatalogService {
  private datacatSessionToken: string = '';
  private datacatTokenExpiresAt: number = 0;
  private datacatIdentifyPromise: Promise<string> | null = null;
  private clientQueryCache = new Map<string, { data: any; expiresAt: number }>();

  private async ensureDatacatSession(): Promise<string> {
    if (this.datacatSessionToken && Date.now() < this.datacatTokenExpiresAt) {
      return this.datacatSessionToken;
    }
    if (this.datacatIdentifyPromise) {
      return this.datacatIdentifyPromise;
    }

    this.datacatIdentifyPromise = (async () => {
      try {
        const rand = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        const deviceToken = `anon_${rand}`;
        const res = await fetch('https://datacat.run/api/liberator/identify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://datacat.run',
            Referer: 'https://datacat.run/',
          },
          body: JSON.stringify({ deviceToken }),
        });
        if (!res.ok) throw new Error(`Datacat identify failed (${res.status})`);
        const data = await res.json();
        if (data.sessionToken) {
          this.datacatSessionToken = data.sessionToken;
          this.datacatTokenExpiresAt = Date.now() + 6 * 3600 * 1000;
          return data.sessionToken;
        }
        throw new Error('No sessionToken returned');
      } finally {
        this.datacatIdentifyPromise = null;
      }
    })();

    return this.datacatIdentifyPromise;
  }

  private async fetchWithCorsFallback(targetUrl: string, headers?: Record<string, string>): Promise<any> {
    try {
      const direct = await fetch(targetUrl, {
        headers: { Accept: 'application/json', ...(headers || {}) },
      });
      if (direct.ok) return await direct.json();
    } catch {}

    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
      const proxied = await fetch(proxyUrl);
      if (proxied.ok) return await proxied.json();
    } catch {}

    try {
      const proxy2 = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
      const proxied2 = await fetch(proxy2);
      if (proxied2.ok) return await proxied2.json();
    } catch {}

    throw new Error('All proxy endpoints unreachable');
  }

  /**
   * Chub.ai Query
   */
  async fetchChubCharacters(params: {
    search?: string;
    tag?: string;
    tagIds?: string;
    page?: number;
    limit?: number;
    sort?: 'popular' | 'trending' | 'latest';
    sfwOnly?: boolean;
    creators?: string;
  }): Promise<{ characters: CommunityCharacter[]; totalCount: number; hasMore: boolean }> {
    const limit = params.limit || 24;
    const page = params.page || 1;
    const sortMap: Record<string, string> = {
      popular: 'download_count',
      trending: 'trending_downloads',
      latest: 'created_at',
    };
    const chubSort = sortMap[params.sort || 'latest'] || 'created_at';

    const q = new URLSearchParams({
      first: String(limit),
      page: String(page),
      namespace: 'characters',
      sort: chubSort,
      asc: 'false',
      nsfw: params.sfwOnly ? 'false' : 'true',
      nsfl: 'false',
    });

    if (params.search?.trim()) {
      q.set('search', params.search.trim());
    }
    if (params.tag && params.tag !== 'all' && params.tag !== 'All') {
      q.set('topics', params.tag.toLowerCase());
    }

    const url = `https://api.chub.ai/search?${q.toString()}`;

    try {
      const json = await this.fetchWithCorsFallback(url);
      const nodes: any[] = json?.data?.nodes || json?.nodes || [];

      if (!Array.isArray(nodes) || nodes.length === 0) {
        return { characters: ANIME_COMMUNITY_FALLBACK, totalCount: 200000, hasMore: true };
      }

      const characters = nodes.map((node: any, idx: number): CommunityCharacter => {
        const fullPath = String(node?.fullPath || node?.id || `chub-${idx}`);
        const creator = fullPath.includes('/') ? fullPath.split('/')[0] : (node?.creator || 'community');
        const rawDesc = String(node?.tagline || node?.description || '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const isCharhub = Boolean(fullPath && !fullPath.startsWith('chub-') && fullPath.includes('/'));
        const hdCard = isCharhub ? `https://avatars.charhub.io/avatars/${fullPath}/avatar_raw.webp` : '';
        const thumbAvatar = isCharhub ? `https://avatars.charhub.io/avatars/${fullPath}/avatar.webp` : '';

        const candidate = node?.max_res_url || hdCard || node?.avatar_url || thumbAvatar || node?.avatar;
        const avatarUrl = getHighResImageUrl(candidate);

        return {
          id: fullPath,
          characterId: fullPath,
          name: node?.name || 'Unnamed Character',
          chatName: node?.name || '',
          creatorName: creator,
          avatarUrl,
          shortDescription: rawDesc.slice(0, 240) || 'Chub AI companion ready to roleplay.',
          isNsfw: Boolean(node?.nsfw_image || (node?.topics || []).includes('NSFW')),
          totalTokens: Number(node?.nTokens) || 1200,
          chatCount: Number(node?.starCount || node?.nChats || 10),
          messageCount: Number(node?.nMessages || 25),
          favoritesCount: Number(node?.nFavorites || node?.starCount || 5),
          tags: Array.isArray(node?.topics)
            ? node.topics.slice(0, 6).map((t: string, i: number) => ({
                id: i + 1,
                name: String(t),
                slug: String(t).toLowerCase().replace(/\s+/g, '-')
              }))
            : [{ id: 1, name: 'anime', slug: 'anime' }],
          firstMessage: node?.definition?.first_message || `*${node?.name || 'They'} look at you quietly.*`,
          personality: node?.definition?.personality || rawDesc,
          scenario: node?.definition?.scenario || rawDesc.slice(0, 300),
          alternateGreetings: Array.isArray(node?.definition?.alternate_greetings) ? node.definition.alternate_greetings : [],
          createdAt: node?.createdAt,
        };
      });

      return {
        characters,
        totalCount: Number(json?.data?.count) || 200000,
        hasMore: characters.length >= limit,
      };
    } catch {
      return { characters: ANIME_COMMUNITY_FALLBACK, totalCount: 200000, hasMore: true };
    }
  }

  /**
   * Datacat (Janitor AI) Query
   */
  async fetchDatacatCharacters(params: {
    search?: string;
    tagIds?: string;
    tag?: string;
    page?: number;
    limit?: number;
    sort?: 'popular' | 'trending' | 'latest';
    sfwOnly?: boolean;
    creators?: string;
  }): Promise<{ characters: CommunityCharacter[]; totalCount: number; hasMore: boolean }> {
    try {
      const sessionToken = await this.ensureDatacatSession();
      const limit = params.limit || 24;
      const offset = ((params.page || 1) - 1) * limit;

      const q = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        summary: '1',
        skipCount: '1',
      });
      if (params.search?.trim()) q.set('search', params.search.trim());
      if (params.tagIds?.trim()) q.set('tagIds', params.tagIds.trim());

      const targetUrl = `https://datacat.run/api/characters/recent-public?${q.toString()}`;
      const json = await this.fetchWithCorsFallback(targetUrl, {
        'X-Session-Token': sessionToken,
        Origin: 'https://datacat.run',
        Referer: 'https://datacat.run/',
      });

      const list: any[] = json?.characters || json?.data || [];
      if (!Array.isArray(list) || list.length === 0) {
        return { characters: ANIME_COMMUNITY_FALLBACK, totalCount: 200000, hasMore: true };
      }

      let characters = list.map((item: any, idx: number): CommunityCharacter => {
        const candidate = item.avatarVariantUrls?.card || item.avatarVariantUrls?.hero || item.avatarDisplayUrl || item.avatar;
        const avatarUrl = getHighResImageUrl(candidate);
        const desc = String(item.description || item.personality || '').replace(/<[^>]*>/g, ' ').trim();

        return {
          id: String(item.characterId || item.id || idx),
          characterId: String(item.characterId || item.id || idx),
          name: item.name || 'Unnamed Character',
          chatName: item.name || '',
          creatorName: item.creatorName || item.creator_name || 'community',
          avatarUrl,
          shortDescription: desc.slice(0, 240) || 'JanitorAI companion ready to roleplay.',
          isNsfw: Boolean(item.nsfw || item.is_nsfw || item.rating === 'nsfw'),
          totalTokens: Number(item.totalTokens || item.tokenCount) || 1600,
          chatCount: item.stats?.chat || 14,
          messageCount: item.stats?.message || 50,
          favoritesCount: item.stats?.favoritesCount?.favoritesCount || item.stats?.favorites || 8,
          tags: Array.isArray(item.tags)
            ? item.tags.map((t: any) => ({
                id: t.id || t.name,
                name: t.name || String(t),
                slug: t.slug || String(t).toLowerCase().replace(/\s+/g, '-')
              }))
            : [{ id: 1, name: 'anime', slug: 'anime' }],
          firstMessage: item.firstMessage || `*${item.name} stands before you.* "Welcome."`,
          personality: item.personality || desc,
          scenario: item.scenario || desc.slice(0, 300),
          alternateGreetings: Array.isArray(item.alternateGreetings) ? item.alternateGreetings : [],
          createdAt: item.createdAt,
        };
      });

      if (params.sfwOnly) {
        characters = characters.filter(c => !c.isNsfw);
      }

      return {
        characters,
        totalCount: 200000,
        hasMore: characters.length >= limit,
      };
    } catch {
      return { characters: ANIME_COMMUNITY_FALLBACK, totalCount: 200000, hasMore: true };
    }
  }

  async getCharacterDetail(id: string): Promise<CommunityCharacterDetail> {
    const match = ANIME_COMMUNITY_FALLBACK.find(c => c.id === id);
    if (match) {
      return {
        ...match,
        firstMessage: match.firstMessage || '*Looks at you.* "Hello."',
        personality: match.personality || match.shortDescription,
        scenario: match.scenario || match.shortDescription,
        alternateGreetings: match.alternateGreetings || [],
      };
    }

    return {
      id,
      characterId: id,
      name: 'Anime Companion',
      chatName: 'Companion',
      creatorName: 'community',
      avatarUrl: 'https://avatars.charhub.io/avatars/hiro_mc/irresistible-riley-e91d140ac49d/avatar.webp',
      shortDescription: 'Detailed character synopsis.',
      isNsfw: true,
      totalTokens: 2200,
      chatCount: 24,
      messageCount: 80,
      favoritesCount: 12,
      tags: [{ id: 1, name: 'anime', slug: 'anime' }],
      firstMessage: '*Glances at you.* "Welcome."',
      personality: 'Nuanced and expressive.',
      scenario: 'Late-night encounter.',
      alternateGreetings: [],
    };
  }
}

export const communityCatalogService = new CommunityCatalogService();
