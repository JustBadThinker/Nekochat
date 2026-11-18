import { Easing } from 'react-native';
import type { UiSkinTokens } from './types';

/**
 * 🎨 Material You (M3) Theme Pack
 * Docked M3 bottom Navigation Bar with 64×32 active pill, 12dp tonal cards,
 * zero colored glow, 52×32 M3 switch, and Material Emphasized Decelerate curves.
 */
export const materialTheme: UiSkinTokens = {
  id: 'material',
  name: '🎨 Material You',
  badge: 'M3',
  desc: 'Docked M3 bottom bar with 64×32 active pill, 12dp tonal cards, and M3 motion curves',
  surfaceMode: 'tonal',
  navBarStyle: 'm3_nav_bar',
  settingsLayout: 'm3_list',
  switchStyle: 'm3',
  cardRadius: 12,
  cardBorderWidth: 0,
  cardBorderAccentMix: 0,
  cardGlowOpacity: 0,
  cardGlowRadius: 0,
  buttonRadius: 999,
  pillRadius: 8,
  inputRadius: 28,
  sheetRadius: 28,
  grabberWidth: 32,
  grabberHeight: 4,
  bubbleRadius: 20,
  bubbleTailRadius: 8,
  bubbleBorderWidth: 0,
  dockRadius: 0,
  dockBorderWidth: 0,
  pressScale: 0.985,
  animation: {
    mode: 'timing',
    enterDuration: 300,
    enterTranslateY: 16,
    enterScaleFrom: 0.97,
    springFriction: 10,
    springTension: 100,
    pressScale: 0.985,
    pressFriction: 10,
    pressTension: 150,
    pressDuration: 100,
    dockSpringFriction: 10,
    dockSpringTension: 120,
    sheetOpenDuration: 320,
    sheetCloseDuration: 220,
    // Material Design 3 Emphasized Decelerate approximation
    easing: Easing.bezier(0.05, 0.7, 0.1, 1.0),
  },
};
