import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { BlurView, BlurViewProps } from 'expo-blur';

/**
 * Workaround for expo-blur ~58.0.6 Android initialization race:
 * On frame 1, `BlurView` mounts with `blurTargetId: undefined` while
 * `blurMethod` is already set, causing `ExpoBlurView.kt` to disable blur and
 * set an opaque fallback background color that never clears once `blurTargetId` binds.
 * Starting with `'none'` and flipping to the requested `blurMethod` after
 * `blurTarget` attaches ensures `setBlurMethod` enables real blur cleanly.
 */
export const SafeBlurView: React.FC<BlurViewProps> = ({
  blurMethod = 'none',
  blurTarget,
  ...rest
}) => {
  const needsDeferredEnable =
    Platform.OS === 'android' &&
    Boolean(blurTarget) &&
    (blurMethod === 'dimezisBlurView' || blurMethod === 'dimezisBlurViewSdk31Plus');

  const [activeMethod, setActiveMethod] = useState<BlurViewProps['blurMethod']>(
    needsDeferredEnable ? 'none' : blurMethod
  );

  useEffect(() => {
    if (!needsDeferredEnable) {
      setActiveMethod(blurMethod);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tryEnable = () => {
      if (cancelled) return;
      if (blurTarget?.current) {
        requestAnimationFrame(() => {
          if (!cancelled) {
            setActiveMethod(blurMethod);
          }
        });
        return;
      }
      attempts += 1;
      if (attempts <= 6) {
        timer = setTimeout(tryEnable, 50);
      }
    };

    const rafId = requestAnimationFrame(tryEnable);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (timer) clearTimeout(timer);
    };
  }, [needsDeferredEnable, blurMethod, blurTarget]);

  return <BlurView {...rest} blurTarget={blurTarget} blurMethod={activeMethod} />;
};
