import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';

const NEKO_SPRITE_SHEET = require('../../assets/neko-sprite-sheet.png');

export type NekoMood = 'idle' | 'happy' | 'hifive';

interface NekoPetSpriteProps {
  mood: NekoMood;
  size?: number; // Height in px (width is 3:4 to match 543x724)
  onPet?: () => void;
}

/**
 * 4-Frame Pixel Neko Companion:
 * Frame 0: Idle (open eyes)
 * Frame 1: Blink (closed eyes)
 * Frame 2: Happy / Petted (>▽< jump)
 * Frame 3: Paw High-Five (raised paw)
 */
export const NekoPetSprite: React.FC<NekoPetSpriteProps> = ({
  mood,
  size = 54,
  onPet,
}) => {
  const frameH = size;
  const frameW = Math.round(size * 0.75); // Exact 543:724 = 3:4 ratio

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

  const frameIndex =
    mood === 'hifive'
      ? 3
      : mood === 'happy'
      ? 2
      : isBlinking
      ? 1
      : 0;

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
          source={NEKO_SPRITE_SHEET}
          style={{
            width: frameW * 4,
            height: frameH,
            transform: [{ translateX: -frameIndex * frameW }],
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

