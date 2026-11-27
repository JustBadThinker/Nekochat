import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { runSwitchAnimation } from '../theme/animations';

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
  const pressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    runSwitchAnimation(anim, value ? 1 : 0, skin.animation);
  }, [value, anim, skin.animation]);

  const isM3 = skin.switchStyle === 'm3';
  const isIos = skin.switchStyle === 'ios';
  const isNekoBento = skin.id === 'bento';

  const trackW = isM3 ? 52 : isIos ? 58 : isNekoBento ? 50 : 46;
  const trackH = isM3 ? 32 : isIos ? 30 : isNekoBento ? 30 : 26;
  const thumbW = isIos ? 34 : isNekoBento ? 21 : 18;
  const thumbH = isIos ? 24 : isNekoBento ? 21 : 18;
  const travel = 20;

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [isM3 ? 4 : 0, travel],
  });

  const nekoScaleX = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.14],
  });

  const nekoScaleY = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.92],
  });

  const m3ThumbSize = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 24],
  });

  const m3ThumbRadius = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 12],
  });

  const m3PressScale = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const trackBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: isIos
      ? ['rgba(120, 120, 128, 0.32)', palette.accent]
      : isM3
        ? ['rgba(255, 255, 255, 0.08)', palette.accent]
        : ['rgba(255, 255, 255, 0.07)', `rgba(${palette.accentRgb}, 0.22)`],
  });

  const trackBorder = anim.interpolate({
    inputRange: [0, 1],
    outputRange: isIos
      ? ['rgba(255, 255, 255, 0.20)', `rgba(${palette.accentRgb}, 0.55)`]
      : isM3
        ? ['#938F99', palette.accent]
        : ['rgba(255, 255, 255, 0.16)', palette.accent],
  });

  const thumbBg = isIos
    ? pressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#FFFFFF', 'rgba(255, 255, 255, 0.28)'],
      })
    : anim.interpolate({
        inputRange: [0, 1],
        outputRange: isM3
          ? ['#938F99', palette.bgDark]
          : ['#64748b', palette.accent],
      });

  const iosThumbScale = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  const iosThumbBorder = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.85)'],
  });

  const handlePressIn = () => {
    if ((!isIos && !isM3 && !isNekoBento) || disabled) return;
    Animated.spring(pressAnim, {
      toValue: 1,
      useNativeDriver: false,
      friction: 7,
      tension: 200,
    }).start();
  };

  const handlePressOut = () => {
    if (!isIos && !isM3 && !isNekoBento) return;
    Animated.spring(pressAnim, {
      toValue: 0,
      useNativeDriver: false,
      friction: 8,
      tension: 160,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={isIos ? 0.95 : 0.85}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
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
            borderWidth: isIos ? 1 : isM3 ? 2 : 1.5,
            ...(isNekoBento ? { borderBottomWidth: 3 } : null),
            padding: isIos ? 2 : isM3 ? 2 : 2.5,
            backgroundColor: trackBg,
            borderColor: trackBorder,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Animated.View
          style={[
            {
              width: isM3 ? m3ThumbSize : thumbW,
              height: isM3 ? m3ThumbSize : thumbH,
              borderRadius: isM3 ? m3ThumbRadius : thumbH / 2,
              backgroundColor: thumbBg,
              alignItems: 'center',
              justifyContent: 'center',
              transform: isIos
                ? [{ translateX }, { scale: iosThumbScale }]
                : isM3
                  ? [{ translateX }, { scale: m3PressScale }]
                  : isNekoBento
                    ? [{ translateX }, { scaleX: nekoScaleX }, { scaleY: nekoScaleY }]
                    : [{ translateX }],
            },
            isNekoBento && {
              borderBottomWidth: 2,
              borderBottomColor: 'rgba(0, 0, 0, 0.28)',
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
              borderWidth: 1,
              borderColor: iosThumbBorder,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.30,
              shadowRadius: 4,
              elevation: 3,
            },
          ]}
        >
          {isM3 && (
            <Animated.View
              style={{
                opacity: anim,
                transform: [{ scale: anim }],
              }}
            >
              <Check size={14} strokeWidth={3} color={palette.accent} />
            </Animated.View>
          )}
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  track: {
    justifyContent: 'center',
  },
});
