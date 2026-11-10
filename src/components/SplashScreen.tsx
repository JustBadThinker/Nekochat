/**
 * Animated Splash Screen
 * Features glowing breathing cat icon with pulsing neon accents.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Cat } from 'lucide-react-native';
import { colors } from '../theme/colors';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Breathing cat animation
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    // Fade out after 1.8 seconds if onFinish provided
    if (onFinish) {
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => onFinish());
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.View
        style={[
          styles.catWrapper,
          {
            transform: [{ scale: pulseAnim }],
            shadowOpacity: glowAnim as any,
          },
        ]}
      >
        <View style={styles.catGlowCircle}>
          <Cat size={64} color={colors.lime} />
        </View>
      </Animated.View>

      <Text style={styles.title}>NekoChat</Text>
      <Text style={styles.subtitle}>AI Companion & Roleplay Client</Text>
      <Text style={styles.versionBadge}>v0.1.0-alpha • Powered by Warden Core</Text>

      <View style={styles.loaderBarContainer}>
        <Animated.View style={[styles.loaderBar, { opacity: glowAnim }]} />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  catWrapper: {
    shadowColor: colors.lime,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 30,
    elevation: 20,
    marginBottom: 24,
  },
  catGlowCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(204, 255, 0, 0.08)',
    borderWidth: 2,
    borderColor: colors.lime,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
  },
  versionBadge: {
    color: colors.lime,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(204, 255, 0, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 32,
  },
  loaderBarContainer: {
    width: 120,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loaderBar: {
    width: '60%',
    height: '100%',
    backgroundColor: colors.lime,
    borderRadius: 2,
  },
});
