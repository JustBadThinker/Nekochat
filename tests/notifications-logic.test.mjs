import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustForQuietHours,
  diffNewCreatorDrops,
  formatAlgorithmPickNotification,
  formatCreatorDropNotification,
  formatMissYouNotification,
  isCharacterNsfw,
  pickEligibleCharacter,
} from '../src/services/notificationLogic.ts';

test('1. adjustForQuietHours shifts late-night and early-morning times to 09:00', () => {
  const late = new Date(2026, 10, 24, 23, 30, 0, 0).getTime();
  const adjustedLate = new Date(adjustForQuietHours(late, true));
  assert.equal(adjustedLate.getDate(), 25);
  assert.equal(adjustedLate.getHours(), 9);

  const early = new Date(2026, 10, 24, 5, 15, 0, 0).getTime();
  const adjustedEarly = new Date(adjustForQuietHours(early, true));
  assert.equal(adjustedEarly.getDate(), 24);
  assert.equal(adjustedEarly.getHours(), 9);

  const daytime = new Date(2026, 10, 24, 14, 20, 0, 0).getTime();
  assert.equal(adjustForQuietHours(daytime, true), daytime);
  assert.equal(adjustForQuietHours(late, false), late);
});

test('2. isCharacterNsfw & pickEligibleCharacter respect Discreet Mode', () => {
  const nsfwChar = { id: '1', name: 'Spicy', contentRating: 'NSFW', tags: ['romance'] };
  const taggedNsfw = { id: '2', name: 'Tagged', contentRating: 'SFW', tags: ['NSFW'] };
  const sfwChar = { id: '3', name: 'Cozy', contentRating: 'SFW', tags: ['Fantasy'] };

  assert.equal(isCharacterNsfw(nsfwChar), true);
  assert.equal(isCharacterNsfw(taggedNsfw), true);
  assert.equal(isCharacterNsfw(sfwChar), false);

  assert.equal(pickEligibleCharacter([nsfwChar, taggedNsfw, sfwChar], true)?.id, '3');
  assert.equal(pickEligibleCharacter([nsfwChar], true), null);
  assert.equal(pickEligibleCharacter([nsfwChar, sfwChar], false)?.id, '1');
});

test('3. Notification copy helpers mask details in Discreet Mode', () => {
  const missAnon = formatMissYouNotification('Aria', true);
  assert.ok(!missAnon.title.includes('Aria'));
  assert.ok(!missAnon.body.includes('Aria'));

  const missNamed = formatMissYouNotification('Aria', false);
  assert.ok(missNamed.title.includes('Aria'));

  const pickAnon = formatAlgorithmPickNotification('Kuro', true);
  assert.ok(!pickAnon.title.includes('Kuro'));

  const dropNamed = formatCreatorDropNotification('@CreatorX', 'Nova', false);
  assert.ok(dropNamed.title.includes('@CreatorX'));
  assert.ok(dropNamed.body.includes('Nova'));
});

test('4. diffNewCreatorDrops seeds baseline silently first, then emits only new cards', () => {
  const firstFetch = [
    { id: 'c1', name: 'Card One' },
    { id: 'c2', name: 'Card Two' },
  ];
  const seeded = diffNewCreatorDrops('@AuthorA', firstFetch, {}, 1000);
  assert.equal(seeded.wasSeeded, true);
  assert.equal(seeded.drops.length, 0);
  assert.deepEqual(seeded.nextSeenMap.AuthorA, ['c1', 'c2']);

  const secondFetch = [
    { id: 'c3', name: 'Brand New Card', isNsfw: false },
    { id: 'c2', name: 'Card Two' },
    { id: 'c1', name: 'Card One' },
  ];
  const diff = diffNewCreatorDrops('@AuthorA', secondFetch, seeded.nextSeenMap, 2000);
  assert.equal(diff.wasSeeded, false);
  assert.equal(diff.drops.length, 1);
  assert.equal(diff.drops[0].characterId, 'c3');
  assert.equal(diff.drops[0].creatorHandle, 'AuthorA');
  assert.equal(diff.drops[0].read, false);
});
