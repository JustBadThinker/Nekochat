/**
 * NekoChat — On-Device Taste Engine Service
 * 100% local preference & tag learning brain stored exclusively in AsyncStorage.
 * Never transmits behavioral data off the device.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Character, CommunityCharacter } from '../types';
import { storageService } from './storageService';
import {
  BotDepthPreference,
  createEmptyTasteState,
  DecayingWeight,
  extractCharacterTags,
  extractSearchTags,
  FEMALE_TAGS,
  GenderFocusMode,
  InteractionSignal,
  LearnedTagSummary,
  MALE_TAGS,
  normalizeCreatorHandle,
  normalizeTag,
  SIGNAL_CREATOR_DELTA,
  SIGNAL_TAG_DELTA,
  TasteEngineState,
  updateDecayedWeight,
  applyTimeDecay,
  buildTasteProfileFromInputs,
  UserTasteProfile,
} from './tasteEngineLogic';

export type {
  BotDepthPreference,
  DecayingWeight,
  GenderFocusMode,
  InteractionSignal,
  LearnedTagSummary,
  TasteEngineState,
  UserTasteProfile,
};

const STORAGE_KEY_TASTE_STATE = '@nekochat:taste_engine_state_v1';
const STORAGE_KEY_LEGACY_TAGS = '@nekochat:match_liked_tags_v2';
const STORAGE_KEY_LIKED_COMPANIONS = '@nekochat:liked_companion_ids';

const GENDER_EXCLUDED_QUERY_TAGS = new Set([...MALE_TAGS, ...FEMALE_TAGS]);

export class TasteEngineService {
  private state: TasteEngineState = createEmptyTasteState();
  private likedCharacterIds = new Set<string>();
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private cachedProfile: UserTasteProfile | null = null;
  private listeners = new Set<() => void>();

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {}
    }
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const [savedStateRaw, legacyTagsRaw, savedLikesRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_TASTE_STATE),
          AsyncStorage.getItem(STORAGE_KEY_LEGACY_TAGS),
          AsyncStorage.getItem(STORAGE_KEY_LIKED_COMPANIONS),
        ]);

        if (savedLikesRaw) {
          const ids: string[] = JSON.parse(savedLikesRaw);
          this.likedCharacterIds = new Set(Array.isArray(ids) ? ids : []);
        }

        if (savedStateRaw) {
          const parsed = JSON.parse(savedStateRaw) as Partial<TasteEngineState>;
          const empty = createEmptyTasteState();
          this.state = {
            ...empty,
            ...parsed,
            tagWeights: parsed?.tagWeights || {},
            creatorWeights: parsed?.creatorWeights || {},
            pinnedTags: Array.isArray(parsed?.pinnedTags) ? parsed.pinnedTags : [],
            mutedTags: Array.isArray(parsed?.mutedTags) ? parsed.mutedTags : [],
            genderFocus: parsed?.genderFocus || 'auto',
            learningPaused: Boolean(parsed?.learningPaused),
            tokenDepthSum: Number(parsed?.tokenDepthSum) || 0,
            tokenDepthCount: Number(parsed?.tokenDepthCount) || 0,
            signalCount: Number(parsed?.signalCount) || 0,
          };
        } else if (legacyTagsRaw) {
          const legacyTags = JSON.parse(legacyTagsRaw) as Record<string, number>;
          const now = Date.now();
          const empty = createEmptyTasteState();
          if (legacyTags && typeof legacyTags === 'object') {
            for (const [rawTag, score] of Object.entries(legacyTags)) {
              const norm = normalizeTag(rawTag);
              if (norm && typeof score === 'number' && Number.isFinite(score) && score !== 0) {
                empty.tagWeights[norm] = {
                  score: Math.max(-8, Math.min(30, score)),
                  updatedAt: now,
                };
              }
            }
          }
          this.state = empty;
          await AsyncStorage.setItem(STORAGE_KEY_TASTE_STATE, JSON.stringify(this.state)).catch(() => {});
        } else {
          this.state = createEmptyTasteState();
        }
      } catch {
        this.state = createEmptyTasteState();
        this.likedCharacterIds = new Set();
      } finally {
        this.initialized = true;
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  public getState(): TasteEngineState {
    return this.state;
  }

  public isCharacterLiked(charId: string): boolean {
    return this.likedCharacterIds.has(charId);
  }

  private trimWeights(
    weights: Record<string, DecayingWeight>,
    maxEntries: number,
    nowMs: number
  ): Record<string, DecayingWeight> {
    const entries = Object.entries(weights);
    if (entries.length <= maxEntries) return weights;
    entries.sort(
      (a, b) => Math.abs(applyTimeDecay(b[1], nowMs)) - Math.abs(applyTimeDecay(a[1], nowMs))
    );
    const trimmed: Record<string, DecayingWeight> = {};
    for (const [k, v] of entries.slice(0, maxEntries)) {
      trimmed[k] = v;
    }
    return trimmed;
  }

  private async persistState(saveLikes: boolean = false): Promise<void> {
    try {
      const jobs: Promise<void>[] = [
        AsyncStorage.setItem(STORAGE_KEY_TASTE_STATE, JSON.stringify(this.state)),
      ];
      if (saveLikes) {
        jobs.push(
          AsyncStorage.setItem(
            STORAGE_KEY_LIKED_COMPANIONS,
            JSON.stringify(Array.from(this.likedCharacterIds))
          )
        );
      }
      await Promise.all(jobs);
    } catch {}
  }

  public async recordInteraction(
    character: CommunityCharacter | Character,
    signal: InteractionSignal
  ): Promise<void> {
    await this.init();
    const id = character.id || (character as any).characterId;
    if (!id) return;

    const now = Date.now();
    let likesChanged = false;
    if (signal === 'like') {
      if (!this.likedCharacterIds.has(id)) {
        this.likedCharacterIds.add(id);
        likesChanged = true;
      }
    } else if (signal === 'unlike') {
      if (this.likedCharacterIds.delete(id)) {
        likesChanged = true;
      }
    }

    if (this.state.learningPaused) {
      if (likesChanged) {
        await this.persistState(true);
        this.cachedProfile = null;
        this.notify();
      }
      return;
    }

    const tagDelta = SIGNAL_TAG_DELTA[signal];
    const creatorDelta = SIGNAL_CREATOR_DELTA[signal];
    const mutedSet = new Set(this.state.mutedTags.map(normalizeTag));
    let stateChanged = false;

    if (tagDelta !== 0) {
      for (const tag of extractCharacterTags(character)) {
        if (mutedSet.has(tag)) continue;
        this.state.tagWeights[tag] = updateDecayedWeight(
          this.state.tagWeights[tag],
          tagDelta,
          now
        );
        stateChanged = true;
      }
    }

    if (creatorDelta !== 0) {
      const handle = normalizeCreatorHandle(
        (character as any).creatorName || (character as any).creator
      );
      if (handle && handle !== 'community' && handle !== 'community creator') {
        this.state.creatorWeights[handle] = updateDecayedWeight(
          this.state.creatorWeights[handle],
          creatorDelta,
          now,
          -6,
          24
        );
        stateChanged = true;
      }
    }

    if (signal === 'like' || signal === 'chat') {
      const tokens = Number((character as any).totalTokens || 0);
      if (tokens > 0 && Number.isFinite(tokens)) {
        this.state.tokenDepthSum += tokens;
        this.state.tokenDepthCount += 1;
        stateChanged = true;
      }
    }

    if (signal !== 'view') {
      this.state.signalCount += 1;
      stateChanged = true;
    }

    if (stateChanged) {
      this.state.tagWeights = this.trimWeights(this.state.tagWeights, 120, now);
      this.state.creatorWeights = this.trimWeights(this.state.creatorWeights, 80, now);
    }

    if (stateChanged || likesChanged) {
      await this.persistState(likesChanged);
      this.cachedProfile = null;
      this.notify();
    }
  }

  public async recordTagInterest(tag: string, delta: number = 2): Promise<void> {
    await this.init();
    if (this.state.learningPaused) return;
    const norm = normalizeTag(tag);
    if (!norm) return;
    if (this.state.mutedTags.includes(norm)) return;

    const now = Date.now();
    this.state.tagWeights[norm] = updateDecayedWeight(this.state.tagWeights[norm], delta, now);
    this.state.signalCount += 1;
    this.state.tagWeights = this.trimWeights(this.state.tagWeights, 120, now);
    await this.persistState(false);
    this.cachedProfile = null;
    this.notify();
  }

  public async recordSearchQuery(query: string): Promise<void> {
    await this.init();
    if (this.state.learningPaused) return;
    const tags = extractSearchTags(query);
    if (tags.length === 0) return;

    const mutedSet = new Set(this.state.mutedTags.map(normalizeTag));
    const now = Date.now();
    let changed = false;
    for (const tag of tags) {
      if (mutedSet.has(tag)) continue;
      this.state.tagWeights[tag] = updateDecayedWeight(this.state.tagWeights[tag], 1.5, now);
      changed = true;
    }
    if (!changed) return;

    this.state.signalCount += 1;
    this.state.tagWeights = this.trimWeights(this.state.tagWeights, 120, now);
    await this.persistState(false);
    this.cachedProfile = null;
    this.notify();
  }

  public async buildUserTasteProfile(forceRefresh: boolean = false): Promise<UserTasteProfile> {
    await this.init();
    if (!forceRefresh && this.cachedProfile) {
      return this.cachedProfile;
    }

    const [activeChats, conversations, followedCreators, savedLikesRaw] = await Promise.all([
      storageService.getCharacters().catch(() => []),
      storageService.getConversations().catch(() => []),
      storageService.getFollowedCreators().catch(() => []),
      AsyncStorage.getItem(STORAGE_KEY_LIKED_COMPANIONS).catch(() => null),
    ]);

    if (savedLikesRaw) {
      try {
        const ids: string[] = JSON.parse(savedLikesRaw);
        if (Array.isArray(ids)) {
          this.likedCharacterIds = new Set(ids);
        }
      } catch {}
    }

    const profile = buildTasteProfileFromInputs({
      state: this.state,
      activeChats,
      conversations,
      likedIdsCount: this.likedCharacterIds.size,
      followedCreators,
    });

    this.cachedProfile = profile;
    return profile;
  }

  public async getTopQueryTags(limit: number = 3): Promise<string[]> {
    const profile = await this.buildUserTasteProfile();
    const out: string[] = [];
    const seen = new Set<string>();

    for (const entry of profile.topLearnedTags) {
      const t = normalizeTag(entry.tag);
      if (!t || seen.has(t) || GENDER_EXCLUDED_QUERY_TAGS.has(t)) continue;
      seen.add(t);
      out.push(t);
      if (out.length >= limit) break;
    }
    return out;
  }

  public async pinTag(tag: string): Promise<void> {
    await this.init();
    const norm = normalizeTag(tag);
    if (!norm) return;
    this.state.mutedTags = this.state.mutedTags.filter(t => t !== norm);
    if (!this.state.pinnedTags.includes(norm)) {
      this.state.pinnedTags = [norm, ...this.state.pinnedTags].slice(0, 20);
    }
    await this.persistState(false);
    this.cachedProfile = null;
    this.notify();
  }

  public async unpinTag(tag: string): Promise<void> {
    await this.init();
    const norm = normalizeTag(tag);
    if (!norm) return;
    this.state.pinnedTags = this.state.pinnedTags.filter(t => t !== norm);
    await this.persistState(false);
    this.cachedProfile = null;
    this.notify();
  }

  public async muteTag(tag: string): Promise<void> {
    await this.init();
    const norm = normalizeTag(tag);
    if (!norm) return;
    this.state.pinnedTags = this.state.pinnedTags.filter(t => t !== norm);
    delete this.state.tagWeights[norm];
    if (!this.state.mutedTags.includes(norm)) {
      this.state.mutedTags = [norm, ...this.state.mutedTags].slice(0, 30);
    }
    await this.persistState(false);
    this.cachedProfile = null;
    this.notify();
  }

  public async unmuteTag(tag: string): Promise<void> {
    await this.init();
    const norm = normalizeTag(tag);
    if (!norm) return;
    this.state.mutedTags = this.state.mutedTags.filter(t => t !== norm);
    await this.persistState(false);
    this.cachedProfile = null;
    this.notify();
  }

  public async removeLearnedTag(tag: string): Promise<void> {
    await this.init();
    const norm = normalizeTag(tag);
    if (!norm) return;
    this.state.pinnedTags = this.state.pinnedTags.filter(t => t !== norm);
    delete this.state.tagWeights[norm];
    await this.persistState(false);
    this.cachedProfile = null;
    this.notify();
  }

  public async setGenderFocus(mode: GenderFocusMode): Promise<void> {
    await this.init();
    this.state.genderFocus = mode;
    await this.persistState(false);
    this.cachedProfile = null;
    this.notify();
  }

  public async setLearningPaused(paused: boolean): Promise<void> {
    await this.init();
    this.state.learningPaused = paused;
    await this.persistState(false);
    this.cachedProfile = null;
    this.notify();
  }

  public async resetTasteProfile(): Promise<void> {
    await this.init();
    this.state = createEmptyTasteState();
    this.cachedProfile = null;
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEY_TASTE_STATE).catch(() => {}),
      AsyncStorage.removeItem(STORAGE_KEY_LEGACY_TAGS).catch(() => {}),
    ]);
    this.notify();
  }
}

export const tasteEngineService = new TasteEngineService();
