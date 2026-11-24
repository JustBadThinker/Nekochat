import type { ViewStyle } from 'react-native';
import type { ThemePalette } from '../colors';
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

export function getScreenBg(palette: ThemePalette, skin: UiSkinTokens): string {
  return skin.screenBg || palette.bgDark;
}

export function getSurfaceBg(palette: ThemePalette, skin: UiSkinTokens): string {
  if (skin.surfaceBg) return skin.surfaceBg;
  return skin.surfaceMode === 'tonal' ? palette.bgSurfaceSubtle : palette.bgSurface;
}

export function getSubtleSurfaceBg(palette: ThemePalette, skin: UiSkinTokens): string {
  return skin.surfaceSubtleBg || palette.bgSurfaceSubtle;
}

export function getCardSurfaceStyle(palette: ThemePalette, skin: UiSkinTokens): ViewStyle {
  const borderColor =
    skin.cardBorderAccentMix > 0
      ? `rgba(${palette.accentRgb}, ${skin.cardBorderAccentMix})`
      : skin.id === 'ios'
        ? 'rgba(255, 255, 255, 0.14)'
        : 'rgba(255, 255, 255, 0.08)';

  const backgroundColor = getSurfaceBg(palette, skin);

  return {
    borderRadius: skin.cardRadius,
    borderWidth: skin.cardBorderWidth,
    borderColor: skin.cardBorderWidth > 0 ? borderColor : 'transparent',
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

  const borderColor = isUser
    ? `rgba(${palette.accentRgb}, ${skin.id === 'janitor' ? 0.35 : 0.25})`
    : skin.cardBorderAccentMix > 0
      ? `rgba(${palette.accentRgb}, ${Math.max(0.18, skin.cardBorderAccentMix * 0.6)})`
      : 'rgba(255, 255, 255, 0.08)';

  const backgroundOverride: ViewStyle =
    skin.id === 'janitor'
      ? { backgroundColor: isUser ? '#25232E' : (skin.surfaceBg || '#1E1E1E') }
      : skin.id === 'material'
        ? { backgroundColor: isUser ? `rgba(${palette.accentRgb}, 0.2)` : getSubtleSurfaceBg(palette, skin) }
        : skin.id === 'ios'
          ? { backgroundColor: isUser ? `rgba(${palette.accentRgb}, 0.24)` : getSubtleSurfaceBg(palette, skin) }
          : {};

  return {
    ...cornerRadii,
    ...backgroundOverride,
    borderWidth: skin.bubbleBorderWidth,
    borderColor: skin.bubbleBorderWidth > 0 ? borderColor : 'transparent',
  };
}
