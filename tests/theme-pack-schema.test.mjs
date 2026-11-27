import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  hexToRgbCsv,
  isValidCssColor,
  stripJsonComments,
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
  assert.equal(pack.palette?.accentRgb, '203, 166, 247');
  assert.equal(pack.palette?.accentMuted, '#CBA6F7');
  assert.equal(pack.palettes.length, 1);
  assert.equal(pack.palettes[0].id, 'test-pack');
  assert.equal(pack.previewImage, undefined);
  assert.equal(pack.geometry?.cardRadius, 999);
  assert.equal(pack.geometry?.bubbleBorderWidth, 6);
  assert.equal(pack.animation?.speedScale, 1.6);
  assert.equal(pack.animation?.enterDuration, 700);
  assert.equal(pack.animation?.springFriction, 3);
  assert.equal(pack.animation?.springTension, 320);
  assert.deepEqual(pack.animation?.easing, [0.25, 0.1, 0.25, 1]);
});

test('validateThemePack supports multi-palette Full Packs, layout overrides, and Skin-Only packs', () => {
  const fullPack = validateThemePack({
    schemaVersion: 1,
    id: 'multi-pack',
    name: 'Multi Pack',
    baseSkin: 'ios',
    defaultPaletteId: 'pal-two',
    layout: {
      navBarStyle: 'm3_nav_bar',
      settingsLayout: 'ios_inset_grouped',
      switchStyle: 'm3',
    },
    palettes: [
      {
        id: 'pal-one',
        name: 'First Color',
        accent: '#7DCFFF',
        bgDark: '#0F111A',
        bgSurface: '#1A1E30',
        bgSurfaceSubtle: '#242A42',
        dockBg: 'rgba(22, 26, 42, 0.85)',
      },
      {
        id: 'pal-two',
        name: 'Second Color',
        accent: '#F43F5E',
        bgDark: '#120D14',
        bgSurface: '#1A121E',
        bgSurfaceSubtle: '#221728',
        dockBg: 'rgba(26, 18, 30, 0.90)',
      },
    ],
  });

  assert.ok(fullPack);
  assert.equal(fullPack.palettes.length, 2);
  assert.equal(fullPack.defaultPaletteId, 'pal-two');
  assert.equal(fullPack.supportsBuiltInPalettes, true);
  assert.equal(fullPack.layout?.navBarStyle, 'm3_nav_bar');
  assert.equal(fullPack.layout?.switchStyle, 'm3');

  const skinOnly = validateThemePack({
    schemaVersion: 1,
    id: 'skin-only-boxy',
    name: 'Sharp Boxy Skin',
    baseSkin: 'bento',
    geometry: { cardRadius: 4, buttonRadius: 4 },
    animation: { speedScale: 0.7 },
  });

  assert.ok(skinOnly);
  assert.equal(skinOnly.palettes.length, 0);
  assert.equal(skinOnly.palette, undefined);
  assert.equal(skinOnly.geometry?.cardRadius, 4);
  assert.equal(skinOnly.animation?.speedScale, 0.7);
});

test('validateThemePack rejects malformed ids, skins, or invalid explicit palettes', () => {
  assert.equal(validateThemePack(null), null);
  assert.equal(
    validateThemePack({
      id: '../bad slug!',
      name: 'Bad',
      baseSkin: 'bento',
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

test('stripJsonComments preserves https URLs while stripping JSONC comments and validates STARTER_TEMPLATE.jsonc', () => {
  const sample = `{
    // comment line
    "url": "https://example.com/a//b", /* inline comment */
    "ok": true
  }`;
  const stripped = JSON.parse(stripJsonComments(sample));
  assert.equal(stripped.url, 'https://example.com/a//b');
  assert.equal(stripped.ok, true);

  const starterPath = path.resolve(process.cwd(), 'themes/STARTER_TEMPLATE.jsonc');
  const rawStarter = fs.readFileSync(starterPath, 'utf8');
  const parsedStarter = JSON.parse(stripJsonComments(rawStarter));
  const validatedStarter = validateThemePack(parsedStarter);
  assert.ok(validatedStarter, 'STARTER_TEMPLATE.jsonc should pass validateThemePack');
  assert.equal(validatedStarter.palettes.length, 2);
});

test('validateThemePack validates custom dock, cardFrameStyle, asymmetric cardCornerRadii, composerStyle & per-palette bubbles', () => {
  const hud = validateThemePack({
    schemaVersion: 1,
    id: 'custom-dock-hud',
    name: 'Custom Dock HUD',
    baseSkin: 'bento',
    layout: {
      composerStyle: 'ios_glass',
    },
    dock: {
      placement: 'docked',
      radius: 0,
      marginHorizontal: 99,
      height: 120,
      blur: true,
      borderWidth: 2,
      borderPosition: 'top_only',
      borderAccentMix: 2,
      glowOpacity: 0.4,
      indicatorStyle: 'top_line',
      labelMode: 'active_only',
      uppercaseLabels: true,
    },
    surfaces: {
      cardFrameStyle: 'hud_dual_edge',
    },
    geometry: {
      cardCornerRadii: [2, 100, -5, 14],
    },
    palettes: [
      {
        id: 'hud-cyan',
        name: 'HUD Cyan',
        accent: '#00F0FF',
        bgDark: '#040A12',
        bgSurface: '#081422',
        bgSurfaceSubtle: '#0D2036',
        dockBg: 'rgba(6, 16, 28, 0.90)',
        userBubbleBg: 'rgba(0, 240, 255, 0.14)',
        aiBubbleBg: '#081422',
      },
    ],
  });

  assert.ok(hud);
  assert.equal(hud.layout?.composerStyle, 'ios_glass');
  assert.equal(hud.dock?.placement, 'docked');
  assert.equal(hud.dock?.marginHorizontal, 48);
  assert.equal(hud.dock?.height, 78);
  assert.equal(hud.dock?.borderAccentMix, 1);
  assert.equal(hud.dock?.indicatorStyle, 'top_line');
  assert.equal(hud.dock?.labelMode, 'active_only');
  assert.equal(hud.dock?.uppercaseLabels, true);
  assert.equal(hud.surfaces?.cardFrameStyle, 'hud_dual_edge');
  assert.deepEqual(hud.geometry?.cardCornerRadii, [2, 64, 0, 14]);
  assert.equal(hud.palettes[0].userBubbleBg, 'rgba(0, 240, 255, 0.14)');
});

test('themes/index.json and every themes/packs/*.json pass strict validation', () => {
  const catalogPath = path.resolve(process.cwd(), 'themes/index.json');
  const catalogRaw = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const items = validateThemeCatalog(catalogRaw);

  assert.ok(items.length >= 7);
  for (const item of items) {
    const packPath = path.resolve(process.cwd(), `themes/packs/${item.id}.json`);
    assert.equal(fs.existsSync(packPath), true, `Missing pack file for ${item.id}`);
    const packJson = JSON.parse(fs.readFileSync(packPath, 'utf8'));
    const validated = validateThemePack(packJson);
    assert.ok(validated, `Pack ${item.id} failed validation`);
    assert.equal(validated.id, item.id);
    assert.equal(validated.baseSkin, item.baseSkin);
    if (item.id === 'catppuccin-mocha' || item.id === 'crt-phosphor') {
      assert.equal(validated.palettes.length, 2);
    }
    if (item.id === 'aegis-scifi-hud') {
      assert.equal(validated.palettes.length, 3);
      assert.equal(validated.dock?.indicatorStyle, 'top_line');
      assert.equal(validated.surfaces?.cardFrameStyle, 'hud_dual_edge');
      assert.deepEqual(validated.geometry?.cardCornerRadii, [2, 14, 2, 14]);
    }
  }
});
