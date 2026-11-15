/**
 * Minimalist Floating Navigation Dock
 * Styled strictly after Warden AI:
 * Pure monochrome white icons (#FFFFFF), clean labels, smooth sliding active indicator.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageSquare, Compass, User, Settings } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

export type TabScreen = 'chats' | 'discover' | 'studio' | 'settings';

const TAB_ITEMS: { key: TabScreen; label: string; Icon: React.ComponentType<any> }[] = [
  { key: 'chats', label: 'Chats', Icon: MessageSquare },
  { key: 'discover', label: 'Discover', Icon: Compass },
  { key: 'studio', label: 'Studio', Icon: User },
  { key: 'settings', label: 'Settings', Icon: Settings },
];

const ITEM_WIDTH = 70;
const ITEM_MARGIN = 2;
const STEP_WIDTH = ITEM_WIDTH + ITEM_MARGIN * 2;

interface CapsuleDockProps {
  activeTab: TabScreen;
  onTabChange: (tab: TabScreen) => void;
  blurTargetRef?: React.RefObject<React.ComponentRef<typeof View> | null>;
}

export const CapsuleDock: React.FC<CapsuleDockProps> = ({ activeTab, onTabChange, blurTargetRef }) => {
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const activeIdx = Math.max(0, TAB_ITEMS.findIndex(t => t.key === activeTab));
  const [slideAnim] = useState(() => new Animated.Value(activeIdx * STEP_WIDTH));
  const [scaleAnims] = useState(() => TAB_ITEMS.map((_, i) => new Animated.Value(i === activeIdx ? 1.08 : 1)));

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeIdx * STEP_WIDTH,
      useNativeDriver: true,
      friction: 8,
      tension: 110,
    }).start();

    TAB_ITEMS.forEach((_, idx) => {
      Animated.spring(scaleAnims[idx], {
        toValue: idx === activeIdx ? 1.08 : 1,
        useNativeDriver: true,
        friction: 6,
        tension: 140,
      }).start();
    });
  }, [activeIdx]);

  return (
    <View
      style={[
        styles.dockContainer,
        { bottom: Math.max(Platform.OS === 'ios' ? 24 : 16, insets.bottom + 8) },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.dockCapsule,
          {
            backgroundColor: 'rgba(14, 17, 26, 0.46)',
            borderColor: `rgba(${palette.accentRgb}, 0.25)`,
          },
          Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(20px) saturate(160%)',
                WebkitBackdropFilter: 'blur(20px) saturate(160%)',
              } as any)
            : {},
        ]}
      >
        {Platform.OS !== 'web' && (
          <BlurView
            intensity={48}
            tint="dark"
            blurMethod="dimezisBlurView"
            blurTarget={blurTargetRef}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}
        {/* Frosted Glass Diagonal Sheen & Rim Highlight */}
        <LinearGradient
          pointerEvents="none"
          colors={[
            'rgba(255, 255, 255, 0.16)',
            'rgba(255, 255, 255, 0.03)',
            'rgba(255, 255, 255, 0.08)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.topSpecularRim} />

        {/* Animated Sliding Active Pill */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.slidingPill,
            {
              backgroundColor: `rgba(${palette.accentRgb}, 0.15)`,
              borderColor: `rgba(${palette.accentRgb}, 0.40)`,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        />

        {TAB_ITEMS.map(({ key, label, Icon }, idx) => {
          const isActive = activeTab === key;
          return (
            <TouchableOpacity
              key={key}
              style={styles.dockItem}
              onPress={() => onTabChange(key)}
              activeOpacity={0.8}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnims[idx] }], alignItems: 'center' }}>
                <Icon
                  size={19}
                  color={isActive ? palette.accent : '#FFFFFF'}
                  style={{ opacity: isActive ? 1 : 0.45 }}
                />
                <Text style={[isActive ? styles.dockLabelActive : styles.dockLabelInactive, isActive && { color: palette.accent }]}>
                  {label}
                </Text>
                <View style={[styles.activeDot, { backgroundColor: palette.accent, opacity: isActive ? 1 : 0 }]} />
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dockContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99,
  },
  dockCapsule: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'web' ? 'rgba(18, 22, 34, 0.48)' : 'rgba(18, 22, 34, 0.72)',
    borderRadius: 32,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 14,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        } as any)
      : {}),
  },
  topSpecularRim: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
  },
  slidingPill: {
    position: 'absolute',
    left: 8 + ITEM_MARGIN,
    top: 6,
    bottom: 6,
    width: ITEM_WIDTH,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25)',
        } as any)
      : {}),
  },
  dockItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: ITEM_WIDTH,
    paddingVertical: 6,
    borderRadius: 22,
    marginHorizontal: ITEM_MARGIN,
  },
  dockLabelActive: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  dockLabelInactive: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  activeDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
});
