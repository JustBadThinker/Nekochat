/**
 * NekoPulseLoader.tsx
 * Dynamic pulsing SVG vector loader for all loading states.
 * Replaces generic ActivityIndicator spinners with the glowing NekoChat brand mark.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { NekoLogoSvg } from './NekoLogoSvg';
import { useTheme } from '../theme/ThemeContext';

export interface NekoPulseLoaderProps {
  size?: number;
  color?: string;
  label?: string;
}

export const NekoPulseLoader: React.FC<NekoPulseLoaderProps> = ({
  size = 38,
  color,
  label,
}) => {
  const { palette, skin } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.75)).current;

  useEffect(() => {
    const duration = Math.max(480, skin.animation.enterDuration * 2.2);
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: skin.id === 'janitor' ? 1.18 : 1.12,
            duration,
            easing: skin.animation.easing,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 0.92,
            duration,
            easing: skin.animation.easing,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.65,
            duration,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim, opacityAnim, skin.animation, skin.id]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          transform: [{ scale: pulseAnim }],
          opacity: opacityAnim,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <NekoLogoSvg size={size} color={color || palette.accent} />
      </Animated.View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  label: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    letterSpacing: 0.3,
  },
});

