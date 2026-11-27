/**
 * Minimalist Floating Navigation Dock
 * Styled strictly after Warden AI:
 * Pure monochrome white icons (#FFFFFF), clean labels, smooth sliding active indicator.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeBlurView } from './SafeBlurView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageSquare, Compass, User, Settings } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { getM3TonalContainer } from '../theme/skins';
import { runDockIconScale, runDockSlideAnimation } from '../theme/animations';
import { useTranslation } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';

export type TabScreen = 'chats' | 'discover' | 'studio' | 'settings';

const TAB_ITEMS: { key: TabScreen; labelKey: TranslationKey; Icon: React.ComponentType<any> }[] = [
  { key: 'chats', labelKey: 'nav.chats', Icon: MessageSquare },
  { key: 'discover', labelKey: 'nav.discover', Icon: Compass },
  { key: 'studio', labelKey: 'nav.studio', Icon: User },
  { key: 'settings', labelKey: 'nav.settings', Icon: Settings },
];

const ITEM_WIDTH = 70;
const ITEM_MARGIN = 2;
const STEP_WIDTH = ITEM_WIDTH + ITEM_MARGIN * 2;

interface CapsuleDockProps {
  activeTab: TabScreen;
  onTabChange: (tab: TabScreen) => void;
  blurTargetRef?: React.RefObject<React.ComponentRef<typeof View> | null>;
  visible?: boolean;
}

export const CapsuleDock: React.FC<CapsuleDockProps> = ({
  activeTab,
  onTabChange,
  blurTargetRef,
  visible = true,
}) => {
  const insets = useSafeAreaInsets();
  const { palette, skin } = useTheme();
  const { t } = useTranslation();
  const activeIdx = Math.max(0, TAB_ITEMS.findIndex(t => t.key === activeTab));
  const [slideAnim] = useState(() => new Animated.Value(activeIdx * STEP_WIDTH));
  const [scaleAnims] = useState(() => TAB_ITEMS.map((_, i) => new Animated.Value(i === activeIdx ? 1.08 : 1)));
  const [m3PillAnims] = useState(() => TAB_ITEMS.map((_, i) => new Animated.Value(i === activeIdx ? 1 : 0)));
  const [dockVisibilityAnim] = useState(() => new Animated.Value(visible ? 1 : 0));

  useEffect(() => {
    Animated.timing(dockVisibilityAnim, {
      toValue: visible ? 1 : 0,
      duration: visible
        ? Math.max(300, skin.animation.enterDuration)
        : Math.max(240, Math.round(skin.animation.enterDuration * 0.85)),
      easing: skin.animation.easing,
      useNativeDriver: true,
    }).start();
  }, [visible, dockVisibilityAnim, skin.animation]);

  // Keep opacity at 1 so CSS backdrop-filter / native BlurView never drops its
  // frosted blur mid-transition; slide cleanly via translateY only.
  const dockAnimatedStyle = {
    transform: [
      {
        translateY: dockVisibilityAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [130, 0],
        }),
      },
    ],
  };

  useEffect(() => {
    runDockSlideAnimation(slideAnim, activeIdx * STEP_WIDTH, skin.animation);

    TAB_ITEMS.forEach((_, idx) => {
      runDockIconScale(scaleAnims[idx], idx === activeIdx, skin.animation);
      Animated.spring(m3PillAnims[idx], {
        toValue: idx === activeIdx ? 1 : 0,
        useNativeDriver: true,
        friction: 6.5,
        tension: 150,
      }).start();
    });
  }, [activeIdx, skin.animation, slideAnim, scaleAnims, m3PillAnims]);

  if (skin.navBarStyle === 'm3_nav_bar') {
    return (
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          styles.dockedBarContainer,
          dockAnimatedStyle,
          {
            backgroundColor: getM3TonalContainer(palette, 'container'),
            borderTopWidth: 0,
            paddingBottom: Math.max(10, insets.bottom),
            paddingTop: 10,
          },
        ]}
      >
        {TAB_ITEMS.map(({ key, labelKey, Icon }, idx) => {
          const isActive = activeTab === key;
          return (
            <TouchableOpacity
              key={key}
              style={styles.dockedTabItem}
              onPress={() => onTabChange(key)}
              activeOpacity={0.85}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnims[idx] }], alignItems: 'center' }}>
                <View style={styles.m3ActivePill}>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        borderRadius: 16,
                        backgroundColor: `rgba(${palette.accentRgb}, 0.24)`,
                        opacity: m3PillAnims[idx],
                        transform: [
                          {
                            scaleX: m3PillAnims[idx].interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.35, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                  <Icon
                    size={20}
                    color={isActive ? palette.accent : '#cbd5e1'}
                    style={{ opacity: isActive ? 1 : 0.72 }}
                  />
                </View>
                <Text
                  style={[
                    styles.m3Label,
                    {
                      fontSize: 11.5,
                      letterSpacing: 0.2,
                      color: isActive ? '#FFFFFF' : '#94a3b8',
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}
                >
                  {t(labelKey)}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    );
  }

  if (skin.navBarStyle === 'classic_bar') {
    return (
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          styles.dockedBarContainer,
          dockAnimatedStyle,
          {
            backgroundColor: '#181818',
            borderTopWidth: 1,
            borderTopColor: 'rgba(255, 255, 255, 0.08)',
            paddingBottom: Math.max(8, insets.bottom),
            paddingTop: 8,
          },
        ]}
      >
        {TAB_ITEMS.map(({ key, labelKey, Icon }, idx) => {
          const isActive = activeTab === key;
          return (
            <TouchableOpacity
              key={key}
              style={styles.dockedTabItem}
              onPress={() => onTabChange(key)}
              activeOpacity={0.8}
            >
              <Animated.View style={{ transform: [{ scale: scaleAnims[idx] }], alignItems: 'center' }}>
                <View
                  style={[
                    styles.classicActivePill,
                    isActive && {
                      backgroundColor: `rgba(${palette.accentRgb}, 0.16)`,
                      borderColor: `rgba(${palette.accentRgb}, 0.35)`,
                    },
                  ]}
                >
                  <Icon
                    size={19}
                    color={isActive ? palette.accent : '#9ca3af'}
                  />
                </View>
                <Text
                  style={[
                    styles.classicLabel,
                    { color: isActive ? '#f3f4f6' : '#9ca3af', fontWeight: isActive ? '700' : '500' },
                  ]}
                >
                  {t(labelKey)}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    );
  }

  if (skin.navBarStyle === 'ios_tab_bar') {
    return (
      <Animated.View
        style={[
          styles.dockContainer,
          dockAnimatedStyle,
          { bottom: Math.max(Platform.OS === 'ios' ? 20 : 14, insets.bottom + 8) },
        ]}
        pointerEvents={visible ? 'box-none' : 'none'}
      >
        <View
          style={{
            padding: 1,
            borderRadius: 35,
            backgroundColor: 'rgba(0, 0, 0, 0.44)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 14 },
            shadowOpacity: 0.65,
            shadowRadius: 26,
            elevation: 18,
          }}
        >
          <View
            style={[
              styles.dockCapsule,
              {
                borderRadius: 34,
                backgroundColor:
                  Platform.OS === 'web' ? 'rgba(18, 20, 30, 0.38)' : 'rgba(18, 20, 30, 0.14)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.28)',
                borderTopColor: 'rgba(255, 255, 255, 0.62)',
                borderBottomColor: 'rgba(255, 255, 255, 0.14)',
                elevation: 0,
                shadowOpacity: 0,
                ...(Platform.OS === 'web'
                  ? ({ backdropFilter: 'blur(26px) saturate(190%)' } as any)
                  : null),
              },
            ]}
          >
            {Platform.OS !== 'web' && (
              <SafeBlurView
                intensity={Platform.OS === 'android' ? 75 : 60}
                blurReductionFactor={3}
                tint="systemUltraThinMaterialDark"
                blurMethod="dimezisBlurViewSdk31Plus"
                blurTarget={blurTargetRef}
                style={[StyleSheet.absoluteFill, { borderRadius: 34 }]}
                pointerEvents="none"
              />
            )}

            <LinearGradient
              pointerEvents="none"
              colors={[
                'rgba(255, 255, 255, 0.22)',
                'rgba(255, 255, 255, 0.02)',
                'rgba(255, 255, 255, 0.10)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View
              pointerEvents="none"
              style={[
                styles.topSpecularRim,
                { height: 1.5, backgroundColor: 'rgba(255, 255, 255, 0.50)' },
              ]}
            />

            {/* Sliding Liquid Glass Lens Indicator */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.slidingPill,
                {
                  borderRadius: 26,
                  backgroundColor: 'rgba(255, 255, 255, 0.20)',
                  borderColor: 'rgba(255, 255, 255, 0.28)',
                  borderTopColor: 'rgba(255, 255, 255, 0.68)',
                  borderBottomColor: 'rgba(0, 0, 0, 0.22)',
                  transform: [{ translateX: slideAnim }],
                },
              ]}
            />

            {TAB_ITEMS.map(({ key, labelKey, Icon }, idx) => {
              const isActive = activeTab === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.dockItem}
                  onPress={() => onTabChange(key)}
                  activeOpacity={0.75}
                >
                  <Animated.View style={{ transform: [{ scale: scaleAnims[idx] }], alignItems: 'center' }}>
                    <Icon
                      size={21}
                      color={isActive ? palette.accent : 'rgba(255, 255, 255, 0.65)'}
                    />
                    <Text
                      style={[
                        styles.iosLabel,
                        {
                          color: isActive ? palette.accent : 'rgba(255, 255, 255, 0.65)',
                          fontWeight: isActive ? '600' : '500',
                        },
                      ]}
                    >
                      {t(labelKey)}
                    </Text>
                  </Animated.View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.dockContainer,
        dockAnimatedStyle,
        { bottom: Math.max(Platform.OS === 'ios' ? 24 : 16, insets.bottom + 8) },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View
        style={[
          styles.dockCapsule,
          {
            backgroundColor: skin.surfaceMode === 'tonal' ? palette.bgSurfaceSubtle : 'rgba(14, 17, 26, 0.88)',
            borderColor: `rgba(${palette.accentRgb}, 0.25)`,
            borderRadius: skin.dockRadius,
            borderWidth: skin.dockBorderWidth,
          },
          skin.id === 'bento' && {
            backgroundColor:
              Platform.OS === 'web' ? 'rgba(18, 22, 34, 0.56)' : 'rgba(18, 22, 34, 0.22)',
            borderWidth: 1.25,
            borderColor: `rgba(${palette.accentRgb}, 0.30)`,
            borderBottomWidth: 3.5,
            borderBottomColor: 'rgba(0, 0, 0, 0.65)',
            ...(Platform.OS === 'web'
              ? ({ backdropFilter: 'blur(22px) saturate(170%)' } as any)
              : null),
          },
        ]}
      >
        {skin.id === 'bento' && Platform.OS !== 'web' && (
          <SafeBlurView
            intensity={Platform.OS === 'android' ? 75 : 55}
            blurReductionFactor={3}
            tint="systemUltraThinMaterialDark"
            blurMethod="dimezisBlurViewSdk31Plus"
            blurTarget={blurTargetRef}
            style={[StyleSheet.absoluteFill, { borderRadius: skin.dockRadius }]}
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
            skin.id === 'bento' && {
              borderRadius: 22,
              borderBottomWidth: 2.5,
              borderBottomColor: `rgba(${palette.accentRgb}, 0.55)`,
            },
          ]}
        />

        {TAB_ITEMS.map(({ key, labelKey, Icon }, idx) => {
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
                  {t(labelKey)}
                </Text>
                <View style={[styles.activeDot, { backgroundColor: palette.accent, opacity: isActive ? 1 : 0 }]} />
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
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
  dockedBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    overflow: 'hidden',
    zIndex: 99,
  },
  dockedTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  m3ActivePill: {
    width: 64,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  m3Label: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  classicActivePill: {
    width: 44,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  classicLabel: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
  iosLabel: {
    fontSize: 10,
    marginTop: 3,
  },
  activeDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
});
