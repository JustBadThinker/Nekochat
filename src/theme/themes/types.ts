import type { EasingFunction } from 'react-native';

export type UiSkinId = 'bento' | 'janitor' | 'material' | 'ios';
export type NavBarStyle = 'floating_capsule' | 'classic_bar' | 'm3_nav_bar' | 'ios_tab_bar';
export type SettingsLayoutStyle = 'bento_grid' | 'm3_list' | 'ios_inset_grouped';
export type SwitchStyle = 'neko' | 'm3' | 'ios';

export interface SkinAnimationConfig {
  mode: 'spring' | 'timing';
  enterDuration: number;
  enterTranslateY: number;
  enterScaleFrom: number;
  springFriction: number;
  springTension: number;
  pressScale: number;
  pressFriction: number;
  pressTension: number;
  pressDuration: number;
  dockSpringFriction: number;
  dockSpringTension: number;
  sheetOpenDuration: number;
  sheetCloseDuration: number;
  easing: EasingFunction;
}

export interface UiSkinTokens {
  id: UiSkinId;
  name: string;
  badge: string;
  desc: string;
  surfaceMode: 'oled' | 'glass' | 'tonal' | 'frosted';
  screenBg?: string;
  surfaceBg?: string;
  surfaceSubtleBg?: string;
  navBarStyle: NavBarStyle;
  settingsLayout: SettingsLayoutStyle;
  switchStyle: SwitchStyle;
  cardRadius: number;
  cardBorderWidth: number;
  cardBorderAccentMix: number;
  cardGlowOpacity: number;
  cardGlowRadius: number;
  buttonRadius: number;
  pillRadius: number;
  inputRadius: number;
  sheetRadius: number;
  grabberWidth: number;
  grabberHeight: number;
  bubbleRadius: number;
  bubbleTailRadius: number;
  bubbleBorderWidth: number;
  dockRadius: number;
  dockBorderWidth: number;
  pressScale: number;
  animation: SkinAnimationConfig;
}
