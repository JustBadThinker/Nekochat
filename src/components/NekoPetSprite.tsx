import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';

const PIXEL_KITTEN_SHEET = require('../../assets/pixel-kitten-sheet.png');
const SHEET_COLS = 8;
const SHEET_ROWS = 10;

export type NekoMood = 'idle' | 'happy' | 'hifive';

interface NekoPetSpriteProps {
  mood: NekoMood;
  size?: number; // Height/width in px (1:1 square cells in 8x9 sheet)
  onPet?: () => void;
}

/**
 * Pixel Kitten Companion using the 8x9 Pixel Kitten Sprite Sheet:
 * - Idle: row 0, col 0 (blink: col 1)
 * - Happy / Petted: row 0, col 7 (hearts)
 * - High-Five / Wave: row 8, col 2
 */
export const NekoPetSprite: React.FC<NekoPetSpriteProps> = ({
  mood,
  size = 54,
  onPet,
}) => {
  const frameH = size;
  const frameW = size;

  const [isBlinking, setIsBlinking] = useState(false);

  const breathY = useRef(new Animated.Value(0)).current;
  const breathScaleY = useRef(new Animated.Value(1)).current;
  const hopY = useRef(new Animated.Value(0)).current;
  const popScale = useRef(new Animated.Value(1)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;

  // Natural idle blink every ~3.2s
  useEffect(() => {
    if (mood !== 'idle') {
      setIsBlinking(false);
      return;
    }
    let blinkTimeout: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      setIsBlinking(true);
      blinkTimeout = setTimeout(() => setIsBlinking(false), 130);
    }, 3200);
    return () => {
      clearInterval(interval);
      if (blinkTimeout) clearTimeout(blinkTimeout);
    };
  }, [mood]);

  // Subtle 60fps breathing loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(breathY, {
            toValue: -1.5,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(breathScaleY, {
            toValue: 1.03,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(breathY, {
            toValue: 0,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(breathScaleY, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathY, breathScaleY]);

  // Trigger hop / high-five motion when mood changes
  useEffect(() => {
    if (mood === 'happy') {
      hopY.setValue(-7);
      popScale.setValue(1.08);
      Animated.parallel([
        Animated.spring(hopY, {
          toValue: 0,
          friction: 4,
          tension: 160,
          useNativeDriver: true,
        }),
        Animated.spring(popScale, {
          toValue: 1,
          friction: 5,
          tension: 140,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mood === 'hifive') {
      popScale.setValue(1.16);
      tiltAnim.setValue(-1);
      Animated.parallel([
        Animated.spring(popScale, {
          toValue: 1,
          friction: 4,
          tension: 150,
          useNativeDriver: true,
        }),
        Animated.spring(tiltAnim, {
          toValue: 0,
          friction: 5,
          tension: 140,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [mood, hopY, popScale, tiltAnim]);

  const spriteCell =
    mood === 'hifive'
      ? { row: 9, col: 2 }
      : mood === 'happy'
      ? { row: 9, col: 1 }
      : isBlinking
      ? { row: 0, col: 1 }
      : { row: 0, col: 0 };

  const rotate = tiltAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-7deg', '0deg', '7deg'],
  });

  return (
    <TouchableOpacity
      onPress={onPet}
      activeOpacity={0.85}
      accessibilityLabel="Pet Neko companion"
      style={styles.touchWrap}
    >
      <Animated.View
        style={{
          width: frameW,
          height: frameH,
          overflow: 'hidden',
          transform: [
            { translateY: Animated.add(breathY, hopY) },
            { scaleY: Animated.multiply(breathScaleY, popScale) },
            { scaleX: popScale },
            { rotate },
          ],
        }}
      >
        <Image
          source={PIXEL_KITTEN_SHEET}
          style={{
            width: frameW * SHEET_COLS,
            height: frameH * SHEET_ROWS,
            transform: [
              { translateX: -spriteCell.col * frameW },
              { translateY: -spriteCell.row * frameH },
            ],
          }}
          resizeMode="stretch"
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
});

