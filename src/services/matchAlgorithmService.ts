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

export class MatchAlgorithmService {
  private seenIds = new Set<string>();
  private seenNames = new Set<string>();
  private likedTags: Record<string, number> = {};
  private likedCharacterIds = new Set<string>();
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

  /**
   * Immediate Social Media Like Handler:
   * Instantly records a like/unlike with 0ms delay, persists to storage, and adapts taste.
   */
  public async recordUserLike(character: CommunityCharacter | Character, nextLiked: boolean): Promise<void> {
    await this.init();
    const id = character.id || (character as any).characterId;
    if (!id) return;

    if (nextLiked) {
      this.likedCharacterIds.add(id);
      // Learn tags
      if (Array.isArray(character.tags)) {
        for (const t of character.tags) {
          const name = typeof t === 'string' ? t.toLowerCase() : String((t as any)?.name || '').toLowerCase();
          if (name) this.likedTags[name] = (this.likedTags[name] || 0) + 3;
        }
      }
    } else {
      this.likedCharacterIds.delete(id);
    }

    try {
      await AsyncStorage.setItem(
        STORAGE_KEY_LIKED_COMPANIONS,
        JSON.stringify(Array.from(this.likedCharacterIds))
      );
      await AsyncStorage.setItem(STORAGE_KEY_LIKED_TAGS, JSON.stringify(this.likedTags));
    } catch {}

    // Invalidate cached profile so it recalculates instantly
    this.cachedProfile = null;
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
    this.seenIds.add(charId);

    if (character?.name) {
      const cleanName = character.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (cleanName) {
        this.seenNames.add(cleanName);
      }
    }

    if (action === 'match' && character) {
      await this.recordUserLike(character, true);
    }

    // Persist seen IDs periodically
    try {
      const arr = Array.from(this.seenIds);
      const trimmed = arr.slice(-2000);
      await AsyncStorage.setItem(STORAGE_KEY_SEEN, JSON.stringify(trimmed));
    } catch {}
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

    // 2. Tag Preference Alignment (up to 40 pts)
    const tagsList = Array.isArray(candidate.tags)
      ? (candidate.tags as any[]).map(t => (typeof t === 'string' ? t.toLowerCase() : String(t?.name || t?.slug || '').toLowerCase()))
      : [];

    let matchedLikedTagCount = 0;
    const referenceTags = taste?.topTags || this.likedTags;
    for (const tag of tagsList) {
      if (referenceTags[tag]) {
        matchedLikedTagCount += referenceTags[tag];
      }
    }
    if (matchedLikedTagCount > 0) {
      const boost = Math.min(40, matchedLikedTagCount * 6);
      score += boost;
      reasons.push('Matches your anime taste');
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

    // Filter strictly for high-affinity matches that strictly obey gender preference
    const scored = batch
      .filter(c => {
        if (taste.dominantGender === 'female' && isCharacterExplicitlyMale(c)) return false;
        if (taste.dominantGender === 'male' && isCharacterExplicitlyFemale(c)) return false;
        return c.affinityScore >= 60;
      })
      .slice(0, limit);

    return scored;
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
        let res = await communityCatalogService.fetchDatacatCharacters({
          page: this.currentPage,
          limit: 30,
          sort: 'trending',
          tagIds: remoteTagIds,
        });

        // If Datacat is unreachable or returned empty, seamlessly fallback to live Chub.ai catalog
        if (!res.characters || res.characters.length === 0) {
          res = await communityCatalogService.fetchChubCharacters({
            page: this.currentPage,
            limit: 30,
            sort: 'trending',
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
            const charNameWords = charNameLower.split(/[\s|/_-]+/).filter(Boolean);

            const hasExplicitMaleTag = charTags.some(t => MALE_TAGS.has(t) || t.startsWith('male ') || t.endsWith(' male'));
            const hasExplicitFemaleTag = charTags.some(t => FEMALE_TAGS.has(t) || t.startsWith('female ') || t.endsWith(' female'));

            const hasMaleNameToken = charNameWords.some(w => MALE_NAME_TOKENS.includes(w));
            const hasFemaleNameToken = charNameWords.some(w => FEMALE_NAME_TOKENS.includes(w));

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

      // Sort batch by affinity score descending
      results.sort((a, b) => b.affinityScore - a.affinityScore);
      return results;
    } finally {
      this.isFetching = false;
    }
  }
}

export const matchAlgorithmService = new MatchAlgorithmService();
