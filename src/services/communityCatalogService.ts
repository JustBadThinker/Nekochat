/**
 * Live Community Catalog Service (Chub.ai & Datacat / Janitor AI)
 * Ported directly from Warden AI with live API integration.
 */

import { Character } from '../types';
import { getHighResImageUrl } from '../utils/imageUtils';

export interface CommunitySearchParams {
  search?: string;
  tag?: string;
  page?: number;
  limit?: number;
  source?: 'chub' | 'datacat';
  nsfw?: boolean;
}

export const communityCatalogService = {
  /**
   * Search and browse live characters from Chub.ai
   */
  async fetchChubCharacters(params: CommunitySearchParams): Promise<Character[]> {
    const page = params.page || 1;
    const query = params.search ? encodeURIComponent(params.search) : '';
    const tag = params.tag && params.tag !== 'All' ? `&topics=${encodeURIComponent(params.tag.toLowerCase())}` : '';
    
    // Chub.ai official public search endpoint
    const url = `https://api.chub.ai/api/characters/search?search=${query}&page=${page}&first=${params.limit || 20}&sort=download_count${tag}`;

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) throw new Error(`Chub API status ${res.status}`);

      const json = await res.json();
      const nodes = json?.data?.nodes || json?.nodes || [];

      return nodes.map((node: any): Character => {
        const fullPath = node?.fullPath || node?.id || '';
        const isCharhub = Boolean(fullPath && !fullPath.startsWith('chub-') && fullPath.includes('/'));
        const hdCard = isCharhub ? `https://avatars.charhub.io/avatars/${fullPath}/chara_card_v2.png` : '';
        const thumbAvatar = isCharhub ? `https://avatars.charhub.io/avatars/${fullPath}/avatar.webp` : '';

        const avatarCandidate = node?.max_res_url || hdCard || node?.avatar_url || thumbAvatar || node?.avatar;
        const avatar = getHighResImageUrl(avatarCandidate);

        const cleanDesc = String(node?.tagline || node?.description || '')
          .replace(/<[^>]*>/g, ' ')
          .trim();

        return {
          id: `chub_${fullPath || node?.id || Math.random()}`,
          name: node?.name || 'Anime Companion',
          tagline: node?.tagline || cleanDesc.slice(0, 60) || 'Chub AI Companion',
          description: cleanDesc || 'An expressive anime roleplay companion from Chub.ai.',
          avatar,
          personality: node?.definition?.personality || cleanDesc || 'Playful, responsive, expressive.',
          scenario: node?.definition?.scenario || cleanDesc.slice(0, 300) || '',
          firstMessage: node?.definition?.first_message || node?.definition?.greeting || `*${node?.name || 'They'} look at you quietly, welcoming you into the scene.*`,
          tags: Array.isArray(node?.topics) ? node.topics.slice(0, 6) : ['Anime', 'Roleplay'],
          creator: fullPath.includes('/') ? fullPath.split('/')[0] : node?.creator || 'community',
          totalChats: Number(node?.starCount || node?.nChats || 120),
          lastActive: Date.now() - 1000 * 60 * Math.floor(Math.random() * 120),
          isFavorite: false,
          comments: [
            {
              id: 'rev-1',
              author: 'AnimeFan99',
              content: 'Very authentic personality and consistent pacing!',
              rating: 5,
            },
          ],
        };
      });
    } catch (err) {
      console.warn('[CommunityCatalogService] Chub fetch failed, falling back:', err);
      return [];
    }
  },

  /**
   * Search and browse live characters from Datacat (Janitor AI Mirror)
   */
  async fetchDatacatCharacters(params: CommunitySearchParams): Promise<Character[]> {
    const query = params.search ? encodeURIComponent(params.search) : '';
    const limit = params.limit || 20;
    const url = `https://datacat.run/api/characters?search=${query}&limit=${limit}`;

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) throw new Error(`Datacat status ${res.status}`);

      const json = await res.json();
      const list = json?.characters || json?.data || [];

      return list.map((c: any): Character => {
        const candidate = c.avatarVariantUrls?.card || c.avatarDisplayUrl || c.avatar;
        const avatar = getHighResImageUrl(candidate);

        return {
          id: `datacat_${c.id || c.character_id}`,
          name: c.name || 'Janitor Companion',
          tagline: c.tagline || (c.description || '').slice(0, 60),
          description: (c.description || c.personality || '').slice(0, 260),
          avatar,
          personality: c.personality || c.description || '',
          scenario: c.scenario || '',
          firstMessage: c.firstMessage || c.first_message || `*${c.name} looks up, their eyes meeting yours.*`,
          tags: Array.isArray(c.tags) ? c.tags.map((t: any) => t.name || String(t)).slice(0, 6) : ['Janitor', 'RP'],
          creator: c.creatorName || c.creator_name || 'Datacat',
          totalChats: c.stats?.chat || 250,
          lastActive: Date.now() - 1000 * 60 * 15,
          isFavorite: false,
          comments: [
            {
              id: 'rev-dc-1',
              author: 'OtakuReviewer',
              content: 'Top quality roleplay bot from Janitor mirror!',
              rating: 5,
            },
          ],
        };
      });
    } catch (err) {
      console.warn('[CommunityCatalogService] Datacat fetch failed:', err);
      return [];
    }
  },

  /**
   * Unified fetch: tries Chub live first, falls back to Datacat, falls back to curated anime starters.
   */
  async getLiveCatalog(params: CommunitySearchParams, fallbackStarters: Character[]): Promise<Character[]> {
    // 1. Try Chub.ai
    const chubResults = await this.fetchChubCharacters(params);
    if (chubResults.length > 0) return chubResults;

    // 2. Try Datacat
    const datacatResults = await this.fetchDatacatCharacters(params);
    if (datacatResults.length > 0) return datacatResults;

    // 3. Fallback to curated starters
    if (params.search) {
      return fallbackStarters.filter(s =>
        s.name.toLowerCase().includes(params.search!.toLowerCase()) ||
        s.tagline.toLowerCase().includes(params.search!.toLowerCase())
      );
    }
    return fallbackStarters;
  },
};
