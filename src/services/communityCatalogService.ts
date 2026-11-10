/**
 * Live Community Catalog Service (Chub.ai & Datacat / Janitor AI)
 * Real scrapers ported from Warden AI with session handshake and zero fake human stock photos.
 */

import { Character } from '../types';
import { getHighResImageUrl } from '../utils/imageUtils';

export interface CommunitySearchParams {
  search?: string;
  tag?: string;
  page?: number;
  limit?: number;
  source?: 'chub' | 'datacat';
  sort?: 'popular' | 'trending' | 'latest';
  nsfw?: boolean;
}

// Resilient anime fallback cards strictly from Charhub CDN (Zero real-human stock photos)
export const ANIME_COMMUNITY_FALLBACK: Character[] = [
  {
    id: 'chub_hiro_riley',
    name: 'Irresistible Riley',
    tagline: 'Your good friend with an interesting secret',
    description: 'A charming, playful companion who has known you for years. Behind the carefree smile lies a deep devotion.',
    avatar: 'https://avatars.charhub.io/avatars/hiro_mc/irresistible-riley-e91d140ac49d/avatar.webp',
    personality: 'Playful, teaseful, deeply loyal, expressive, sweet.',
    scenario: 'Hanging out in your living room on a quiet weekend afternoon.',
    firstMessage: '*Riley glances over from the sofa with a mischievous grin.* "Hey... you\'ve been spacing out for five minutes. Thinking about me?"',
    tags: ['Anime', 'Romance', 'Friends to Lovers', 'Slice of Life'],
    creator: 'hiro_mc',
    totalChats: 4850,
    lastActive: Date.now() - 1000 * 60 * 12,
    isFavorite: false,
  },
  {
    id: 'chub_esdash_ayumi',
    name: 'Ayumi | Tomboy Crush',
    tagline: 'The tough athletic classmate who softens around you',
    description: 'The school\'s fiercest track athlete. Unapproachable to most, but she secretly waits for you at the lockers after practice.',
    avatar: 'https://avatars.charhub.io/avatars/Esdash/ayumi-tomboy-crush-8e1bf236766c/avatar.webp',
    personality: 'Tsundere, athletic, fiercely protective, secretly flustered.',
    scenario: 'Sunset by the school gym lockers after track practice.',
    firstMessage: '*Ayumi tosses a cold sports drink into your hands, looking away with a faint blush.* "Don\'t get the wrong idea! The vending machine gave me an extra one."',
    tags: ['Anime', 'Tsundere', 'School Life', 'Romance'],
    creator: 'Esdash',
    totalChats: 6120,
    lastActive: Date.now() - 1000 * 60 * 25,
    isFavorite: true,
  },
  {
    id: 'chub_anon_angeline',
    name: 'Angeline Weston',
    tagline: 'Aristocratic Mage from the High Spire',
    description: 'A highborn mage versed in celestial archives. Banished to study ancient relics, she requires an assistant with an open mind.',
    avatar: 'https://avatars.charhub.io/avatars/Anonymous/angeline-weston-f414a8cf3d01/avatar.webp',
    personality: 'Dignified, articulate, intellectual, warm once trusted.',
    scenario: 'Arcane archives illuminated by glowing celestial orbs.',
    firstMessage: '*She turns from the ancient parchment, her silver eyes catching the starlight.* "Few are permitted in this wing of the observatory. State your purpose."',
    tags: ['Anime', 'Fantasy', 'Magic', 'Adventure'],
    creator: 'Anonymous',
    totalChats: 3950,
    lastActive: Date.now() - 1000 * 60 * 90,
    isFavorite: false,
  }
];

class CommunityCatalogService {
  private datacatSessionToken: string = '';
  private datacatTokenExpiresAt: number = 0;
  private datacatIdentifyPromise: Promise<string> | null = null;

  /**
   * Session handshake with Datacat (Janitor AI Liberator API)
   */
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

  /**
   * Helper that fetches with CORS proxy fallback
   */
  private async fetchWithCorsFallback(targetUrl: string, headers?: Record<string, string>): Promise<any> {
    // 1. Direct fetch
    try {
      const direct = await fetch(targetUrl, {
        headers: { Accept: 'application/json', ...(headers || {}) },
      });
      if (direct.ok) return await direct.json();
    } catch {}

    // 2. Browser CORS proxy fallback for local Edge/Firefox
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
   * Live Chub.ai Catalog Query
   */
  async fetchChubCharacters(params: CommunitySearchParams): Promise<Character[]> {
    const limit = params.limit || 24;
    const page = params.page || 1;
    const sortMap: Record<string, string> = {
      popular: 'download_count',
      trending: 'trending_downloads',
      latest: 'created_at',
    };
    const chubSort = sortMap[params.sort || 'trending'] || 'trending_downloads';

    const q = new URLSearchParams({
      first: String(limit),
      page: String(page),
      namespace: 'characters',
      sort: chubSort,
      asc: 'false',
      nsfw: 'true',
      nsfl: 'false',
    });

    if (params.search?.trim()) {
      q.set('search', params.search.trim());
    }
    if (params.tag && params.tag !== 'All') {
      q.set('topics', params.tag.toLowerCase());
    }

    const url = `https://api.chub.ai/search?${q.toString()}`;

    try {
      const json = await this.fetchWithCorsFallback(url);
      const nodes: any[] = json?.data?.nodes || json?.nodes || [];

      if (!Array.isArray(nodes) || nodes.length === 0) return [];

      return nodes.map((node: any, idx: number): Character => {
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
        const avatar = getHighResImageUrl(candidate);

        return {
          id: `chub_${fullPath}`,
          name: node?.name || 'Anime Companion',
          tagline: node?.tagline || rawDesc.slice(0, 60) || 'Chub AI Companion',
          description: rawDesc || 'An expressive anime companion from Chub.ai community.',
          avatar,
          personality: rawDesc || 'Expressive, immersive, responsive anime roleplay companion.',
          scenario: rawDesc.slice(0, 300) || '',
          firstMessage: `*${node?.name || 'They'} look at you quietly.* "Hello there."`,
          tags: Array.isArray(node?.topics) && node.topics.length > 0 ? node.topics.slice(0, 5) : ['Anime', 'Roleplay'],
          creator: `@${creator}`,
          totalChats: Number(node?.starCount || node?.nChats || 140),
          lastActive: Date.now() - 1000 * 60 * (idx * 5 + 2),
          isFavorite: false,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Live Datacat (Janitor AI) Catalog Query
   */
  async fetchDatacatCharacters(params: CommunitySearchParams): Promise<Character[]> {
    try {
      const sessionToken = await this.ensureDatacatSession();
      const limit = params.limit || 24;
      const q = new URLSearchParams({
        limit: String(limit),
        summary: '1',
        skipCount: '1',
      });
      if (params.search?.trim()) {
        q.set('search', params.search.trim());
      }

      const targetUrl = `https://datacat.run/api/characters/recent-public?${q.toString()}`;
      const json = await this.fetchWithCorsFallback(targetUrl, {
        'X-Session-Token': sessionToken,
        Origin: 'https://datacat.run',
        Referer: 'https://datacat.run/',
      });

      const list: any[] = json?.characters || json?.data || [];
      if (!Array.isArray(list) || list.length === 0) return [];

      return list.map((item: any, idx: number): Character => {
        const candidate = item.avatarVariantUrls?.card || item.avatarVariantUrls?.hero || item.avatarDisplayUrl || item.avatar;
        const avatar = getHighResImageUrl(candidate);
        const desc = String(item.description || item.personality || '').replace(/<[^>]*>/g, ' ').trim();

        return {
          id: `datacat_${item.characterId || item.id || idx}`,
          name: item.name || 'Janitor Companion',
          tagline: desc.slice(0, 60) || 'Janitor AI Anime Character',
          description: desc || 'A popular character from the Janitor AI community.',
          avatar,
          personality: item.personality || desc || 'Detailed, nuanced, character-focused roleplay.',
          scenario: item.scenario || desc.slice(0, 250) || '',
          firstMessage: item.firstMessage || `*${item.name} stands before you.* "Welcome."`,
          tags: Array.isArray(item.tags) ? item.tags.map((t: any) => typeof t === 'string' ? t : t.name).slice(0, 5) : ['Anime', 'Janitor'],
          creator: `@${item.creatorName || item.creator || 'community'}`,
          totalChats: Number(item.totalChats || item.chatCount || 200),
          lastActive: Date.now() - 1000 * 60 * (idx * 8 + 3),
          isFavorite: false,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Unified Live Catalog Scraper with Resilient Fallback
   */
  async getLiveCatalog(params: CommunitySearchParams): Promise<Character[]> {
    let characters: Character[] = [];
    if (params.source === 'datacat') {
      characters = await this.fetchDatacatCharacters(params);
      if (characters.length === 0) {
        characters = await this.fetchChubCharacters(params);
      }
    } else {
      characters = await this.fetchChubCharacters(params);
      if (characters.length === 0) {
        characters = await this.fetchDatacatCharacters(params);
      }
    }

    if (characters.length > 0) {
      return characters;
    }

    // Pure anime fallback if offline
    return ANIME_COMMUNITY_FALLBACK;
  }
}

export const communityCatalogService = new CommunityCatalogService();
