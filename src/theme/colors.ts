/**
 * Bento-OLED High-Contrast Design Tokens & Dynamic Theme Engine
 * Eliminates visual fatigue while maximizing battery life & 120Hz rendering performance.
 */

import { Platform } from 'react-native';

export type ThemeId =
  | 'midnight'
  | 'sakura'
  | 'slate'
  | 'cyan'
  | 'crimson'
  | 'amethyst'
  | 'emerald'
  | 'sunset';

export interface ThemePalette {
  id: ThemeId;
  name: string;
  desc: string;
  accent: string;
  accentMuted: string;
  accentRgb: string;
  bgDark: string;
  bgSurface: string;
  bgSurfaceSubtle: string;
  webFrameBg: string;
  dockBg: string;
}

export const THEME_PALETTES: Record<ThemeId, ThemePalette> = {
  midnight: {
    id: 'midnight',
    name: '⚡ Midnight Cyber',
    desc: 'True OLED Black (#0c0e14) + Acid Lime (#d4ff00)',
    accent: '#D4FF00',
    accentMuted: '#99CC00',
    accentRgb: '212, 255, 0',
    bgDark: '#0c0e14',
    bgSurface: '#12151e',
    bgSurfaceSubtle: '#161a24',
    webFrameBg: '#050608',
    dockBg: 'rgba(18, 20, 26, 0.92)',
  },
  sakura: {
    id: 'sakura',
    name: '🌸 Sakura Dusk',
    desc: 'Deep Plum (#120d14) + Pastel Rose (#fb7185)',
    accent: '#FB7185',
    accentMuted: '#F43F5E',
    accentRgb: '251, 113, 133',
    bgDark: '#120d14',
    bgSurface: '#1a121e',
    bgSurfaceSubtle: '#221728',
    webFrameBg: '#09060b',
    dockBg: 'rgba(26, 18, 30, 0.92)',
  },
  slate: {
    id: 'slate',
    name: '☕ Warm Slate',
    desc: 'Warm Dark Slate (#12151f) + Amber (#facc15)',
    accent: '#FACC15',
    accentMuted: '#EAB308',
    accentRgb: '250, 204, 21',
    bgDark: '#12151f',
    bgSurface: '#181c29',
    bgSurfaceSubtle: '#1f2435',
    webFrameBg: '#0b0d13',
    dockBg: 'rgba(24, 28, 41, 0.92)',
  },
  cyan: {
    id: 'cyan',
    name: '💠 Cyber Cyan',
    desc: 'Deep Void (#070c12) + Electric Cyan (#38bdf8)',
    accent: '#38BDF8',
    accentMuted: '#0EA5E9',
    accentRgb: '56, 189, 248',
    bgDark: '#070c12',
    bgSurface: '#0d1520',
    bgSurfaceSubtle: '#121e2d',
    webFrameBg: '#04070a',
    dockBg: 'rgba(13, 21, 32, 0.92)',
  },
  crimson: {
    id: 'crimson',
    name: '🩸 Crimson Velvet',
    desc: 'Obsidian Noir (#11090c) + Neon Crimson (#ff4d6d)',
    accent: '#FF4D6D',
    accentMuted: '#E11D48',
    accentRgb: '255, 77, 109',
    bgDark: '#11090c',
    bgSurface: '#1a0e13',
    bgSurfaceSubtle: '#24131a',
    webFrameBg: '#080406',
    dockBg: 'rgba(26, 14, 19, 0.92)',
  },
  amethyst: {
    id: 'amethyst',
    name: '🔮 Amethyst Night',
    desc: 'Deep Violet (#0e0b16) + Soft Amethyst (#c084fc)',
    accent: '#C084FC',
    accentMuted: '#A855F7',
    accentRgb: '192, 132, 252',
    bgDark: '#0e0b16',
    bgSurface: '#161122',
    bgSurfaceSubtle: '#1e172f',
    webFrameBg: '#07050b',
    dockBg: 'rgba(22, 17, 34, 0.92)',
  },
  emerald: {
    id: 'emerald',
    name: '🌿 Matcha Forest',
    desc: 'Deep Pine (#08110d) + Mint Emerald (#34d399)',
    accent: '#34D399',
    accentMuted: '#10B981',
    accentRgb: '52, 211, 153',
    bgDark: '#08110d',
    bgSurface: '#0e1b15',
    bgSurfaceSubtle: '#14261e',
    webFrameBg: '#040906',
    dockBg: 'rgba(14, 27, 21, 0.92)',
  },
  sunset: {
    id: 'sunset',
    name: '🌅 Sunset Tangerine',
    desc: 'Warm Espresso (#140e0a) + Tangerine (#fb923c)',
    accent: '#FB923C',
    accentMuted: '#F97316',
    accentRgb: '251, 146, 60',
    bgDark: '#140e0a',
    bgSurface: '#1e150f',
    bgSurfaceSubtle: '#291c14',
    webFrameBg: '#0a0705',
    dockBg: 'rgba(30, 21, 15, 0.92)',
  },
};

export const colors = {
  // Active theme ID
  themeId: 'midnight' as ThemeId,

  // Backgrounds
  bgDark: '#0c0e14',
  bgSurface: '#12151e',
  bgSurfaceSubtle: '#161a24',
  borderSubtle: '#22252C',

  // Accent Colors (Dynamically updated by active theme)
  lime: '#D4FF00',
  limeMuted: '#99CC00',
  accentRgb: '212, 255, 0',
  lemon: '#FACC15',
  coral: '#FB7185',
  cyan: '#38BDF8',
  slate: '#94A3B8',

  // Typography
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Syntax Roleplay Defaults
  syntax: {
    dialogue: '#FFFFFF',
    narration: '#94A3B8',
    thoughts: '#38BDF8',
    emphasis: '#D4FF00',
  },

  // Floating Dock & Blurs
  dockBg: 'rgba(18, 20, 26, 0.92)',
  dockActive: '#D4FF00',
  dockActiveText: '#000000',
};

export function getThemePalette(themeId?: string): ThemePalette {
  const key = (themeId || colors.themeId || 'midnight') as ThemeId;
  return THEME_PALETTES[key] || THEME_PALETTES.midnight;
}

/**
 * Applies the selected theme across design tokens AND (on Web) re-colors
 * compiled React Native Web atomic stylesheet classes & SVG strokes in real-time.
 */
export function applyThemePalette(
  themeId?: string,
  customPalette?: ThemePalette | null
): ThemePalette {
  const palette = customPalette || getThemePalette(themeId);
  colors.themeId = palette.id;
  colors.lime = palette.accent;
  colors.limeMuted = palette.accentMuted;
  colors.accentRgb = palette.accentRgb;
  colors.bgDark = palette.bgDark;
  colors.bgSurface = palette.bgSurface;
  colors.bgSurfaceSubtle = palette.bgSurfaceSubtle;
  colors.dockBg = palette.dockBg;
  colors.dockActive = palette.accent;
  colors.syntax.emphasis = palette.accent;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const syncWebSheet = () => {
      try {
        const overrideId = 'nekochat-theme-overrides';
        let styleEl = document.getElementById(overrideId) as HTMLStyleElement | null;
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = overrideId;
          document.head.appendChild(styleEl);
        }

        const rnwStyleEl = document.getElementById('react-native-stylesheet') as HTMLStyleElement | null;
        const dynamicRules: string[] = [];

        if (rnwStyleEl && rnwStyleEl.sheet) {
          const cssRules = Array.from(rnwStyleEl.sheet.cssRules || []);
          for (const rule of cssRules) {
            const text = rule.cssText || '';
            if (
              text.includes('212, 255, 0') ||
              text.includes('212,255,0') ||
              text.includes('204, 255, 0') ||
              text.includes('204,255,0') ||
              text.toLowerCase().includes('#d4ff00') ||
              text.toLowerCase().includes('#ccff00')
            ) {
              const replaced = text
                .replace(/212,\s*255,\s*0/g, palette.accentRgb)
                .replace(/204,\s*255,\s*0/g, palette.accentRgb)
                .replace(/#d4ff00/gi, palette.accent)
                .replace(/#ccff00/gi, palette.accent)
                .replace(/;\s*\}/g, ' !important; }')
                .replace(/([^!])\s*\}/g, '$1 !important; }');
              dynamicRules.push(replaced);
            }
          }
        }

        // Also style inline SVG strokes/fills that used #d4ff00 / #D4FF00 / #CCFF00
        dynamicRules.push(`
          :root {
            --neko-accent: ${palette.accent};
            --neko-accent-rgb: ${palette.accentRgb};
            --neko-bg: ${palette.bgDark};
          }
          body, #root {
            background-color: ${palette.webFrameBg} !important;
          }
          svg[stroke="#d4ff00"], svg[stroke="#D4FF00"], svg[stroke="#CCFF00"], svg[stroke="#ccff00"],
          svg [stroke="#d4ff00"], svg [stroke="#D4FF00"], svg [stroke="#CCFF00"], svg [stroke="#ccff00"] {
            stroke: ${palette.accent} !important;
          }
          svg[fill="#d4ff00"], svg[fill="#D4FF00"], svg[fill="#CCFF00"], svg[fill="#ccff00"],
          svg [fill="#d4ff00"], svg [fill="#D4FF00"], svg [fill="#CCFF00"], svg [fill="#ccff00"] {
            fill: ${palette.accent} !important;
          }
        `);

        styleEl.textContent = dynamicRules.join('\n');
      } catch {}
    };

    syncWebSheet();
    setTimeout(syncWebSheet, 60);
    setTimeout(syncWebSheet, 250);
  }

  return palette;
}
