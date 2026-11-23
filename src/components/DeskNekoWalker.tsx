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

// DeskNekoWalker: certified emotional-support pixel cat.
// Do not question the throw physics; it works on my machine ¯\_(ツ)_/¯
const PIXEL_KITTEN_SHEET = require('../../assets/pixel-kitten-sheet.png');
const SHEET_COLS = 8;
const SHEET_ROWS = 10;

type DeskAction =
  | 'idle'
  | 'walk'
  | 'run'
  | 'groom'
  | 'sleep'
  | 'hop'
  | 'stretch'
  | 'wave'
  | 'dizzy'
  | 'curious'
  | 'waiting'
  | 'grabbed'
  | 'thrown'
  | 'landing';

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
  const facingRef = useRef<1 | -1>(1);
  facingRef.current = facing;
  const [pillowState, setPillowState] = useState<{ x: number; col: number; poofing?: boolean } | null>(null);
  const pillowOpacity = useRef(new Animated.Value(1)).current;

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

  // Autonomous behavior loop when neither typing nor waiting
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
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
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
        // Allow lifting high across the chat area (-420px..0px) while keeping landing intact on top border
        const nextY = Math.max(-420, Math.min(0, dragStartRef.current.y + gesture.dy));
        if (Math.abs(gesture.dx) > 4) {
          setFacing(gesture.dx >= 0 ? 1 : -1);
        }
        posX.setValue(nextX);
        bounceY.setValue(nextY);
        if (nextY < -12) {
          pillowOpacity.setValue(1);
          setPillowState({ x: nextX, col: 0, poofing: false });
        }
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

        // Throw physics: velocity + gravity + wall/ceiling bounce, landing intact on top border (y = 0)
        setAction('thrown');
        let x = currentXRef.current;
        let y = currentYRef.current;
        let vx = Math.max(-20, Math.min(20, gesture.vx * 16));
        let vy = Math.max(-24, Math.min(14, gesture.vy * 18));
        const gravity = 0.85;
        const minX = 8;
        const maxX = maxWalkXRef.current;

        const step = () => {
          vx *= 0.978;
          vy += gravity;
          x += vx;
          y += vy;

          if (x <= minX) {
            x = minX;
            vx = Math.abs(vx) * 0.65;
            setFacing(1);
          } else if (x >= maxX) {
            x = maxX;
            vx = -Math.abs(vx) * 0.65;
            setFacing(-1);
          }

          if (y < -460) {
            y = -460;
            vy = Math.abs(vy) * 0.45;
          }

          if (y >= 0) {
            posX.setValue(x);
            bounceY.setValue(0);
            throwRafRef.current = null;
            setPillowState({ x, col: 0 });
            setAction('landing');
            return;
          }

          posX.setValue(x);
          bounceY.setValue(y);
          setPillowState({ x, col: 0 });
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
        }).start(() => setAction('landing'));
      },
    })
  ).current;

  // React to user typing or AI waiting
  // Autonomous behavior loop when neither typing nor waiting
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

  // Dedicated pillow poof/disappear animation (runs independently so setAction('idle') never cancels it)
  // Autonomous behavior loop when neither typing nor waiting
  useEffect(() => {
    if (!pillowState?.poofing) return;
    const poofCols = [1, 2, 3, 4, 5, 6, 7];
    let pTick = 0;
    pillowOpacity.setValue(1);
    Animated.timing(pillowOpacity, {
      toValue: 0,
      duration: poofCols.length * 165,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    const iv = setInterval(() => {
      pTick += 1;
      if (pTick < poofCols.length) {
        setPillowState(prev => (prev ? { ...prev, col: poofCols[pTick] } : null));
      } else {
        clearInterval(iv);
        setPillowState(null);
      }
    }, 165);
    return () => clearInterval(iv);
  }, [pillowState?.poofing, pillowOpacity]);
  // Autonomous behavior loop when neither typing nor waiting
  useEffect(() => {
    if (
      action === 'curious' ||
      action === 'waiting' ||
      action === 'grabbed' ||
      action === 'thrown' ||
      action === 'landing'
    ) {
      return;
    }

    const pickNextBehavior = () => {
      const r = Math.random();
      if (r < 0.44 && maxWalkX > 48) {
        // Walk or dash to a random X along the top of the input bar
        const targetX = 18 + Math.random() * (maxWalkX - 18);
        const dist = Math.abs(targetX - currentXRef.current);
        if (dist > 16) {
          const dir: 1 | -1 = targetX >= currentXRef.current ? 1 : -1;
          // Row 3 (run) faces right only, so only dash right; walk left uses Row 2 at faster cadence (no moonwalk!)
          const isFastRight = dir === 1 && dist > 120;
          setFacing(dir);
          setAction(isFastRight ? 'run' : 'walk');
          const duration = isFastRight
            ? Math.min(2200, Math.max(700, Math.round(dist * 10)))
            : Math.min(3400, Math.max(900, Math.round(dist * 15)));
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
      if (r < 0.56) {
        setAction('groom');
      } else if (r < 0.68) {
        setAction('wave');
      } else if (r < 0.78) {
        setAction('hop');
      } else if (r < 0.87) {
        setAction('stretch');
      } else if (r < 0.96) {
        setAction('sleep');
      } else {
        setAction('idle');
      }
    };

    const timer = setInterval(pickNextBehavior, 4200);
    return () => clearInterval(timer);
  }, [action, maxWalkX, posX]);

  // Frame sequencer per action (8x10 Pixel Kitten Sprite Sheet — no horizontal flip needed)
  useEffect(() => {
    if (action !== 'walk' && action !== 'run') {
      walkAnimRef.current?.stop();
      walkAnimRef.current = null;
    }
    let tick = 0;
    if (action === 'walk') {
      // Row 1 = walk right, Row 2 = walk left (native unflipped art)
      const walkRow = facingRef.current === 1 ? 1 : 2;
      setFrame({ row: walkRow, col: 0 });
      const iv = setInterval(() => {
        tick = (tick + 1) % 8;
        setFrame({ row: walkRow, col: tick });
      }, 115);
      return () => clearInterval(iv);
    }

    if (action === 'run') {
      setFrame({ row: 3, col: 0 });
      const iv = setInterval(() => {
        tick = (tick + 1) % 8;
        setFrame({ row: 3, col: tick });
      }, 90);
      return () => clearInterval(iv);
    }

    if (action === 'groom') {
      setFrame({ row: 6, col: 0 });
      const iv = setInterval(() => {
        tick = (tick + 1) % 8;
        setFrame({ row: 6, col: tick });
      }, 220);
      return () => clearInterval(iv);
    }

    if (action === 'hop') {
      setFrame({ row: 8, col: 0 });
      const iv = setInterval(() => {
        tick = (tick + 1) % 8;
        setFrame({ row: 8, col: tick });
      }, 170);
      return () => clearInterval(iv);
    }

    if (action === 'wave') {
      const seq = [0, 1, 2, 1, 2, 0];
      setFrame({ row: 9, col: seq[0] });
      const iv = setInterval(() => {
        tick = (tick + 1) % seq.length;
        setFrame({ row: 9, col: seq[tick] });
      }, 280);
      return () => clearInterval(iv);
    }

    if (action === 'stretch') {
      const seq = [3, 4, 3, 4];
      setFrame({ row: 9, col: seq[0] });
      const iv = setInterval(() => {
        tick = (tick + 1) % seq.length;
        setFrame({ row: 9, col: seq[tick] });
      }, 360);
      return () => clearInterval(iv);
    }

    if (action === 'dizzy') {
      const seq = [1, 2, 3, 4, 3, 4];
      setFrame({ row: 7, col: seq[0] });
      const iv = setInterval(() => {
        tick = (tick + 1) % seq.length;
        setFrame({ row: 7, col: seq[tick] });
      }, 220);
      return () => clearInterval(iv);
    }

    if (action === 'sleep') {
      // Alternate between different sleep poses (Zzz, curled ball, flopped)
      const seq = [
        { row: 9, col: 5 },
        { row: 9, col: 6 },
        { row: 9, col: 5 },
        { row: 7, col: 7 },
      ];
      setFrame(seq[0]);
      const iv = setInterval(() => {
        tick = (tick + 1) % seq.length;
        setFrame(seq[tick]);
      }, 900);
      return () => clearInterval(iv);
    }

    if (action === 'curious') {
      setFrame({ row: 0, col: 4 });
      const iv = setInterval(() => {
        tick = (tick + 1) % 2;
        setFrame({ row: 0, col: tick === 0 ? 4 : 3 });
      }, 650);
      return () => clearInterval(iv);
    }

    if (action === 'grabbed') {
      setFrame({ row: 4, col: 0 });
      return;
    }

    if (action === 'thrown') {
      setFrame({ row: 4, col: 1 });
      return;
    }

    if (action === 'landing') {
      // 1) Land on pillow (image 2: 4,2..4,4 -> image 3: 4,5..4,7)
      // 2) Jump off pillow forward & let pillow poof/disappear behind (row 5 cols 1..7)
      const seq = [
        { row: 4, col: 2 },
        { row: 4, col: 3 },
        { row: 4, col: 4 },
        { row: 4, col: 5 },
        { row: 4, col: 6 },
        { row: 4, col: 7 },
      ];
      setFrame(seq[0]);
      // Hide separate pillow while cat+pillow sprite (row 4 cols 2..7) is active
      setPillowState(prev => (prev ? { ...prev, col: -1, poofing: false } : null));
      const iv = setInterval(() => {
        tick += 1;
        if (tick < seq.length) {
          setFrame(seq[tick]);
        } else {
          clearInterval(iv);
          // Cat jumps off the pillow!
          const landX = currentXRef.current;
          const jumpOffset = landX + 26 <= maxWalkXRef.current ? 26 : -26;
          setFacing(jumpOffset >= 0 ? 1 : -1);
          setFrame({ row: 8, col: 3 });
          setPillowState({ x: landX, col: 1, poofing: true });

          Animated.parallel([
            Animated.sequence([
              Animated.timing(bounceY, { toValue: -18, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              Animated.timing(bounceY, { toValue: 0, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            ]),
            Animated.timing(posX, { toValue: landX + jumpOffset, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]).start(() => {
            setAction('idle');
          });
        }
      }, 150);
      return () => {
        clearInterval(iv);
      };
    }

    if (action === 'waiting') {
      const seq = [
        { row: 0, col: 4 },
        { row: 0, col: 3 },
        { row: 9, col: 2 },
        { row: 0, col: 5 },
      ];
      setFrame(seq[0]);
      const iv = setInterval(() => {
        tick = (tick + 1) % seq.length;
        setFrame(seq[tick]);
      }, 720);
      return () => clearInterval(iv);
    }

    // Idle: sit + blink, glance, happy smile, occasional back-turned look
    setFrame({ row: 0, col: 0 });
    const iv = setInterval(() => {
      tick = (tick + 1) % 14;
      if (tick === 4) {
        setFrame({ row: 0, col: 1 }); // blink
      } else if (tick === 7) {
        setFrame({ row: 0, col: 2 }); // glance
      } else if (tick === 10) {
        setFrame({ row: 0, col: 5 }); // happy smile
      } else if (tick === 12) {
        setFrame({ row: 9, col: 7 }); // look away / back view
      } else {
        setFrame({ row: 0, col: 0 });
      }
    }, 320);
    return () => clearInterval(iv);
  }, [action, bounceY, posX]);

  return (
    <View style={styles.rail} pointerEvents="box-none">
      {pillowState && pillowState.col >= 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.petAnchor,
            {
              opacity: pillowOpacity,
              transform: [{ translateX: pillowState.x }, { translateY: 12 }],
            },
          ]}
        >
          <View style={styles.spriteViewport}>
            <Image
              source={PIXEL_KITTEN_SHEET}
              style={{
                width: FRAME_SIZE * SHEET_COLS,
                height: FRAME_SIZE * SHEET_ROWS,
                transform: [
                  { translateX: -pillowState.col * FRAME_SIZE },
                  { translateY: -5 * FRAME_SIZE },
                ],
              }}
              resizeMode="stretch"
            />
          </View>
        </Animated.View>
      )}
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
          <View style={styles.spriteViewport}>
            <Image
              source={PIXEL_KITTEN_SHEET}
              style={{
                width: FRAME_SIZE * SHEET_COLS,
                height: FRAME_SIZE * SHEET_ROWS,
                transform: [
                  { translateX: -frame.col * FRAME_SIZE },
                  { translateY: -frame.row * FRAME_SIZE },
                ],
              }}
              resizeMode="stretch"
            />
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

