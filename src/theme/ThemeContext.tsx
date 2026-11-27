import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { ThemePalette, THEME_PALETTES, applyThemePalette } from './colors';
import {
  UiSkinId,
  UiSkinTokens,
  UI_SKINS,
  resolvePaletteWithPack,
  resolveSkinWithPack,
} from './skins';
import type { NekoThemePack } from './themePackSchema';

interface ThemeContextValue {
  themeId: string;
  palette: ThemePalette;
  skinId: UiSkinId;
  skin: UiSkinTokens;
  activePack: NekoThemePack | null;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeId: 'midnight',
  palette: THEME_PALETTES.midnight,
  skinId: 'bento',
  skin: UI_SKINS.bento,
  activePack: null,
});

export const ThemeProvider: React.FC<{
  themeId?: string;
  uiSkin?: UiSkinId | string;
  activeThemePack?: NekoThemePack | null;
  installedPalettes?: ThemePalette[];
  children: React.ReactNode;
}> = ({
  themeId = 'midnight',
  uiSkin = 'bento',
  activeThemePack = null,
  installedPalettes = [],
  children,
}) => {
  const resolvedPalette = useMemo(
    () => resolvePaletteWithPack(themeId, activeThemePack, installedPalettes),
    [themeId, activeThemePack, installedPalettes]
  );

  const resolvedSkin = useMemo(
    () => resolveSkinWithPack(uiSkin, activeThemePack, resolvedPalette.id),
    [uiSkin, activeThemePack, resolvedPalette.id]
  );

  useEffect(() => {
    applyThemePalette(resolvedPalette.id, resolvedPalette);
  }, [resolvedPalette]);

  const value = useMemo<ThemeContextValue>(() => {
    const palette = applyThemePalette(resolvedPalette.id, resolvedPalette);
    return {
      themeId: resolvedPalette.id,
      palette,
      skinId: resolvedSkin.id,
      skin: resolvedSkin,
      activePack: activeThemePack || null,
    };
  }, [resolvedPalette, resolvedSkin, activeThemePack]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => useContext(ThemeContext);
