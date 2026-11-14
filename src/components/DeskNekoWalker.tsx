import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';

const DESK_SPRITE_4X4 = require('../../assets/neko-desk-4x4.png');

type DeskAction = 'idle' | 'walk' | 'groom' | 'sleep' | 'curious' | 'waiting';

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
  const [action, setAction] = useState<DeskAction>('idle');
  const [frame, setFrame] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [facing, setFacing] = useState<1 | -1>(1);

  const maxWalkX = Math.max(24, containerWidth - FRAME_SIZE - 24);
  const posX = useRef(new Animated.Value(28)).current;
  const currentXRef = useRef(28);
  const bounceY = useRef(new Animated.Value(0)).current;
  const walkAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const id = posX.addListener(({ value }) => {
      currentXRef.current = value;
    });
    return () => posX.removeListener(id);
  }, [posX]);

  // React to user typing or AI waiting
  useEffect(() => {
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
    if (action === 'curious' || action === 'waiting') return;

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
        style={[
          styles.petAnchor,
          {
            transform: [
              { translateX: posX },
              { translateY: bounceY },
            ],
          },
        ]}
      >
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          accessibilityLabel="Open Neko Fidget Game"
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
              { transform: [{ scaleX: facing }] },
            ]}
          >
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
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
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
    borderColor: 'rgba(212, 255, 0, 0.45)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  waitBubbleText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#d4ff00',
  },
});

