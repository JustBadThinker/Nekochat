import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface NekoSwitchProps {
  value: boolean;
  onValueChange: (nextValue: boolean) => void;
  disabled?: boolean;
}

export const NekoSwitch: React.FC<NekoSwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
}) => {
  const { palette, skin } = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      friction: skin.switchStyle === 'ios' ? 9 : 7,
      tension: skin.switchStyle === 'ios' ? 110 : 130,
    }).start();
  }, [value, anim, skin.switchStyle]);

  const isM3 = skin.switchStyle === 'm3';
  const isIos = skin.switchStyle === 'ios';

  const trackW = isM3 ? 52 : isIos ? 51 : 46;
  const trackH = isM3 ? 32 : isIos ? 31 : 26;
  const thumbSize = isM3 ? (value ? 24 : 16) : isIos ? 27 : 18;
  const travel = isM3 ? 20 : isIos ? 20 : 20;

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [isM3 && !value ? 4 : 0, travel],
  });

  const trackBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: isIos
      ? ['rgba(120, 120, 128, 0.36)', palette.accent]
      : isM3
        ? ['rgba(255, 255, 255, 0.08)', palette.accent]
        : ['rgba(255, 255, 255, 0.07)', `rgba(${palette.accentRgb}, 0.22)`],
  });

  const trackBorder = anim.interpolate({
    inputRange: [0, 1],
    outputRange: isIos
      ? ['transparent', 'transparent']
      : isM3
        ? ['rgba(255, 255, 255, 0.35)', palette.accent]
        : ['rgba(255, 255, 255, 0.16)', palette.accent],
  });

  const thumbBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: isIos
      ? ['#FFFFFF', '#FFFFFF']
      : isM3
        ? ['#94a3b8', palette.bgDark]
        : ['#64748b', palette.accent],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
    >
      <Animated.View
        style={[
          styles.track,
          {
            width: trackW,
            height: trackH,
            borderRadius: trackH / 2,
            borderWidth: isIos ? 0 : 1.5,
            padding: isIos ? 2 : 2.5,
            backgroundColor: trackBg,
            borderColor: trackBorder,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Animated.View
          style={[
            {
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              backgroundColor: thumbBg,
              transform: [{ translateX }],
            },
            value &&
              skin.switchStyle === 'neko' && {
                shadowColor: palette.accent,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.65,
                shadowRadius: 6,
                elevation: 4,
              },
            isIos && {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.28,
              shadowRadius: 3,
              elevation: 3,
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  track: {
    justifyContent: 'center',
  },
});
