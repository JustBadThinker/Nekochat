/**
 * NekoChat — Match Recommendation Algorithm Service
 * Algorithmic character discovery for Match Deck & For You feed:
 * - Persistent swiped/seen memory (IDs + normalized names prevent repeating/looping cards)
 * - Tag-aware catalog pagination (real Datacat tagIds + Chub fallback)
 * - Creator diversity spacing + 80/20 exploit/explore re-ranking
 * - Delegates all local taste/tag learning & scoring to tasteEngineService
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommunityCharacter, Character, Persona } from '../types';
import { communityCatalogService, POPULAR_COMMUNITY_CATEGORIES } from './communityCatalogService';
import { storageService } from './storageService';
import { tasteEngineService } from './tasteEngineService';
import {
  InteractionSignal,
  UserTasteProfile,
  MALE_TAGS,
  FEMALE_TAGS,
  MALE_NAME_TOKENS,
  FEMALE_NAME_TOKENS,
  isCharacterExplicitlyMale,
  isCharacterExplicitlyFemale,
  resolveRemoteTagIds,
  scoreCandidateWithTaste,
} from './tasteEngineLogic';

export type { InteractionSignal, UserTasteProfile };
export {
  MALE_TAGS,
  FEMALE_TAGS,
  MALE_NAME_TOKENS,
  FEMALE_NAME_TOKENS,
  isCharacterExplicitlyMale,
  isCharacterExplicitlyFemale,
};

const STORAGE_KEY_SEEN = '@nekochat:match_seen_ids_v2';
const STORAGE_KEY_SEEN_NAMES = '@nekochat:match_seen_names_v2';

export interface ScoredMatchCharacter extends CommunityCharacter {
  affinityScore: number;
  matchReasons: string[];
}

export class MatchAlgorithmService {
  private seenIds = new Set<string>();
  private seenNames = new Set<string>();
  private followedCreatorHandles = new Set<string>();
  private currentPage = 1;
  private isFetching = false;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private cachedProfile: UserTasteProfile | null = null;

  public async init(): Promise<void> {
    if (this.initialized) {
      await tasteEngineService.init();
      return;
    }
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const [, savedSeenRaw, savedNamesRaw] = await Promise.all([
          tasteEngineService.init(),
          AsyncStorage.getItem(STORAGE_KEY_SEEN),
          AsyncStorage.getItem(STORAGE_KEY_SEEN_NAMES),
        ]);

        if (savedSeenRaw) {
          const list: string[] = JSON.parse(savedSeenRaw);
          this.seenIds = new Set(Array.isArray(list) ? list : []);
        }
        if (savedNamesRaw) {
          const names: string[] = JSON.parse(savedNamesRaw);
          this.seenNames = new Set(Array.isArray(names) ? names : []);
        }
      } catch {
        this.seenIds = new Set();
        this.seenNames = new Set();
      } finally {
        this.initialized = true;
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  public async buildUserTasteProfile(): Promise<UserTasteProfile> {
    await this.init();
    const [profile, followed] = await Promise.all([
      tasteEngineService.buildUserTasteProfile(),
      storageService.getFollowedCreators().catch(() => [] as string[]),
    ]);
    this.followedCreatorHandles = new Set(
      followed.map(h => h.replace(/^@+/, '').toLowerCase().trim()).filter(Boolean)
    );
    this.cachedProfile = profile;
    return profile;
  }

  private addSeenEntry(charId: string, name?: string): void {
    if (charId) this.seenIds.add(charId);
    if (name) {
      const cleanName = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (cleanName) this.seenNames.add(cleanName);
    }
  }

  private async persistSeen(): Promise<void> {
    try {
      const trimmedIds = Array.from(this.seenIds).slice(-2000);
      const trimmedNames = Array.from(this.seenNames).slice(-500);
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY_SEEN, JSON.stringify(trimmedIds)),
        AsyncStorage.setItem(STORAGE_KEY_SEEN_NAMES, JSON.stringify(trimmedNames)),
      ]);
    } catch {}
  }

  public async recordInteraction(
    character: CommunityCharacter | Character,
    signal: InteractionSignal
  ): Promise<void> {
    await this.init();
    const id = character.id || (character as any).characterId;
    if (!id) return;

    const shouldSaveSeen =
      signal === 'view' || signal === 'pass' || signal === 'chat' || signal === 'quick_skip';
    if (shouldSaveSeen) {
      this.addSeenEntry(id, character.name);
      await this.persistSeen();
    }

    await tasteEngineService.recordInteraction(character, signal);
    if (signal !== 'view') {
      this.cachedProfile = null;
    }
  }

  public async recordUserLike(
    character: CommunityCharacter | Character,
    nextLiked: boolean
  ): Promise<void> {
    await this.recordInteraction(character, nextLiked ? 'like' : 'unlike');
  }

  public isCharacterLiked(charId: string): boolean {
    return tasteEngineService.isCharacterLiked(charId);
  }

  public async markSwiped(
    charId: string,
    action: 'pass' | 'match',
    character?: CommunityCharacter
  ): Promise<void> {
    await this.init();
    this.addSeenEntry(charId, character?.name);

    if (character) {
      await this.recordInteraction(character, action === 'match' ? 'like' : 'pass');
      return;
    }

    await this.persistSeen();
  }

  public async resetSeen(): Promise<void> {
    this.seenIds.clear();
    this.seenNames.clear();
    this.currentPage = 1;
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEY_SEEN).catch(() => {}),
      AsyncStorage.removeItem(STORAGE_KEY_SEEN_NAMES).catch(() => {}),
    ]);
  }

  public scoreCharacter(
    candidate: CommunityCharacter,
    activePersona?: Persona,
    profile?: UserTasteProfile
  ): { score: number; reasons: string[] } {
    const taste = profile || this.cachedProfile;
    const { score, reasons } = scoreCandidateWithTaste({
      candidate,
      activePersona,
      profile: taste,
      followedCreators: this.followedCreatorHandles,
      creatorWeights: tasteEngineService.getState().creatorWeights,
    });
    return { score, reasons };
  }

  public async getLearnedRecommendations(
    limit: number = 3,
    activePersona?: Persona
  ): Promise<ScoredMatchCharacter[]> {
    const taste = await this.buildUserTasteProfile();

    if (!taste.hasLearnedPattern) {
      return [];
    }

    const queryTags = await tasteEngineService.getTopQueryTags(2);
    const targetFilters: string[] = [];
    if (taste.effectiveGender === 'female') targetFilters.push('female');
    else if (taste.effectiveGender === 'male') targetFilters.push('male');
    if (queryTags[0]) targetFilters.push(queryTags[0]);

    const batch = await this.getNextBatch(16, activePersona, targetFilters);
    const filtered = batch.filter(c => {
      const check = scoreCandidateWithTaste({
        candidate: c,
        activePersona,
        profile: taste,
        followedCreators: this.followedCreatorHandles,
        creatorWeights: tasteEngineService.getState().creatorWeights,
      });
      return !check.blocked;
    });
    const highAffinity = filtered.filter(c => c.affinityScore >= 40);
    return (highAffinity.length > 0 ? highAffinity : filtered).slice(0, limit);
  }

  private rerankWithDiversity(candidates: ScoredMatchCharacter[]): ScoredMatchCharacter[] {
    if (candidates.length <= 2) return candidates;

    const creatorCounts = new Map<string, number>();
    const remaining = [...candidates].sort((a, b) => b.affinityScore - a.affinityScore);
    const ranked: ScoredMatchCharacter[] = [];

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

  public async getNextBatch(
    limit: number = 20,
    activePersona?: Persona,
    filterTags?: string[] | string
  ): Promise<ScoredMatchCharacter[]> {
    await this.init();
    if (this.isFetching) return [];
    this.isFetching = true;

    try {
      const profile = await this.buildUserTasteProfile();

      const normalizedFilterTags: string[] = (
        Array.isArray(filterTags)
          ? filterTags
          : filterTags
            ? [filterTags]
            : []
      )
        .map(t => t.trim().toLowerCase())
        .filter(t => t && t !== 'all');

      const topQueryTags =
        normalizedFilterTags.length === 0 ? await tasteEngineService.getTopQueryTags(3) : [];

      const results: ScoredMatchCharacter[] = [];
      const seenInBatchIds = new Set<string>();
      const seenInBatchNames = new Set<string>();
      let attempts = 0;

      while (results.length < limit && attempts < 4) {
        attempts++;
        const isLatestExplorePage = this.currentPage % 3 === 0;
        const batchSort: 'trending' | 'latest' = isLatestExplorePage ? 'latest' : 'trending';

        // Build tagIds for this request: explicit filterTags take priority, otherwise blend gender + rotating top learned tag
        let pageTags: string[] = normalizedFilterTags;
        let chubSearchTerm: string | undefined =
          normalizedFilterTags.length > 0 ? normalizedFilterTags[0] : undefined;

        if (normalizedFilterTags.length === 0) {
          const queryList: string[] = [];
          if (profile.effectiveGender === 'female') queryList.push('female');
          else if (profile.effectiveGender === 'male') queryList.push('male');

          if (!isLatestExplorePage && topQueryTags.length > 0) {
            const rotatingTag = topQueryTags[(this.currentPage - 1) % topQueryTags.length];
            queryList.push(rotatingTag);
            chubSearchTerm = rotatingTag;
          } else if (profile.effectiveGender !== 'none') {
            chubSearchTerm = profile.effectiveGender;
          }
          pageTags = queryList;
        }

        const remoteTagIds = resolveRemoteTagIds(pageTags, POPULAR_COMMUNITY_CATEGORIES);

        let res = await communityCatalogService.fetchDatacatCharacters({
          page: this.currentPage,
          limit: 30,
          sort: batchSort,
          tagIds: remoteTagIds,
        });

        if (!res.characters || res.characters.length === 0) {
          res = await communityCatalogService.fetchChubCharacters({
            page: this.currentPage,
            limit: 30,
            sort: batchSort,
            search: chubSearchTerm,
          });
        }

        this.currentPage += 1;
        const candidates = res.characters || [];
        if (candidates.length === 0) break;

        for (const c of candidates) {
          const id = c.id || c.characterId;
          const nameKey = (c.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

          if (this.seenIds.has(id) || seenInBatchIds.has(id)) continue;
          if (nameKey && (this.seenNames.has(nameKey) || seenInBatchNames.has(nameKey))) continue;

          if (normalizedFilterTags.length > 0) {
            const charTags = Array.isArray(c.tags)
              ? (c.tags as any[]).map(t =>
                  (typeof t === 'string'
                    ? t.toLowerCase().trim()
                    : String(t?.name || t?.slug || '').toLowerCase().trim())
                )
              : [];
            const charNameLower = (c.name || '').toLowerCase();
            const isMale = isCharacterExplicitlyMale(c);
            const isFemale = isCharacterExplicitlyFemale(c);

            const matches = normalizedFilterTags.some(filter => {
              if (filter === 'female') {
                if (isMale) return false;
                return (
                  isFemale ||
                  charTags.some(t => t.includes('female') || t.includes('girl') || t.includes('waifu'))
                );
              }
              if (filter === 'male') {
                if (isFemale) return false;
                return (
                  isMale ||
                  charTags.some(t => t.includes('male') || t.includes('boy') || t.includes('husbando'))
                );
              }
              return charTags.some(t => t.includes(filter)) || charNameLower.includes(filter);
            });

            if (!matches) continue;
          }

          const { score, reasons, blocked } = scoreCandidateWithTaste({
            candidate: c,
            activePersona,
            profile,
            followedCreators: this.followedCreatorHandles,
            creatorWeights: tasteEngineService.getState().creatorWeights,
          });

          if (blocked) continue;

          seenInBatchIds.add(id);
          if (nameKey) seenInBatchNames.add(nameKey);

          results.push({
            ...c,
            affinityScore: score,
            matchReasons: reasons,
          });

          if (results.length >= limit) break;
        }
      }

      return this.rerankWithDiversity(results);
    } finally {
      this.isFetching = false;
    }
  }
}

export const matchAlgorithmService = new MatchAlgorithmService();
