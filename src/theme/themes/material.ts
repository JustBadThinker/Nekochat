import { Easing } from 'react-native';
import type { UiSkinTokens } from './types';

/**
 * 🎨 Material 3 Expressive (Android 16 / Pixel UI) Theme Pack
 * Dynamic Material You tonal surfaces tinted by active accent, M3 split-gap
 * sliders, checkmark morphing switches, Expressive segmented cards, and spring motion.
 */
export const materialTheme: UiSkinTokens = {
  id: 'material',
  name: '🎨 Material 3 Expressive',
  badge: 'M3E',
  desc: 'Android 16 Material 3 Expressive: dynamic tonal surfaces, split-gap sliders, checkmark switches & segmented cards',
  surfaceMode: 'tonal',
  navBarStyle: 'm3_nav_bar',
  settingsLayout: 'm3_list',
  switchStyle: 'm3',
  cardRadius: 22,
  cardBorderWidth: 0,
  cardBorderAccentMix: 0,
  cardGlowOpacity: 0,
  cardGlowRadius: 0,
  buttonRadius: 999,
  pillRadius: 999,
  inputRadius: 28,
  sheetRadius: 28,
  grabberWidth: 32,
  grabberHeight: 4,
  bubbleRadius: 22,
  bubbleTailRadius: 6,
  bubbleBorderWidth: 0,
  dockRadius: 0,
  dockBorderWidth: 0,
  pressScale: 0.965,
  animation: {
    mode: 'spring',
    enterDuration: 320,
    enterTranslateY: 16,
    enterScaleFrom: 0.97,
    springFriction: 7,
    springTension: 115,
    pressScale: 0.965,
    pressFriction: 7,
    pressTension: 180,
    pressDuration: 100,
    dockSpringFriction: 6.5,
    dockSpringTension: 140,
    sheetOpenDuration: 320,
    sheetCloseDuration: 220,
    // Material Design 3 Emphasized Decelerate approximation
    easing: Easing.bezier(0.05, 0.7, 0.1, 1.0),
  },
};
