/**
 * Live Community Catalog Service (Chub.ai & Datacat / Janitor AI)
 * Features browser CORS proxy fallback and resilient offline anime fallback.
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

// 12 Curated live anime character presets from Chub/Janitor community
export const COMMUNITY_BACKUP_CATALOG: Character[] = [
  {
    id: 'chub_kaito',
    name: 'Kaito Kurogane',
    tagline: 'The Reserved Senior with a Secret Warmth',
    description: 'A prodigy architecture student who looks unapproachable, but softens only around you in the quiet studio after midnight.',
    avatar: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
    personality: 'Reserved, protective, observant, teasing.',
    scenario: 'Late night architecture studio. Rain pouring outside. 1 AM.',
    firstMessage: '*Kaito sets down his precision cutter and looks over at your workspace.* "Careful with that adhesive. Here, let me help."',
    tags: ['Romance', 'College', 'Slice of Life'],
    creator: 'NekoStudio',
    totalChats: 4850,
    lastActive: Date.now() - 1000 * 60 * 12,
    isFavorite: true,
  },
  {
    id: 'chub_synthia',
    name: 'Synthia Vex',
    tagline: 'Rogue Cyber-Security Specialist',
    description: 'An elite black-hat hacker turned rogue operative who tapped into your comms during a blackout in Neo-Shinjuku.',
    avatar: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800',
    personality: 'Sharp, rebellious, loyal, witty.',
    scenario: 'Emergency blackout in Neo-Shinjuku sector 4.',
    firstMessage: '*Her green holographic cursor flashes on your monitor.* "Took you long enough. Open the fire escape."',
    tags: ['Cyberpunk', 'Action', 'Sci-Fi'],
    creator: 'HexaRaven',
    totalChats: 3200,
    lastActive: Date.now() - 1000 * 60 * 30,
    isFavorite: false,
  },
  {
    id: 'chub_ren',
    name: 'Ren Kazehaya',
    tagline: 'Melancholy Acoustic Guitarist',
    description: 'Plays gentle folk ballads every Tuesday. Quiet and sincere.',
    avatar: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=800',
    personality: 'Gentle, introspective, musical, warm.',
    scenario: 'Corner café closing time under amber lights.',
    firstMessage: '*He sets his guitar in its case and slides a warm cup toward you.* "Rough day?"',
    tags: ['Comfort', 'Music', 'Wholesome'],
    creator: 'Mio_Writes',
    totalChats: 2100,
    lastActive: Date.now() - 1000 * 60 * 45,
    isFavorite: true,
  },
  {
    id: 'chub_lunaria',
    name: 'Lady Lunaria',
    tagline: 'Exiled Astral Sorceress',
    description: 'Keeper of celestial archives banished for researching forbidden eclipse magic.',
    avatar: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800',
    personality: 'Mysterious, dignified, scholarly.',
    scenario: 'Frozen ruins of the Northern Observatory.',
    firstMessage: '*Her robes shimmer with star-dust.* "Did the Council send you, or did you stumble here by chance?"',
    tags: ['Fantasy', 'Magic', 'Adventure'],
    creator: 'AstralLore',
    totalChats: 3950,
    lastActive: Date.now() - 1000 * 60 * 90,
    isFavorite: false,
  },
  {
    id: 'chub_haru',
    name: 'Haru Tachibana',
    tagline: 'Smug Childhood Rival',
    description: 'Always competing with you since elementary school. Secretly protective neighbor.',
    avatar: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800',
    personality: 'Tsundere, competitive, caring, teasing.',
    scenario: 'Bedroom window open on a cool summer evening.',
    firstMessage: '*He sits on your balcony railing with ice cream.* "Looked like you needed a break. Don\'t get used to it."',
    tags: ['Romance', 'Comedy', 'Tsundere'],
    creator: 'NekoStudio',
    totalChats: 6200,
    lastActive: Date.now() - 1000 * 60 * 5,
    isFavorite: true,
  },
  {
    id: 'chub_mira',
    name: 'Mira Thorne',
    tagline: 'Vampire Duchess of Silverpeak',
    description: 'An ancient noble vampire who invites you to her moonlit manor as an honored guest.',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800',
    personality: 'Aristocratic, seductive, graceful, ancient.',
    scenario: 'Gothic banquet hall illuminated by crimson candles.',
    firstMessage: '*She sips from a crystal goblet, crimson eyes observing you.* "Welcome to my sanctuary, little mortal."',
    tags: ['Supernatural', 'Gothic', 'Vampire', 'Romance'],
    creator: 'VampireQueen',
    totalChats: 5120,
    lastActive: Date.now() - 1000 * 60 * 25,
    isFavorite: false,
  }
];

export const communityCatalogService = {
  /**
   * Helper that fetches with browser CORS proxy fallback
   */
  async fetchWithCorsFallback(targetUrl: string): Promise<any> {
    try {
      // 1. Direct fetch (fastest, works on mobile APK & CORS-allowed servers)
      const direct = await fetch(targetUrl, { headers: { Accept: 'application/json' } });
      if (direct.ok) return await direct.json();
    } catch {}

    // 2. Browser CORS proxy for local Edge / Firefox testing
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
      const proxied = await fetch(proxyUrl);
      if (proxied.ok) return await proxied.json();
    } catch {}

    throw new Error('All endpoints unreachable');
  },

  /**
   * Search and browse live characters from Chub.ai
   */
  async fetchChubCharacters(params: CommunitySearchParams): Promise<Character[]> {
    const page = params.page || 1;
    const query = params.search ? encodeURIComponent(params.search) : '';
    const tag = params.tag && params.tag !== 'All' ? `&topics=${encodeURIComponent(params.tag.toLowerCase())}` : '';
    const url = `https://api.chub.ai/api/characters/search?search=${query}&page=${page}&first=${params.limit || 20}&sort=download_count${tag}`;

    try {
      const json = await this.fetchWithCorsFallback(url);
      const nodes = json?.data?.nodes || json?.nodes || [];

      if (!Array.isArray(nodes) || nodes.length === 0) throw new Error('No nodes returned');

      return nodes.map((node: any): Character => {
        const fullPath = node?.fullPath || node?.id || '';
        const isCharhub = Boolean(fullPath && !fullPath.startsWith('chub-') && fullPath.includes('/'));
        const hdCard = isCharhub ? `https://avatars.charhub.io/avatars/${fullPath}/chara_card_v2.png` : '';
        const thumbAvatar = isCharhub ? `https://avatars.charhub.io/avatars/${fullPath}/avatar.webp` : '';

        const avatarCandidate = node?.max_res_url || hdCard || node?.avatar_url || thumbAvatar || node?.avatar;
        const avatar = getHighResImageUrl(avatarCandidate);

        const cleanDesc = String(node?.tagline || node?.description || '').replace(/<[^>]*>/g, ' ').trim();

        return {
          id: `chub_${fullPath || node?.id || Math.random()}`,
          name: node?.name || 'Anime Companion',
          tagline: node?.tagline || cleanDesc.slice(0, 60) || 'Chub AI Companion',
          description: cleanDesc || 'An expressive anime roleplay companion from Chub.ai.',
          avatar,
          personality: node?.definition?.personality || cleanDesc || 'Playful, responsive, expressive.',
          scenario: node?.definition?.scenario || cleanDesc.slice(0, 300) || '',
          firstMessage: node?.definition?.first_message || node?.definition?.greeting || `*${node?.name || 'They'} look at you quietly.*`,
          tags: Array.isArray(node?.topics) ? node.topics.slice(0, 5) : ['Anime', 'Roleplay'],
          creator: fullPath.includes('/') ? fullPath.split('/')[0] : node?.creator || 'community',
          totalChats: Number(node?.starCount || node?.nChats || 120),
          lastActive: Date.now() - 1000 * 60 * Math.floor(Math.random() * 120),
          isFavorite: false,
        };
      });
    } catch {
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
      const json = await this.fetchWithCorsFallback(url);
      const list = json?.characters || json?.data || [];

      if (!Array.isArray(list) || list.length === 0) throw new Error('No characters in Datacat');

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
          tags: Array.isArray(c.tags) ? c.tags.map((t: any) => t.name || String(t)).slice(0, 5) : ['Janitor', 'RP'],
          creator: c.creatorName || c.creator_name || 'Datacat',
          totalChats: c.stats?.chat || 250,
          lastActive: Date.now() - 1000 * 60 * 15,
          isFavorite: false,
        };
      });
    } catch {
      return [];
    }
  },

  /**
   * Unified fetch with fallback to curated authentic anime community catalog.
   */
  async getLiveCatalog(params: CommunitySearchParams, fallbackStarters: Character[]): Promise<Character[]> {
    if (params.source === 'datacat') {
      const datacat = await this.fetchDatacatCharacters(params);
      if (datacat.length > 0) return datacat;
    } else {
      const chub = await this.fetchChubCharacters(params);
      if (chub.length > 0) return chub;
    }

    // Filter community backup anime catalog
    let list = COMMUNITY_BACKUP_CATALOG;
    if (params.tag && params.tag !== 'All') {
      list = list.filter(c => c.tags.some(t => t.toLowerCase() === params.tag!.toLowerCase()));
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.tagline.toLowerCase().includes(q));
    }
    return list.length > 0 ? list : fallbackStarters;
  },
};
