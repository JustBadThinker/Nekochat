import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  Animated,
  Easing,
  PanResponder,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { ThemePalette } from '../theme/colors';

const DESK_SPRITE_4X4 = require('../../assets/neko-desk-4x4.png');
const NEKO_LIFTED_IMG = require('../../assets/neko-lifted.png');
const NEKO_THROWN_IMG = require('../../assets/neko-thrown.png');

type DeskAction = 'idle' | 'walk' | 'groom' | 'sleep' | 'curious' | 'waiting' | 'grabbed' | 'thrown';

interface DeskNekoWalkerProps {
  containerWidth: number;
  isTypingUser: boolean;
  isAiWaiting: boolean;
  onPress: () => void;
}

const FRAME_SIZE = 44;

/**
 * Walking, Paw-Licking & Typing-Reactive Desk Neko perched on top of the input box.
 * Never auto-opens the game; tapping her opens the InlineWaitFidget card.
 */
export const DeskNekoWalker: React.FC<DeskNekoWalkerProps> = ({
  containerWidth,
  isTypingUser,
  isAiWaiting,
  onPress,
}) => {
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [action, setAction] = useState<DeskAction>('idle');
  const [frame, setFrame] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [facing, setFacing] = useState<1 | -1>(1);

  const maxWalkX = Math.max(24, containerWidth - FRAME_SIZE - 24);
  const maxWalkXRef = useRef(maxWalkX);
  maxWalkXRef.current = maxWalkX;
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  const posX = useRef(new Animated.Value(28)).current;
  const currentXRef = useRef(28);
  const currentYRef = useRef(0);
  const bounceY = useRef(new Animated.Value(0)).current;
  const walkAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const throwRafRef = useRef<number | null>(null);
  const isGrabbedRef = useRef(false);
  const dragStartRef = useRef({ x: 28, y: 0 });

  useEffect(() => {
    const idX = posX.addListener(({ value }) => {
      currentXRef.current = value;
    });
    const idY = bounceY.addListener(({ value }) => {
      currentYRef.current = value;
    });
    return () => {
      posX.removeListener(idX);
      bounceY.removeListener(idY);
      if (throwRafRef.current !== null) cancelAnimationFrame(throwRafRef.current);
    };
  }, [posX, bounceY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        if (throwRafRef.current !== null) {
          cancelAnimationFrame(throwRafRef.current);
          throwRafRef.current = null;
        }
        walkAnimRef.current?.stop();
        isGrabbedRef.current = true;
        dragStartRef.current = { x: currentXRef.current, y: currentYRef.current };
        setAction('grabbed');
      },
      onPanResponderMove: (_evt, gesture) => {
        const minX = 8;
        const maxX = maxWalkXRef.current;
        const nextX = Math.max(minX, Math.min(maxX, dragStartRef.current.x + gesture.dx));
        // Allow lifting above the input border (-110px..0px) so she always stays on/above the border
        const nextY = Math.max(-110, Math.min(0, dragStartRef.current.y + gesture.dy));
        if (Math.abs(gesture.dx) > 4) {
          setFacing(gesture.dx >= 0 ? 1 : -1);
        }
        posX.setValue(nextX);
        bounceY.setValue(nextY);
      },
      onPanResponderRelease: (_evt, gesture) => {
        isGrabbedRef.current = false;
        // Short tap without dragging -> open the mini-game card
        if (Math.abs(gesture.dx) < 6 && Math.abs(gesture.dy) < 6) {
          bounceY.setValue(0);
          setAction('idle');
          onPressRef.current();
          return;
        }

        // Throw physics: velocity + gravity + edge bounce, landing intact on top border (y = 0)
        setAction('thrown');
        let x = currentXRef.current;
        let y = currentYRef.current;
        let vx = Math.max(-16, Math.min(16, gesture.vx * 14));
        let vy = Math.max(-14, Math.min(10, gesture.vy * 14));
        const gravity = 0.85;
        const minX = 8;
        const maxX = maxWalkXRef.current;

        const step = () => {
          vx *= 0.975;
          vy += gravity;
          x += vx;
          y += vy;

          if (x <= minX) {
            x = minX;
            vx = Math.abs(vx) * 0.6;
            setFacing(1);
          } else if (x >= maxX) {
            x = maxX;
            vx = -Math.abs(vx) * 0.6;
            setFacing(-1);
          }

          if (y >= 0) {
            y = 0;
            if (Math.abs(vy) > 3.2) {
              vy = -vy * 0.35;
              vx *= 0.72;
            } else {
              posX.setValue(x);
              bounceY.setValue(0);
              throwRafRef.current = null;
              setAction('idle');
              return;
            }
          }

          posX.setValue(x);
          bounceY.setValue(y);
          throwRafRef.current = requestAnimationFrame(step);
        };

        throwRafRef.current = requestAnimationFrame(step);
      },
      onPanResponderTerminate: () => {
        isGrabbedRef.current = false;
        Animated.spring(bounceY, {
          toValue: 0,
          friction: 5,
          tension: 160,
          useNativeDriver: true,
        }).start(() => setAction('idle'));
      },
    })
  ).current;

  // React to user typing or AI waiting
  useEffect(() => {
    if (isGrabbedRef.current) return;
    if (isTypingUser) {
      walkAnimRef.current?.stop();
      setAction('curious');
      bounceY.setValue(-4);
      Animated.spring(bounceY, {
        toValue: 0,
        friction: 5,
        tension: 180,
        useNativeDriver: true,
      }).start();
      return;
    }
    if (isAiWaiting) {
      walkAnimRef.current?.stop();
      setAction('waiting');
      return;
    }
    setAction('idle');
  }, [isTypingUser, isAiWaiting, bounceY]);

  // Autonomous behavior loop when neither typing nor waiting
  useEffect(() => {
    if (action === 'curious' || action === 'waiting' || action === 'grabbed' || action === 'thrown') return;

    const pickNextBehavior = () => {
      const r = Math.random();
      if (r < 0.42 && maxWalkX > 48) {
        // Walk to a random X along the top of the input bar
        const targetX = 18 + Math.random() * (maxWalkX - 18);
        const dist = Math.abs(targetX - currentXRef.current);
        if (dist > 16) {
          setFacing(targetX >= currentXRef.current ? 1 : -1);
          setAction('walk');
          const duration = Math.min(3400, Math.max(900, Math.round(dist * 16)));
          const anim = Animated.timing(posX, {
            toValue: targetX,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
          });
          walkAnimRef.current = anim;
          anim.start(({ finished }) => {
            if (finished) {
              setAction('idle');
            }
          });
          return;
        }
      }
      if (r < 0.72) {
        setAction('groom');
      } else if (r < 0.88) {
        setAction('idle');
      } else {
        setAction('sleep');
      }
    };

    const timer = setInterval(pickNextBehavior, 4200);
    return () => clearInterval(timer);
  }, [action, maxWalkX, posX]);

  // Frame sequencer per action
  useEffect(() => {
    let tick = 0;
    if (action === 'walk') {
      setFrame({ row: 1, col: 0 });
      const iv = setInterval(() => {
        tick = (tick + 1) % 4;
        setFrame({ row: 1, col: tick });
      }, 160);
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

    if (action === 'curious') {
      setFrame({ row: 0, col: 3 });
      return;
    }

    if (action === 'grabbed' || action === 'thrown') {
      return;
    }

    if (action === 'waiting') {
      setFrame({ row: 0, col: 3 });
      const iv = setInterval(() => {
        tick = (tick + 1) % 3;
        setFrame(tick === 0 ? { row: 0, col: 3 } : tick === 1 ? { row: 0, col: 2 } : { row: 3, col: 3 });
      }, 900);
      return () => clearInterval(iv);
    }

    // Idle: sit + occasional blink & ear twitch
    setFrame({ row: 0, col: 0 });
    const iv = setInterval(() => {
      tick = (tick + 1) % 10;
      if (tick === 5) {
        setFrame({ row: 0, col: 1 }); // blink
      } else if (tick === 8) {
        setFrame({ row: 0, col: 2 }); // ear twitch
      } else {
        setFrame({ row: 0, col: 0 });
      }
    }, 320);
    return () => clearInterval(iv);
  }, [action]);

  return (
    <View style={styles.rail} pointerEvents="box-none">
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.petAnchor,
          {
            transform: [
              { translateX: posX },
              { translateY: bounceY },
              { rotate: action === 'grabbed' ? '-8deg' : '0deg' },
              { scale: action === 'grabbed' ? 1.08 : 1 },
            ],
          },
        ]}
      >
        <View
          accessibilityLabel="Drag to lift/throw Neko or tap to open game"
          style={styles.touchTarget}
        >
          {isAiWaiting && (
            <View style={styles.waitBubble}>
              <Text style={styles.waitBubbleText}>Writing...</Text>
            </View>
          )}
          <View
            style={[
              styles.spriteViewport,
              { transform: [{ scaleX: action === 'grabbed' ? 1 : facing }] },
            ]}
          >
            {action === 'grabbed' ? (
              <Image
                source={NEKO_LIFTED_IMG}
                style={{ width: FRAME_SIZE, height: FRAME_SIZE }}
                resizeMode="contain"
              />
            ) : action === 'thrown' ? (
              <Image
                source={NEKO_THROWN_IMG}
                style={{ width: FRAME_SIZE, height: FRAME_SIZE }}
                resizeMode="contain"
              />
            ) : (
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
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  rail: {
    position: 'absolute',
    top: -39,
    left: 0,
    right: 0,
    height: FRAME_SIZE,
    zIndex: 20,
  },
  petAnchor: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  touchTarget: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spriteViewport: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    overflow: 'hidden',
  },
  waitBubble: {
    position: 'absolute',
    left: FRAME_SIZE - 4,
    top: 4,
    backgroundColor: 'rgba(12, 16, 26, 0.92)',
    borderWidth: 1,
    borderColor: `rgba(${palette.accentRgb}, 0.45)`,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  waitBubbleText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: palette.accent,
  },
});

