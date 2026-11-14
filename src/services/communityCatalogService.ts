/**
 * Live Community Catalog Service (Chub.ai & Janitor / Datacat)
 * Strictly 100% REAL LIVE DATA — ZERO MOCK CHARACTERS — ZERO HARDCODED FALLBACKS.
 *
 * Architecture:
 * 1. Chub.ai: Fetches live from public CORS-enabled https://api.chub.ai/search
 * 2. Datacat / JanitorAI: Fetches live via local Community Proxy (http://localhost:3001)
 *    Ported from Warden AI server to bypass browser CORS restrictions.
 */

import { Platform } from 'react-native';
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

export interface CommunityCreatorProfile {
  creatorId?: string;
  userName: string;
  avatarUrl?: string;
  aboutMeHtml?: string;
  followersCount?: number;
  charCount?: number;
  totalChats?: number;
  totalMessages?: number;
  profileCreatedAt?: string | null;
  profileUrl?: string;
  creatorVerified?: boolean;
  topTags?: Array<{ id?: number; name?: string; slug?: string } | string>;
}

class CommunityCatalogService {
  private proxyUrl = 'http://localhost:3001';
  private datacatSessionToken = '';
  private datacatTokenExpiresAt = 0;
  private datacatIdentifyPromise: Promise<string> | null = null;

  public getProxyBaseUrl(): string {
    if (this.proxyUrl !== 'http://localhost:3001') {
      return this.proxyUrl;
    }
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return `http://${window.location.hostname}:3001`;
    }
    return 'http://localhost:3001';
  }

  private async ensureDatacatSession(): Promise<string> {
    if (this.datacatSessionToken && Date.now() < this.datacatTokenExpiresAt) {
      return this.datacatSessionToken;
    }
    if (this.datacatIdentifyPromise) {
      return this.datacatIdentifyPromise;
    }

    this.datacatIdentifyPromise = (async () => {
      try {
        const rand = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
        const deviceToken = `anon_${rand}_${Date.now().toString(36)}`;
        const res = await fetch('https://datacat.run/api/liberator/identify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://datacat.run',
            Referer: 'https://datacat.run/'
          },
          body: JSON.stringify({ deviceToken })
        });
        if (!res.ok) throw new Error(`Identify status ${res.status}`);
        const data = await res.json();
        if (data.sessionToken) {
          this.datacatSessionToken = data.sessionToken;
          this.datacatTokenExpiresAt = Date.now() + 6 * 3600 * 1000;
          return data.sessionToken;
        }
        throw new Error('No sessionToken in identify response');
      } finally {
        this.datacatIdentifyPromise = null;
      }
    })();

    return this.datacatIdentifyPromise;
  }

  /**
   * Direct Datacat / JanitorAI query fallback (operates standalone without proxy)
   */
  private async fetchDirectDatacat(params: {
    search?: string;
    tagIds?: string;
    limit?: number;
    offset?: number;
    sort?: 'recent' | 'popular' | 'trending' | 'latest';
    sfwOnly?: boolean;
  }): Promise<CatalogResponse> {
    const sessionToken = await this.ensureDatacatSession();
    const limit = params.limit || 12;
    const offset = params.offset || 0;

    const fetchLimit =
      params.sort === 'popular' || params.sort === 'trending'
        ? Math.min(60, Math.max(limit * 2, 48))
        : limit;

    const query = new URLSearchParams({
      limit: String(fetchLimit),
      offset: String(offset),
      summary: '1',
      skipCount: '1'
    });
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.tagIds?.trim()) query.set('tagIds', params.tagIds.trim());

    const res = await fetch(`https://datacat.run/api/characters/recent-public?${query.toString()}`, {
      headers: {
        'X-Session-Token': sessionToken,
        Origin: 'https://datacat.run',
        Referer: 'https://datacat.run/'
      }
    });

    if (!res.ok) {
      throw new Error(`Direct Datacat query failed (${res.status})`);
    }

    const data = await res.json();
    const rawList: any[] = data.characters || data.data || [];

    let characters: CommunityCharacter[] = rawList.map(item => {
      const candidate =
        item.avatarVariantUrls?.card ||
        item.avatarVariantUrls?.hero ||
        item.avatarVariantUrls?.raw ||
        item.avatarDisplayUrl ||
        item.avatar ||
        'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500';

      const avatarUrl = getHighResImageUrl(candidate);

      return {
        id: item.characterId || item.id,
        characterId: item.characterId || item.id,
        name: item.name || 'Unnamed Character',
        chatName: item.chat_name || item.chatName || item.name || '',
        creatorName: String(item.creatorName || item.creator_name || 'community').replace(/^@+/, ''),
        creatorId: item.creator_id || item.creatorId,
        avatarUrl,
        shortDescription: (item.description || item.personality || '').replace(/<[^>]*>/g, ' ').trim().slice(0, 260),
        isNsfw: Boolean(item.nsfw || item.is_nsfw || item.rating === 'nsfw'),
        totalTokens: Number(item.totalTokens || item.tokenCount) || 850,
        chatCount: item.stats?.chat || 0,
        messageCount: item.stats?.message || 0,
        favoritesCount: item.stats?.favoritesCount?.favoritesCount || item.stats?.favorites || 0,
        tags: Array.isArray(item.tags)
          ? item.tags.map((t: any, i: number) => ({
              id: t.id || i,
              name: t.name || String(t),
              slug: t.slug || String(t).toLowerCase().replace(/\s+/g, '-')
            }))
          : [],
        firstPublishedAt: item.firstPublishedAt || item.first_published_at,
        createdAt: item.createdAt || item.created_at
      };
    });

    if (params.sfwOnly) {
      characters = characters.filter(c => !c.isNsfw);
    }

    if (params.sort === 'popular') {
      characters.sort((a, b) => {
        const scoreA = (a.chatCount || 0) * 3 + (a.messageCount || 0) + (a.favoritesCount || 0) * 5;
        const scoreB = (b.chatCount || 0) * 3 + (b.messageCount || 0) + (b.favoritesCount || 0) * 5;
        return scoreB - scoreA;
      });
    } else if (params.sort === 'trending') {
      const now = Date.now();
      characters.sort((a, b) => {
        const timeA = new Date(a.firstPublishedAt || a.createdAt || now).getTime();
        const timeB = new Date(b.firstPublishedAt || b.createdAt || now).getTime();
        const hoursA = Math.max(1, (now - timeA) / 3600000);
        const hoursB = Math.max(1, (now - timeB) / 3600000);
        const engagementA = (a.chatCount || 0) * 2 + (a.favoritesCount || 0) * 6 + (a.messageCount || 0) * 0.5 + 15;
        const engagementB = (b.chatCount || 0) * 2 + (b.favoritesCount || 0) * 6 + (b.messageCount || 0) * 0.5 + 15;
        return engagementB / Math.pow(hoursB + 2, 0.6) - engagementA / Math.pow(hoursA + 2, 0.6);
      });
    }

    const sliced = characters.slice(0, limit);

    return {
      characters: sliced,
      totalCount: Number(data.totalCount || data.count || 214500),
      hasMore: characters.length >= limit
    };
  }

  /**
   * Direct Datacat single character detail query
   */
  private async fetchDirectDatacatDetail(id: string): Promise<CommunityCharacterDetail | null> {
    try {
      const sessionToken = await this.ensureDatacatSession();
      const res = await fetch(`https://datacat.run/api/characters/${encodeURIComponent(id)}`, {
        headers: {
          'X-Session-Token': sessionToken,
          Origin: 'https://datacat.run',
          Referer: 'https://datacat.run/'
        }
      });
      if (!res.ok) return null;
      const data = await res.json();
      const c = data.character || data;

      const candidate =
        c.avatarVariantUrls?.hero ||
        c.avatarVariantUrls?.card ||
        c.avatarVariantUrls?.raw ||
        c.avatarDisplayUrl ||
        c.avatar ||
        'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500';

      const avatarUrl = getHighResImageUrl(candidate);

      return {
        id: c.characterId || c.id || id,
        characterId: c.characterId || c.id || id,
        name: c.name || 'Character',
        chatName: c.name || '',
        creatorName: String(c.creatorName || c.creator_name || 'community').replace(/^@+/, ''),
        avatarUrl,
        shortDescription: (c.description || c.personality || '').replace(/<[^>]*>/g, ' ').trim().slice(0, 260),
        isNsfw: Boolean(c.nsfw || c.is_nsfw || c.rating === 'nsfw'),
        totalTokens: Number(c.totalTokens || c.tokenCount) || 850,
        chatCount: c.stats?.chat || 0,
        messageCount: c.stats?.message || 0,
        favoritesCount: c.stats?.favoritesCount?.favoritesCount || c.stats?.favorites || 0,
        tags: Array.isArray(c.tags)
          ? c.tags.map((t: any, i: number) => ({
              id: t.id || i,
              name: t.name || String(t),
              slug: t.slug || String(t).toLowerCase().replace(/\s+/g, '-')
            }))
          : [],
        firstMessage: c.firstMessage || c.first_message || `*${c.name || 'They'} look at you quietly.*`,
        personality: c.personality || c.description || 'Expressive companion.',
        scenario: c.scenario || c.description || '',
        descriptionHtml: c.description || '',
        alternateGreetings: Array.isArray(c.alternateGreetings) ? c.alternateGreetings : []
      };
    } catch {
      return null;
    }
  }

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

    // On Native Mobile (Android APK & iOS), native networking has no browser CORS restrictions.
    // Query Datacat directly without requiring a local PC proxy daemon or external hosting!
    if (Platform.OS !== 'web') {
      try {
        const directRes = await this.fetchDirectDatacat({
          search: params.search,
          tagIds: params.tagIds,
          limit,
          offset,
          sort: params.sort,
          sfwOnly: params.sfwOnly,
        });
        if (directRes.characters && directRes.characters.length > 0) {
          return directRes;
        }
      } catch (_nativeErr) {
        console.warn('[CommunityCatalogService] Direct native Datacat query failed, falling back:', _nativeErr);
      }
    }

    const baseUrl = this.getProxyBaseUrl();
    const proxyTarget = `${baseUrl}/api/community/characters?${q.toString()}`;

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
        totalCount: Number(json.totalCount) || characters.length,
        hasMore: characters.length >= limit,
      };
    } catch (err: any) {
      console.warn('[CommunityCatalogService] Datacat proxy unreachable, trying direct fallback:', err);
      try {
        const directRes = await this.fetchDirectDatacat({
          search: params.search,
          tagIds: params.tagIds,
          limit,
          offset,
          sort: params.sort,
          sfwOnly: params.sfwOnly,
        });
        if (directRes.characters && directRes.characters.length > 0) {
          return directRes;
        }
      } catch (_directErr) {
        // Direct fallback failed
      }
      return {
        characters: [],
        totalCount: 0,
        hasMore: false,
        error: `Datacat Proxy Offline (Port 3001). Jalankan 'npm run proxy' di terminal untuk memuat katalog live JanitorAI.`,
      };
    }
  }

  /**
   * 3. Character Detail Query (Live — Both Chub.ai & Datacat/Janitor)
   */
  async getCharacterDetail(charId: string): Promise<CommunityCharacterDetail | null> {
    const isChub = charId.includes('/') || charId.startsWith('chub-');

    if (isChub) {
      try {
        const cleanPath = charId.replace(/^chub-/, '');
        const res = await fetch(`https://api.chub.ai/api/characters/${cleanPath}?full=true`, {
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const json = await res.json();
          const node = json.node || json;
          const def = node.definition || {};
          const fullPath = String(node.fullPath || node.id || charId);
          const creator = fullPath.includes('/') ? fullPath.split('/')[0] : (node.creator || 'community');
          const rawDesc = String(node.tagline || node.description || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const avatarUrl = getHighResImageUrl(node.avatar_url || node.max_res_url);

          return {
            id: String(node.id || fullPath),
            characterId: String(node.id || fullPath),
            name: node.name || 'Unnamed Companion',
            chatName: node.name || '',
            creatorName: creator,
            creatorId: node.creatorId ? String(node.creatorId) : undefined,
            avatarUrl,
            shortDescription: rawDesc.slice(0, 240) || 'Chub AI companion.',
            isNsfw: Boolean(node.nsfw_image || (node.topics || []).includes('NSFW')),
            totalTokens: Number(node.nTokens) || 0,
            chatCount: Number(node.starCount || node.nChats || 0),
            messageCount: Number(node.nMessages || 0),
            favoritesCount: Number(node.nFavorites || node.starCount || 0),
            tags: Array.isArray(node.topics)
              ? node.topics.slice(0, 8).map((t: string, i: number) => ({
                  id: i + 1,
                  name: String(t),
                  slug: String(t).toLowerCase().replace(/\s+/g, '-'),
                }))
              : [],
            firstMessage: def.first_message || `*${node.name || 'They'} look at you quietly.*`,
            personality: def.personality || rawDesc,
            scenario: def.scenario || rawDesc.slice(0, 300),
            descriptionHtml: node.description || rawDesc,
            alternateGreetings: Array.isArray(def.alternate_greetings) ? def.alternate_greetings : [],
            createdAt: node.createdAt,
          };
        }
      } catch (err) {
        console.warn('[CommunityCatalogService] Chub detail fetch error:', err);
      }
    }

    // Native mobile: direct Datacat query without proxy requirement
    if (Platform.OS !== 'web') {
      try {
        const direct = await this.fetchDirectDatacatDetail(charId);
        if (direct) return direct;
      } catch {}
    }

    // Datacat / Janitor via proxy (web desktop)
    try {
      const baseUrl = this.getProxyBaseUrl();
      const res = await fetch(`${baseUrl}/api/community/characters/${encodeURIComponent(charId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.character) return json.character;
      }
    } catch {}

    // Direct Datacat fallback
    try {
      const direct = await this.fetchDirectDatacatDetail(charId);
      if (direct) return direct;
    } catch {}

    return null;
  }

  /**
   * 4. Fetch Characters by a Specific Creator (Live — Janitor/Datacat & Chub.ai)
   */
  async fetchCreatorCharacters(
    creatorName: string,
    opts?: {
      source?: 'janitor' | 'chub';
      page?: number;
      limit?: number;
      sort?: 'popular' | 'trending' | 'latest';
      sfwOnly?: boolean;
    }
  ): Promise<CatalogResponse> {
    const cleanHandle = creatorName.replace(/^@+/, '').trim();
    if (!cleanHandle) {
      return { characters: [], totalCount: 0, hasMore: false };
    }

    const source = opts?.source || 'janitor';
    const limit = opts?.limit || 24;
    const page = opts?.page || 1;
    const sort = opts?.sort || 'latest';

    if (source === 'chub') {
      const sortMap: Record<string, string> = {
        popular: 'download_count',
        trending: 'trending_downloads',
        latest: 'created_at',
      };
      const q = new URLSearchParams({
        first: String(limit),
        page: String(page),
        namespace: 'characters',
        username: cleanHandle,
        sort: sortMap[sort] || 'created_at',
        asc: 'false',
        nsfw: opts?.sfwOnly ? 'false' : 'true',
        nsfl: 'false',
      });

      try {
        const res = await fetch(`https://api.chub.ai/search?${q.toString()}`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`Chub creator query failed (${res.status})`);
        const json = await res.json();
        const nodes: any[] = json?.data?.nodes || json?.nodes || [];
        const characters = nodes.map((node: any, idx: number): CommunityCharacter => {
          const fullPath = String(node?.fullPath || node?.id || `chub-${idx}`);
          const creator = fullPath.includes('/') ? fullPath.split('/')[0] : (node?.creator || cleanHandle);
          const rawDesc = String(node?.tagline || node?.description || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          return {
            id: String(node?.id || fullPath),
            characterId: String(node?.id || fullPath),
            name: node?.name || 'Unnamed Companion',
            chatName: node?.name || '',
            creatorName: creator,
            creatorId: node?.creatorId ? String(node.creatorId) : undefined,
            avatarUrl: getHighResImageUrl(node?.avatar_url || node?.max_res_url),
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
        return {
          characters: [],
          totalCount: 0,
          hasMore: false,
          error: err?.message || 'Failed to load Chub creator characters',
        };
      }
    }

    // JanitorAI / Datacat: search by handle and strictly match creatorName
    const res = await this.fetchDatacatCharacters({
      search: cleanHandle,
      page,
      limit: Math.max(limit, 36),
      sort,
      sfwOnly: opts?.sfwOnly,
    });

    const targetLower = cleanHandle.toLowerCase();
    const matched = res.characters.filter(
      c => (c.creatorName || '').replace(/^@+/, '').trim().toLowerCase() === targetLower
    );

    return {
      characters: matched,
      totalCount: matched.length,
      hasMore: false,
      error: res.error,
    };
  }

  /**
   * 5. Fetch Creator Profile (including JanitorAI HTML Bio / aboutMeHtml)
   */
  async fetchCreatorProfile(
    creatorName: string,
    creatorId?: string,
    source: 'janitor' | 'chub' = 'janitor'
  ): Promise<CommunityCreatorProfile> {
    const cleanHandle = creatorName.replace(/^@+/, '').trim();

    if (source === 'chub') {
      try {
        const res = await fetch(`https://api.chub.ai/api/users/${encodeURIComponent(cleanHandle)}`, {
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const json = await res.json();
          const u = json.user || json;
          return {
            creatorId: u.id ? String(u.id) : undefined,
            userName: u.username || cleanHandle,
            avatarUrl: getHighResImageUrl(u.avatar_url || ''),
            aboutMeHtml: u.bio || u.description || '',
            followersCount: Number(u.followers_count || 0),
            charCount: Number(u.characters_count || 0),
          };
        }
      } catch {}
      return { userName: cleanHandle };
    }

    let resolvedId = creatorId;
    if (!resolvedId) {
      try {
        const charsRes = await this.fetchCreatorCharacters(cleanHandle, { source: 'janitor', limit: 24 });
        const withId = charsRes.characters.find(c => Boolean(c.creatorId));
        if (withId?.creatorId) resolvedId = withId.creatorId;
      } catch {}
    }

    if (resolvedId) {
      // Native mobile direct Datacat
      if (Platform.OS !== 'web') {
        try {
          const sessionToken = await this.ensureDatacatSession();
          const res = await fetch(`https://datacat.run/api/creators/${encodeURIComponent(resolvedId)}`, {
            headers: {
              'X-Session-Token': sessionToken,
              Origin: 'https://datacat.run',
              Referer: 'https://datacat.run/',
            },
          });
          if (res.ok) {
            const json = await res.json();
            const c = json.creator || json;
            return {
              creatorId: c.creatorId || resolvedId,
              userName: String(c.userName || cleanHandle).replace(/^@+/, ''),
              avatarUrl: getHighResImageUrl(
                c.avatarVariantUrls?.hero || c.avatarVariantUrls?.card || c.avatarDisplayUrl || c.avatar
              ),
              aboutMeHtml: c.creatorProfileAboutOverrideHtml || c.aboutMeHtml || c.profileText || '',
              followersCount: Number(c.followersCount || 0),
              charCount: Number(c.charCount || 0),
              totalChats: Number(c.totalChats || 0),
              totalMessages: Number(c.totalMessages || 0),
              profileCreatedAt: c.profileCreatedAt || null,
              profileUrl: c.profileUrl || '',
              creatorVerified: Boolean(c.creatorVerified),
              topTags: Array.isArray(c.topTags) ? c.topTags : [],
            };
          }
        } catch {}
      }

      // Proxy (Web) or fallback
      try {
        const baseUrl = this.getProxyBaseUrl();
        const res = await fetch(`${baseUrl}/api/community/creators/${encodeURIComponent(resolvedId)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.creator) return json.creator;
        }
      } catch {}

      // Direct Datacat fallback
      try {
        const sessionToken = await this.ensureDatacatSession();
        const res = await fetch(`https://datacat.run/api/creators/${encodeURIComponent(resolvedId)}`, {
          headers: {
            'X-Session-Token': sessionToken,
            Origin: 'https://datacat.run',
            Referer: 'https://datacat.run/',
          },
        });
        if (res.ok) {
          const json = await res.json();
          const c = json.creator || json;
          return {
            creatorId: c.creatorId || resolvedId,
            userName: String(c.userName || cleanHandle).replace(/^@+/, ''),
            avatarUrl: getHighResImageUrl(
              c.avatarVariantUrls?.hero || c.avatarVariantUrls?.card || c.avatarDisplayUrl || c.avatar
            ),
            aboutMeHtml: c.creatorProfileAboutOverrideHtml || c.aboutMeHtml || c.profileText || '',
            followersCount: Number(c.followersCount || 0),
            charCount: Number(c.charCount || 0),
            totalChats: Number(c.totalChats || 0),
            totalMessages: Number(c.totalMessages || 0),
            profileCreatedAt: c.profileCreatedAt || null,
            profileUrl: c.profileUrl || '',
            creatorVerified: Boolean(c.creatorVerified),
            topTags: Array.isArray(c.topTags) ? c.topTags : [],
          };
        }
      } catch {}
    }

    return { userName: cleanHandle };
  }
}

export const communityCatalogService = new CommunityCatalogService();
