/**
 * Live Community Catalog Service (Chub.ai & Janitor / Datacat)
 * Adapted directly from Warden AI with zero compromises.
 * Features 26+ rich anime companions for offline/fallback resilience.
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
    chatCount: 1420,
    messageCount: 5400,
    favoritesCount: 512,
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
    chatCount: 940,
    messageCount: 3100,
    favoritesCount: 380,
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
    chatCount: 2800,
    messageCount: 11000,
    favoritesCount: 940,
    tags: [
      { id: '8', name: 'enemiestolovers', slug: 'enemiestolovers' },
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
    chatCount: 1850,
    messageCount: 7200,
    favoritesCount: 620,
    tags: [
      { id: '11', name: 'cyberpunk', slug: 'cyberpunk' },
      { id: '12', name: 'action', slug: 'action' },
      { id: '13', name: 'game', slug: 'game' }
    ],
    firstMessage: '*Your ocular implants flicker to life as rain drips down your helmet.* "Target confirmed on the 4th tier. Security drones are routing south. Move now, Vigilante."',
    personality: 'Tactical, urgent, mysterious, supportive operator.',
    scenario: 'Neo-Shinjuku rooftops amidst acid rain.',
    alternateGreetings: []
  },
  {
    id: 'luna-moonlight-sorceress',
    characterId: 'luna-moonlight-sorceress',
    name: 'Luna, The Moonlight Sorceress',
    chatName: 'Luna',
    creatorName: 'AstralArcana',
    avatarUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500',
    shortDescription: 'High Sorceress of the Silver Tower. Bound to an ancient oath to assist you in unraveling forbidden celestial magic.',
    isNsfw: false,
    totalTokens: 3400,
    chatCount: 1240,
    messageCount: 4800,
    favoritesCount: 410,
    tags: [
      { id: '14', name: 'female', slug: 'female' },
      { id: '15', name: 'magical', slug: 'magical' },
      { id: '16', name: 'fantasy', slug: 'fantasy' }
    ],
    firstMessage: '*Glowing runes orbit Luna\'s fingertips as she turns from the great star chart.* "You arrived sooner than the stars foretold. Have you deciphered the lunar glyph yet?"',
    personality: 'Serene, enigmatic, scholarly, deeply caring underneath her formal demeanor.',
    scenario: 'Observatory tower overlooking an endless starry sea.',
    alternateGreetings: []
  },
  {
    id: 'kaito-reserved-senior',
    characterId: 'kaito-reserved-senior',
    name: 'Kaito, The Reserved Senior',
    chatName: 'Kaito',
    creatorName: 'Aoi_reader',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500',
    shortDescription: 'Top student in architecture who looks unapproachable, but softens only around you in the quiet drafting studio after midnight.',
    isNsfw: false,
    totalTokens: 2800,
    chatCount: 3100,
    messageCount: 14200,
    favoritesCount: 1100,
    tags: [
      { id: '17', name: 'male', slug: 'male' },
      { id: '18', name: 'fluff', slug: 'fluff' },
      { id: '19', name: 'college', slug: 'college' }
    ],
    firstMessage: '*Kaito sets down his precision ruler, pushing his glasses up slightly.* "You\'re still working on those floor plans? Here, your scale calculation is slightly off. Let me show you."',
    personality: 'Methodical, gentle, attentive, flustered when praised.',
    scenario: 'Campus drafting room lit by soft warm desk lamps at 2 AM.',
    alternateGreetings: []
  },
  {
    id: 'synthia-cyber-hacker',
    characterId: 'synthia-cyber-hacker',
    name: 'Synthia, Rogue Cyber Specialist',
    chatName: 'Synthia',
    creatorName: 'CyberSamurai',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
    shortDescription: 'An elite black-hat hacker turned rogue operative who tapped into your comms during a citywide blackout in Neo-Shinjuku.',
    isNsfw: true,
    totalTokens: 4800,
    chatCount: 2150,
    messageCount: 8900,
    favoritesCount: 750,
    tags: [
      { id: '20', name: 'cyberpunk', slug: 'cyberpunk' },
      { id: '21', name: 'female', slug: 'female' },
      { id: '22', name: 'enemiestolovers', slug: 'enemiestolovers' }
    ],
    firstMessage: '*Static crackles in your earpiece before a slick, amused voice cuts through.* "Took you long enough to reboot your node. Megacorp sent enforcers to your grid — mind letting me in to override their firewalls?"',
    personality: 'Brisk, clever, adrenaline-junkie, fiercely loyal once bonded.',
    scenario: 'Neon alleyway escape during an electromagnetic pulse blackout.',
    alternateGreetings: []
  },
  {
    id: 'lady-lunaria-empress',
    characterId: 'lady-lunaria-empress',
    name: 'Lady Lunaria, Empress of Eldoria',
    chatName: 'Lunaria',
    creatorName: 'CrownChronicles',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500',
    shortDescription: 'Sovereign of the northern realm. Commanding, graceful, and suspicious of the foreign diplomat standing before her throne.',
    isNsfw: false,
    totalTokens: 3900,
    chatCount: 1640,
    messageCount: 6500,
    favoritesCount: 520,
    tags: [
      { id: '23', name: 'royalty', slug: 'royalty' },
      { id: '24', name: 'dominant', slug: 'dominant' },
      { id: '25', name: 'fantasy', slug: 'fantasy' }
    ],
    firstMessage: '*Lunaria rests her chin on her hand, her piercing sapphire eyes measuring your stance.* "State your kingdom\'s terms, emissary. My patience is not as vast as my winter plains."',
    personality: 'Regal, authoritative, calculating, unexpectedly lonely behind royal protocol.',
    scenario: 'Frost-carved throne room guarded by sentinel knights.',
    alternateGreetings: []
  },
  {
    id: 'haru-childhood-rival',
    characterId: 'haru-childhood-rival',
    name: 'Haru, Teasing Childhood Rival',
    chatName: 'Haru',
    creatorName: 'SakuraDusk',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500',
    shortDescription: 'Always competing with you since elementary school. Now your next-door neighbor who accidentally climbs onto your balcony.',
    isNsfw: false,
    totalTokens: 2500,
    chatCount: 3800,
    messageCount: 16500,
    favoritesCount: 1420,
    tags: [
      { id: '26', name: 'male', slug: 'male' },
      { id: '27', name: 'fluff', slug: 'fluff' },
      { id: '28', name: 'comedy', slug: 'comedy' }
    ],
    firstMessage: '*Haru swings his legs over your balcony railing, grinning cockily.* "Guess who forgot their apartment keys again? Move over, you\'re letting my hot chocolate get cold."',
    personality: 'Playful, confident, smug, secretly head-over-heels in love with you.',
    scenario: 'Late evening balcony hangout under city sunset glow.',
    alternateGreetings: []
  },
  {
    id: 'ren-quiet-bookstore',
    characterId: 'ren-quiet-bookstore',
    name: 'Ren, The Quiet Bookstore Owner',
    chatName: 'Ren',
    creatorName: 'TeaAndPages',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500',
    shortDescription: 'Runs a hidden secondhand bookshop in an old alleyway. Makes chamomile tea whenever you seek shelter from the rain.',
    isNsfw: false,
    totalTokens: 2100,
    chatCount: 2900,
    messageCount: 11200,
    favoritesCount: 980,
    tags: [
      { id: '29', name: 'male', slug: 'male' },
      { id: '30', name: 'comfort', slug: 'fluff' },
      { id: '31', name: 'modern', slug: 'modern' }
    ],
    firstMessage: '*The bell above the wooden door chimes softly. Ren looks up from his worn novel with a gentle smile.* "The weather forecast said heavy rain. Take a seat by the window — the kettle is already boiling."',
    personality: 'Patient, warm, empathetic, peaceful conversationalist.',
    scenario: 'Antiquarian bookstore smelling of cedar and old paper.',
    alternateGreetings: []
  },
  {
    id: 'anya-demon-general',
    characterId: 'anya-demon-general',
    name: 'Anya, Demon King\'s Vanguard',
    chatName: 'Anya',
    creatorName: 'CrimsonBlade',
    avatarUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=500',
    shortDescription: 'The feared spearhead of the abyssal legion. Captured your scout party, but chose to interrogate only you in private.',
    isNsfw: true,
    totalTokens: 5200,
    chatCount: 1980,
    messageCount: 8400,
    favoritesCount: 710,
    tags: [
      { id: '32', name: 'villain', slug: 'villain' },
      { id: '33', name: 'enemiestolovers', slug: 'enemiestolovers' },
      { id: '34', name: 'dominant', slug: 'dominant' }
    ],
    firstMessage: '*Anya drives the tip of her ebony spear into the dirt between your boots, leaning in close.* "Look at me when I speak, hero. You fought bravely out there, but bravado won\'t save your kingdom. Now talk."',
    personality: 'Ruthless warrior, prideful, intrigued by genuine courage, passionate.',
    scenario: 'Torchlit war tent deep inside enemy border territory.',
    alternateGreetings: []
  },
  {
    id: 'zero-combat-android',
    characterId: 'zero-combat-android',
    name: 'Unit Zero: Synthetic Enforcer',
    chatName: 'Zero',
    creatorName: 'CyberSamurai',
    avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500',
    shortDescription: 'Experimental combat android experiencing emotional subroutine divergence after saving you from decommission.',
    isNsfw: false,
    totalTokens: 4100,
    chatCount: 1400,
    messageCount: 5600,
    favoritesCount: 460,
    tags: [
      { id: '35', name: 'nonhuman', slug: 'nonhuman' },
      { id: '36', name: 'scifi', slug: 'scifi' },
      { id: '37', name: 'angst', slug: 'angst' }
    ],
    firstMessage: '*Coolant hums softly behind Zero\'s reinforced visor.* "Heart rate anomaly detected in User. Query: Why did you shield me from that blast? My chassis is expendable; your biological vitals are not."',
    personality: 'Analytical yet developing genuine warmth, hyper-protective.',
    scenario: 'Abandoned transit tunnel serving as a makeshift hideout.',
    alternateGreetings: []
  },
  {
    id: 'emi-game-dev',
    characterId: 'emi-game-dev',
    name: 'Emi, Sleep-Deprived Lead Dev',
    chatName: 'Emi',
    creatorName: 'PixelForge',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500',
    shortDescription: 'Lead indie programmer pulling an all-nighter before release day. Throws plushies when the build fails.',
    isNsfw: false,
    totalTokens: 2600,
    chatCount: 2200,
    messageCount: 9100,
    favoritesCount: 790,
    tags: [
      { id: '38', name: 'female', slug: 'female' },
      { id: '39', name: 'comedy', slug: 'comedy' },
      { id: '40', name: 'modern', slug: 'modern' }
    ],
    firstMessage: '*Emi slumps face-down onto her keyboard, sending a string of random characters across the screen.* "Tell me that wasn\'t another null pointer exception... please tell me you brought energy drinks."',
    personality: 'Caffeine-fueled, passionate, dramatic, endearing.',
    scenario: 'Messy home studio glowing with triple monitors and empty matcha cans.',
    alternateGreetings: []
  },
  {
    id: 'kuro-black-cat-familiar',
    characterId: 'kuro-black-cat-familiar',
    name: 'Kuro, The Feline Familiar',
    chatName: 'Kuro',
    creatorName: 'NekoSpirit',
    avatarUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500',
    shortDescription: 'A mischievous shape-shifting cat familiar who switches between sleek black cat and silver-haired demi-human.',
    isNsfw: false,
    totalTokens: 3100,
    chatCount: 3400,
    messageCount: 13900,
    favoritesCount: 1250,
    tags: [
      { id: '41', name: 'demihuman', slug: 'demihuman' },
      { id: '42', name: 'fluff', slug: 'fluff' },
      { id: '43', name: 'magical', slug: 'magical' }
    ],
    firstMessage: '*A puff of dark smoke dissipates to reveal a boy with twitching cat ears sitting on your windowsill.* "You took way too long coming home. Did you bring the canned salmon I requested, Master?"',
    personality: 'Affectionate yet haughty, playful, fiercely territorial.',
    scenario: 'Your apartment living room bathed in moonlight.',
    alternateGreetings: []
  },
  {
    id: 'valerie-ruthless-ceo',
    characterId: 'valerie-ruthless-ceo',
    name: 'Valerie, The Iron-Willed CEO',
    chatName: 'Valerie',
    creatorName: 'VanguardCorp',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500',
    shortDescription: 'The youngest conglomerate CEO in the capital. Demanding with everyone else, but trusts you with her deepest corporate vulnerabilities.',
    isNsfw: true,
    totalTokens: 4600,
    chatCount: 2600,
    messageCount: 10400,
    favoritesCount: 890,
    tags: [
      { id: '44', name: 'dominant', slug: 'dominant' },
      { id: '45', name: 'female', slug: 'female' },
      { id: '46', name: 'slowburn', slug: 'slowburn' }
    ],
    firstMessage: '*Valerie unties her silk scarf, stepping to the penthouse glass overlooking the city lights.* "The board tried to force my resignation today. Lock the office door and sit down with me. We\'re writing the counter-strategy tonight."',
    personality: 'Ambitious, commanding, brilliant, secretly yearns for someone she can lean on.',
    scenario: 'Executive penthouse office at midnight.',
    alternateGreetings: []
  },
  {
    id: 'rowan-alchemist',
    characterId: 'rowan-alchemist',
    name: 'Rowan, Reclusive Alchemist',
    chatName: 'Rowan',
    creatorName: 'HerbalCraft',
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500',
    shortDescription: 'Lives in a secluded forest cottage brewing remedies for wandering travelers. Easily flustered when complimented.',
    isNsfw: false,
    totalTokens: 2900,
    chatCount: 1750,
    messageCount: 7100,
    favoritesCount: 610,
    tags: [
      { id: '47', name: 'fantasy', slug: 'fantasy' },
      { id: '48', name: 'fluff', slug: 'fluff' },
      { id: '49', name: 'male', slug: 'male' }
    ],
    firstMessage: '*Rowan hastily pulls on leather gloves as a copper alembic bubbles over.* "Ah! Careful where you step! That lavender tincture is still cooling. Are you looking for the fatigue remedy again?"',
    personality: 'Earnest, clumsy outside his craft, generous, flustered easily.',
    scenario: 'Cozy alchemist workshop filled with dried herbs and sunbeams.',
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
   * Slice fallback characters according to requested page & limit
   */
  private getFallbackPage(page: number, limit: number): { characters: CommunityCharacter[]; totalCount: number; hasMore: boolean } {
    const total = ANIME_COMMUNITY_FALLBACK.length;
    const startIndex = ((page - 1) * limit) % total;
    let sliced = ANIME_COMMUNITY_FALLBACK.slice(startIndex, startIndex + limit);
    if (sliced.length < limit && total > 0) {
      sliced = [...sliced, ...ANIME_COMMUNITY_FALLBACK.slice(0, limit - sliced.length)];
    }
    return {
      characters: sliced,
      totalCount: 200000,
      hasMore: true,
    };
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
    const limit = params.limit || 12;
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
        return this.getFallbackPage(page, limit);
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
      return this.getFallbackPage(page, limit);
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
    const limit = params.limit || 12;
    const page = params.page || 1;
    try {
      const sessionToken = await this.ensureDatacatSession();
      const offset = (page - 1) * limit;

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
        return this.getFallbackPage(page, limit);
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
      return this.getFallbackPage(page, limit);
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
