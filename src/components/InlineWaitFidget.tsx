import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import { Brain, ChevronDown, PawPrint, RotateCcw, X } from 'lucide-react-native';
import { GLASS } from '../theme/glassTheme';
import { NekoPetSprite, NekoMood } from './NekoPetSprite';

interface InlineWaitFidgetProps {
  charName: string;
  isWaiting: boolean;
  isTypingReply?: boolean;
  liveThought?: string;
  score: number;
  streak: number;
  onScoreChange: (nextScore: number, nextStreak: number) => void;
  onReset: () => void;
  onClose?: () => void;
}

const calcTargetWidth = (s: number) => {
  const step = s % 10; // 0..9, resets every 10
  return Math.max(0.09, 0.22 - step * 0.014);
};

const randomTargetLeft = (width: number) => {
  const minLeft = 0.08;
  const maxLeft = Math.max(minLeft + 0.05, 0.92 - width);
  return minLeft + Math.random() * (maxLeft - minLeft);
};

/**
 * Input-docked Neko Pet + Randomized Timing Fidget + Collapsible Thinking Window:
 * - Fades gently while reply text is actively printing
 * - Randomized highlight position, shrinking each hit and resetting every 10
 * - 4-frame pixel Neko companion you can pet, giving a real Paw High-Five every 10 streak
 */
export const InlineWaitFidget: React.FC<InlineWaitFidgetProps> = ({
  charName,
  isWaiting,
  isTypingReply = false,
  liveThought,
  score,
  streak,
  onScoreChange,
  onReset,
  onClose,
}) => {
  const [showThought, setShowThought] = useState(false);
  const [hitLabel, setHitLabel] = useState<string | null>(null);
  const [nekoMood, setNekoMood] = useState<NekoMood>('idle');
  const [targetWidth, setTargetWidth] = useState<number>(() => calcTargetWidth(streak));
  const [targetLeft, setTargetLeft] = useState<number>(() => randomTargetLeft(calcTargetWidth(streak)));

  const pulseAnim = useRef(new Animated.Value(0.45)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const enterOpacity = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;
  const sparkAnim = useRef(new Animated.Value(0)).current;
  const sparkValRef = useRef(0);
  const hitOpacity = useRef(new Animated.Value(0)).current;
  const moodTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smooth slide-up + fade-in entrance
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(enterOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, enterOpacity]);

  const handleAnimatedClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 28,
        duration: 190,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(enterOpacity, {
        toValue: 0,
        duration: 190,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose?.();
    });
  };

  const setTempMood = (next: NekoMood, durationMs: number) => {
    if (moodTimerRef.current) clearTimeout(moodTimerRef.current);
    setNekoMood(next);
    moodTimerRef.current = setTimeout(() => setNekoMood('idle'), durationMs);
  };

  useEffect(() => {
    return () => {
      if (moodTimerRef.current) clearTimeout(moodTimerRef.current);
    };
  }, []);

  // Fade gently when AI is actively printing/revealing reply text
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isTypingReply ? 0.45 : 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [isTypingReply, fadeAnim]);

  // Writing... dot pulse
  useEffect(() => {
    if (!isWaiting) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isWaiting, pulseAnim]);

  // Continuous 1-thumb timing spark oscillation (0 -> 1 -> 0)
  useEffect(() => {
    const listenerId = sparkAnim.addListener(({ value }) => {
      sparkValRef.current = value;
    });
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(sparkAnim, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => {
      sparkAnim.removeListener(listenerId);
      loop.stop();
    };
  }, [sparkAnim]);

  const triggerHitFeedback = (label: string) => {
    setHitLabel(label);
    hitOpacity.setValue(1);
    Animated.timing(hitOpacity, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };

  const handlePetNeko = () => {
    onScoreChange(score + 1, streak);
    setTempMood('happy', 650);
    triggerHitFeedback('PURR +1');
  };

  const handleFidgetTap = () => {
    const pos = sparkValRef.current;
    const tolerance = 0.02;
    const isPerfect = pos >= targetLeft - tolerance && pos <= targetLeft + targetWidth + tolerance;
    const nextStreak = isPerfect ? streak + 1 : 0;
    const isHiFive = isPerfect && nextStreak > 0 && nextStreak % 10 === 0;
    const pts = isHiFive ? 5 : isPerfect ? 2 : 1;

    onScoreChange(score + pts, nextStreak);

    if (isHiFive) {
      setTempMood('hifive', 1100);
      triggerHitFeedback('🐾 HI-FIVE +5!');
    } else if (isPerfect) {
      setTempMood('happy', 650);
      triggerHitFeedback('NICE +2!');
    } else {
      triggerHitFeedback('+1');
    }

    // Randomize highlight position and shrink width (resets every 10)
    const nextW = calcTargetWidth(nextStreak);
    setTargetWidth(nextW);
    setTargetLeft(randomTargetLeft(nextW));
  };

  const sparkLeft = sparkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['3%', '92%'],
  });

  const isHiFiveReady = streak > 0 && streak % 10 === 9;
  const showPawOnTarget = isHiFiveReady || nekoMood === 'hifive';

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: Animated.multiply(enterOpacity, fadeAnim),
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Top Row: Writing... (only while waiting) or Score Badge + Thinking / Reset / Close */}
      <View style={styles.topRow}>
        <View style={styles.statusLeft}>
          {isWaiting ? (
            <>
              <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
              <Text style={styles.writingText} numberOfLines={1}>
                Writing...
              </Text>
            </>
          ) : (
            <View style={styles.scorePill}>
              <Text style={styles.scoreText}>
                🐾 {score}{streak >= 1 ? ` • 🔥${streak}` : ''}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.topActions}>
          {isWaiting && (
            <View style={styles.scorePill}>
              <Text style={styles.scoreText}>
                🐾 {score}{streak >= 1 ? ` • 🔥${streak}` : ''}
              </Text>
            </View>
          )}

          {(isWaiting || Boolean(liveThought && liveThought.trim())) && (
            <TouchableOpacity
              style={[styles.thoughtToggleBtn, showThought && styles.thoughtToggleBtnActive]}
              onPress={() => setShowThought(prev => !prev)}
              activeOpacity={0.8}
            >
              <Brain size={11} color={showThought ? '#000000' : '#d4ff00'} />
              <Text style={[styles.thoughtToggleText, showThought && styles.thoughtToggleTextActive]}>
                Thinking
              </Text>
              <ChevronDown
                size={11}
                color={showThought ? '#000000' : '#9ca3af'}
                style={{ transform: [{ rotate: showThought ? '180deg' : '0deg' }] }}
              />
            </TouchableOpacity>
          )}

          {score > 0 && (
            <TouchableOpacity
              style={styles.iconActionBtn}
              onPress={() => {
                onReset();
                const resetW = calcTargetWidth(0);
                setTargetWidth(resetW);
                setTargetLeft(randomTargetLeft(resetW));
              }}
              activeOpacity={0.8}
              accessibilityLabel="Reset fidget score"
            >
              <RotateCcw size={12} color="#9ca3af" />
            </TouchableOpacity>
          )}

          {!isWaiting && onClose && (
            <TouchableOpacity
              style={styles.iconActionBtn}
              onPress={handleAnimatedClose}
              activeOpacity={0.8}
              accessibilityLabel="Close fidget"
            >
              <X size={13} color="#e2e8f0" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Collapsible Thinking Process Window */}
      {showThought && (
        <View style={styles.thoughtWindow}>
          <ScrollView style={{ maxHeight: 88 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <Text style={styles.thoughtWindowText}>
              {liveThought && liveThought.trim().length > 0
                ? liveThought.trim()
                : `${charName} is composing the next scene in character... (Live reasoning appears here when supported by the active model)`}
            </Text>
          </ScrollView>
        </View>
      )}

      {/* Main Pet + Timing Bar Row */}
      <View style={styles.petAndBarRow}>
        <NekoPetSprite mood={nekoMood} size={52} onPet={handlePetNeko} />

        <TouchableOpacity
          style={styles.fidgetBox}
          onPress={handleFidgetTap}
          activeOpacity={0.85}
        >
          <View style={styles.fidgetHeader}>
            <Text style={styles.fidgetTitle} numberOfLines={1}>
              {isHiFiveReady ? '🐾 High-five the paw!' : 'Tap on lime zone'}
            </Text>
            {hitLabel ? (
              <Animated.Text
                style={[
                  styles.hitBadge,
                  (hitLabel.includes('NICE') || hitLabel.includes('HI-FIVE')) && styles.hitBadgePerfect,
                  { opacity: hitOpacity },
                ]}
              >
                {hitLabel}
              </Animated.Text>
            ) : null}
          </View>

          <View style={styles.track}>
            <View
              style={[
                styles.sweetSpot,
                {
                  left: `${Math.round(targetLeft * 100)}%`,
                  width: `${Math.round(targetWidth * 100)}%`,
                },
                showPawOnTarget && styles.sweetSpotHiFive,
              ]}
            >
              {showPawOnTarget && (
                <PawPrint size={11} color="#000000" />
              )}
            </View>
            <Animated.View style={[styles.spark, { left: sparkLeft }]} />
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 10,
    marginBottom: 6,
    backgroundColor: GLASS.bgElevated,
    borderWidth: 1,
    borderColor: GLASS.borderBright,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    ...GLASS.backdropStrong,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconActionBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d4ff00',
  },
  writingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: 0.2,
  },
  thoughtToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 9,
    backgroundColor: 'rgba(212, 255, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.25)',
  },
  thoughtToggleBtnActive: {
    backgroundColor: '#d4ff00',
    borderColor: '#d4ff00',
  },
  thoughtToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#d4ff00',
  },
  thoughtToggleTextActive: {
    color: '#000000',
  },
  thoughtWindow: {
    backgroundColor: 'rgba(6, 8, 14, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    padding: 8,
  },
  thoughtWindowText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  petAndBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fidgetBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 7,
  },
  fidgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  fidgetTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#cbd5e1',
    flex: 1,
  },
  hitBadge: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#e2e8f0',
  },
  hitBadgePerfect: {
    color: '#d4ff00',
  },
  scorePill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 255, 0, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.28)',
  },
  scoreText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#d4ff00',
  },
  track: {
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
  },
  sweetSpot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(212, 255, 0, 0.3)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(212, 255, 0, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sweetSpotHiFive: {
    backgroundColor: '#d4ff00',
  },
  spark: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#d4ff00',
    top: 1,
    shadowColor: '#d4ff00',
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
});
