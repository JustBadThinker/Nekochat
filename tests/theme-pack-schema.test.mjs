import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  hexToRgbCsv,
  isValidCssColor,
  validateThemeCatalog,
  validateThemePack,
} from '../src/theme/themePackSchema.ts';

test('hexToRgbCsv converts 3-char, 6-char, and 8-char hex colors', () => {
  assert.equal(hexToRgbCsv('#f0a'), '255, 0, 170');
  assert.equal(hexToRgbCsv('#CBA6F7'), '203, 166, 247');
  assert.equal(hexToRgbCsv('#39FF1488'), '57, 255, 20');
  assert.equal(hexToRgbCsv('not-a-hex'), null);
});

test('isValidCssColor validates hex and rgb/rgba strings and rejects unsafe values', () => {
  assert.equal(isValidCssColor('#D4FF00'), true);
  assert.equal(isValidCssColor('rgba(18, 20, 26, 0.92)'), true);
  assert.equal(isValidCssColor('javascript:alert(1)'), false);
  assert.equal(isValidCssColor('red; background:url(x)'), false);
});

test('validateThemePack derives accentRgb, clamps animation bounds, and strips invalid URLs', () => {
  const pack = validateThemePack({
    schemaVersion: 1,
    id: 'test-pack',
    name: 'Test Pack',
    author: 'Tester',
    version: '1.0.0',
    description: 'Clamping & validation check',
    badge: 'Test',
    baseSkin: 'bento',
    tags: ['Neon', 'Pastel'],
    previewImage: 'javascript:alert(1)',
    palette: {
      accent: '#CBA6F7',
      bgDark: '#11111B',
      bgSurface: '#1E1E2E',
      bgSurfaceSubtle: '#313244',
      dockBg: 'rgba(24, 24, 37, 0.92)',
    },
    geometry: {
      cardRadius: 9999,
      bubbleBorderWidth: 40,
    },
    animation: {
      mode: 'spring',
      speedScale: 5,
      enterDuration: 9999,
      springFriction: 0.5,
      springTension: 1000,
      easing: [0.25, 0.1, 0.25, 1],
    },
  });

  assert.ok(pack);
  assert.equal(pack.palette.accentRgb, '203, 166, 247');
  assert.equal(pack.palette.accentMuted, '#CBA6F7');
  assert.equal(pack.previewImage, undefined);
  assert.equal(pack.geometry?.cardRadius, 999);
  assert.equal(pack.geometry?.bubbleBorderWidth, 6);
  assert.equal(pack.animation?.speedScale, 1.6);
  assert.equal(pack.animation?.enterDuration, 700);
  assert.equal(pack.animation?.springFriction, 3);
  assert.equal(pack.animation?.springTension, 320);
  assert.deepEqual(pack.animation?.easing, [0.25, 0.1, 0.25, 1]);
});

test('validateThemePack rejects malformed ids, skins, or missing required palette colors', () => {
  assert.equal(validateThemePack(null), null);
  assert.equal(
    validateThemePack({
      id: '../bad slug!',
      name: 'Bad',
      baseSkin: 'bento',
      palette: {
        accent: '#FFFFFF',
        bgDark: '#000000',
        bgSurface: '#111111',
        bgSurfaceSubtle: '#222222',
        dockBg: '#111111',
      },
    }),
    null
  );
  assert.equal(
    validateThemePack({
      id: 'missing-color',
      name: 'Broken',
      baseSkin: 'bento',
      palette: { accent: 'not-a-color' },
    }),
    null
  );
});

test('themes/index.json and every themes/packs/*.json pass strict validation', () => {
  const catalogPath = path.resolve(process.cwd(), 'themes/index.json');
  const catalogRaw = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const items = validateThemeCatalog(catalogRaw);

  assert.ok(items.length >= 6);
  for (const item of items) {
    const packPath = path.resolve(process.cwd(), `themes/packs/${item.id}.json`);
    assert.equal(fs.existsSync(packPath), true, `Missing pack file for ${item.id}`);
    const packJson = JSON.parse(fs.readFileSync(packPath, 'utf8'));
    const validated = validateThemePack(packJson);
    assert.ok(validated, `Pack ${item.id} failed validation`);
    assert.equal(validated.id, item.id);
    assert.equal(validated.baseSkin, item.baseSkin);
  }
});
