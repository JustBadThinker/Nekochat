import { Easing } from 'react-native';
import type { UiSkinTokens } from './types';

/**
 * ⚡ Neko OLED Theme Pack
 * High-contrast OLED surfaces, crisp 1px borders, floating capsule dock,
 * and snappy spring physics.
 */
export const nekoTheme: UiSkinTokens = {
  id: 'bento',
  name: '⚡ Neko OLED',
  badge: 'Neko',
  desc: 'Floating capsule dock, crisp 1px OLED borders, 2-column Bento grid, and snappy springs',
  surfaceMode: 'oled',
  navBarStyle: 'floating_capsule',
  settingsLayout: 'bento_grid',
  switchStyle: 'neko',
  cardRadius: 16,
  cardBorderWidth: 1,
  cardBorderAccentMix: 0,
  cardGlowOpacity: 0,
  cardGlowRadius: 0,
  buttonRadius: 12,
  pillRadius: 10,
  inputRadius: 12,
  sheetRadius: 24,
  grabberWidth: 36,
  grabberHeight: 4,
  bubbleRadius: 16,
  bubbleTailRadius: 6,
  bubbleBorderWidth: 1,
  dockRadius: 28,
  dockBorderWidth: 1,
  pressScale: 0.965,
  animation: {
    mode: 'spring',
    enterDuration: 240,
    enterTranslateY: 10,
    enterScaleFrom: 0.95,
    springFriction: 8,
    springTension: 85,
    pressScale: 0.965,
    pressFriction: 7,
    pressTension: 180,
    pressDuration: 120,
    dockSpringFriction: 8,
    dockSpringTension: 110,
    sheetOpenDuration: 260,
    sheetCloseDuration: 210,
    easing: Easing.out(Easing.cubic),
  },
};
