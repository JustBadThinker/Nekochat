/**
 * Pure, framework-agnostic Theme Pack Schema & Validator.
 * Zero React Native imports so Node unit tests and CI checks can validate
 * downloadable JSON/JSONC theme packs directly without Metro shims.
 */

export type ThemeEasingSpec =
  | 'cubicOut'
  | 'quadOut'
  | 'expoOut'
  | 'backOut'
  | 'iosStandard'
  | 'm3Emphasized'
  | 'linear'
  | [number, number, number, number];

export type ThemePackBaseSkin = 'bento' | 'janitor' | 'material' | 'ios';

export type ThemePackComposerStyle =
  | 'bento_macropad'
  | 'classic_pill'
  | 'material_pill'
  | 'ios_glass';

export type ThemePackCardFrameStyle =
  | 'default'
  | 'flat'
  | 'keycap'
  | 'glass_rim'
  | 'neon_frame'
  | 'accent_left'
  | 'hud_dual_edge';

export interface ThemePackDockConfig {
  placement?: 'floating' | 'docked';
  radius?: number;
  marginHorizontal?: number;
  marginBottom?: number;
  height?: number;
  blur?: boolean;
  borderWidth?: number;
  borderPosition?: 'all' | 'top_only' | 'none';
  borderAccentMix?: number;
  glowOpacity?: number;
  indicatorStyle?: 'pill' | 'underline' | 'top_line' | 'dot' | 'filled_block' | 'none';
  indicatorRadius?: number;
  labelMode?: 'always' | 'active_only' | 'hidden';
  uppercaseLabels?: boolean;
}

export interface ThemePackPalette {
  accent: string;
  accentMuted: string;
  accentRgb: string;
  bgDark: string;
  bgSurface: string;
  bgSurfaceSubtle: string;
  webFrameBg?: string;
  dockBg: string;
  userBubbleBg?: string;
  aiBubbleBg?: string;
}

export interface ThemePackNamedPalette extends ThemePackPalette {
  id: string;
  name: string;
  desc?: string;
}

export interface ThemePackLayout {
  navBarStyle?: 'floating_capsule' | 'classic_bar' | 'm3_nav_bar' | 'ios_tab_bar';
  settingsLayout?: 'bento_grid' | 'm3_list' | 'ios_inset_grouped';
  switchStyle?: 'neko' | 'm3' | 'ios';
  composerStyle?: ThemePackComposerStyle;
}

export interface ThemePackSurfaces {
  surfaceMode?: 'oled' | 'glass' | 'tonal' | 'frosted';
  cardFrameStyle?: ThemePackCardFrameStyle;
  screenBg?: string;
  surfaceBg?: string;
  surfaceSubtleBg?: string;
  cardBorderAccentMix?: number;
  cardGlowOpacity?: number;
  cardGlowRadius?: number;
  keycapLipWidth?: number;
  specularRimOpacity?: number;
  userBubbleBg?: string;
  aiBubbleBg?: string;
}

export interface ThemePackGeometry {
  cardRadius?: number;
  cardCornerRadii?: [number, number, number, number];
  cardBorderWidth?: number;
  buttonRadius?: number;
  pillRadius?: number;
  inputRadius?: number;
  sheetRadius?: number;
  grabberWidth?: number;
  grabberHeight?: number;
  bubbleRadius?: number;
  bubbleTailRadius?: number;
  bubbleBorderWidth?: number;
  dockRadius?: number;
  dockBorderWidth?: number;
  pressScale?: number;
}

export interface ThemePackAnimation {
  mode?: 'spring' | 'timing';
  speedScale?: number;
  easing?: ThemeEasingSpec;
  enterDuration?: number;
  enterTranslateY?: number;
  enterScaleFrom?: number;
  springFriction?: number;
  springTension?: number;
  pressScale?: number;
  pressFriction?: number;
  pressTension?: number;
  pressDuration?: number;
  dockSpringFriction?: number;
  dockSpringTension?: number;
  sheetOpenDuration?: number;
  sheetCloseDuration?: number;
  sheetSnapFriction?: number;
  sheetSnapTension?: number;
  screenEnterFriction?: number;
  screenEnterTension?: number;
  screenExitDuration?: number;
  switchFriction?: number;
  switchTension?: number;
  tabFadeDuration?: number;
  composerDuration?: number;
  collapsibleDuration?: number;
}

export interface NekoThemePack {
  schemaVersion: 1;
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  badge: string;
  baseSkin: ThemePackBaseSkin;
  supportsBuiltInPalettes: boolean;
  defaultPaletteId?: string;
  tags: string[];
  previewImage?: string;
  palette?: ThemePackPalette;
  palettes: ThemePackNamedPalette[];
  layout?: ThemePackLayout;
  dock?: ThemePackDockConfig;
  surfaces?: ThemePackSurfaces;
  geometry?: ThemePackGeometry;
  animation?: ThemePackAnimation;
}

export interface ThemePackManifestItem {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  badge: string;
  baseSkin: ThemePackBaseSkin;
  tags: string[];
  previewImage?: string;
  previewSwatches: string[];
  motionSummary: string;
  packUrl: string;
}

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,48}$/;
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_COLOR_RE = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/;
const RGB_CSV_RE = /^\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*$/;

const VALID_BASE_SKINS = new Set<ThemePackBaseSkin>(['bento', 'janitor', 'material', 'ios']);
const VALID_SURFACE_MODES = new Set(['oled', 'glass', 'tonal', 'frosted']);
const VALID_NAV_STYLES = new Set(['floating_capsule', 'classic_bar', 'm3_nav_bar', 'ios_tab_bar']);
const VALID_SETTINGS_LAYOUTS = new Set(['bento_grid', 'm3_list', 'ios_inset_grouped']);
const VALID_SWITCH_STYLES = new Set(['neko', 'm3', 'ios']);
const VALID_COMPOSER_STYLES = new Set<ThemePackComposerStyle>([
  'bento_macropad',
  'classic_pill',
  'material_pill',
  'ios_glass',
]);
const VALID_CARD_FRAMES = new Set<ThemePackCardFrameStyle>([
  'default',
  'flat',
  'keycap',
  'glass_rim',
  'neon_frame',
  'accent_left',
  'hud_dual_edge',
]);
const VALID_DOCK_PLACEMENTS = new Set(['floating', 'docked']);
const VALID_DOCK_BORDER_POS = new Set(['all', 'top_only', 'none']);
const VALID_DOCK_INDICATORS = new Set([
  'pill',
  'underline',
  'top_line',
  'dot',
  'filled_block',
  'none',
]);
const VALID_DOCK_LABELS = new Set(['always', 'active_only', 'hidden']);
const VALID_EASING_NAMES = new Set([
  'cubicOut',
  'quadOut',
  'expoOut',
  'backOut',
  'iosStandard',
  'm3Emphasized',
  'linear',
]);

/**
 * Strips `//` line comments and block comments from JSONC community templates
 * without corrupting URLs like `"https://..."` inside string literals.
 */
export function stripJsonComments(input: string): string {
  let out = '';
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (inLineComment) {
      if (ch === '\n' || ch === '\r') {
        inLineComment = false;
        out += ch;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    out += ch;
  }

  return out;
}

function clampNum(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
}

function cleanStr(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

export function isValidCssColor(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  return HEX_COLOR_RE.test(s) || RGB_COLOR_RE.test(s);
}

export function hexToRgbCsv(hex: string): string | null {
  const s = String(hex || '').trim();
  if (!HEX_COLOR_RE.test(s)) return null;
  let body = s.slice(1);
  if (body.length === 3) {
    body = body
      .split('')
      .map(c => c + c)
      .join('');
  }
  const r = parseInt(body.slice(0, 2), 16);
  const g = parseInt(body.slice(2, 4), 16);
  const b = parseInt(body.slice(4, 6), 16);
  if ([r, g, b].some(n => Number.isNaN(n))) return null;
  return `${r}, ${g}, ${b}`;
}

function isSafeHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  return /^https:\/\/[^\s]+$/i.test(s);
}

function normalizeRgbCsv(raw: unknown, fallbackHex: string): string | null {
  if (typeof raw === 'string') {
    const m = raw.match(RGB_CSV_RE);
    if (m) {
      const r = Math.min(255, Math.max(0, Number(m[1])));
      const g = Math.min(255, Math.max(0, Number(m[2])));
      const b = Math.min(255, Math.max(0, Number(m[3])));
      return `${r}, ${g}, ${b}`;
    }
  }
  return hexToRgbCsv(fallbackHex);
}

function validatePaletteFields(rawPal: unknown): ThemePackPalette | null {
  if (!rawPal || typeof rawPal !== 'object') return null;
  const p = rawPal as Record<string, any>;
  if (
    !isValidCssColor(p.accent) ||
    !isValidCssColor(p.bgDark) ||
    !isValidCssColor(p.bgSurface) ||
    !isValidCssColor(p.bgSurfaceSubtle) ||
    !isValidCssColor(p.dockBg)
  ) {
    return null;
  }

  const accent = p.accent.trim();
  const accentMuted = isValidCssColor(p.accentMuted) ? p.accentMuted.trim() : accent;
  const accentRgb = normalizeRgbCsv(p.accentRgb, accent);
  if (!accentRgb) return null;

  return {
    accent,
    accentMuted,
    accentRgb,
    bgDark: p.bgDark.trim(),
    bgSurface: p.bgSurface.trim(),
    bgSurfaceSubtle: p.bgSurfaceSubtle.trim(),
    dockBg: p.dockBg.trim(),
    ...(isValidCssColor(p.webFrameBg) ? { webFrameBg: p.webFrameBg.trim() } : {}),
    ...(isValidCssColor(p.userBubbleBg) ? { userBubbleBg: p.userBubbleBg.trim() } : {}),
    ...(isValidCssColor(p.aiBubbleBg) ? { aiBubbleBg: p.aiBubbleBg.trim() } : {}),
  };
}

function validateEasingSpec(raw: unknown): ThemeEasingSpec | undefined {
  if (typeof raw === 'string' && VALID_EASING_NAMES.has(raw)) {
    return raw as ThemeEasingSpec;
  }
  if (
    Array.isArray(raw) &&
    raw.length === 4 &&
    raw.every(v => typeof v === 'number' && Number.isFinite(v))
  ) {
    return [
      Math.min(1, Math.max(0, raw[0])),
      Math.min(2, Math.max(-1, raw[1])),
      Math.min(1, Math.max(0, raw[2])),
      Math.min(2, Math.max(-1, raw[3])),
    ];
  }
  return undefined;
}

function validateCornerRadii(raw: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(raw) || raw.length !== 4) return undefined;
  if (!raw.every(v => typeof v === 'number' && Number.isFinite(v))) return undefined;
  return [
    Math.min(64, Math.max(0, raw[0])),
    Math.min(64, Math.max(0, raw[1])),
    Math.min(64, Math.max(0, raw[2])),
    Math.min(64, Math.max(0, raw[3])),
  ];
}

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const clean = cleanStr(item, 24);
    if (clean && !out.includes(clean)) {
      out.push(clean);
    }
    if (out.length >= 6) break;
  }
  return out;
}

function pickDefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const res: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) res[k] = v;
  }
  return res as Partial<T>;
}

/**
 * Validates and clamps an untrusted JSON Theme Pack object.
 */
export function validateThemePack(raw: unknown): NekoThemePack | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, any>;

  const schemaVersion = obj.schemaVersion ?? 1;
  if (schemaVersion !== 1) return null;

  const id = cleanStr(obj.id, 49).toLowerCase();
  if (!SLUG_RE.test(id)) return null;

  const name = cleanStr(obj.name, 48);
  if (!name) return null;

  const baseSkin = obj.baseSkin as ThemePackBaseSkin;
  if (!VALID_BASE_SKINS.has(baseSkin)) return null;

  const description = cleanStr(obj.description, 280);

  let primaryPalette: ThemePackPalette | undefined;
  if (obj.palette !== undefined) {
    const validatedSingle = validatePaletteFields(obj.palette);
    if (!validatedSingle) return null;
    primaryPalette = validatedSingle;
  }

  const palettes: ThemePackNamedPalette[] = [];
  const seenPalIds = new Set<string>();
  if (Array.isArray(obj.palettes)) {
    for (const rawEntry of obj.palettes) {
      if (!rawEntry || typeof rawEntry !== 'object') continue;
      const e = rawEntry as Record<string, any>;
      const palId = cleanStr(e.id, 49).toLowerCase();
      const palName = cleanStr(e.name, 48);
      const palFields = validatePaletteFields(e);
      if (!SLUG_RE.test(palId) || seenPalIds.has(palId) || !palName || !palFields) {
        continue;
      }
      seenPalIds.add(palId);
      const palDesc = cleanStr(e.desc, 160);
      palettes.push({
        id: palId,
        name: palName,
        ...(palDesc ? { desc: palDesc } : {}),
        ...palFields,
      });
      if (palettes.length >= 12) break;
    }
  }

  if (primaryPalette && palettes.length === 0) {
    palettes.push({
      id,
      name,
      ...(description ? { desc: description } : {}),
      ...primaryPalette,
    });
  } else if (!primaryPalette && palettes.length > 0) {
    const first = palettes[0];
    primaryPalette = {
      accent: first.accent,
      accentMuted: first.accentMuted,
      accentRgb: first.accentRgb,
      bgDark: first.bgDark,
      bgSurface: first.bgSurface,
      bgSurfaceSubtle: first.bgSurfaceSubtle,
      dockBg: first.dockBg,
      ...(first.webFrameBg ? { webFrameBg: first.webFrameBg } : {}),
      ...(first.userBubbleBg ? { userBubbleBg: first.userBubbleBg } : {}),
      ...(first.aiBubbleBg ? { aiBubbleBg: first.aiBubbleBg } : {}),
    };
  }

  const rawDefaultPalId = cleanStr(obj.defaultPaletteId, 49).toLowerCase();
  const defaultPaletteId = SLUG_RE.test(rawDefaultPalId)
    ? rawDefaultPalId
    : palettes[0]?.id;

  const supportsBuiltInPalettes = obj.supportsBuiltInPalettes !== false;

  let layout: ThemePackLayout | undefined;
  if (obj.layout && typeof obj.layout === 'object') {
    const l = obj.layout as Record<string, any>;
    const cleanedLayout = pickDefined<ThemePackLayout>({
      navBarStyle: VALID_NAV_STYLES.has(l.navBarStyle) ? l.navBarStyle : undefined,
      settingsLayout: VALID_SETTINGS_LAYOUTS.has(l.settingsLayout) ? l.settingsLayout : undefined,
      switchStyle: VALID_SWITCH_STYLES.has(l.switchStyle) ? l.switchStyle : undefined,
      composerStyle: VALID_COMPOSER_STYLES.has(l.composerStyle) ? l.composerStyle : undefined,
    });
    if (Object.keys(cleanedLayout).length > 0) {
      layout = cleanedLayout;
    }
  }

  let dock: ThemePackDockConfig | undefined;
  if (obj.dock && typeof obj.dock === 'object') {
    const d = obj.dock as Record<string, any>;
    const cleanedDock = pickDefined<ThemePackDockConfig>({
      placement: VALID_DOCK_PLACEMENTS.has(d.placement) ? d.placement : undefined,
      radius: clampNum(d.radius, 0, 999),
      marginHorizontal: clampNum(d.marginHorizontal, 0, 48),
      marginBottom: clampNum(d.marginBottom, 0, 28),
      height: clampNum(d.height, 52, 78),
      blur: typeof d.blur === 'boolean' ? d.blur : undefined,
      borderWidth: clampNum(d.borderWidth, 0, 4),
      borderPosition: VALID_DOCK_BORDER_POS.has(d.borderPosition) ? d.borderPosition : undefined,
      borderAccentMix: clampNum(d.borderAccentMix, 0, 1),
      glowOpacity: clampNum(d.glowOpacity, 0, 1),
      indicatorStyle: VALID_DOCK_INDICATORS.has(d.indicatorStyle) ? d.indicatorStyle : undefined,
      indicatorRadius: clampNum(d.indicatorRadius, 0, 999),
      labelMode: VALID_DOCK_LABELS.has(d.labelMode) ? d.labelMode : undefined,
      uppercaseLabels: typeof d.uppercaseLabels === 'boolean' ? d.uppercaseLabels : undefined,
    });
    if (Object.keys(cleanedDock).length > 0) {
      dock = cleanedDock;
    }
  }

  let surfaces: ThemePackSurfaces | undefined;
  if (obj.surfaces && typeof obj.surfaces === 'object') {
    const s = obj.surfaces as Record<string, any>;
    const cleanedSurfaces = pickDefined<ThemePackSurfaces>({
      surfaceMode: VALID_SURFACE_MODES.has(s.surfaceMode) ? s.surfaceMode : undefined,
      cardFrameStyle: VALID_CARD_FRAMES.has(s.cardFrameStyle) ? s.cardFrameStyle : undefined,
      screenBg: isValidCssColor(s.screenBg) ? s.screenBg.trim() : undefined,
      surfaceBg: isValidCssColor(s.surfaceBg) ? s.surfaceBg.trim() : undefined,
      surfaceSubtleBg: isValidCssColor(s.surfaceSubtleBg) ? s.surfaceSubtleBg.trim() : undefined,
      cardBorderAccentMix: clampNum(s.cardBorderAccentMix, 0, 1),
      cardGlowOpacity: clampNum(s.cardGlowOpacity, 0, 1),
      cardGlowRadius: clampNum(s.cardGlowRadius, 0, 32),
      keycapLipWidth: clampNum(s.keycapLipWidth, 0, 6),
      specularRimOpacity: clampNum(s.specularRimOpacity, 0, 1),
      userBubbleBg: isValidCssColor(s.userBubbleBg) ? s.userBubbleBg.trim() : undefined,
      aiBubbleBg: isValidCssColor(s.aiBubbleBg) ? s.aiBubbleBg.trim() : undefined,
    });
    if (Object.keys(cleanedSurfaces).length > 0) {
      surfaces = cleanedSurfaces;
    }
  }

  let geometry: ThemePackGeometry | undefined;
  if (obj.geometry && typeof obj.geometry === 'object') {
    const g = obj.geometry as Record<string, any>;
    const cleanedGeo = pickDefined<ThemePackGeometry>({
      cardRadius: clampNum(g.cardRadius, 0, 999),
      cardCornerRadii: validateCornerRadii(g.cardCornerRadii),
      cardBorderWidth: clampNum(g.cardBorderWidth, 0, 6),
      buttonRadius: clampNum(g.buttonRadius, 0, 999),
      pillRadius: clampNum(g.pillRadius, 0, 999),
      inputRadius: clampNum(g.inputRadius, 0, 999),
      sheetRadius: clampNum(g.sheetRadius, 0, 999),
      grabberWidth: clampNum(g.grabberWidth, 16, 100),
      grabberHeight: clampNum(g.grabberHeight, 2, 10),
      bubbleRadius: clampNum(g.bubbleRadius, 0, 999),
      bubbleTailRadius: clampNum(g.bubbleTailRadius, 0, 999),
      bubbleBorderWidth: clampNum(g.bubbleBorderWidth, 0, 6),
      dockRadius: clampNum(g.dockRadius, 0, 999),
      dockBorderWidth: clampNum(g.dockBorderWidth, 0, 6),
      pressScale: clampNum(g.pressScale, 0.85, 1),
    });
    if (Object.keys(cleanedGeo).length > 0) {
      geometry = cleanedGeo;
    }
  }

  let animation: ThemePackAnimation | undefined;
  if (obj.animation && typeof obj.animation === 'object') {
    const a = obj.animation as Record<string, any>;
    const cleanedAnim = pickDefined<ThemePackAnimation>({
      mode: a.mode === 'spring' || a.mode === 'timing' ? a.mode : undefined,
      speedScale: clampNum(a.speedScale, 0.4, 1.6),
      easing: validateEasingSpec(a.easing),
      enterDuration: clampNum(a.enterDuration, 40, 700),
      enterTranslateY: clampNum(a.enterTranslateY, 0, 40),
      enterScaleFrom: clampNum(a.enterScaleFrom, 0.8, 1),
      springFriction: clampNum(a.springFriction, 3, 20),
      springTension: clampNum(a.springTension, 40, 320),
      pressScale: clampNum(a.pressScale, 0.85, 1),
      pressFriction: clampNum(a.pressFriction, 3, 20),
      pressTension: clampNum(a.pressTension, 40, 320),
      pressDuration: clampNum(a.pressDuration, 40, 700),
      dockSpringFriction: clampNum(a.dockSpringFriction, 3, 20),
      dockSpringTension: clampNum(a.dockSpringTension, 40, 320),
      sheetOpenDuration: clampNum(a.sheetOpenDuration, 40, 700),
      sheetCloseDuration: clampNum(a.sheetCloseDuration, 40, 700),
      sheetSnapFriction: clampNum(a.sheetSnapFriction, 3, 20),
      sheetSnapTension: clampNum(a.sheetSnapTension, 40, 320),
      screenEnterFriction: clampNum(a.screenEnterFriction, 3, 20),
      screenEnterTension: clampNum(a.screenEnterTension, 40, 320),
      screenExitDuration: clampNum(a.screenExitDuration, 40, 700),
      switchFriction: clampNum(a.switchFriction, 3, 20),
      switchTension: clampNum(a.switchTension, 40, 320),
      tabFadeDuration: clampNum(a.tabFadeDuration, 40, 700),
      composerDuration: clampNum(a.composerDuration, 40, 700),
      collapsibleDuration: clampNum(a.collapsibleDuration, 40, 700),
    });
    if (Object.keys(cleanedAnim).length > 0) {
      animation = cleanedAnim;
    }
  }

  return {
    schemaVersion: 1,
    id,
    name,
    author: cleanStr(obj.author, 40) || 'Community',
    version: cleanStr(obj.version, 20) || '1.0.0',
    description,
    badge: cleanStr(obj.badge, 12) || 'Pack',
    baseSkin,
    supportsBuiltInPalettes,
    ...(defaultPaletteId ? { defaultPaletteId } : {}),
    tags: normalizeTags(obj.tags),
    ...(isSafeHttpsUrl(obj.previewImage) ? { previewImage: obj.previewImage.trim() } : {}),
    ...(primaryPalette ? { palette: primaryPalette } : {}),
    palettes,
    ...(layout ? { layout } : {}),
    ...(dock ? { dock } : {}),
    ...(surfaces ? { surfaces } : {}),
    ...(geometry ? { geometry } : {}),
    ...(animation ? { animation } : {}),
  };
}

/**
 * Validates an array or `{ themes: [...] }` catalog manifest JSON from GitHub.
 */
export function validateThemeCatalog(raw: unknown): ThemePackManifestItem[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as any).themes)
      ? (raw as any).themes
      : [];

  const result: ThemePackManifestItem[] = [];
  const seenIds = new Set<string>();

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, any>;
    const id = cleanStr(item.id, 49).toLowerCase();
    const name = cleanStr(item.name, 48);
    const baseSkin = item.baseSkin as ThemePackBaseSkin;

    if (!SLUG_RE.test(id) || seenIds.has(id) || !name || !VALID_BASE_SKINS.has(baseSkin)) {
      continue;
    }
    if (!isSafeHttpsUrl(item.packUrl)) {
      continue;
    }

    const swatches = Array.isArray(item.previewSwatches)
      ? item.previewSwatches.filter(isValidCssColor).slice(0, 5)
      : [];

    if (swatches.length < 3) continue;

    seenIds.add(id);
    result.push({
      id,
      name,
      author: cleanStr(item.author, 40) || 'Community',
      version: cleanStr(item.version, 20) || '1.0.0',
      description: cleanStr(item.description, 240),
      badge: cleanStr(item.badge, 12) || 'Pack',
      baseSkin,
      tags: normalizeTags(item.tags),
      ...(isSafeHttpsUrl(item.previewImage) ? { previewImage: item.previewImage.trim() } : {}),
      previewSwatches: swatches,
      motionSummary: cleanStr(item.motionSummary, 64) || 'Balanced motion',
      packUrl: item.packUrl.trim(),
    });
  }

  return result;
}
