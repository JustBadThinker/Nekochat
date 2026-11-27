import { Platform, type ViewStyle } from 'react-native';
import { getThemePalette, type ThemeId, type ThemePalette } from '../colors';
import { resolveEasing } from '../animations';
import type { NekoThemePack } from '../themePackSchema';
import type { UiSkinId, UiSkinTokens } from './types';
import { nekoTheme } from './neko';
import { classicJanitorTheme } from './classic';
import { materialTheme } from './material';
import { higTheme } from './hig';

export * from './types';
export { nekoTheme, classicJanitorTheme, materialTheme, higTheme };

export const UI_SKINS: Record<UiSkinId, UiSkinTokens> = {
  bento: nekoTheme,
  janitor: classicJanitorTheme,
  material: materialTheme,
  ios: higTheme,
};

export function getUiSkin(skinId?: string): UiSkinTokens {
  const key = (skinId || 'bento') as UiSkinId;
  return UI_SKINS[key] || UI_SKINS.bento;
}

export function resolvePaletteWithPack(
  themeId?: string,
  pack?: NekoThemePack | null
): ThemePalette {
  if (!pack) return getThemePalette(themeId);
  return {
    id: (pack.id as ThemeId) || 'midnight',
    name: pack.name,
    desc: pack.description || `${pack.baseSkin} pack by ${pack.author}`,
    accent: pack.palette.accent,
    accentMuted: pack.palette.accentMuted,
    accentRgb: pack.palette.accentRgb,
    bgDark: pack.palette.bgDark,
    bgSurface: pack.palette.bgSurface,
    bgSurfaceSubtle: pack.palette.bgSurfaceSubtle,
    webFrameBg: pack.palette.webFrameBg || pack.palette.bgDark,
    dockBg: pack.palette.dockBg,
  };
}

export function resolveSkinWithPack(
  skinId?: string,
  pack?: NekoThemePack | null
): UiSkinTokens {
  const base = getUiSkin(pack ? pack.baseSkin : skinId);
  if (!pack) return base;

  const animOverride = pack.animation;
  const easingSpec = animOverride?.easing ?? base.animation.easingSpec;
  const mergedAnimation = {
    ...base.animation,
    ...(animOverride?.mode ? { mode: animOverride.mode } : {}),
    ...(animOverride?.speedScale !== undefined ? { speedScale: animOverride.speedScale } : {}),
    easingSpec,
    easing: resolveEasing(easingSpec),
    ...(animOverride?.enterDuration !== undefined ? { enterDuration: animOverride.enterDuration } : {}),
    ...(animOverride?.enterTranslateY !== undefined ? { enterTranslateY: animOverride.enterTranslateY } : {}),
    ...(animOverride?.enterScaleFrom !== undefined ? { enterScaleFrom: animOverride.enterScaleFrom } : {}),
    ...(animOverride?.springFriction !== undefined ? { springFriction: animOverride.springFriction } : {}),
    ...(animOverride?.springTension !== undefined ? { springTension: animOverride.springTension } : {}),
    ...(animOverride?.pressScale !== undefined ? { pressScale: animOverride.pressScale } : {}),
    ...(animOverride?.pressFriction !== undefined ? { pressFriction: animOverride.pressFriction } : {}),
    ...(animOverride?.pressTension !== undefined ? { pressTension: animOverride.pressTension } : {}),
    ...(animOverride?.pressDuration !== undefined ? { pressDuration: animOverride.pressDuration } : {}),
    ...(animOverride?.dockSpringFriction !== undefined ? { dockSpringFriction: animOverride.dockSpringFriction } : {}),
    ...(animOverride?.dockSpringTension !== undefined ? { dockSpringTension: animOverride.dockSpringTension } : {}),
    ...(animOverride?.sheetOpenDuration !== undefined ? { sheetOpenDuration: animOverride.sheetOpenDuration } : {}),
    ...(animOverride?.sheetCloseDuration !== undefined ? { sheetCloseDuration: animOverride.sheetCloseDuration } : {}),
    ...(animOverride?.sheetSnapFriction !== undefined ? { sheetSnapFriction: animOverride.sheetSnapFriction } : {}),
    ...(animOverride?.sheetSnapTension !== undefined ? { sheetSnapTension: animOverride.sheetSnapTension } : {}),
    ...(animOverride?.screenEnterFriction !== undefined ? { screenEnterFriction: animOverride.screenEnterFriction } : {}),
    ...(animOverride?.screenEnterTension !== undefined ? { screenEnterTension: animOverride.screenEnterTension } : {}),
    ...(animOverride?.screenExitDuration !== undefined ? { screenExitDuration: animOverride.screenExitDuration } : {}),
    ...(animOverride?.switchFriction !== undefined ? { switchFriction: animOverride.switchFriction } : {}),
    ...(animOverride?.switchTension !== undefined ? { switchTension: animOverride.switchTension } : {}),
    ...(animOverride?.tabFadeDuration !== undefined ? { tabFadeDuration: animOverride.tabFadeDuration } : {}),
    ...(animOverride?.composerDuration !== undefined ? { composerDuration: animOverride.composerDuration } : {}),
    ...(animOverride?.collapsibleDuration !== undefined ? { collapsibleDuration: animOverride.collapsibleDuration } : {}),
  };

  const s = pack.surfaces;
  const g = pack.geometry;

  return {
    ...base,
    packId: pack.id,
    baseSkinId: base.id,
    name: pack.name,
    badge: pack.badge || base.badge,
    desc: pack.description || base.desc,
    ...(s?.surfaceMode ? { surfaceMode: s.surfaceMode } : {}),
    screenBg: s?.screenBg ?? pack.palette.bgDark,
    surfaceBg: s?.surfaceBg ?? pack.palette.bgSurface,
    surfaceSubtleBg: s?.surfaceSubtleBg ?? pack.palette.bgSurfaceSubtle,
    ...(s && (s.keycapLipWidth !== undefined || s.specularRimOpacity !== undefined || s.userBubbleBg || s.aiBubbleBg)
      ? {
          surfaceOverrides: {
            ...(s.keycapLipWidth !== undefined ? { keycapLipWidth: s.keycapLipWidth } : {}),
            ...(s.specularRimOpacity !== undefined ? { specularRimOpacity: s.specularRimOpacity } : {}),
            ...(s.userBubbleBg ? { userBubbleBg: s.userBubbleBg } : {}),
            ...(s.aiBubbleBg ? { aiBubbleBg: s.aiBubbleBg } : {}),
          },
        }
      : {}),
    ...(s?.cardBorderAccentMix !== undefined ? { cardBorderAccentMix: s.cardBorderAccentMix } : {}),
    ...(s?.cardGlowOpacity !== undefined ? { cardGlowOpacity: s.cardGlowOpacity } : {}),
    ...(s?.cardGlowRadius !== undefined ? { cardGlowRadius: s.cardGlowRadius } : {}),
    ...(g?.cardRadius !== undefined ? { cardRadius: g.cardRadius } : {}),
    ...(g?.cardBorderWidth !== undefined ? { cardBorderWidth: g.cardBorderWidth } : {}),
    ...(g?.buttonRadius !== undefined ? { buttonRadius: g.buttonRadius } : {}),
    ...(g?.pillRadius !== undefined ? { pillRadius: g.pillRadius } : {}),
    ...(g?.inputRadius !== undefined ? { inputRadius: g.inputRadius } : {}),
    ...(g?.sheetRadius !== undefined ? { sheetRadius: g.sheetRadius } : {}),
    ...(g?.grabberWidth !== undefined ? { grabberWidth: g.grabberWidth } : {}),
    ...(g?.grabberHeight !== undefined ? { grabberHeight: g.grabberHeight } : {}),
    ...(g?.bubbleRadius !== undefined ? { bubbleRadius: g.bubbleRadius } : {}),
    ...(g?.bubbleTailRadius !== undefined ? { bubbleTailRadius: g.bubbleTailRadius } : {}),
    ...(g?.bubbleBorderWidth !== undefined ? { bubbleBorderWidth: g.bubbleBorderWidth } : {}),
    ...(g?.dockRadius !== undefined ? { dockRadius: g.dockRadius } : {}),
    ...(g?.dockBorderWidth !== undefined ? { dockBorderWidth: g.dockBorderWidth } : {}),
    ...(g?.pressScale !== undefined ? { pressScale: g.pressScale } : {}),
    animation: mergedAnimation,
  };
}

function mixM3TonalColor(
  baseR: number,
  baseG: number,
  baseB: number,
  accentRgb: string,
  weight: number
): string {
  const parts = accentRgb.split(',').map(p => Number(p.trim()));
  const ar = Number.isFinite(parts[0]) ? parts[0] : baseR;
  const ag = Number.isFinite(parts[1]) ? parts[1] : baseG;
  const ab = Number.isFinite(parts[2]) ? parts[2] : baseB;
  const r = Math.max(0, Math.min(255, Math.round(baseR * (1 - weight) + ar * weight)));
  const g = Math.max(0, Math.min(255, Math.round(baseG * (1 - weight) + ag * weight)));
  const b = Math.max(0, Math.min(255, Math.round(baseB * (1 - weight) + ab * weight)));
  return `rgb(${r}, ${g}, ${b})`;
}

export function getM3TonalContainer(
  palette: ThemePalette,
  level: 'canvas' | 'low' | 'container' | 'high' | 'highest' | 'primaryContainer'
): string {
  switch (level) {
    case 'canvas':
      return mixM3TonalColor(17, 18, 22, palette.accentRgb, 0.04);
    case 'low':
      return mixM3TonalColor(23, 25, 30, palette.accentRgb, 0.06);
    case 'container':
      return mixM3TonalColor(29, 31, 38, palette.accentRgb, 0.08);
    case 'high':
      return mixM3TonalColor(36, 39, 47, palette.accentRgb, 0.11);
    case 'highest':
      return mixM3TonalColor(45, 48, 58, palette.accentRgb, 0.14);
    case 'primaryContainer': {
      const parts = palette.accentRgb.split(',').map(p => Number(p.trim()));
      const ar = Number.isFinite(parts[0]) ? parts[0] : 120;
      const ag = Number.isFinite(parts[1]) ? parts[1] : 120;
      const ab = Number.isFinite(parts[2]) ? parts[2] : 140;
      const lum = 0.299 * ar + 0.587 * ag + 0.114 * ab;
      const weight = lum > 190 ? 0.30 : lum > 150 ? 0.38 : 0.44;
      return mixM3TonalColor(18, 20, 24, palette.accentRgb, weight);
    }
  }
}

export function getScreenBg(palette: ThemePalette, skin: UiSkinTokens): string {
  if (skin.id === 'material') return getM3TonalContainer(palette, 'canvas');
  return skin.screenBg || palette.bgDark;
}

export function getSurfaceBg(palette: ThemePalette, skin: UiSkinTokens): string {
  if (skin.id === 'material') return getM3TonalContainer(palette, 'container');
  if (skin.surfaceBg) return skin.surfaceBg;
  return skin.surfaceMode === 'tonal' ? palette.bgSurfaceSubtle : palette.bgSurface;
}

export function getSubtleSurfaceBg(palette: ThemePalette, skin: UiSkinTokens): string {
  if (skin.id === 'material') return getM3TonalContainer(palette, 'high');
  return skin.surfaceSubtleBg || palette.bgSurfaceSubtle;
}

export function getCardSurfaceStyle(palette: ThemePalette, skin: UiSkinTokens): ViewStyle {
  const borderColor =
    skin.cardBorderAccentMix > 0
      ? `rgba(${palette.accentRgb}, ${skin.cardBorderAccentMix})`
      : skin.id === 'ios'
        ? 'rgba(255, 255, 255, 0.22)'
        : 'rgba(255, 255, 255, 0.08)';

  const backgroundColor = getSurfaceBg(palette, skin);

  return {
    borderRadius: skin.cardRadius,
    borderWidth: skin.cardBorderWidth,
    borderColor: skin.cardBorderWidth > 0 ? borderColor : 'transparent',
    ...(skin.id === 'bento'
      ? {
          borderWidth: skin.cardBorderWidth || 1.25,
          borderColor: 'rgba(255, 255, 255, 0.11)',
          borderTopColor: 'rgba(255, 255, 255, 0.17)',
          borderBottomWidth: skin.surfaceOverrides?.keycapLipWidth ?? 3.5,
          borderBottomColor: 'rgba(0, 0, 0, 0.52)',
        }
      : {}),
    ...(skin.id === 'ios'
      ? {
          borderTopColor: `rgba(255, 255, 255, ${skin.surfaceOverrides?.specularRimOpacity ?? 0.46})`,
          borderBottomColor: 'rgba(0, 0, 0, 0.42)',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.48,
          shadowRadius: 20,
          elevation: 8,
        }
      : {}),
    backgroundColor,
    ...(skin.cardGlowOpacity > 0
      ? {
          shadowColor: palette.accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: skin.cardGlowOpacity,
          shadowRadius: skin.cardGlowRadius,
          elevation: 6,
        }
      : {}),
  };
}

export function getBubbleSurfaceStyle(
  palette: ThemePalette,
  skin: UiSkinTokens,
  isUser: boolean
): ViewStyle {
  const baseRadius = skin.bubbleRadius;
  const tailRadius = skin.bubbleTailRadius;

  const cornerRadii: ViewStyle = isUser
    ? {
        borderTopLeftRadius: baseRadius,
        borderTopRightRadius: baseRadius,
        borderBottomLeftRadius: baseRadius,
        borderBottomRightRadius: tailRadius,
      }
    : {
        borderTopLeftRadius: baseRadius,
        borderTopRightRadius: baseRadius,
        borderBottomRightRadius: baseRadius,
        borderBottomLeftRadius: tailRadius,
      };

  const borderColor =
    skin.id === 'ios'
      ? isUser
        ? `rgba(${palette.accentRgb}, 0.52)`
        : 'rgba(255, 255, 255, 0.22)'
      : isUser
        ? `rgba(${palette.accentRgb}, ${skin.id === 'janitor' ? 0.35 : 0.25})`
        : skin.cardBorderAccentMix > 0
          ? `rgba(${palette.accentRgb}, ${Math.max(0.18, skin.cardBorderAccentMix * 0.6)})`
          : 'rgba(255, 255, 255, 0.08)';

  const backgroundOverride: ViewStyle =
    skin.id === 'janitor'
      ? {
          backgroundColor: isUser ? 'rgba(38, 34, 52, 0.56)' : 'rgba(22, 22, 26, 0.58)',
          borderTopColor: 'rgba(255, 255, 255, 0.22)',
          ...(Platform.OS === 'web'
            ? ({ backdropFilter: 'blur(16px) saturate(150%)' } as any)
            : null),
        }
      : skin.id === 'material'
        ? {
            backgroundColor: isUser
              ? getM3TonalContainer(palette, 'primaryContainer')
              : getM3TonalContainer(palette, 'high'),
          }
        : skin.id === 'ios'
          ? {
              backgroundColor: isUser ? `rgba(${palette.accentRgb}, 0.26)` : 'rgba(20, 22, 32, 0.52)',
              borderTopColor: 'rgba(255, 255, 255, 0.48)',
              borderBottomColor: isUser ? 'rgba(0, 0, 0, 0.28)' : 'rgba(0, 0, 0, 0.36)',
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: isUser ? 0.32 : 0.34,
              shadowRadius: 12,
              elevation: 4,
            }
          : skin.id === 'bento'
            ? {
                backgroundColor: isUser
                  ? mixM3TonalColor(16, 18, 26, palette.accentRgb, 0.26)
                  : palette.bgSurface,
                borderWidth: 1.25,
                borderColor: isUser
                  ? `rgba(${palette.accentRgb}, 0.55)`
                  : 'rgba(255, 255, 255, 0.11)',
                borderBottomWidth: 3,
                borderBottomColor: isUser
                  ? `rgba(${palette.accentRgb}, 0.72)`
                  : 'rgba(0, 0, 0, 0.55)',
              }
            : {};

  const customBubbleBg = isUser
    ? skin.surfaceOverrides?.userBubbleBg
    : skin.surfaceOverrides?.aiBubbleBg;

  return {
    ...cornerRadii,
    borderWidth: skin.bubbleBorderWidth,
    borderColor: skin.bubbleBorderWidth > 0 ? borderColor : 'transparent',
    ...backgroundOverride,
    ...(customBubbleBg ? { backgroundColor: customBubbleBg } : null),
  };
}
