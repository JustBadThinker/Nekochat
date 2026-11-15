/**
 * NekoChat — Match Recommendation Algorithm Service
 * Algorithmic character discovery for Tinder-Style Match Deck:
 * - Persistent swiped/seen memory (eliminates repeating/looping cards)
 * - Dynamic affinity scoring based on user persona & engagement
 * - Continuous background fetching without dead ends
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommunityCharacter, Character, Persona } from '../types';
import { communityCatalogService } from './communityCatalogService';
import { storageService } from './storageService';

const STORAGE_KEY_SEEN = '@nekochat:match_seen_ids_v2';
const STORAGE_KEY_LIKED_TAGS = '@nekochat:match_liked_tags_v2';
const STORAGE_KEY_LIKED_COMPANIONS = '@nekochat:liked_companion_ids';

export interface ScoredMatchCharacter extends CommunityCharacter {
  affinityScore: number;
  matchReasons: string[];
}

export interface UserTasteProfile {
  totalInteractions: number;
  femaleInteractions: number;
  maleInteractions: number;
  dominantGender: 'female' | 'male' | 'none';
  genderConfidence: number; // 0% to 100%
  topTags: Record<string, number>;
  hasLearnedPattern: boolean; // >= 50% confidence & >= 2 interactions
}

export const MALE_TAGS = new Set([
  'male', 'man', 'boy', 'guy', 'men', 'yaoi', 'bl', 'boys love',
  'husbando', 'mlm', 'dilf', 'male lead', 'bara', 'fujoshi', 'submissive male',
  'dominant male', 'switch male', 'boyfriend', 'husband', 'stepbrother', 'brother'
]);

export const FEMALE_TAGS = new Set([
  'female', 'woman', 'girl', 'women', 'yuri', 'girls love',
  'waifu', 'milf', 'female lead', 'f4f', 'f/f', 'tsundere', 'yandere',
  'submissive female', 'dominant female', 'girlfriend', 'wife', 'stepsister', 'sister'
]);

export const MALE_NAME_TOKENS = [
  'mr.', 'sir', 'lord', 'king', 'prince', 'boy', 'man', 'father', 'husband', 'brother',
  'romeo', 'caius', 'lucas', 'alex', 'ethan', 'jack', 'stepbrother', 'boyfriend', 'butler',
  'duke', 'alpha', 'daddy', 'son', 'priest', 'male'
];

export const FEMALE_NAME_TOKENS = [
  'ms.', 'mrs.', 'miss', 'lady', 'queen', 'princess', 'girl', 'woman', 'mother', 'wife', 'sister',
  'waifu', 'girlfriend', 'stepsister', 'maid', 'duchess', 'daughter', 'female'
];

export function isCharacterExplicitlyMale(c: any): boolean {
  if (!c) return false;
  if (c.gender === 'male' || c.gender === 'man') return true;

  const charTags = Array.isArray(c.tags)
    ? (c.tags as any[]).map(t =>
        (typeof t === 'string' ? t.toLowerCase().trim() : String(t?.name || t?.slug || '').toLowerCase().trim())
      )
    : [];

  if (charTags.some(t => MALE_TAGS.has(t) || t.startsWith('male ') || t.endsWith(' male') || t === 'male')) {
    return true;
  }

  const charNameLower = (c.name || '').toLowerCase();
  const charNameWords: string[] = charNameLower.split(/[\s|/_-]+/).filter(Boolean);
  if (charNameWords.some((w: string) => MALE_NAME_TOKENS.includes(w))) {
    return true;
  }

  const descPool = `${c.shortDescription || ''} ${c.description || ''} ${c.personality || ''}`.toLowerCase();
  const hasMalePronouns = /\b(he|him|his)\b/i.test(descPool);
  const hasFemalePronouns = /\b(she|her|hers)\b/i.test(descPool);
  if (hasMalePronouns && !hasFemalePronouns && !charTags.some(t => FEMALE_TAGS.has(t))) {
    return true;
  }

  return false;
}

export function isCharacterExplicitlyFemale(c: any): boolean {
  if (!c) return false;
  if (c.gender === 'female' || c.gender === 'woman') return true;

  const charTags = Array.isArray(c.tags)
    ? (c.tags as any[]).map(t =>
        (typeof t === 'string' ? t.toLowerCase().trim() : String(t?.name || t?.slug || '').toLowerCase().trim())
      )
    : [];

  if (charTags.some(t => FEMALE_TAGS.has(t) || t.startsWith('female ') || t.endsWith(' female') || t === 'female')) {
    return true;
  }

  const charNameLower = (c.name || '').toLowerCase();
  const charNameWords: string[] = charNameLower.split(/[\s|/_-]+/).filter(Boolean);
  if (charNameWords.some((w: string) => FEMALE_NAME_TOKENS.includes(w))) {
    return true;
  }

  const descPool = `${c.shortDescription || ''} ${c.description || ''} ${c.personality || ''}`.toLowerCase();
  const hasFemalePronouns = /\b(she|her|hers)\b/i.test(descPool);
  const hasMalePronouns = /\b(he|him|his)\b/i.test(descPool);
  if (hasFemalePronouns && !hasMalePronouns && !charTags.some(t => MALE_TAGS.has(t))) {
    return true;
  }

  return false;
}

export type InteractionSignal = 'view' | 'dwell' | 'like' | 'unlike' | 'chat' | 'pass';

const SIGNAL_TAG_DELTA: Record<InteractionSignal, number> = {
  view: 0,
  dwell: 1,
  like: 3,
  unlike: -1,
  chat: 5,
  pass: -1,
};

export class MatchAlgorithmService {
  private seenIds = new Set<string>();
  private seenNames = new Set<string>();
  private likedTags: Record<string, number> = {};
  private likedCharacterIds = new Set<string>();
  private followedCreatorHandles = new Set<string>();
  private currentPage = 1;
  private isFetching = false;
  private initialized = false;
  private cachedProfile: UserTasteProfile | null = null;

  public async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const savedSeen = await AsyncStorage.getItem(STORAGE_KEY_SEEN);
      if (savedSeen) {
        const list: string[] = JSON.parse(savedSeen);
        this.seenIds = new Set(list);
      }

      const savedTags = await AsyncStorage.getItem(STORAGE_KEY_LIKED_TAGS);
      if (savedTags) {
        this.likedTags = JSON.parse(savedTags);
      }

      const savedLikedChars = await AsyncStorage.getItem(STORAGE_KEY_LIKED_COMPANIONS);
      if (savedLikedChars) {
        this.likedCharacterIds = new Set(JSON.parse(savedLikedChars));
      }
    } catch {
      this.seenIds = new Set();
      this.seenNames = new Set();
      this.likedTags = {};
      this.likedCharacterIds = new Set();
    }
    this.initialized = true;
  }

  /**
   * Builds the true User Taste Profile from actual chats, conversations, and likes.
   * Zero Sugarcoating: If total interactions < 2 or confidence < 50%, hasLearnedPattern = false.
   */
  public async buildUserTasteProfile(): Promise<UserTasteProfile> {
    await this.init();

    const topTags: Record<string, number> = { ...this.likedTags };
    let femaleInteractions = 0;
    let maleInteractions = 0;
    let totalInteractions = 0;

    // 1. Analyze Active Chat Characters (Characters user opened or chatted with)
    let charMap = new Map<string, Character>();
    try {
      const activeChats = await storageService.getCharacters();
      charMap = new Map<string, Character>(activeChats.map(c => [c.id, c]));
      for (const c of activeChats) {
        totalInteractions += 2;
        const isMale = isCharacterExplicitlyMale(c);
        const isFemale = isCharacterExplicitlyFemale(c);

        if (isFemale) femaleInteractions += 2;
        else if (isMale) maleInteractions += 2;
        else femaleInteractions += 1; // Default to female skew if non-male anime waifu

        if (Array.isArray(c.tags)) {
          for (const t of c.tags) {
            const raw = typeof t === 'string' ? t : (t as any)?.name || '';
            const clean = raw.toLowerCase().trim();
            if (clean) topTags[clean] = (topTags[clean] || 0) + 2;
          }
        }
      }
    } catch {}

    // 2. Analyze Conversation Message Counts
    try {
      const convs = await storageService.getConversations();
      for (const conv of convs) {
        const msgCount = conv.messages ? conv.messages.length : 0;
        if (msgCount > 0) {
          totalInteractions += Math.min(10, msgCount);
          // Reward character tags for deeply engaged conversations
          const char = charMap.get(conv.characterId);
          if (char) {
            const isMale = isCharacterExplicitlyMale(char);
            const isFemale = isCharacterExplicitlyFemale(char);
            if (isFemale) femaleInteractions += Math.min(6, msgCount);
            else if (isMale) maleInteractions += Math.min(6, msgCount);
          }
        }
      }
    } catch {}

    // 3. Analyze Liked Companions (from Heart button)
    try {
      const savedLikes = await AsyncStorage.getItem(STORAGE_KEY_LIKED_COMPANIONS);
      if (savedLikes) {
        const ids: string[] = JSON.parse(savedLikes);
        this.likedCharacterIds = new Set(ids);
        totalInteractions += ids.length * 3;
      }
    } catch {}

    // 4. Load Followed Creators for In-Network Blending
    try {
      const followed = await storageService.getFollowedCreators();
      this.followedCreatorHandles = new Set(
        followed.map(h => h.replace(/^@+/, '').toLowerCase().trim()).filter(Boolean)
      );
    } catch {}

    // Compute Dominant Gender & Confidence Level
    const totalGender = femaleInteractions + maleInteractions;
    let dominantGender: 'female' | 'male' | 'none' = 'none';
    let genderConfidence = 0;

    if (totalGender > 0) {
      if (femaleInteractions >= maleInteractions * 1.5 || (femaleInteractions > 0 && maleInteractions === 0)) {
        dominantGender = 'female';
        genderConfidence = Math.min(100, Math.round((femaleInteractions / totalGender) * 100));
      } else if (maleInteractions >= femaleInteractions * 1.5 || (maleInteractions > 0 && femaleInteractions === 0)) {
        dominantGender = 'male';
        genderConfidence = Math.min(100, Math.round((maleInteractions / totalGender) * 100));
      } else {
        dominantGender = 'none';
        genderConfidence = 40;
      }
    }

    // Explicit Rule: Pattern is learned ONLY if >= 2 interactions AND confidence >= 50%
    const hasLearnedPattern = totalInteractions >= 2 && genderConfidence >= 50;

    const profile: UserTasteProfile = {
      totalInteractions,
      femaleInteractions,
      maleInteractions,
      dominantGender,
      genderConfidence,
      topTags,
      hasLearnedPattern,
    };

    this.cachedProfile = profile;
    return profile;
  }

  private extractTagNames(character: CommunityCharacter | Character): string[] {
    if (!Array.isArray(character.tags)) return [];
    return (character.tags as any[])
      .map(t => (typeof t === 'string' ? t : String(t?.name || t?.slug || '')).toLowerCase().trim())
      .filter(Boolean);
  }

  private adjustTagWeights(character: CommunityCharacter | Character, delta: number): void {
    if (delta === 0) return;
    for (const tag of this.extractTagNames(character)) {
      const next = (this.likedTags[tag] || 0) + delta;
      this.likedTags[tag] = Math.max(-6, Math.min(30, next));
    }
  }

  private addSeenEntry(charId: string, name?: string): void {
    if (charId) this.seenIds.add(charId);
    if (name) {
      const cleanName = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (cleanName) this.seenNames.add(cleanName);
    }
  }

  private async persistSignals(saveSeen: boolean, saveTagsAndLikes: boolean): Promise<void> {
    try {
      if (saveSeen) {
        const trimmed = Array.from(this.seenIds).slice(-2000);
        await AsyncStorage.setItem(STORAGE_KEY_SEEN, JSON.stringify(trimmed));
      }
      if (saveTagsAndLikes) {
        await AsyncStorage.setItem(
          STORAGE_KEY_LIKED_COMPANIONS,
          JSON.stringify(Array.from(this.likedCharacterIds))
        );
        await AsyncStorage.setItem(STORAGE_KEY_LIKED_TAGS, JSON.stringify(this.likedTags));
      }
    } catch {}
  }

  /**
   * Unified Multi-Signal Engagement Tracker (X/TikTok-style action weights):
   * - 'view': marks seen so For You doesn't repeat cards
   * - 'dwell': soft +1 boost when user pauses or opens Read More
   * - 'like' / 'unlike': +3 / -1 tag weight + liked list
   * - 'chat': strongest +5 boost when user starts chatting
   * - 'pass': marks seen + soft -1 decay on skipped tags
   */
  public async recordInteraction(
    character: CommunityCharacter | Character,
    signal: InteractionSignal
  ): Promise<void> {
    await this.init();
    const id = character.id || (character as any).characterId;
    if (!id) return;

    const delta = SIGNAL_TAG_DELTA[signal];
    const shouldSaveSeen = signal === 'view' || signal === 'pass' || signal === 'chat';
    const shouldSaveTags = delta !== 0 || signal === 'like' || signal === 'unlike';

    if (shouldSaveSeen) {
      this.addSeenEntry(id, character.name);
    }
    if (signal === 'like') {
      this.likedCharacterIds.add(id);
    } else if (signal === 'unlike') {
      this.likedCharacterIds.delete(id);
    }
    this.adjustTagWeights(character, delta);

    await this.persistSignals(shouldSaveSeen, shouldSaveTags);
    if (shouldSaveTags) {
      this.cachedProfile = null;
    }
  }

  /**
   * Immediate Social Media Like Handler:
   * Instantly records a like/unlike with 0ms delay, persists to storage, and adapts taste.
   */
  public async recordUserLike(character: CommunityCharacter | Character, nextLiked: boolean): Promise<void> {
    await this.recordInteraction(character, nextLiked ? 'like' : 'unlike');
  }

  /**
   * Checks if character ID is liked.
   */
  public isCharacterLiked(charId: string): boolean {
    return this.likedCharacterIds.has(charId);
  }

  /**
   * Mark character as swiped (pass or match) so it never repeats
   */
  public async markSwiped(charId: string, action: 'pass' | 'match', character?: CommunityCharacter): Promise<void> {
    await this.init();
    this.addSeenEntry(charId, character?.name);

    if (character) {
      if (action === 'match') {
        await this.recordInteraction(character, 'like');
      } else {
        await this.recordInteraction(character, 'pass');
      }
      return;
    }

    await this.persistSignals(true, false);
  }

  /**
   * Reset the seen history if user explicitly requests "Restart Deck"
   */
  public async resetSeen(): Promise<void> {
    this.seenIds.clear();
    this.seenNames.clear();
    this.currentPage = 1;
    await AsyncStorage.removeItem(STORAGE_KEY_SEEN);
  }

  /**
   * Calculate algorithmic affinity score (0% to 100%).
   * Strict: Never assigns fake base scores. Disqualifies opposite gender if dominant.
   */
  public scoreCharacter(
    candidate: CommunityCharacter,
    activePersona?: Persona,
    profile?: UserTasteProfile
  ): { score: number; reasons: string[] } {
    const taste = profile || this.cachedProfile;
    const reasons: string[] = [];

    const isMale = isCharacterExplicitlyMale(candidate);
    const isFemale = isCharacterExplicitlyFemale(candidate);

    // Strict Gender Hard-Gate: If user chats with females, NEVER surface male bots!
    if (taste && taste.hasLearnedPattern) {
      if (taste.dominantGender === 'female' && isMale) {
        return { score: 0, reasons: [] };
      }
      if (taste.dominantGender === 'male' && isFemale) {
        return { score: 0, reasons: [] };
      }
    }

    let score = 0;

    // 1. Gender Match Alignment (up to 40 pts)
    if (taste?.dominantGender === 'female' && (isFemale || !isMale)) {
      score += 40;
      reasons.push('Matches female preference');
    } else if (taste?.dominantGender === 'male' && isMale) {
      score += 40;
      reasons.push('Matches male preference');
    } else {
      score += 20;
    }

    // 2. Tag Preference Alignment (positive boost up to 40 pts, soft negative decay down to -18 pts)
    const tagsList = this.extractTagNames(candidate);
    let weightedTagSum = 0;
    const referenceTags = taste?.topTags || this.likedTags;
    for (const tag of tagsList) {
      if (typeof referenceTags[tag] === 'number') {
        weightedTagSum += referenceTags[tag];
      }
    }
    if (weightedTagSum > 0) {
      const boost = Math.min(40, weightedTagSum * 5);
      score += boost;
      reasons.push('Matches your anime taste');
    } else if (weightedTagSum < 0) {
      score += Math.max(-18, weightedTagSum * 3);
    }

    // 2b. Followed Creator In-Network Boost (+18 pts)
    const creatorKey = (candidate.creatorName || '').replace(/^@+/, '').toLowerCase().trim();
    if (creatorKey && this.followedCreatorHandles.has(creatorKey)) {
      score += 18;
      reasons.push('Creator you follow');
    }

    // 3. Persona Alignment (up to 12 pts)
    if (activePersona?.description) {
      const personaWords = activePersona.description.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
      const targetText = `${candidate.name} ${candidate.shortDescription || ''} ${candidate.personality || ''}`.toLowerCase();
      let personaMatches = 0;
      for (const w of personaWords) {
        if (targetText.includes(w)) personaMatches++;
      }
      if (personaMatches > 0) {
        score += Math.min(12, personaMatches * 4);
        reasons.push(`Fits ${activePersona.name}`);
      }
    }

    // 4. Quality & Popularity Bonus (up to 8 pts)
    const chatCount = Number(candidate.chatCount || 0);
    const favorites = Number(candidate.favoritesCount || 0);
    if (chatCount > 1000 || favorites > 100) {
      score += Math.min(8, Math.log10(chatCount + 1) * 1.5);
    }

    const finalScore = Math.min(99, Math.max(0, Math.round(score)));
    if (reasons.length === 0 && finalScore >= 50) reasons.push('Recommended for you');

    return { score: finalScore, reasons };
  }

  /**
   * Fetches genuine algorithmic recommendations for "Top 3 For You".
   * Returns empty array if user pattern is under 50% (as requested by user).
   */
  public async getLearnedRecommendations(
    limit: number = 3,
    activePersona?: Persona
  ): Promise<ScoredMatchCharacter[]> {
    const taste = await this.buildUserTasteProfile();

    // If pattern not found or confidence under 50%: return [] so only Trending 24h shows!
    if (!taste.hasLearnedPattern) {
      return [];
    }

    // Fetch batch targeted to user's proven preference
    const targetFilter = taste.dominantGender === 'female' ? ['female'] : taste.dominantGender === 'male' ? ['male'] : [];
    const batch = await this.getNextBatch(16, activePersona, targetFilter);

    // Filter for high-affinity matches that strictly obey gender preference
    const genderFiltered = batch.filter(c => {
      if (taste.dominantGender === 'female' && isCharacterExplicitlyMale(c)) return false;
      if (taste.dominantGender === 'male' && isCharacterExplicitlyFemale(c)) return false;
      return true;
    });
    const highAffinity = genderFiltered.filter(c => c.affinityScore >= 40);
    const scored = (highAffinity.length > 0 ? highAffinity : genderFiltered).slice(0, limit);

    return scored;
  }

  /**
   * Re-rank scored candidates using Creator Diversity Penalty + 80/20 Exploit/Explore interleaving.
   * Prevents the same creator from flooding consecutive slots and injects ~20% serendipity picks.
   */
  private rerankWithDiversity(candidates: ScoredMatchCharacter[]): ScoredMatchCharacter[] {
    if (candidates.length <= 2) return candidates;

    const creatorCounts = new Map<string, number>();
    const remaining = [...candidates].sort((a, b) => b.affinityScore - a.affinityScore);
    const ranked: ScoredMatchCharacter[] = [];

    // Greedy diversity pass (X-style author penalty)
    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestAdjusted = -Infinity;
      const lastCreator =
        ranked.length > 0
          ? (ranked[ranked.length - 1].creatorName || '').toLowerCase().trim()
          : '';

      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        const cKey = (item.creatorName || '').toLowerCase().trim();
        const priorCount = cKey ? creatorCounts.get(cKey) || 0 : 0;
        const diversityMultiplier = 1 / (1 + 0.35 * priorCount);
        const consecutivePenalty = cKey && cKey === lastCreator ? 0.65 : 1;
        const adjusted = item.affinityScore * diversityMultiplier * consecutivePenalty;

        if (adjusted > bestAdjusted) {
          bestAdjusted = adjusted;
          bestIdx = i;
        }
      }

      const [picked] = remaining.splice(bestIdx, 1);
      const pickedCreator = (picked.creatorName || '').toLowerCase().trim();
      if (pickedCreator) {
        creatorCounts.set(pickedCreator, (creatorCounts.get(pickedCreator) || 0) + 1);
      }
      ranked.push(picked);
    }

    // 80/20 Exploit vs Explore: every 5th slot, surface an exploration candidate from the tail
    if (ranked.length >= 6) {
      const explorePoolSize = Math.max(1, Math.floor(ranked.length * 0.2));
      const explorePool = ranked.splice(ranked.length - explorePoolSize, explorePoolSize);
      for (let slot = 4; explorePool.length > 0 && slot <= ranked.length; slot += 5) {
        const surprise = explorePool.shift()!;
        ranked.splice(slot, 0, {
          ...surprise,
          matchReasons:
            surprise.matchReasons.length > 0
              ? surprise.matchReasons
              : ['Fresh discovery for you'],
        });
      }
      if (explorePool.length > 0) {
        ranked.push(...explorePool);
      }
    }

    return ranked;
  }

  /**
   * Fetch a fresh algorithmic batch of unswiped characters from live catalog
   */
  public async getNextBatch(
    limit: number = 20,
    activePersona?: Persona,
    filterTags?: string[] | string
  ): Promise<ScoredMatchCharacter[]> {
    await this.init();
    if (this.isFetching) return [];
    this.isFetching = true;
    await this.buildUserTasteProfile();

    const normalizedFilterTags: string[] = (
      Array.isArray(filterTags)
        ? filterTags
        : filterTags ? [filterTags] : []
    )
      .map(t => t.trim().toLowerCase())
      .filter(t => t && t !== 'all');

    // Map normalized filter tags to remote Datacat tagIds
    let remoteTagIds: string | undefined;
    const tagIdList: number[] = [];
    for (const f of normalizedFilterTags) {
      if (f === 'female') tagIdList.push(3);
      else if (f === 'male') tagIdList.push(2);
      else if (f === 'anime') tagIdList.push(1);
      else if (f === 'romance') tagIdList.push(55);
      else if (f === 'fantasy') tagIdList.push(9);
      else if (f === 'rpg') tagIdList.push(54);
      else if (f === 'sci-fi') tagIdList.push(12);
      else if (f === 'monster girls') tagIdList.push(21);
      else if (f === 'slice of life') tagIdList.push(63);
      else if (f === 'smut') tagIdList.push(13);
      else if (f === 'fluff') tagIdList.push(64);
    }
    if (tagIdList.length > 0) {
      remoteTagIds = tagIdList.join(',');
    }

    try {
      const results: ScoredMatchCharacter[] = [];
      const seenInBatchIds = new Set<string>();
      const seenInBatchNames = new Set<string>();
      let attempts = 0;

      while (results.length < limit && attempts < 4) {
        attempts++;
        // Every 3rd page blends 'latest' uploads with 'trending' for time-decay freshness
        const batchSort: 'trending' | 'latest' = this.currentPage % 3 === 0 ? 'latest' : 'trending';
        let res = await communityCatalogService.fetchDatacatCharacters({
          page: this.currentPage,
          limit: 30,
          sort: batchSort,
          tagIds: remoteTagIds,
        });

        // If Datacat is unreachable or returned empty, seamlessly fallback to live Chub.ai catalog
        if (!res.characters || res.characters.length === 0) {
          res = await communityCatalogService.fetchChubCharacters({
            page: this.currentPage,
            limit: 30,
            sort: batchSort,
            search: normalizedFilterTags.length > 0 ? normalizedFilterTags[0] : undefined,
          });
        }

        this.currentPage += 1;
        const candidates = res.characters || [];
        if (candidates.length === 0) break;

        for (const c of candidates) {
          const id = c.id || c.characterId;
          const nameKey = (c.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

          // Filter out already seen/swiped characters or in-batch duplicate IDs/names
          if (this.seenIds.has(id) || seenInBatchIds.has(id)) continue;
          if (nameKey && (this.seenNames.has(nameKey) || seenInBatchNames.has(nameKey))) continue;

          // Apply multi-tag filter if active
          if (normalizedFilterTags.length > 0) {
            const charTags = Array.isArray(c.tags)
              ? (c.tags as any[]).map(t =>
                  (typeof t === 'string' ? t.toLowerCase().trim() : String(t?.name || t?.slug || '').toLowerCase().trim())
                )
              : [];
            const charNameLower = (c.name || '').toLowerCase();
            const isMale = isCharacterExplicitlyMale(c);
            const isFemale = isCharacterExplicitlyFemale(c);

            // Check if matches any of the selected filters
            const matches = normalizedFilterTags.some(filter => {
              if (filter === 'female') {
                // Strict: Never include male bots in female section!
                if (isMale) return false;
                return isFemale || charTags.some(t => t.includes('female') || t.includes('girl') || t.includes('waifu'));
              }
              if (filter === 'male') {
                // Strict: Never include female bots in male section!
                if (isFemale) return false;
                return isMale || charTags.some(t => t.includes('male') || t.includes('boy') || t.includes('husbando'));
              }
              return charTags.some(t => t.includes(filter)) || charNameLower.includes(filter);
            });

            if (!matches) continue;
          }

          seenInBatchIds.add(id);
          if (nameKey) seenInBatchNames.add(nameKey);

          const { score, reasons } = this.scoreCharacter(c, activePersona);
          results.push({
            ...c,
            affinityScore: score,
            matchReasons: reasons,
          });

          if (results.length >= limit) break;
        }
      }

      // Re-rank with creator diversity spacing & 80/20 exploit/explore mixing
      return this.rerankWithDiversity(results);
    } finally {
      this.isFetching = false;
    }
  }
}

export const matchAlgorithmService = new MatchAlgorithmService();
