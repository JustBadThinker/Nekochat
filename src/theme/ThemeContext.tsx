import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { ThemeId, ThemePalette, THEME_PALETTES, applyThemePalette } from './colors';

interface ThemeContextValue {
  themeId: ThemeId;
  palette: ThemePalette;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeId: 'midnight',
  palette: THEME_PALETTES.midnight,
});

export const ThemeProvider: React.FC<{
  themeId?: ThemeId | string;
  children: React.ReactNode;
}> = ({ themeId = 'midnight', children }) => {
  const resolvedId = (
    themeId && themeId in THEME_PALETTES ? themeId : 'midnight'
  ) as ThemeId;

  useEffect(() => {
    applyThemePalette(resolvedId);
  }, [resolvedId]);

  const value = useMemo<ThemeContextValue>(() => {
    const palette = applyThemePalette(resolvedId);
    return { themeId: resolvedId, palette };
  }, [resolvedId]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => useContext(ThemeContext);

