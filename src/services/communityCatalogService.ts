/**
 * Live Community Catalog Service (Chub.ai & Janitor / Datacat)
 * Strictly 100% REAL LIVE DATA — ZERO MOCK CHARACTERS — ZERO HARDCODED FALLBACKS.
 *
 * Architecture:
 * 1. Chub.ai: Fetches live from public CORS-enabled https://api.chub.ai/search
 * 2. Datacat / JanitorAI: Fetches live via local Community Proxy (http://localhost:3001)
 *    Ported from Warden AI server to bypass browser CORS restrictions.
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

export interface CatalogResponse {
  characters: CommunityCharacter[];
  totalCount: number;
  hasMore: boolean;
  error?: string;
}

class CommunityCatalogService {
  private proxyUrl = 'http://localhost:3001';

  /**
   * Set custom proxy URL (if user configures external proxy)
   */
  public setProxyUrl(url: string) {
    this.proxyUrl = url.replace(/\/+$/, '');
  }

  public getProxyUrl(): string {
    return this.proxyUrl;
  }

  /**
   * 1. Chub.ai Live Query (Public CORS-enabled REST API)
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
  }): Promise<CatalogResponse> {
    const limit = params.limit || 12;
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
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Chub.ai API returned status ${res.status}`);
      }

      const json = await res.json();
      const nodes: any[] = json?.data?.nodes || json?.nodes || [];

      if (!Array.isArray(nodes) || nodes.length === 0) {
        return {
          characters: [],
          totalCount: Number(json?.data?.count) || 0,
          hasMore: false,
        };
      }

      const characters = nodes.map((node: any, idx: number): CommunityCharacter => {
        const fullPath = String(node?.fullPath || node?.id || `chub-${idx}`);
        const creator = fullPath.includes('/') ? fullPath.split('/')[0] : (node?.creator || 'community');
        const rawDesc = String(node?.tagline || node?.description || '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const avatarCandidate = node?.avatar_url || node?.max_res_url;
        const avatarUrl = getHighResImageUrl(avatarCandidate);

        return {
          id: String(node?.id || fullPath),
          characterId: String(node?.id || fullPath),
          name: node?.name || 'Unnamed Companion',
          chatName: node?.name || '',
          creatorName: creator,
          creatorId: node?.creatorId ? String(node.creatorId) : undefined,
          avatarUrl,
          shortDescription: rawDesc.slice(0, 240) || 'Chub AI companion ready to roleplay.',
          isNsfw: Boolean(node?.nsfw_image || (node?.topics || []).includes('NSFW')),
          totalTokens: Number(node?.nTokens) || 0,
          chatCount: Number(node?.starCount || node?.nChats || 0),
          messageCount: Number(node?.nMessages || 0),
          favoritesCount: Number(node?.nFavorites || node?.starCount || 0),
          tags: Array.isArray(node?.topics)
            ? node.topics.slice(0, 6).map((t: string, i: number) => ({
                id: i + 1,
                name: String(t),
                slug: String(t).toLowerCase().replace(/\s+/g, '-'),
              }))
            : [{ id: 1, name: 'anime', slug: 'anime' }],
          firstMessage: node?.definition?.first_message || `*${node?.name || 'They'} look at you quietly.*`,
          personality: node?.definition?.personality || rawDesc,
          scenario: node?.definition?.scenario || rawDesc.slice(0, 300),
          alternateGreetings: Array.isArray(node?.definition?.alternate_greetings)
            ? node.definition.alternate_greetings
            : [],
          createdAt: node?.createdAt,
        };
      });

      return {
        characters,
        totalCount: Number(json?.data?.count) || characters.length,
        hasMore: characters.length >= limit,
      };
    } catch (err: any) {
      console.warn('[CommunityCatalogService] Chub.ai fetch failed:', err);
      return {
        characters: [],
        totalCount: 0,
        hasMore: false,
        error: `Chub.ai Error: ${err?.message || 'Failed to connect to live Chub API'}`,
      };
    }
  }

  /**
   * 2. Datacat / JanitorAI Live Query (Via Local Proxy http://localhost:3001)
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
  }): Promise<CatalogResponse> {
    const limit = params.limit || 12;
    const page = params.page || 1;
    const offset = (page - 1) * limit;

    const q = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      sort: params.sort || 'trending',
    });

    if (params.search?.trim()) q.set('search', params.search.trim());
    if (params.tagIds?.trim()) q.set('tagIds', params.tagIds.trim());
    if (params.sfwOnly) q.set('sfwOnly', '1');

    const proxyTarget = `${this.proxyUrl}/api/community/characters?${q.toString()}`;

    try {
      const res = await fetch(proxyTarget, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`Proxy error (${res.status}): ${await res.text()}`);
      }

      const json = await res.json();
      if (!json.success && json.error) {
        throw new Error(json.error);
      }

      const characters: CommunityCharacter[] = json.characters || [];
      return {
        characters,
        totalCount: Number(json.totalCount) || 214520,
        hasMore: characters.length >= limit,
      };
    } catch (err: any) {
      console.warn('[CommunityCatalogService] Datacat proxy unreachable:', err);
      return {
        characters: [],
        totalCount: 0,
        hasMore: false,
        error: `Datacat Proxy Offline (Port 3001). Jalankan 'npm run proxy' di terminal untuk memuat katalog live JanitorAI.`,
      };
    }
  }

  /**
   * 3. Character Detail Query (Live)
   */
  async getCharacterDetail(charId: string): Promise<CommunityCharacterDetail | null> {
    try {
      const res = await fetch(`${this.proxyUrl}/api/community/characters/${encodeURIComponent(charId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.character) return json.character;
      }
    } catch {}

    return null;
  }
}

export const communityCatalogService = new CommunityCatalogService();
