import { Easing } from 'react-native';
import type { UiSkinTokens } from './types';

/**
 * 🔮 Classic (Janitor Neon) Theme Pack
 * Accent-lit card borders, soft neon glow, pill buttons, glowing RP bubbles,
 * and energetic bouncy spring animations.
 */
export const classicJanitorTheme: UiSkinTokens = {
  id: 'janitor',
  name: '🔮 Classic (Janitor)',
  badge: 'Classic',
  desc: 'Accent-lit card borders, soft neon glow, pill buttons, and bouncy RP animations',
  surfaceMode: 'glass',
  navBarStyle: 'floating_capsule',
  settingsLayout: 'bento_grid',
  switchStyle: 'neko',
  cardRadius: 20,
  cardBorderWidth: 1.5,
  cardBorderAccentMix: 0.44,
  cardGlowOpacity: 0.25,
  cardGlowRadius: 14,
  buttonRadius: 999,
  pillRadius: 999,
  inputRadius: 22,
  sheetRadius: 28,
  grabberWidth: 40,
  grabberHeight: 4,
  bubbleRadius: 20,
  bubbleTailRadius: 8,
  bubbleBorderWidth: 1.25,
  dockRadius: 999,
  dockBorderWidth: 1.5,
  pressScale: 0.955,
  animation: {
    mode: 'spring',
    enterDuration: 280,
    enterTranslateY: 14,
    enterScaleFrom: 0.93,
    springFriction: 6,
    springTension: 95,
    pressScale: 0.955,
    pressFriction: 5,
    pressTension: 200,
    pressDuration: 130,
    dockSpringFriction: 6,
    dockSpringTension: 125,
    sheetOpenDuration: 280,
    sheetCloseDuration: 200,
    easing: Easing.out(Easing.back(1.2)),
  },
};
