import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTimeDecay,
  buildTasteProfileFromInputs,
  createEmptyTasteState,
  extractSearchTags,
  HALF_LIFE_MS,
  resolveRemoteTagIds,
  scoreCandidateWithTaste,
} from '../src/services/tasteEngineLogic.ts';

const SAMPLE_CATEGORIES = [
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
  { label: '#game', value: 'game', tagId: '72' },
  { label: '#villain', value: 'villain', tagId: '73' },
  { label: '#royalty', value: 'royalty', tagId: '25' },
  { label: '#comedy', value: 'comedy', tagId: '9' },
];

test('applyTimeDecay halves weight after one 14-day half-life', () => {
  const now = 1_700_000_000_000;
  const decayed = applyTimeDecay({ score: 10, updatedAt: now - HALF_LIFE_MS }, now);
  assert.ok(Math.abs(decayed - 5) < 0.001, `expected ~5, got ${decayed}`);
});

test('neutral-gender RPG cards do not skew toward femaleInteractions', () => {
  const state = createEmptyTasteState();
  const profile = buildTasteProfileFromInputs({
    state,
    activeChats: [
      {
        id: 'world-1',
        name: 'Eldoria Dungeon Master',
        tags: ['fantasy', 'rpg'],
        description: 'An epic tabletop dungeon realm full of quests.',
      },
      {
        id: 'world-2',
        name: 'Starship Navigator',
        tags: ['sci-fi', 'adventure'],
        description: 'Explore uncharted galaxies together.',
      },
    ],
    conversations: [],
    likedIdsCount: 0,
    followedCreators: [],
  });

  assert.equal(profile.femaleInteractions, 0);
  assert.equal(profile.maleInteractions, 0);
  assert.equal(profile.dominantGender, 'none');
  assert.equal(profile.effectiveGender, 'none');
  assert.ok(profile.topTags.fantasy >= 2);
});

test('genderFocus overrides inferred gender in effectiveGender and scoring', () => {
  const baseState = createEmptyTasteState();
  const chats = [
    { id: 'f1', name: 'Girlfriend Aria', tags: ['female', 'fluff'] },
    { id: 'f2', name: 'Maid Hana', tags: ['female', 'anime'] },
  ];

  const allProfile = buildTasteProfileFromInputs({
    state: { ...baseState, genderFocus: 'all' },
    activeChats: chats,
    conversations: [],
    likedIdsCount: 0,
    followedCreators: [],
  });
  assert.equal(allProfile.dominantGender, 'female');
  assert.equal(allProfile.effectiveGender, 'none');

  const maleCandidate = { id: 'm1', name: 'Duke Julian', tags: ['male', 'royalty'], creatorName: 'a' };
  assert.equal(
    scoreCandidateWithTaste({ candidate: maleCandidate, profile: allProfile }).blocked,
    false
  );

  const femaleProfile = buildTasteProfileFromInputs({
    state: { ...baseState, genderFocus: 'auto' },
    activeChats: chats,
    conversations: [],
    likedIdsCount: 0,
    followedCreators: [],
  });
  assert.equal(femaleProfile.effectiveGender, 'female');
  const blockedRes = scoreCandidateWithTaste({ candidate: maleCandidate, profile: femaleProfile });
  assert.equal(blockedRes.blocked, true);
  assert.equal(blockedRes.score, 0);
});

test('mutedTags hard-block matching candidates and exclude from topLearnedTags', () => {
  const state = createEmptyTasteState();
  state.mutedTags = ['villain'];
  state.tagWeights = {
    villain: { score: 10, updatedAt: Date.now() },
    fluff: { score: 5, updatedAt: Date.now() },
  };
  const profile = buildTasteProfileFromInputs({
    state,
    activeChats: [],
    conversations: [],
    likedIdsCount: 0,
    followedCreators: [],
  });

  assert.equal(profile.topTags.villain, undefined);
  assert.ok(profile.topLearnedTags.every(t => t.tag !== 'villain'));

  const res = scoreCandidateWithTaste({
    candidate: { id: 'v1', name: 'Dark Overlord', tags: ['villain', 'fluff'] },
    profile,
  });
  assert.equal(res.blocked, true);
  assert.equal(res.score, 0);
});

test('pinnedTags boost score and surface first in topLearnedTags', () => {
  const state = createEmptyTasteState();
  state.pinnedTags = ['magical'];
  state.tagWeights = {
    comedy: { score: 6, updatedAt: Date.now() },
  };
  const profile = buildTasteProfileFromInputs({
    state,
    activeChats: [],
    conversations: [],
    likedIdsCount: 0,
    followedCreators: [],
  });

  assert.equal(profile.topLearnedTags[0].tag, 'magical');
  assert.equal(profile.topLearnedTags[0].pinned, true);

  const magicScore = scoreCandidateWithTaste({
    candidate: { id: 'c1', name: 'Archmage Lyra', tags: ['magical'] },
    profile,
  });
  const plainScore = scoreCandidateWithTaste({
    candidate: { id: 'c2', name: 'Citizen Bob', tags: ['slice'] },
    profile,
  });
  assert.ok(magicScore.score > plainScore.score);
  assert.ok(magicScore.reasons.some(r => r.includes('pinned #magical')));
});

test('deep/return conversations boost tags and creator affinity', () => {
  const now = Date.now();
  const state = createEmptyTasteState();
  const profile = buildTasteProfileFromInputs({
    state,
    activeChats: [
      { id: 'c1', name: 'Rei', tags: ['anime'], creator: '@nekoauthor' },
    ],
    conversations: [
      {
        id: 'conv1',
        characterId: 'c1',
        messages: new Array(9).fill({ role: 'user', content: 'hi' }),
        createdAt: now - 2 * 3600 * 1000,
        updatedAt: now,
      },
    ],
    likedIdsCount: 0,
    followedCreators: [],
    nowMs: now,
  });

  assert.ok(profile.topTags.anime >= 4.5);
  assert.ok(profile.topCreators.some(c => c.handle === 'nekoauthor' && c.score >= 3));
});

test('bot depth preference rewards candidates matching preferred token bracket', () => {
  const state = createEmptyTasteState();
  state.tokenDepthSum = 4400; // avg 2200 => deep
  state.tokenDepthCount = 2;
  const profile = buildTasteProfileFromInputs({
    state,
    activeChats: [],
    conversations: [],
    likedIdsCount: 0,
    followedCreators: [],
  });
  assert.equal(profile.preferredDepth, 'deep');

  const deepBot = scoreCandidateWithTaste({
    candidate: { id: 'd1', name: 'Deep Lore', tags: [], totalTokens: 2100 },
    profile,
  });
  const shortBot = scoreCandidateWithTaste({
    candidate: { id: 's1', name: 'Short Bot', tags: [], totalTokens: 400 },
    profile,
  });
  assert.ok(deepBot.score > shortBot.score);
});

test('extractSearchTags filters stop words and short noise', () => {
  const tags = extractSearchTags('fantasy bot for roleplay with villain knight');
  assert.deepEqual(tags, ['fantasy', 'villain', 'knight']);
});

test('resolveRemoteTagIds maps exact catalog tags and aliases to real IDs', () => {
  const ids = resolveRemoteTagIds(['male', 'fantasy', 'romance', 'anime'], SAMPLE_CATEGORIES);
  assert.equal(ids, '4,67,18,55');
});
