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

export function getCardSurfaceStyle(palette: ThemePalette, skin: UiSkinTokens): ViewStyle {
  const borderColor =
    skin.cardBorderAccentMix > 0
      ? `rgba(${palette.accentRgb}, ${skin.cardBorderAccentMix})`
      : skin.id === 'ios'
        ? 'rgba(255, 255, 255, 0.14)'
        : 'rgba(255, 255, 255, 0.08)';

  const backgroundColor =
    skin.surfaceMode === 'tonal'
      ? palette.bgSurfaceSubtle
      : skin.surfaceMode === 'frosted'
        ? 'rgba(28, 28, 30, 0.78)'
        : palette.bgSurface;

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
    ? `rgba(${palette.accentRgb}, ${skin.id === 'janitor' ? 0.55 : 0.25})`
    : skin.cardBorderAccentMix > 0
      ? `rgba(${palette.accentRgb}, ${Math.max(0.18, skin.cardBorderAccentMix * 0.6)})`
      : 'rgba(255, 255, 255, 0.08)';

  const backgroundOverride: ViewStyle =
    skin.id === 'material'
      ? { backgroundColor: isUser ? `rgba(${palette.accentRgb}, 0.2)` : palette.bgSurfaceSubtle }
      : skin.id === 'ios'
        ? { backgroundColor: isUser ? `rgba(${palette.accentRgb}, 0.24)` : 'rgba(44, 44, 46, 0.92)' }
        : {};

  return {
    ...cornerRadii,
    ...backgroundOverride,
    borderWidth: skin.bubbleBorderWidth,
    borderColor: skin.bubbleBorderWidth > 0 ? borderColor : 'transparent',
    ...(skin.id === 'janitor'
      ? {
          shadowColor: palette.accent,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isUser ? 0.22 : 0.12,
          shadowRadius: 10,
        }
      : {}),
  };
}
