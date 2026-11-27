/**
 * Centralized Frontend Animation Registry
 *
 * Components call these helpers with `skin.animation` from `useTheme()` so every
 * built-in skin and downloaded Theme Pack drives its own motion physics,
 * speed scale, and easing curves consistently across the entire app.
 */

import { Animated, Easing, type EasingFunction } from 'react-native';
import type { SkinAnimationConfig } from './themes/types';
import type { ThemeEasingSpec } from './themePackSchema';

export function resolveEasing(spec?: ThemeEasingSpec): EasingFunction {
  if (Array.isArray(spec) && spec.length === 4) {
    return Easing.bezier(spec[0], spec[1], spec[2], spec[3]);
  }
  switch (spec) {
    case 'quadOut':
      return Easing.out(Easing.quad);
    case 'expoOut':
      return Easing.out(Easing.exp);
    case 'backOut':
      return Easing.out(Easing.back(1.2));
    case 'iosStandard':
      return Easing.bezier(0.25, 0.1, 0.25, 1.0);
    case 'm3Emphasized':
      return Easing.bezier(0.05, 0.7, 0.1, 1.0);
    case 'linear':
      return Easing.linear;
    case 'cubicOut':
    default:
      return Easing.out(Easing.cubic);
  }
}

function scaleDuration(ms: number, cfg: SkinAnimationConfig): number {
  const scale = typeof cfg.speedScale === 'number' && cfg.speedScale > 0 ? cfg.speedScale : 1;
  return Math.max(30, Math.round(ms * scale));
}

export function runEnterAnimation(anim: Animated.Value, cfg: SkinAnimationConfig): void {
  if (cfg.mode === 'timing') {
    Animated.timing(anim, {
      toValue: 1,
      duration: scaleDuration(cfg.enterDuration, cfg),
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
      duration: scaleDuration(cfg.pressDuration, cfg),
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
      duration: scaleDuration(cfg.pressDuration, cfg),
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
      duration: scaleDuration(240, cfg),
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
      duration: scaleDuration(180, cfg),
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
    const base = isOpen ? cfg.enterDuration : Math.max(120, Math.round(cfg.enterDuration * 0.72));
    Animated.timing(anim, {
      toValue,
      duration: scaleDuration(base, cfg),
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
  const duration = scaleDuration(cfg.sheetOpenDuration, cfg);
  translateY.setValue(420);
  backdropOpacity.setValue(0);
  Animated.parallel([
    Animated.timing(translateY, {
      toValue: 0,
      duration,
      easing: cfg.easing,
      useNativeDriver: true,
    }),
    Animated.timing(backdropOpacity, {
      toValue: 1,
      duration,
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
  const duration = scaleDuration(cfg.sheetCloseDuration, cfg);
  Animated.parallel([
    Animated.timing(translateY, {
      toValue: 520,
      duration,
      easing: cfg.easing,
      useNativeDriver: true,
    }),
    Animated.timing(backdropOpacity, {
      toValue: 0,
      duration,
      easing: cfg.easing,
      useNativeDriver: true,
    }),
  ]).start(onDone);
}

export function runSheetSnapBackAnimation(
  translateY: Animated.Value,
  cfg: SkinAnimationConfig
): void {
  if (cfg.mode === 'timing') {
    Animated.timing(translateY, {
      toValue: 0,
      duration: scaleDuration(cfg.sheetCloseDuration, cfg),
      easing: cfg.easing,
      useNativeDriver: true,
    }).start();
    return;
  }
  Animated.spring(translateY, {
    toValue: 0,
    useNativeDriver: true,
    friction: cfg.sheetSnapFriction,
    tension: cfg.sheetSnapTension,
  }).start();
}

export function runScreenEnterAnimation(
  anim: Animated.Value,
  cfg: SkinAnimationConfig
): void {
  anim.setValue(0);
  if (cfg.mode === 'timing') {
    Animated.timing(anim, {
      toValue: 1,
      duration: scaleDuration(cfg.enterDuration, cfg),
      easing: cfg.easing,
      useNativeDriver: true,
    }).start();
    return;
  }
  Animated.spring(anim, {
    toValue: 1,
    useNativeDriver: true,
    friction: cfg.screenEnterFriction,
    tension: cfg.screenEnterTension,
  }).start();
}

export function runScreenExitAnimation(
  anim: Animated.Value,
  cfg: SkinAnimationConfig,
  onDone?: () => void
): void {
  Animated.timing(anim, {
    toValue: 0,
    duration: scaleDuration(cfg.screenExitDuration, cfg),
    easing: cfg.easing,
    useNativeDriver: true,
  }).start(() => onDone?.());
}

export function runSwitchAnimation(
  anim: Animated.Value,
  toValue: number,
  cfg: SkinAnimationConfig
): void {
  if (cfg.mode === 'timing') {
    Animated.timing(anim, {
      toValue,
      duration: scaleDuration(cfg.pressDuration, cfg),
      easing: cfg.easing,
      useNativeDriver: false,
    }).start();
    return;
  }
  Animated.spring(anim, {
    toValue,
    useNativeDriver: false,
    friction: cfg.switchFriction,
    tension: cfg.switchTension,
  }).start();
}

export function runTabFadeAnimation(
  anim: Animated.Value,
  cfg: SkinAnimationConfig,
  startFrom = 0
): void {
  anim.setValue(startFrom);
  Animated.timing(anim, {
    toValue: 1,
    duration: scaleDuration(cfg.tabFadeDuration, cfg),
    easing: cfg.easing,
    useNativeDriver: true,
  }).start();
}

export function runComposerAnimation(
  anim: Animated.Value,
  toValue: number,
  cfg: SkinAnimationConfig,
  useNativeDriver = false
): void {
  Animated.timing(anim, {
    toValue,
    duration: scaleDuration(cfg.composerDuration, cfg),
    easing: cfg.easing,
    useNativeDriver,
  }).start();
}

export function runCollapsibleAnimation(
  anim: Animated.Value,
  toValue: number,
  cfg: SkinAnimationConfig,
  useNativeDriver = true,
  onDone?: (finished: boolean) => void
): void {
  Animated.timing(anim, {
    toValue,
    duration: scaleDuration(cfg.collapsibleDuration, cfg),
    easing: cfg.easing,
    useNativeDriver,
  }).start(({ finished }) => onDone?.(finished));
}
