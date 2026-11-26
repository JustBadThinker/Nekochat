import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, Delete } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { getScreenBg } from '../theme/skins';
import { runEnterAnimation } from '../theme/animations';
import {
  computeLockoutMs,
  PASSCODE_MAX_ATTEMPTS,
  verifyPasscode,
} from '../services/passcodeService';
import { NekoLogoSvg } from './NekoLogoSvg';

interface PasscodeGateProps {
  expectedPin: string;
  onUnlock: () => void;
}

export const PasscodeGate: React.FC<PasscodeGateProps> = ({ expectedPin, onUnlock }) => {
  const { palette, skin } = useTheme();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntilMs, setLockoutUntilMs] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);

  const enterAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    runEnterAnimation(enterAnim, skin.animation);
  }, [enterAnim, skin.animation]);

  useEffect(() => {
    if (lockoutUntilMs <= Date.now()) {
      setRemainingSec(0);
      return;
    }
    const updateRemaining = () => {
      const left = Math.max(0, Math.ceil((lockoutUntilMs - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) {
        setLockoutUntilMs(0);
        setErrorMsg('');
      }
    };
    updateRemaining();
    const timer = setInterval(updateRemaining, 500);
    return () => clearInterval(timer);
  }, [lockoutUntilMs]);

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 55, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 55, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]).start();
  };

  const handleDigit = (digit: string) => {
    if (remainingSec > 0 || pin.length >= 4) return;
    setErrorMsg('');
    const next = pin + digit;
    setPin(next);

    if (next.length === 4) {
      if (verifyPasscode(next, expectedPin)) {
        setFailedAttempts(0);
        setLockoutUntilMs(0);
        setRemainingSec(0);
        Animated.timing(enterAnim, {
          toValue: 0,
          duration: 220,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }).start(() => onUnlock());
      } else {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        triggerShake();
        const lockMs = computeLockoutMs(nextAttempts);
        if (lockMs > 0) {
          const until = Date.now() + lockMs;
          const sec = Math.ceil(lockMs / 1000);
          setLockoutUntilMs(until);
          setRemainingSec(sec);
          setErrorMsg(`Too many attempts. Try again in ${sec}s`);
        } else {
          const leftBeforeCooldown = PASSCODE_MAX_ATTEMPTS - nextAttempts;
          setErrorMsg(
            leftBeforeCooldown <= 2
              ? `Incorrect passcode (${leftBeforeCooldown} left before cooldown)`
              : 'Incorrect passcode'
          );
        }
        setTimeout(() => setPin(''), 240);
      }
    }
  };

  const handleBackspace = () => {
    if (remainingSec > 0 || pin.length === 0) return;
    setErrorMsg('');
    setPin(prev => prev.slice(0, -1));
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: getScreenBg(palette, skin) }]}>
      <Animated.View
        style={[
          styles.inner,
          {
            opacity: enterAnim,
            transform: [
              {
                translateY: enterAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
            ],
          },
        ]}
      >
        <NekoLogoSvg size={44} color={palette.accent} />
        <View style={[styles.lockBadge, { backgroundColor: `rgba(${palette.accentRgb}, 0.14)`, borderColor: `rgba(${palette.accentRgb}, 0.35)` }]}>
          <Lock size={14} color={palette.accent} />
          <Text style={[styles.lockBadgeText, { color: palette.accent }]}>NekoChat Locked</Text>
        </View>

        <Text style={styles.title}>Enter Passcode</Text>
        <Text style={styles.subtitle}>Unlock your private roleplay sessions</Text>

        {/* 4 PIN Dots */}
        <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          {[0, 1, 2, 3].map(idx => {
            const filled = idx < pin.length;
            return (
              <View
                key={idx}
                style={[
                  styles.dot,
                  filled && {
                    backgroundColor: palette.accent,
                    borderColor: palette.accent,
                    transform: [{ scale: 1.12 }],
                  },
                ]}
              />
            );
          })}
        </Animated.View>

        <Text style={styles.errorText}>
          {remainingSec > 0 ? `Too many attempts. Try again in ${remainingSec}s` : errorMsg || ' '}
        </Text>

        {/* Numeric Keypad */}
        <View style={styles.keypadGrid}>
          {keys.map((k, idx) => {
            if (k === '') {
              return <View key={`empty-${idx}`} style={styles.keyEmpty} />;
            }
            if (k === 'del') {
              return (
                <TouchableOpacity
                  key="del"
                  style={[styles.keyBtn, remainingSec > 0 && { opacity: 0.4 }]}
                  onPress={handleBackspace}
                  disabled={remainingSec > 0}
                  activeOpacity={0.7}
                  accessibilityLabel="Delete digit"
                >
                  <Delete size={20} color="#cbd5e1" />
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                key={k}
                style={[styles.keyBtn, remainingSec > 0 && { opacity: 0.4 }]}
                onPress={() => handleDigit(k)}
                disabled={remainingSec > 0}
                activeOpacity={0.7}
              >
                <Text style={styles.keyText}>{k}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 14,
    marginBottom: 12,
  },
  lockBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  title: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'transparent',
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
    height: 18,
    marginBottom: 14,
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    width: 264,
  },
  keyBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: {
    width: 72,
    height: 72,
  },
  keyText: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '700',
  },
});
