import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { ThemeId, ThemePalette, THEME_PALETTES, applyThemePalette } from './colors';
import { UiSkinId, UiSkinTokens, UI_SKINS, getUiSkin } from './skins';

interface ThemeContextValue {
  themeId: ThemeId;
  palette: ThemePalette;
  skinId: UiSkinId;
  skin: UiSkinTokens;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeId: 'midnight',
  palette: THEME_PALETTES.midnight,
  skinId: 'bento',
  skin: UI_SKINS.bento,
});

export const ThemeProvider: React.FC<{
  themeId?: ThemeId | string;
  uiSkin?: UiSkinId | string;
  children: React.ReactNode;
}> = ({ themeId = 'midnight', uiSkin = 'bento', children }) => {
  const resolvedId = (
    themeId && themeId in THEME_PALETTES ? themeId : 'midnight'
  ) as ThemeId;
  const resolvedSkin = getUiSkin(uiSkin);

  useEffect(() => {
    applyThemePalette(resolvedId);
  }, [resolvedId]);

  const value = useMemo<ThemeContextValue>(() => {
    const palette = applyThemePalette(resolvedId);
    return { themeId: resolvedId, palette, skinId: resolvedSkin.id, skin: resolvedSkin };
  }, [resolvedId, resolvedSkin]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => useContext(ThemeContext);

