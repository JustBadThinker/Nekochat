import { Easing } from 'react-native';
import type { UiSkinTokens } from './types';

/**
 *  HIG (iPhone / UIKit) Theme Pack
 * Edge-to-edge frosted UITabBar, insetGrouped lists, borderless iMessage bubbles,
 * 51×31 UISwitch, and fluid Cupertino spring/ease curves.
 */
export const higTheme: UiSkinTokens = {
  id: 'ios',
  name: ' HIG (iPhone)',
  badge: 'HIG',
  desc: 'Edge-to-edge frosted UITabBar, insetGrouped lists, and fluid iOS Cupertino motion',
  surfaceMode: 'frosted',
  navBarStyle: 'ios_tab_bar',
  settingsLayout: 'ios_inset_grouped',
  switchStyle: 'ios',
  cardRadius: 12,
  cardBorderWidth: 0.5,
  cardBorderAccentMix: 0,
  cardGlowOpacity: 0,
  cardGlowRadius: 0,
  buttonRadius: 10,
  pillRadius: 999,
  inputRadius: 18,
  sheetRadius: 16,
  grabberWidth: 36,
  grabberHeight: 5,
  bubbleRadius: 18,
  bubbleTailRadius: 4,
  bubbleBorderWidth: 0,
  dockRadius: 0,
  dockBorderWidth: 0.5,
  pressScale: 0.975,
  animation: {
    mode: 'spring',
    enterDuration: 280,
    enterTranslateY: 8,
    enterScaleFrom: 0.98,
    springFriction: 9,
    springTension: 105,
    pressScale: 0.975,
    pressFriction: 9,
    pressTension: 140,
    pressDuration: 110,
    dockSpringFriction: 9,
    dockSpringTension: 115,
    sheetOpenDuration: 300,
    sheetCloseDuration: 230,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
  },
};
