/**
 * NekoPulseLoader.tsx
 * Dynamic pulsing SVG vector loader for all loading states.
 * Replaces generic ActivityIndicator spinners with the glowing NekoChat brand mark.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { NekoLogoSvg } from './NekoLogoSvg';
import { colors } from '../theme/colors';

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
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.75)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 650,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 650,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 0.9,
            duration: 650,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.65,
            duration: 650,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim, opacityAnim]);

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
        <NekoLogoSvg size={size} color={color || colors.lime} />
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

