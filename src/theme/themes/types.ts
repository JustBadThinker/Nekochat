import type { EasingFunction } from 'react-native';
import type { ThemeEasingSpec } from '../themePackSchema';

export type UiSkinId = 'bento' | 'janitor' | 'material' | 'ios';
export type NavBarStyle = 'floating_capsule' | 'classic_bar' | 'm3_nav_bar' | 'ios_tab_bar';
export type SettingsLayoutStyle = 'bento_grid' | 'm3_list' | 'ios_inset_grouped';
export type SwitchStyle = 'neko' | 'm3' | 'ios';

export interface SkinAnimationConfig {
  mode: 'spring' | 'timing';
  speedScale: number;
  easingSpec: ThemeEasingSpec;
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
  sheetSnapFriction: number;
  sheetSnapTension: number;
  screenEnterFriction: number;
  screenEnterTension: number;
  screenExitDuration: number;
  switchFriction: number;
  switchTension: number;
  tabFadeDuration: number;
  composerDuration: number;
  collapsibleDuration: number;
  easing: EasingFunction;
}

export interface UiSkinSurfaceOverrides {
  keycapLipWidth?: number;
  specularRimOpacity?: number;
  userBubbleBg?: string;
  aiBubbleBg?: string;
}

export interface UiSkinTokens {
  id: UiSkinId;
  packId?: string;
  baseSkinId?: UiSkinId;
  name: string;
  badge: string;
  desc: string;
  surfaceMode: 'oled' | 'glass' | 'tonal' | 'frosted';
  screenBg?: string;
  surfaceBg?: string;
  surfaceSubtleBg?: string;
  surfaceOverrides?: UiSkinSurfaceOverrides;
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
