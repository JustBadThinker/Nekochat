/**
 * NekoChat — Pure Local Taste Engine Logic (Zero RN dependencies)
 * Computes 100% on-device user taste profiles, 14-day exponential decay weights,
 * tag/creator affinity scoring, and Datacat tag ID resolution.
 */

export type InteractionSignal =
  | 'view'
  | 'dwell'
  | 'quick_skip'
  | 'like'
  | 'unlike'
  | 'chat'
  | 'pass';

export type GenderFocusMode = 'auto' | 'female' | 'male' | 'all';
export type BotDepthPreference = 'any' | 'short' | 'medium' | 'deep';

export interface DecayingWeight {
  score: number;
  updatedAt: number;
}

export interface TasteEngineState {
  tagWeights: Record<string, DecayingWeight>;
  creatorWeights: Record<string, DecayingWeight>;
  pinnedTags: string[];
  mutedTags: string[];
  genderFocus: GenderFocusMode;
  learningPaused: boolean;
  tokenDepthSum: number;
  tokenDepthCount: number;
  signalCount: number;
}

export interface LearnedTagSummary {
  tag: string;
  score: number;
  pinned: boolean;
}

export interface UserTasteProfile {
  totalInteractions: number;
  femaleInteractions: number;
  maleInteractions: number;
  dominantGender: 'female' | 'male' | 'none';
  genderConfidence: number; // 0% to 100%
  topTags: Record<string, number>;
  hasLearnedPattern: boolean;
  genderFocus: GenderFocusMode;
  effectiveGender: 'female' | 'male' | 'none';
  pinnedTags: string[];
  mutedTags: string[];
  topLearnedTags: LearnedTagSummary[];
  topCreators: { handle: string; score: number }[];
  preferredDepth: BotDepthPreference;
  learningPaused: boolean;
}

export const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export const SIGNAL_TAG_DELTA: Record<InteractionSignal, number> = {
  view: 0,
  dwell: 1,
  quick_skip: -0.6,
  like: 3,
  unlike: -1,
  chat: 5,
  pass: -1,
};

export const SIGNAL_CREATOR_DELTA: Record<InteractionSignal, number> = {
  view: 0,
  dwell: 0.5,
  quick_skip: -0.3,
  like: 2.5,
  unlike: -1,
  chat: 4,
  pass: -0.8,
};

export const MALE_TAGS = new Set([
  'male', 'man', 'boy', 'guy', 'men', 'yaoi', 'bl', 'boys love',
  'husbando', 'mlm', 'dilf', 'male lead', 'bara', 'fujoshi', 'submissive male',
  'dominant male', 'switch male', 'boyfriend', 'husband', 'stepbrother', 'brother',
]);

export const FEMALE_TAGS = new Set([
  'female', 'woman', 'girl', 'women', 'yuri', 'girls love',
  'waifu', 'milf', 'female lead', 'f4f', 'f/f', 'tsundere', 'yandere',
  'submissive female', 'dominant female', 'girlfriend', 'wife', 'stepsister', 'sister',
]);

export const MALE_NAME_TOKENS = [
  'mr.', 'sir', 'lord', 'king', 'prince', 'boy', 'man', 'father', 'husband', 'brother',
  'romeo', 'caius', 'lucas', 'alex', 'ethan', 'jack', 'stepbrother', 'boyfriend', 'butler',
  'duke', 'alpha', 'daddy', 'son', 'priest', 'male',
];

export const FEMALE_NAME_TOKENS = [
  'ms.', 'mrs.', 'miss', 'lady', 'queen', 'princess', 'girl', 'woman', 'mother', 'wife', 'sister',
  'waifu', 'girlfriend', 'stepsister', 'maid', 'duchess', 'daughter', 'female',
];

const SEARCH_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'you', 'your',
  'bot', 'bots', 'char', 'character', 'roleplay', 'chat', 'about', 'into',
  'girl', 'boy',
]);

const REMOTE_TAG_ALIASES: Record<string, string> = {
  fantasy: 'magical',
  magic: 'magical',
  scifi: 'nonhuman',
  'sci-fi': 'nonhuman',
  monster: 'nonhuman',
  'monster girls': 'demihuman',
  'enemies to lovers': 'enemiestolovers',
  rpg: 'game',
  romance: 'fluff',
  'slice of life': 'fluff',
  humor: 'comedy',
  funny: 'comedy',
  royal: 'royalty',
  princess: 'royalty',
  prince: 'royalty',
  dom: 'dominant',
  sub: 'submissive',
};

export function createEmptyTasteState(): TasteEngineState {
  return {
    tagWeights: {},
    creatorWeights: {},
    pinnedTags: [],
    mutedTags: [],
    genderFocus: 'auto',
    learningPaused: false,
    tokenDepthSum: 0,
    tokenDepthCount: 0,
    signalCount: 0,
  };
}

export function normalizeTag(raw: string): string {
  const cleaned = String(raw || '')
    .replace(/^#+/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (cleaned.length < 2 || cleaned === 'all') return '';
  return cleaned;
}

export function normalizeCreatorHandle(raw?: string): string {
  return String(raw || '')
    .replace(/^@+/, '')
    .trim()
    .toLowerCase();
}

export function extractCharacterTags(character: any): string[] {
  if (!character || !Array.isArray(character.tags)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of character.tags) {
    const raw = typeof t === 'string' ? t : String(t?.name || t?.slug || '');
    const norm = normalizeTag(raw);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

export function extractSearchTags(query: string): string[] {
  const tokens = String(query || '')
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .map(t => normalizeTag(t))
    .filter(t => t.length >= 3 && !SEARCH_STOP_WORDS.has(t));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tok of tokens) {
    if (!seen.has(tok)) {
      seen.add(tok);
      out.push(tok);
      if (out.length >= 4) break;
    }
  }
  return out;
}

export function classifyBotDepth(totalTokens?: number): BotDepthPreference {
  if (!totalTokens || !Number.isFinite(totalTokens) || totalTokens <= 0) return 'any';
  if (totalTokens < 700) return 'short';
  if (totalTokens <= 1600) return 'medium';
  return 'deep';
}

export function applyTimeDecay(
  entry: DecayingWeight,
  nowMs: number,
  halfLifeMs: number = HALF_LIFE_MS
): number {
  if (!entry || !Number.isFinite(entry.score)) return 0;
  const elapsed = Math.max(0, nowMs - (entry.updatedAt || nowMs));
  return entry.score * Math.pow(0.5, elapsed / halfLifeMs);
}

export function updateDecayedWeight(
  existing: DecayingWeight | undefined,
  delta: number,
  nowMs: number,
  minVal: number = -8,
  maxVal: number = 30
): DecayingWeight {
  const decayed = existing ? applyTimeDecay(existing, nowMs) : 0;
  const clamped = Math.max(minVal, Math.min(maxVal, decayed + delta));
  return {
    score: Math.round(clamped * 100) / 100,
    updatedAt: nowMs,
  };
}

export function isCharacterExplicitlyMale(c: any): boolean {
  if (!c) return false;
  if (c.gender === 'male' || c.gender === 'man') return true;

  const charTags = extractCharacterTags(c);
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

  const charTags = extractCharacterTags(c);
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

export function buildTasteProfileFromInputs(inputs: {
  state: TasteEngineState;
  activeChats: any[];
  conversations: any[];
  likedIdsCount: number;
  followedCreators: string[];
  nowMs?: number;
}): UserTasteProfile {
  const { state, activeChats, conversations, likedIdsCount, followedCreators } = inputs;
  const nowMs = inputs.nowMs ?? Date.now();
  const mutedSet = new Set((state.mutedTags || []).map(normalizeTag).filter(Boolean));
  const pinnedList = Array.from(
    new Set((state.pinnedTags || []).map(normalizeTag).filter(t => t && !mutedSet.has(t)))
  );
  const pinnedSet = new Set(pinnedList);

  const topTags: Record<string, number> = {};
  for (const [rawTag, entry] of Object.entries(state.tagWeights || {})) {
    const tag = normalizeTag(rawTag);
    if (!tag || mutedSet.has(tag)) continue;
    const val = applyTimeDecay(entry, nowMs);
    if (val >= 0.05 || val <= -0.05) {
      topTags[tag] = Math.round(val * 100) / 100;
    }
  }

  for (const pTag of pinnedList) {
    topTags[pTag] = Math.round(((topTags[pTag] || 0) + 12) * 100) / 100;
  }

  const creatorScores: Record<string, number> = {};
  for (const [rawHandle, entry] of Object.entries(state.creatorWeights || {})) {
    const handle = normalizeCreatorHandle(rawHandle);
    if (!handle) continue;
    const val = applyTimeDecay(entry, nowMs);
    if (val >= 0.05 || val <= -0.05) {
      creatorScores[handle] = Math.round(val * 100) / 100;
    }
  }

  let femaleInteractions = 0;
  let maleInteractions = 0;
  let totalInteractions = 0;

  const charMap = new Map<string, any>();
  for (const c of activeChats || []) {
    if (!c?.id) continue;
    charMap.set(c.id, c);
    totalInteractions += 2;
    const isMale = isCharacterExplicitlyMale(c);
    const isFemale = isCharacterExplicitlyFemale(c);
    if (isFemale) femaleInteractions += 2;
    else if (isMale) maleInteractions += 2;

    for (const tag of extractCharacterTags(c)) {
      if (mutedSet.has(tag)) continue;
      topTags[tag] = Math.round(((topTags[tag] || 0) + 2) * 100) / 100;
    }
  }

  for (const conv of conversations || []) {
    const msgCount = Array.isArray(conv?.messages) ? conv.messages.length : 0;
    if (msgCount <= 0) continue;
    totalInteractions += Math.min(10, msgCount);
    const char = charMap.get(conv.characterId);
    if (!char) continue;

    const isMale = isCharacterExplicitlyMale(char);
    const isFemale = isCharacterExplicitlyFemale(char);
    if (isFemale) femaleInteractions += Math.min(6, msgCount);
    else if (isMale) maleInteractions += Math.min(6, msgCount);

    const createdAt = typeof conv.createdAt === 'number' ? conv.createdAt : 0;
    const updatedAt = typeof conv.updatedAt === 'number' ? conv.updatedAt : createdAt;
    const isDeepOrReturn =
      msgCount >= 8 || (updatedAt - createdAt >= 12 * 3600 * 1000 && msgCount >= 4);

    if (isDeepOrReturn) {
      for (const tag of extractCharacterTags(char)) {
        if (mutedSet.has(tag)) continue;
        topTags[tag] = Math.round(((topTags[tag] || 0) + 2.5) * 100) / 100;
      }
      const handle = normalizeCreatorHandle(char.creator || char.creatorName);
      if (handle) {
        creatorScores[handle] = Math.round(((creatorScores[handle] || 0) + 3) * 100) / 100;
      }
    }
  }

  totalInteractions += likedIdsCount * 3 + (state.signalCount || 0);

  for (const rawFollowed of followedCreators || []) {
    const handle = normalizeCreatorHandle(rawFollowed);
    if (!handle) continue;
    creatorScores[handle] = Math.round(((creatorScores[handle] || 0) + 4) * 100) / 100;
  }

  const totalGender = femaleInteractions + maleInteractions;
  let dominantGender: 'female' | 'male' | 'none' = 'none';
  let genderConfidence = 0;

  if (totalGender > 0) {
    if (
      femaleInteractions >= maleInteractions * 1.5 ||
      (femaleInteractions > 0 && maleInteractions === 0)
    ) {
      dominantGender = 'female';
      genderConfidence = Math.min(100, Math.round((femaleInteractions / totalGender) * 100));
    } else if (
      maleInteractions >= femaleInteractions * 1.5 ||
      (maleInteractions > 0 && femaleInteractions === 0)
    ) {
      dominantGender = 'male';
      genderConfidence = Math.min(100, Math.round((maleInteractions / totalGender) * 100));
    } else {
      dominantGender = 'none';
      genderConfidence = 40;
    }
  }

  const genderFocus: GenderFocusMode = state.genderFocus || 'auto';
  const effectiveGender: 'female' | 'male' | 'none' =
    genderFocus === 'female'
      ? 'female'
      : genderFocus === 'male'
        ? 'male'
        : genderFocus === 'all'
          ? 'none'
          : genderConfidence >= 50
            ? dominantGender
            : 'none';

  const topLearnedTags: LearnedTagSummary[] = Object.entries(topTags)
    .filter(([tag, score]) => pinnedSet.has(tag) || score >= 0.6)
    .map(([tag, score]) => ({
      tag,
      score: Math.round(score * 10) / 10,
      pinned: pinnedSet.has(tag),
    }))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.score - a.score;
    })
    .slice(0, 16);

  const topCreators = Object.entries(creatorScores)
    .filter(([, score]) => score > 0.3)
    .map(([handle, score]) => ({
      handle,
      score: Math.round(score * 10) / 10,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const preferredDepth: BotDepthPreference =
    (state.tokenDepthCount || 0) >= 2
      ? classifyBotDepth(state.tokenDepthSum / state.tokenDepthCount)
      : 'any';

  const hasLearnedPattern =
    totalInteractions >= 2 &&
    (genderConfidence >= 50 || topLearnedTags.length >= 2 || genderFocus !== 'auto');

  return {
    totalInteractions,
    femaleInteractions,
    maleInteractions,
    dominantGender,
    genderConfidence,
    topTags,
    hasLearnedPattern,
    genderFocus,
    effectiveGender,
    pinnedTags: pinnedList,
    mutedTags: Array.from(mutedSet),
    topLearnedTags,
    topCreators,
    preferredDepth,
    learningPaused: Boolean(state.learningPaused),
  };
}

export function scoreCandidateWithTaste(params: {
  candidate: any;
  activePersona?: { name?: string; description?: string } | null;
  profile?: UserTasteProfile | null;
  followedCreators?: Set<string>;
  creatorWeights?: Record<string, DecayingWeight>;
  nowMs?: number;
}): { score: number; reasons: string[]; blocked: boolean } {
  const { candidate, activePersona, profile, followedCreators, creatorWeights } = params;
  const nowMs = params.nowMs ?? Date.now();
  const reasons: string[] = [];

  const candidateTags = extractCharacterTags(candidate);
  const mutedSet = new Set(profile?.mutedTags || []);
  if (candidateTags.some(t => mutedSet.has(t))) {
    return { score: 0, reasons: [], blocked: true };
  }

  const isMale = isCharacterExplicitlyMale(candidate);
  const isFemale = isCharacterExplicitlyFemale(candidate);
  const effectiveGender = profile?.effectiveGender || 'none';

  if (effectiveGender === 'female' && isMale) {
    return { score: 0, reasons: [], blocked: true };
  }
  if (effectiveGender === 'male' && isFemale) {
    return { score: 0, reasons: [], blocked: true };
  }

  let score = 0;

  // 1. Gender focus alignment (up to 32 pts)
  if (effectiveGender === 'female' && (isFemale || !isMale)) {
    score += 32;
    reasons.push('Matches female focus');
  } else if (effectiveGender === 'male' && isMale) {
    score += 32;
    reasons.push('Matches male focus');
  } else {
    score += 16;
  }

  // 2. Pinned tags (+14 per pinned match, capped at +28)
  const pinnedSet = new Set(profile?.pinnedTags || []);
  const matchedPinned = candidateTags.filter(t => pinnedSet.has(t));
  if (matchedPinned.length > 0) {
    score += Math.min(28, matchedPinned.length * 14);
    reasons.push(`Matches pinned #${matchedPinned[0]}`);
  }

  // 3. Learned tag weights (+36 max, -18 min)
  const refTags = profile?.topTags || {};
  let weightedTagSum = 0;
  let strongestTag = '';
  let strongestTagVal = 0;
  for (const tag of candidateTags) {
    const val = refTags[tag];
    if (typeof val === 'number') {
      weightedTagSum += val;
      if (!pinnedSet.has(tag) && val > strongestTagVal) {
        strongestTagVal = val;
        strongestTag = tag;
      }
    }
  }
  if (weightedTagSum > 0) {
    score += Math.min(36, weightedTagSum * 4.5);
    if (strongestTag) {
      reasons.push(`Matches #${strongestTag}`);
    } else if (matchedPinned.length === 0) {
      reasons.push('Matches your anime taste');
    }
  } else if (weightedTagSum < 0) {
    score += Math.max(-18, weightedTagSum * 3);
  }

  // 4. Creator affinity: followed (+18) or implicit learned creator weight (up to +14 / down to -8)
  const creatorKey = normalizeCreatorHandle(candidate?.creatorName);
  if (creatorKey) {
    if (followedCreators?.has(creatorKey)) {
      score += 18;
      reasons.push('Creator you follow');
    } else if (creatorWeights?.[creatorKey]) {
      const cw = applyTimeDecay(creatorWeights[creatorKey], nowMs);
      if (cw >= 0.8) {
        score += Math.min(14, Math.round(cw * 2.5));
        reasons.push('Creator you enjoy');
      } else if (cw <= -0.8) {
        score += Math.max(-8, Math.round(cw * 2));
      }
    }
  }

  // 5. Active Persona keyword alignment (up to 10 pts)
  if (activePersona?.description) {
    const personaWords = activePersona.description
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length >= 4);
    const targetText =
      `${candidate?.name || ''} ${candidate?.shortDescription || ''} ${candidate?.personality || ''}`.toLowerCase();
    let personaMatches = 0;
    for (const w of personaWords) {
      if (targetText.includes(w)) personaMatches++;
    }
    if (personaMatches > 0) {
      score += Math.min(10, personaMatches * 3.5);
      if (activePersona.name) {
        reasons.push(`Fits ${activePersona.name}`);
      }
    }
  }

  // 6. Bot depth preference alignment (+6 pts)
  if (profile?.preferredDepth && profile.preferredDepth !== 'any') {
    const candidateDepth = classifyBotDepth(Number(candidate?.totalTokens || 0));
    if (candidateDepth === profile.preferredDepth) {
      score += 6;
      reasons.push('Matches your RP depth');
    }
  }

  // 7. Popularity quality bonus (up to 8 pts)
  const chatCount = Number(candidate?.chatCount || 0);
  const favorites = Number(candidate?.favoritesCount || 0);
  if (chatCount > 1000 || favorites > 100) {
    score += Math.min(8, Math.log10(chatCount + 1) * 1.5);
  }

  const finalScore = Math.min(99, Math.max(0, Math.round(score)));
  if (reasons.length === 0 && finalScore >= 50) {
    reasons.push('Recommended for you');
  }

  return { score: finalScore, reasons, blocked: false };
}

export function resolveRemoteTagIds(
  tags: string[],
  categories: { value: string; tagId: string }[]
): string | undefined {
  const valueToId = new Map<string, string>();
  for (const cat of categories || []) {
    const val = String(cat?.value || '').trim().toLowerCase();
    const id = String(cat?.tagId || '').trim();
    if (val && id) valueToId.set(val, id);
  }

  const ids: string[] = [];
  const seenIds = new Set<string>();
  for (const raw of tags || []) {
    const norm = normalizeTag(raw);
    if (!norm) continue;
    const mapped = REMOTE_TAG_ALIASES[norm] || norm;
    const id = valueToId.get(mapped) || valueToId.get(norm);
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      ids.push(id);
    }
  }
  return ids.length > 0 ? ids.join(',') : undefined;
}
