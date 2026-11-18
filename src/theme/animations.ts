/**
 * Centralized Frontend Animation Registry
 *
 * Components call these helpers with `skin.animation` from `useTheme()` so every
 * theme pack (`Neko OLED`, `Classic / Janitor`, `Material You`, `HIG / iPhone`)
 * drives its own motion physics and easing curves consistently.
 */

import { Animated } from 'react-native';
import type { SkinAnimationConfig } from './themes/types';

export function runEnterAnimation(anim: Animated.Value, cfg: SkinAnimationConfig): void {
  if (cfg.mode === 'timing') {
    Animated.timing(anim, {
      toValue: 1,
      duration: cfg.enterDuration,
      easing: cfg.easing,
      useNativeDriver: true,
    }).start();
    return;
  }
  Animated.spring(anim, {
    toValue: 1,
    useNativeDriver: true,
    friction: cfg.springFriction,
    tension: cfg.springTension,
  }).start();
}

export function runPressInAnimation(anim: Animated.Value, cfg: SkinAnimationConfig): void {
  if (cfg.mode === 'timing') {
    Animated.timing(anim, {
      toValue: cfg.pressScale,
      duration: cfg.pressDuration,
      easing: cfg.easing,
      useNativeDriver: true,
    }).start();
    return;
  }
  Animated.spring(anim, {
    toValue: cfg.pressScale,
    useNativeDriver: true,
    friction: cfg.pressFriction,
    tension: cfg.pressTension,
  }).start();
}

export function runPressOutAnimation(anim: Animated.Value, cfg: SkinAnimationConfig): void {
  if (cfg.mode === 'timing') {
    Animated.timing(anim, {
      toValue: 1,
      duration: cfg.pressDuration,
      easing: cfg.easing,
      useNativeDriver: true,
    }).start();
    return;
  }
  Animated.spring(anim, {
    toValue: 1,
    useNativeDriver: true,
    friction: cfg.pressFriction,
    tension: Math.max(100, cfg.pressTension - 30),
  }).start();
}

export function runDockSlideAnimation(
  slideAnim: Animated.Value,
  toValue: number,
  cfg: SkinAnimationConfig
): void {
  if (cfg.mode === 'timing') {
    Animated.timing(slideAnim, {
      toValue,
      duration: 240,
      easing: cfg.easing,
      useNativeDriver: true,
    }).start();
    return;
  }
  Animated.spring(slideAnim, {
    toValue,
    useNativeDriver: true,
    friction: cfg.dockSpringFriction,
    tension: cfg.dockSpringTension,
  }).start();
}

export function runDockIconScale(
  scaleAnim: Animated.Value,
  isActive: boolean,
  cfg: SkinAnimationConfig
): void {
  const target = isActive ? 1.08 : 1;
  if (cfg.mode === 'timing') {
    Animated.timing(scaleAnim, {
      toValue: target,
      duration: 180,
      easing: cfg.easing,
      useNativeDriver: true,
    }).start();
    return;
  }
  Animated.spring(scaleAnim, {
    toValue: target,
    useNativeDriver: true,
    friction: cfg.pressFriction,
    tension: cfg.pressTension,
  }).start();
}

export function runToggleAnimation(
  anim: Animated.Value,
  isOpen: boolean,
  cfg: SkinAnimationConfig
): void {
  const toValue = isOpen ? 1 : 0;
  if (cfg.mode === 'timing') {
    Animated.timing(anim, {
      toValue,
      duration: isOpen ? cfg.enterDuration : Math.max(150, Math.round(cfg.enterDuration * 0.72)),
      easing: cfg.easing,
      useNativeDriver: true,
    }).start();
    return;
  }
  Animated.spring(anim, {
    toValue,
    useNativeDriver: true,
    friction: cfg.dockSpringFriction,
    tension: cfg.dockSpringTension,
  }).start();
}

export function runSheetOpenAnimation(
  translateY: Animated.Value,
  backdropOpacity: Animated.Value,
  cfg: SkinAnimationConfig
): void {
  translateY.setValue(420);
  backdropOpacity.setValue(0);
  Animated.parallel([
    Animated.timing(translateY, {
      toValue: 0,
      duration: cfg.sheetOpenDuration,
      easing: cfg.easing,
      useNativeDriver: true,
    }),
    Animated.timing(backdropOpacity, {
      toValue: 1,
      duration: cfg.sheetOpenDuration,
      easing: cfg.easing,
      useNativeDriver: true,
    }),
  ]).start();
}

export function runSheetCloseAnimation(
  translateY: Animated.Value,
  backdropOpacity: Animated.Value,
  cfg: SkinAnimationConfig,
  onDone: () => void
): void {
  Animated.parallel([
    Animated.timing(translateY, {
      toValue: 520,
      duration: cfg.sheetCloseDuration,
      easing: cfg.easing,
      useNativeDriver: true,
    }),
    Animated.timing(backdropOpacity, {
      toValue: 0,
      duration: cfg.sheetCloseDuration,
      easing: cfg.easing,
      useNativeDriver: true,
    }),
  ]).start(onDone);
}
