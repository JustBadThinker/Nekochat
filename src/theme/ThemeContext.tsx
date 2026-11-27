import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { ThemeId, ThemePalette, THEME_PALETTES, applyThemePalette } from './colors';
import {
  UiSkinId,
  UiSkinTokens,
  UI_SKINS,
  resolvePaletteWithPack,
  resolveSkinWithPack,
} from './skins';
import type { NekoThemePack } from './themePackSchema';

interface ThemeContextValue {
  themeId: ThemeId;
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
  themeId?: ThemeId | string;
  uiSkin?: UiSkinId | string;
  activeThemePack?: NekoThemePack | null;
  children: React.ReactNode;
}> = ({ themeId = 'midnight', uiSkin = 'bento', activeThemePack = null, children }) => {
  const resolvedId = (
    themeId && themeId in THEME_PALETTES ? themeId : 'midnight'
  ) as ThemeId;
  const resolvedSkin = useMemo(
    () => resolveSkinWithPack(uiSkin, activeThemePack),
    [uiSkin, activeThemePack]
  );
  const resolvedPalette = useMemo(
    () => resolvePaletteWithPack(resolvedId, activeThemePack),
    [resolvedId, activeThemePack]
  );

  useEffect(() => {
    applyThemePalette(resolvedId, activeThemePack ? resolvedPalette : null);
  }, [resolvedId, activeThemePack, resolvedPalette]);

  const value = useMemo<ThemeContextValue>(() => {
    const palette = applyThemePalette(resolvedId, activeThemePack ? resolvedPalette : null);
    return {
      themeId: resolvedId,
      palette,
      skinId: resolvedSkin.id,
      skin: resolvedSkin,
      activePack: activeThemePack || null,
    };
  }, [resolvedId, resolvedSkin, activeThemePack, resolvedPalette]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => useContext(ThemeContext);
