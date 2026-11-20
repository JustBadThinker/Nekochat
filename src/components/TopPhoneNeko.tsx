import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const DESK_SPRITE_4X4 = require('../../assets/neko-desk-4x4.png');

type TopNekoAction = 'walk' | 'sleep' | 'groom' | 'idle';

interface TopPhoneNekoProps {
  containerWidth: number;
}

const FRAME_SIZE = 32;

/**
 * Compact pixel cat that sleeps or walks along the top edge of the phone.
 */
export const TopPhoneNeko: React.FC<TopPhoneNekoProps> = ({ containerWidth }) => {
  const { palette } = useTheme();
  const [action, setAction] = useState<TopNekoAction>('sleep');
  const [frame, setFrame] = useState<{ row: number; col: number }>({ row: 3, col: 2 });
  const [facing, setFacing] = useState<1 | -1>(1);
  const [showHeart, setShowHeart] = useState(false);

  const maxWalkX = Math.max(48, containerWidth - FRAME_SIZE - 20);
  const posX = useRef(new Animated.Value(Math.max(20, Math.round((containerWidth - FRAME_SIZE) * 0.5)))).current;
  const currentXRef = useRef(Math.max(20, Math.round((containerWidth - FRAME_SIZE) * 0.5)));
  const hopY = useRef(new Animated.Value(0)).current;
  const walkAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const id = posX.addListener(({ value }) => {
      currentXRef.current = value;
    });
    return () => {
      posX.removeListener(id);
      walkAnimRef.current?.stop();
    };
  }, [posX]);

  useEffect(() => {
    const pickBehavior = () => {
      const r = Math.random();
      if (r < 0.45 && maxWalkX > 48) {
        const targetX = 16 + Math.random() * (maxWalkX - 16);
        const dist = Math.abs(targetX - currentXRef.current);
        if (dist > 14) {
          setFacing(targetX >= currentXRef.current ? 1 : -1);
          setAction('walk');
          const duration = Math.min(4200, Math.max(1000, Math.round(dist * 18)));
          const anim = Animated.timing(posX, {
            toValue: targetX,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
          });
          walkAnimRef.current = anim;
          anim.start(({ finished }) => {
            if (finished) {
              setAction(Math.random() < 0.55 ? 'sleep' : 'idle');
            }
          });
          return;
        }
      }
      if (r < 0.78) {
        setAction('sleep');
      } else if (r < 0.9) {
        setAction('groom');
      } else {
        setAction('idle');
      }
    };

    const iv = setInterval(pickBehavior, 5200);
    return () => clearInterval(iv);
  }, [maxWalkX, posX]);

  useEffect(() => {
    let tick = 0;
    if (action === 'walk') {
      setFrame({ row: 1, col: 0 });
      const iv = setInterval(() => {
        tick = (tick + 1) % 4;
        setFrame({ row: 1, col: tick });
      }, 170);
      return () => clearInterval(iv);
    }
    if (action === 'groom') {
      const seq = [0, 1, 2, 1, 2, 3];
      setFrame({ row: 2, col: seq[0] });
      const iv = setInterval(() => {
        tick = (tick + 1) % seq.length;
        setFrame({ row: 2, col: seq[tick] });
      }, 340);
      return () => clearInterval(iv);
    }
    if (action === 'sleep') {
      setFrame({ row: 3, col: 2 });
      return;
    }
    setFrame({ row: 0, col: 0 });
    const iv = setInterval(() => {
      tick = (tick + 1) % 8;
      setFrame(tick === 4 ? { row: 0, col: 1 } : tick === 7 ? { row: 0, col: 2 } : { row: 0, col: 0 });
    }, 340);
    return () => clearInterval(iv);
  }, [action]);

  const handleTap = () => {
    walkAnimRef.current?.stop();
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 1100);
    Animated.sequence([
      Animated.timing(hopY, { toValue: -5, duration: 110, useNativeDriver: true }),
      Animated.timing(hopY, { toValue: 0, duration: 140, useNativeDriver: true }),
    ]).start();
    setAction(prev => (prev === 'sleep' ? 'idle' : 'sleep'));
  };

  return (
    <View style={styles.rail} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.anchor,
          {
            transform: [{ translateX: posX }, { translateY: hopY }],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleTap}
          accessibilityLabel="Top phone Neko companion"
          style={styles.touchTarget}
        >
          <View style={[styles.viewport, { transform: [{ scaleX: facing }] }]}>
            <Image
              source={DESK_SPRITE_4X4}
              style={{
                width: FRAME_SIZE * 4,
                height: FRAME_SIZE * 4,
                transform: [
                  { translateX: -frame.col * FRAME_SIZE },
                  { translateY: -frame.row * FRAME_SIZE },
                ],
              }}
              resizeMode="stretch"
            />
          </View>
          {action === 'sleep' && !showHeart && (
            <Text style={[styles.statusText, { color: palette.accent }]}>zZz</Text>
          )}
          {showHeart && <Text style={[styles.statusText, { color: '#fb7185' }]}>♥</Text>}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: FRAME_SIZE + 4,
    zIndex: 80,
  },
  anchor: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  touchTarget: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewport: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    overflow: 'hidden',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    marginLeft: -2,
    marginTop: -8,
  },
});
