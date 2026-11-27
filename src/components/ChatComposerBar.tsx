/**
 * ChatComposerBar — Isolated bottom message composer & Action Deck for ChatRoomScreen.
 * Holds draft `inputText`, expand state, and action-deck state locally so keystrokes
 * do not re-render the entire chat message list.
 */

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeBlurView } from './SafeBlurView';
import {
  ChevronDown,
  Edit2,
  Image as ImageIcon,
  Maximize2,
  MessageCircle,
  Minimize2,
  Plus,
  Send,
  Sparkles,
  Square,
  Users,
} from 'lucide-react-native';
import type { DynamicCastMember, Persona } from '../types';
import type { CastCandidateSuggestion } from '../services/dynamicCastService';
import type { ThemePalette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { getCardSurfaceStyle, getM3TonalContainer, getSurfaceBg, UiSkinTokens } from '../theme/skins';
import { GLASS } from '../theme/glassTheme';
import { runToggleAnimation } from '../theme/animations';
import { DeskNekoWalker } from './DeskNekoWalker';

export interface ChatComposerBarHandle {
  setText: (text: string) => void;
  closeActionDeck: () => void;
}

interface ChatComposerBarProps {
  persona: Persona;
  blurTargetRef?: React.RefObject<React.ComponentRef<typeof View> | null>;
  isStreaming: boolean;
  isRefining: boolean;
  refineMode: 'refine' | 'write';
  fidgetOpen: boolean;
  activeImageProvider: string;
  castMembers: DynamicCastMember[];
  castCandidate: CastCandidateSuggestion | null;
  onSend: (text: string) => void;
  onStopStreaming: () => void;
  onRefine: (mode: 'refine' | 'write', draftText: string) => void;
  onOpenFidget: () => void;
  onNekoGrabChange?: (grabbed: boolean) => void;
  onOpenSceneDepict: () => void;
  onOpenCastSheet: (candidateName?: string) => void;
  onOpenPersonaModal: () => void;
}

export const ChatComposerBar = React.memo(
  forwardRef<ChatComposerBarHandle, ChatComposerBarProps>(function ChatComposerBarInner(
    {
      persona,
      blurTargetRef,
      isStreaming,
      isRefining,
      refineMode,
      fidgetOpen,
      activeImageProvider,
      castMembers,
      castCandidate,
      onSend,
      onStopStreaming,
      onRefine,
      onOpenFidget,
      onNekoGrabChange,
      onOpenSceneDepict,
      onOpenCastSheet,
      onOpenPersonaModal,
    },
    ref
  ) {
    const { palette, skin } = useTheme();
    const isIosGlass = skin.id === 'ios';
    const isM3 = skin.id === 'material';
    const isNekoBento = skin.id === 'bento';
    const isJanitor = skin.id === 'janitor';
    const styles = useMemo(() => createStyles(palette, skin), [palette, skin]);

    const [inputText, setInputText] = useState('');
    const [composerWidth, setComposerWidth] = useState(340);
    const [showActionDeck, setShowActionDeck] = useState(false);
    const actionDeckAnim = useRef(new Animated.Value(0)).current;
    const [isInputExpanded, setIsInputExpanded] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [composerInputHeight, setComposerInputHeight] = useState(34);
    const composerInputRef = useRef<any>(null);
    const composerExpandAnim = useRef(new Animated.Value(0)).current;
    const janitorMergeAnim = useRef(new Animated.Value(0)).current;
    const bentoDockAnim = useRef(new Animated.Value(0)).current;
    const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isJanitorMerged =
      isJanitor &&
      (isInputFocused || showActionDeck || isInputExpanded || inputText.trim().length > 0);

    const isBentoActive =
      isNekoBento &&
      (isInputFocused || showActionDeck || isInputExpanded || inputText.trim().length > 0);

    const janitorSeparateOpacity = janitorMergeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    const scheduleComposerBlur = () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      blurTimerRef.current = setTimeout(() => {
        setIsInputFocused(false);
        blurTimerRef.current = null;
      }, 220);
    };

    const cancelComposerBlur = () => {
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }
    };

    useEffect(() => {
      return () => {
        if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      };
    }, []);

    useEffect(() => {
      if (!isJanitor) return;
      Animated.timing(janitorMergeAnim, {
        toValue: isJanitorMerged ? 1 : 0,
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, [isJanitor, isJanitorMerged, janitorMergeAnim]);

    useEffect(() => {
      if (!isNekoBento) return;
      Animated.timing(bentoDockAnim, {
        toValue: isBentoActive ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, [isNekoBento, isBentoActive, bentoDockAnim]);

    useEffect(() => {
      if ((!isJanitor && !isNekoBento) || Platform.OS === 'web') return;
      const subHide = Keyboard.addListener('keyboardDidHide', () => {
        scheduleComposerBlur();
        composerInputRef.current?.blur?.();
      });
      return () => subHide.remove();
    }, [isJanitor, isNekoBento]);

    useImperativeHandle(
      ref,
      () => ({
        setText: (text: string) => setInputText(text),
        closeActionDeck: () => setShowActionDeck(false),
      }),
      []
    );

    useEffect(() => {
      runToggleAnimation(actionDeckAnim, showActionDeck, skin.animation);
    }, [showActionDeck, actionDeckAnim, skin.animation]);

    useEffect(() => {
      if (!inputText) {
        setComposerInputHeight(34);
        if (Platform.OS === 'web' && composerInputRef.current) {
          (composerInputRef.current as any).style.height = '100%';
        }
        return;
      }
      if (Platform.OS === 'web' && composerInputRef.current && !isInputExpanded) {
        const el = composerInputRef.current as any;
        requestAnimationFrame(() => {
          el.style.height = '34px';
          const nextH = Math.max(34, Math.min(200, el.scrollHeight));
          el.style.height = '100%';
          setComposerInputHeight(nextH);
        });
      }
    }, [inputText, isInputExpanded]);

    const handleToggleInputExpanded = () => {
      const nextExpanded = !isInputExpanded;
      setIsInputExpanded(nextExpanded);
      Animated.timing(composerExpandAnim, {
        toValue: nextExpanded ? 1 : 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    };

    const handlePressSend = () => {
      const text = inputText.trim();
      if (!text || isStreaming) return;
      setInputText('');
      setComposerInputHeight(34);
      if (Platform.OS === 'web' && composerInputRef.current) {
        (composerInputRef.current as any).style.height = '34px';
      }
      setShowActionDeck(false);
      onSend(text);
    };

    return (
      <View
        pointerEvents="box-none"
        style={{
          position: 'relative',
          zIndex: 30,
          marginTop: !fidgetOpen && !(isIosGlass || isJanitor) ? -39 : 0,
        }}
      >
        {!fidgetOpen && (
          <View
            pointerEvents="box-none"
            style={{
              height: 39,
              zIndex: 35,
              elevation: 35,
              overflow: 'visible',
            }}
          >
            <DeskNekoWalker
              containerWidth={composerWidth}
              isTypingUser={inputText.trim().length > 0}
              isAiWaiting={isStreaming}
              onPress={onOpenFidget}
              onGrabChange={onNekoGrabChange}
            />
          </View>
        )}

      <View
        style={[
          styles.composerWrapper,
          isIosGlass && { backgroundColor: 'transparent', borderTopWidth: 0 },
          isM3 && {
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            paddingTop: 4,
            paddingBottom: Platform.OS === 'ios' ? 14 : 10,
          },
          isNekoBento && {
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            paddingTop: 4,
            paddingBottom: Platform.OS === 'ios' ? 14 : 10,
          },
          isJanitor && {
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            paddingTop: 4,
            paddingBottom: Platform.OS === 'ios' ? 14 : 10,
          },
        ]}
        onLayout={e => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) setComposerWidth(w);
        }}
      >

        {/* Action Deck Popup Card (Inside + Button — Clean Floating Card) */}
        {showActionDeck && (
          <Animated.View
            style={[
              styles.actionDeck,
              getCardSurfaceStyle(palette, skin),
              isIosGlass && {
                overflow: 'hidden',
                borderRadius: 24,
                backgroundColor:
                  Platform.OS === 'web' ? 'rgba(18, 20, 30, 0.48)' : 'rgba(18, 20, 30, 0.42)',
                borderColor: 'rgba(255, 255, 255, 0.26)',
                borderTopColor: 'rgba(255, 255, 255, 0.56)',
                borderBottomColor: 'rgba(0, 0, 0, 0.35)',
                elevation: 16,
                ...(Platform.OS === 'web'
                  ? ({ backdropFilter: 'blur(26px) saturate(190%)' } as any)
                  : null),
              },
              isM3 && {
                borderRadius: 28,
                borderWidth: 0,
                backgroundColor: getM3TonalContainer(palette, 'high'),
              },
              isNekoBento && {
                borderRadius: 22,
                backgroundColor: palette.bgSurface,
                borderWidth: 1.25,
                borderColor: `rgba(${palette.accentRgb}, 0.25)`,
                borderBottomWidth: 3.5,
                borderBottomColor: 'rgba(0, 0, 0, 0.60)',
              },
              isJanitor && {
                overflow: 'hidden',
                borderRadius: 22,
                backgroundColor:
                  Platform.OS === 'web' ? 'rgba(24, 24, 28, 0.56)' : 'rgba(24, 24, 28, 0.48)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.16)',
                ...(Platform.OS === 'web'
                  ? ({ backdropFilter: 'blur(24px) saturate(160%)' } as any)
                  : null),
              },
              {
                opacity: actionDeckAnim,
                transform: [
                  {
                    translateY: actionDeckAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                  {
                    scale: actionDeckAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {(isIosGlass || isJanitor) && Platform.OS !== 'web' && (
              <SafeBlurView
                intensity={Platform.OS === 'android' ? 75 : 55}
                blurReductionFactor={3}
                tint="dark"
                blurMethod="dimezisBlurViewSdk31Plus"
                blurTarget={blurTargetRef}
                style={[StyleSheet.absoluteFill, { borderRadius: isJanitor ? 22 : 24 }]}
                pointerEvents="none"
              />
            )}
            {isIosGlass && (
              <>
                <LinearGradient
                  pointerEvents="none"
                  colors={[
                    'rgba(255, 255, 255, 0.18)',
                    'rgba(255, 255, 255, 0.02)',
                    'rgba(255, 255, 255, 0.08)',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 20,
                    right: 20,
                    height: 1,
                    backgroundColor: 'rgba(255, 255, 255, 0.44)',
                  }}
                />
              </>
            )}
            {/* Compact 5-Tile Quick Action Grid inside + */}
            <View style={styles.actionDeckGrid}>
              {/* 1. OOC */}
              <TouchableOpacity
                style={[
                  styles.actionGridTile,
                  isIosGlass && {
                    borderRadius: 16,
                    borderColor: 'rgba(255, 255, 255, 0.14)',
                    borderTopColor: 'rgba(255, 255, 255, 0.26)',
                  },
                  inputText.trim().toLowerCase().startsWith('[ooc]') && {
                    borderColor: `rgba(${palette.accentRgb}, 0.55)`,
                    backgroundColor: `rgba(${palette.accentRgb}, 0.1)`,
                  },
                ]}
                onPress={() => {
                  setInputText(prev =>
                    prev.trim().toLowerCase().startsWith('[ooc]')
                      ? prev.replace(/^\[ooc\]\s*/i, '')
                      : `[ooc] ${prev}`
                  );
                  setShowActionDeck(false);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.actionGridIconBox, { backgroundColor: `rgba(${palette.accentRgb}, 0.14)` }]}>
                  <MessageCircle size={16} color={palette.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionGridTitle}>OOC</Text>
                  <Text style={styles.actionGridSub} numberOfLines={1}>
                    {inputText.trim().toLowerCase().startsWith('[ooc]') ? 'Active in draft' : 'Note to AI'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* 2. Refine Text */}
              <TouchableOpacity
                style={[
                  styles.actionGridTile,
                  isIosGlass && {
                    borderRadius: 16,
                    borderColor: 'rgba(255, 255, 255, 0.14)',
                    borderTopColor: 'rgba(255, 255, 255, 0.26)',
                  },
                  (!inputText.trim() || isRefining) && { opacity: 0.55 },
                ]}
                onPress={() => {
                  setShowActionDeck(false);
                  onRefine('refine', inputText);
                }}
                disabled={!inputText.trim() || isRefining}
                activeOpacity={0.8}
              >
                <View style={[styles.actionGridIconBox, { backgroundColor: `rgba(${palette.accentRgb}, 0.14)` }]}>
                  <Sparkles size={16} color={palette.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionGridTitle}>
                    {isRefining && refineMode === 'refine' ? 'Refining...' : 'Refine Text'}
                  </Text>
                  <Text style={styles.actionGridSub} numberOfLines={1}>
                    {inputText.trim() ? 'Polish your draft' : 'Type draft first'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* 3. Write from Scratch */}
              <TouchableOpacity
                style={[
                  styles.actionGridTile,
                  isIosGlass && {
                    borderRadius: 16,
                    borderColor: 'rgba(255, 255, 255, 0.14)',
                    borderTopColor: 'rgba(255, 255, 255, 0.26)',
                  },
                  isRefining && { opacity: 0.55 },
                ]}
                onPress={() => {
                  setShowActionDeck(false);
                  onRefine('write', inputText);
                }}
                disabled={isRefining}
                activeOpacity={0.8}
              >
                <View style={[styles.actionGridIconBox, { backgroundColor: `rgba(${palette.accentRgb}, 0.14)` }]}>
                  <Edit2 size={15} color={palette.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionGridTitle}>
                    {isRefining && refineMode === 'write' ? 'Writing...' : 'Write from Scratch'}
                  </Text>
                  <Text style={styles.actionGridSub} numberOfLines={1}>Uses chat & memory</Text>
                </View>
              </TouchableOpacity>

              {/* 4. Image Generation */}
              <TouchableOpacity
                style={[
                  styles.actionGridTile,
                  isIosGlass && {
                    borderRadius: 16,
                    borderColor: 'rgba(255, 255, 255, 0.14)',
                    borderTopColor: 'rgba(255, 255, 255, 0.26)',
                  },
                ]}
                onPress={() => {
                  setShowActionDeck(false);
                  onOpenSceneDepict();
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.actionGridIconBox, { backgroundColor: `rgba(${palette.accentRgb}, 0.14)` }]}>
                  <ImageIcon size={16} color={palette.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionGridTitle}>Image Generation</Text>
                  <Text style={[styles.actionGridSub, { opacity: 0.72 }]} numberOfLines={1}>
                    {activeImageProvider ? `Provider: ${activeImageProvider}` : 'No provider set'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* 5. Dynamic Cast & Scene */}
              <TouchableOpacity
                style={[
                  styles.actionGridTile,
                  { width: '100%' },
                  isIosGlass && {
                    borderRadius: 16,
                    borderColor: 'rgba(255, 255, 255, 0.14)',
                    borderTopColor: 'rgba(255, 255, 255, 0.26)',
                  },
                  castCandidate && {
                    borderColor: `rgba(${palette.accentRgb}, 0.5)`,
                    backgroundColor: `rgba(${palette.accentRgb}, 0.08)`,
                  },
                ]}
                onPress={() => {
                  setShowActionDeck(false);
                  onOpenCastSheet(castCandidate?.name);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.actionGridIconBox, { backgroundColor: `rgba(${palette.accentRgb}, 0.14)` }]}>
                  <Users size={16} color={palette.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionGridTitle}>
                    {castCandidate ? `+ Add ${castCandidate.name} to Cast` : 'Dynamic Cast & Scene'}
                  </Text>
                  <Text style={styles.actionGridSub} numberOfLines={1}>
                    {castCandidate
                      ? 'Suggested from chat • Tap to add'
                      : castMembers.some(m => !m.isPrimary)
                        ? castMembers
                            .filter(m => !m.isPrimary)
                            .map(m => `${m.name} · ${m.presence.charAt(0).toUpperCase() + m.presence.slice(1)}`)
                            .join(', ')
                        : 'Manage cast presence & traits'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Unified Expandable Composer Container (or Janitor Liquid-Merge Floating Pills) */}
        {isJanitor ? (
          <Animated.View
            style={{
              marginHorizontal: 12,
              marginBottom: 4,
              borderRadius: 24,
              overflow: 'hidden',
              borderWidth: 1,
              backgroundColor: janitorMergeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [
                  'rgba(24, 24, 28, 0)',
                  Platform.OS === 'web' ? 'rgba(24, 24, 28, 0.56)' : 'rgba(24, 24, 28, 0.44)',
                ],
                extrapolate: 'clamp',
              }),
              borderColor: janitorMergeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.16)'],
                extrapolate: 'clamp',
              }),
              paddingHorizontal: janitorMergeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 10],
                extrapolate: 'clamp',
              }),
              paddingVertical: janitorMergeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 8],
                extrapolate: 'clamp',
              }),
              ...(Platform.OS === 'web' && isJanitorMerged
                ? ({ backdropFilter: 'blur(24px) saturate(160%)' } as any)
                : null),
            }}
          >
            {Platform.OS !== 'web' && (
              <Animated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { opacity: janitorMergeAnim }]}
              >
                <SafeBlurView
                  intensity={Platform.OS === 'android' ? 75 : 55}
                  blurReductionFactor={3}
                  tint="dark"
                  blurMethod="dimezisBlurViewSdk31Plus"
                  blurTarget={blurTargetRef}
                  style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
                  pointerEvents="none"
                />
              </Animated.View>
            )}

            {/* Row 1: Separate floating [+] [Message here...] [Send] pills that merge smoothly on focus */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <Animated.View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  overflow: 'hidden',
                  borderWidth: 1,
                  marginRight: janitorMergeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 6],
                    extrapolate: 'clamp',
                  }),
                  backgroundColor: showActionDeck
                    ? palette.accent
                    : janitorMergeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [
                          Platform.OS === 'web' ? 'rgba(24, 24, 28, 0.56)' : 'rgba(24, 24, 28, 0.44)',
                          'rgba(255, 255, 255, 0.08)',
                        ],
                        extrapolate: 'clamp',
                      }),
                  borderColor: janitorMergeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.08)'],
                    extrapolate: 'clamp',
                  }),
                  ...(Platform.OS === 'web' && !isJanitorMerged
                    ? ({ backdropFilter: 'blur(24px) saturate(160%)' } as any)
                    : null),
                }}
              >
                {Platform.OS !== 'web' && (
                  <Animated.View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, { opacity: janitorSeparateOpacity }]}
                  >
                    <SafeBlurView
                      intensity={Platform.OS === 'android' ? 75 : 55}
                      blurReductionFactor={3}
                      tint="dark"
                      blurMethod="dimezisBlurViewSdk31Plus"
                      blurTarget={blurTargetRef}
                      style={[StyleSheet.absoluteFill, { borderRadius: 21 }]}
                      pointerEvents="none"
                    />
                  </Animated.View>
                )}
                <TouchableOpacity
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPressIn={cancelComposerBlur}
                  onPress={() => {
                    setShowActionDeck(prev => !prev);
                  }}
                  activeOpacity={0.8}
                  accessibilityLabel="More chat tools"
                >
                  <Animated.View
                    style={{
                      transform: [
                        {
                          rotate: actionDeckAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '45deg'],
                          }),
                        },
                      ],
                    }}
                  >
                    <Plus size={18} color={showActionDeck ? palette.bgDark : palette.accent} />
                  </Animated.View>
                  {Boolean(castCandidate) && !showActionDeck && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: palette.accent,
                      }}
                    />
                  )}
                </TouchableOpacity>
              </Animated.View>

              <Animated.View
                style={{
                  flex: 1,
                  minHeight: 42,
                  borderRadius: 22,
                  overflow: 'hidden',
                  borderWidth: 1,
                  justifyContent: 'center',
                  backgroundColor: janitorMergeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [
                      Platform.OS === 'web' ? 'rgba(24, 24, 28, 0.56)' : 'rgba(24, 24, 28, 0.44)',
                      'rgba(24, 24, 28, 0)',
                    ],
                    extrapolate: 'clamp',
                  }),
                  borderColor: janitorMergeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0)'],
                    extrapolate: 'clamp',
                  }),
                  paddingHorizontal: janitorMergeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 6],
                    extrapolate: 'clamp',
                  }),
                  ...(Platform.OS === 'web' && !isJanitorMerged
                    ? ({ backdropFilter: 'blur(24px) saturate(160%)' } as any)
                    : null),
                }}
              >
                {Platform.OS !== 'web' && (
                  <Animated.View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, { opacity: janitorSeparateOpacity }]}
                  >
                    <SafeBlurView
                      intensity={Platform.OS === 'android' ? 75 : 55}
                      blurReductionFactor={3}
                      tint="dark"
                      blurMethod="dimezisBlurViewSdk31Plus"
                      blurTarget={blurTargetRef}
                      style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
                      pointerEvents="none"
                    />
                  </Animated.View>
                )}
                <Animated.View
                  style={{
                    height: composerExpandAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [Math.max(40, inputText ? composerInputHeight + 6 : 40), 196],
                    }),
                    overflow: 'hidden',
                  }}
                >
                  <TextInput
                    ref={composerInputRef}
                    style={[
                      styles.unifiedTextInput,
                      {
                        height: '100%',
                        maxHeight: undefined,
                        paddingVertical: 9,
                        textAlignVertical: isInputExpanded || composerInputHeight > 44 ? 'top' : 'center',
                      },
                    ]}
                    placeholder="Message here..."
                    placeholderTextColor="rgba(255, 255, 255, 0.45)"
                    value={inputText}
                    numberOfLines={Platform.OS === 'web' && !isInputExpanded ? 1 : undefined}
                    onFocus={() => {
                      cancelComposerBlur();
                      setIsInputFocused(true);
                    }}
                    onBlur={scheduleComposerBlur}
                    onChangeText={setInputText}
                    onContentSizeChange={e => {
                      if (Platform.OS === 'web') return;
                      if (!inputText) {
                        setComposerInputHeight(34);
                        return;
                      }
                      const h = e.nativeEvent.contentSize?.height || 34;
                      setComposerInputHeight(Math.max(34, Math.min(200, Math.ceil(h))));
                    }}
                    scrollEnabled={isInputExpanded || composerInputHeight >= 200}
                    multiline
                    textAlignVertical={isInputExpanded || composerInputHeight > 44 ? 'top' : 'center'}
                  />
                </Animated.View>
              </Animated.View>

              <Animated.View
                style={{
                  marginLeft: janitorMergeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 6],
                    extrapolate: 'clamp',
                  }),
                }}
              >
                {isStreaming ? (
                  <TouchableOpacity
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      backgroundColor: '#ef4444',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onPressIn={cancelComposerBlur}
                    onPress={onStopStreaming}
                    activeOpacity={0.8}
                    accessibilityLabel="Stop response"
                  >
                    <Square size={16} color="#FFFFFF" fill="#FFFFFF" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      backgroundColor: palette.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: inputText.trim() ? 1 : 0.45,
                    }}
                    onPressIn={cancelComposerBlur}
                    onPress={handlePressSend}
                    disabled={!inputText.trim()}
                    activeOpacity={0.8}
                    accessibilityLabel="Send message"
                  >
                    <Send size={16} color={palette.bgDark} />
                  </TouchableOpacity>
                )}
              </Animated.View>
            </View>

            {/* Row 2: Liquid Reveal Toolbar ([Persona Profile Pill] ... [Expand]) */}
            <Animated.View
              pointerEvents={isJanitorMerged ? 'auto' : 'none'}
              style={{
                height: janitorMergeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 42],
                  extrapolate: 'clamp',
                }),
                opacity: janitorMergeAnim.interpolate({
                  inputRange: [0, 0.35, 1],
                  outputRange: [0, 0, 1],
                  extrapolate: 'clamp',
                }),
                marginTop: janitorMergeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 8],
                  extrapolate: 'clamp',
                }),
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTopWidth: 0.75,
                  borderTopColor: 'rgba(255, 255, 255, 0.10)',
                  paddingTop: 8,
                }}
              >
                <TouchableOpacity
                  onPressIn={cancelComposerBlur}
                  onPress={onOpenPersonaModal}
                  activeOpacity={0.8}
                  accessibilityLabel="Switch or edit active persona"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                    paddingLeft: 4,
                    paddingRight: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: 'rgba(255, 255, 255, 0.10)',
                    maxWidth: '78%',
                  }}
                >
                  {persona.avatar ? (
                    <Image
                      source={{ uri: persona.avatar }}
                      style={{ width: 24, height: 24, borderRadius: 12 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: `rgba(${palette.accentRgb}, 0.22)`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '800' }}>
                        {persona.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={{ color: '#e2e8f0', fontSize: 12.5, fontWeight: '600', flexShrink: 1 }}
                    numberOfLines={1}
                  >
                    {persona.name}
                  </Text>
                  <ChevronDown size={14} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPressIn={cancelComposerBlur}
                  onPress={handleToggleInputExpanded}
                  activeOpacity={0.8}
                  accessibilityLabel={isInputExpanded ? 'Minimize input' : 'Expand input'}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: 'rgba(255, 255, 255, 0.10)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isInputExpanded ? (
                    <Minimize2 size={15} color="#9ca3af" />
                  ) : (
                    <Maximize2 size={15} color="#9ca3af" />
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>
        ) : isNekoBento ? (
          <View style={styles.bentoComposerRow}>
            {/* Left Module: Tactile Bento Input Block */}
            <View
              style={[
                styles.bentoInputCard,
                (isInputFocused || isInputExpanded) && styles.bentoInputCardActive,
              ]}
            >
              {/* Row 1: [+] Keycap + Clean TextInput */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.bentoKeycapBtn, showActionDeck && styles.bentoKeycapBtnActive]}
                  onPressIn={cancelComposerBlur}
                  onPress={() => {
                    setShowActionDeck(prev => !prev);
                  }}
                  activeOpacity={0.8}
                  accessibilityLabel="More chat tools"
                >
                  <Animated.View
                    style={{
                      transform: [
                        {
                          rotate: actionDeckAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '45deg'],
                          }),
                        },
                      ],
                    }}
                  >
                    <Plus size={18} color={showActionDeck ? palette.bgDark : palette.accent} />
                  </Animated.View>
                  {Boolean(castCandidate) && !showActionDeck && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 5,
                        right: 5,
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: palette.accent,
                      }}
                    />
                  )}
                </TouchableOpacity>

                <Animated.View
                  style={{
                    flex: 1,
                    height: composerExpandAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [Math.max(34, inputText ? composerInputHeight : 34), 196],
                    }),
                    overflow: 'hidden',
                  }}
                >
                  <TextInput
                    ref={composerInputRef}
                    style={[
                      styles.unifiedTextInput,
                      {
                        height: '100%',
                        maxHeight: undefined,
                        paddingVertical: 7,
                        textAlignVertical: isInputExpanded || composerInputHeight > 44 ? 'top' : 'center',
                      },
                    ]}
                    placeholder="Message or *action*..."
                    placeholderTextColor="rgba(255, 255, 255, 0.42)"
                    value={inputText}
                    numberOfLines={Platform.OS === 'web' && !isInputExpanded ? 1 : undefined}
                    onFocus={() => {
                      cancelComposerBlur();
                      setIsInputFocused(true);
                    }}
                    onBlur={scheduleComposerBlur}
                    onChangeText={setInputText}
                    onContentSizeChange={e => {
                      if (Platform.OS === 'web') return;
                      if (!inputText) {
                        setComposerInputHeight(34);
                        return;
                      }
                      const h = e.nativeEvent.contentSize?.height || 34;
                      setComposerInputHeight(Math.max(34, Math.min(200, Math.ceil(h))));
                    }}
                    scrollEnabled={isInputExpanded || composerInputHeight >= 200}
                    multiline
                    textAlignVertical={isInputExpanded || composerInputHeight > 44 ? 'top' : 'center'}
                  />
                </Animated.View>
              </View>

              {/* Row 2: Tactile Sub-Dock ([Persona Chip]) */}
              <Animated.View
                pointerEvents={isBentoActive ? 'auto' : 'none'}
                style={{
                  height: bentoDockAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 38],
                    extrapolate: 'clamp',
                  }),
                  opacity: bentoDockAnim.interpolate({
                    inputRange: [0, 0.35, 1],
                    outputRange: [0, 0, 1],
                    extrapolate: 'clamp',
                  }),
                  marginTop: bentoDockAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 6],
                    extrapolate: 'clamp',
                  }),
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTopWidth: 1,
                    borderTopColor: 'rgba(255, 255, 255, 0.06)',
                    paddingTop: 6,
                  }}
                >
                  <TouchableOpacity
                    style={styles.bentoPersonaChip}
                    onPressIn={cancelComposerBlur}
                    onPress={onOpenPersonaModal}
                    activeOpacity={0.8}
                    accessibilityLabel="Switch or edit active persona"
                  >
                    {persona.avatar ? (
                      <Image
                        source={{ uri: persona.avatar }}
                        style={{ width: 22, height: 22, borderRadius: 7 }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 7,
                          backgroundColor: `rgba(${palette.accentRgb}, 0.22)`,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: palette.accent, fontSize: 10.5, fontWeight: '800' }}>
                          {persona.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={{ color: '#e2e8f0', fontSize: 12.5, fontWeight: '600', flexShrink: 1 }}
                      numberOfLines={1}
                    >
                      {persona.name}
                    </Text>
                    <ChevronDown size={13} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>

            {/* Right Module: 2x2 Bento Stack ([Send/Stop] on top, [Expand] below when active) */}
            <View style={styles.bentoRightStack}>
              {isStreaming ? (
                <TouchableOpacity
                  style={styles.bentoSendKeycapStop}
                  onPressIn={cancelComposerBlur}
                  onPress={onStopStreaming}
                  activeOpacity={0.8}
                  accessibilityLabel="Stop response"
                >
                  <Square size={16} color="#FFFFFF" fill="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                (() => {
                  const hasDraft = inputText.trim().length > 0;
                  return (
                    <TouchableOpacity
                      style={[styles.bentoSendKeycap, hasDraft && styles.bentoSendKeycapActive]}
                      onPressIn={cancelComposerBlur}
                      onPress={handlePressSend}
                      disabled={!hasDraft}
                      activeOpacity={0.8}
                      accessibilityLabel="Send message"
                    >
                      <Send
                        size={17}
                        color={hasDraft ? palette.bgDark : `rgba(${palette.accentRgb}, 0.55)`}
                      />
                    </TouchableOpacity>
                  );
                })()
              )}

              <Animated.View
                pointerEvents={isBentoActive ? 'auto' : 'none'}
                style={{
                  height: bentoDockAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 38],
                    extrapolate: 'clamp',
                  }),
                  opacity: bentoDockAnim.interpolate({
                    inputRange: [0, 0.35, 1],
                    outputRange: [0, 0, 1],
                    extrapolate: 'clamp',
                  }),
                  marginTop: bentoDockAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 6],
                    extrapolate: 'clamp',
                  }),
                  overflow: 'hidden',
                }}
              >
                <TouchableOpacity
                  style={[styles.bentoExpandKeycap, isInputExpanded && styles.bentoExpandKeycapActive]}
                  onPressIn={cancelComposerBlur}
                  onPress={handleToggleInputExpanded}
                  activeOpacity={0.8}
                  accessibilityLabel={isInputExpanded ? 'Minimize input' : 'Expand input'}
                >
                  {isInputExpanded ? (
                    <Minimize2 size={14} color={palette.accent} />
                  ) : (
                    <Maximize2 size={14} color="#9ca3af" />
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        ) : (
        <Animated.View
          style={[
            styles.unifiedComposerCard,
            {
              borderRadius: skin.inputRadius,
              borderWidth: skin.id === 'material' ? 0 : Math.max(0.75, skin.cardBorderWidth),
              borderColor:
                skin.id === 'janitor'
                  ? 'rgba(255, 255, 255, 0.1)'
                  : isIosGlass
                    ? 'rgba(255, 255, 255, 0.28)'
                    : 'rgba(255, 255, 255, 0.14)',
              backgroundColor: isIosGlass
                ? Platform.OS === 'web'
                  ? 'rgba(18, 20, 30, 0.38)'
                  : 'rgba(18, 20, 30, 0.28)'
                : isM3
                  ? getM3TonalContainer(palette, 'high')
                  : getSurfaceBg(palette, skin),
              shadowColor: skin.cardGlowOpacity > 0 ? palette.accent : '#000',
              shadowOpacity: skin.cardGlowOpacity > 0 ? 0.2 : isIosGlass ? 0.45 : 0.15,
            },
            isM3 && {
              borderRadius: 28,
              marginHorizontal: 12,
              marginBottom: 4,
              shadowOpacity: 0.35,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            },
            isIosGlass && {
              overflow: 'hidden',
              borderTopColor: 'rgba(255, 255, 255, 0.60)',
              borderBottomColor: 'rgba(255, 255, 255, 0.12)',
              elevation: 14,
              ...(Platform.OS === 'web'
                ? ({ backdropFilter: 'blur(26px) saturate(190%)' } as any)
                : null),
            },
            isInputExpanded && { borderColor: palette.accent },
          ]}
        >
          {isIosGlass && Platform.OS !== 'web' && (
            <SafeBlurView
              intensity={Platform.OS === 'android' ? 75 : 55}
              blurReductionFactor={3}
              tint="dark"
              blurMethod="dimezisBlurViewSdk31Plus"
              blurTarget={blurTargetRef}
              style={[StyleSheet.absoluteFill, { borderRadius: skin.inputRadius }]}
              pointerEvents="none"
            />
          )}
          {isIosGlass && (
            <>
              <LinearGradient
                pointerEvents="none"
                colors={[
                  'rgba(255, 255, 255, 0.20)',
                  'rgba(255, 255, 255, 0.02)',
                  'rgba(255, 255, 255, 0.09)',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 22,
                  right: 22,
                  height: 1,
                  backgroundColor: 'rgba(255, 255, 255, 0.48)',
                }}
              />
            </>
          )}
          <Animated.View
            style={{
              height: composerExpandAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [inputText ? composerInputHeight : 34, 196],
              }),
              overflow: 'hidden',
            }}
          >
            <TextInput
              ref={composerInputRef}
              style={[
                styles.unifiedTextInput,
                { height: '100%', maxHeight: undefined },
              ]}
              placeholder='Type your roleplay action or dialogue (*actions in asterisks*, "dialogue")...'
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              value={inputText}
              numberOfLines={Platform.OS === 'web' && !isInputExpanded ? 1 : undefined}
              onChangeText={setInputText}
              onContentSizeChange={e => {
                if (Platform.OS === 'web') return;
                if (!inputText) {
                  setComposerInputHeight(34);
                  return;
                }
                const h = e.nativeEvent.contentSize?.height || 34;
                setComposerInputHeight(Math.max(34, Math.min(200, Math.ceil(h))));
              }}
              scrollEnabled={isInputExpanded || composerInputHeight >= 200}
              multiline
              textAlignVertical="top"
            />
          </Animated.View>

          {/* Bottom Inner Control Dock (+ | [Avatar Name v] ... [Expand] [Send]) */}
          <View style={styles.composerControlRow}>
            <View style={[styles.composerLeftControls, { flex: 1, gap: 8 }]}>
              <TouchableOpacity
                style={[
                  styles.composerActionBtn,
                  isIosGlass && {
                    borderRadius: 999,
                    backgroundColor: 'rgba(255, 255, 255, 0.10)',
                    borderColor: 'rgba(255, 255, 255, 0.18)',
                    borderTopColor: 'rgba(255, 255, 255, 0.30)',
                  },
                  isM3 && {
                    borderRadius: 999,
                    borderWidth: 0,
                    backgroundColor: `rgba(${palette.accentRgb}, 0.18)`,
                  },
                  showActionDeck && [styles.composerActionBtnActive, { backgroundColor: palette.accent }],
                ]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setShowActionDeck(prev => !prev);
                }}
                activeOpacity={0.8}
                accessibilityLabel="More chat tools"
              >
                <Animated.View
                  style={{
                    transform: [
                      {
                        rotate: actionDeckAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '45deg'],
                        }),
                      },
                    ],
                  }}
                >
                  <Plus size={18} color={showActionDeck ? palette.bgDark : palette.accent} />
                </Animated.View>
                {Boolean(castCandidate) && !showActionDeck && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 5,
                      right: 5,
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: palette.accent,
                    }}
                  />
                )}
              </TouchableOpacity>

              {/* Persona Selector Pill (Avatar + Name + Chevron) */}
              <TouchableOpacity
                style={[
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingLeft: 4,
                    paddingRight: 10,
                    paddingVertical: 4,
                    borderRadius: isIosGlass || isM3 ? 999 : 12,
                    backgroundColor: isIosGlass
                      ? 'rgba(255, 255, 255, 0.10)'
                      : isM3
                        ? getM3TonalContainer(palette, 'highest')
                        : 'rgba(255, 255, 255, 0.055)',
                    borderWidth: isM3 ? 0 : 1,
                    borderColor: isIosGlass ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.1)',
                    maxWidth: '72%',
                  },
                  isIosGlass && { borderTopColor: 'rgba(255, 255, 255, 0.30)' },
                ]}
                onPress={onOpenPersonaModal}
                activeOpacity={0.8}
                accessibilityLabel="Switch or edit active persona"
              >
                {persona.avatar ? (
                  <Image
                    source={{ uri: persona.avatar }}
                    style={{ width: 24, height: 24, borderRadius: isIosGlass || isM3 ? 12 : 7 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: isIosGlass || isM3 ? 12 : 7,
                      backgroundColor: `rgba(${palette.accentRgb}, 0.22)`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: palette.accent, fontSize: 11, fontWeight: '800' }}>
                      {persona.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text
                  style={{ color: '#e2e8f0', fontSize: 12.5, fontWeight: '600', flexShrink: 1 }}
                  numberOfLines={1}
                >
                  {persona.name}
                </Text>
                <ChevronDown size={14} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Right Controls: Expand Button, Send / Stop */}
            <View style={styles.composerRightControls}>
              <TouchableOpacity
                style={[
                  styles.expandToggleBtn,
                  isIosGlass && {
                    borderRadius: 999,
                    backgroundColor: 'rgba(255, 255, 255, 0.10)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.16)',
                    borderTopColor: 'rgba(255, 255, 255, 0.28)',
                  },
                  isM3 && {
                    borderRadius: 999,
                    borderWidth: 0,
                    backgroundColor: getM3TonalContainer(palette, 'highest'),
                  },
                ]}
                onPress={handleToggleInputExpanded}
                activeOpacity={0.8}
                accessibilityLabel={isInputExpanded ? 'Minimize input' : 'Expand input'}
              >
                {isInputExpanded ? (
                  <Minimize2 size={16} color="#9ca3af" />
                ) : (
                  <Maximize2 size={16} color="#9ca3af" />
                )}
              </TouchableOpacity>

              {isStreaming ? (
                <TouchableOpacity
                  style={[
                    styles.stopBtn,
                    { borderRadius: isIosGlass ? 999 : skin.buttonRadius },
                    isM3 && { minWidth: 42, height: 36 },
                  ]}
                  onPress={onStopStreaming}
                  activeOpacity={0.8}
                  accessibilityLabel="Stop response"
                >
                  <Square size={16} color="#FFFFFF" fill="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.sendBtnLime,
                    { backgroundColor: palette.accent, borderRadius: isIosGlass ? 999 : skin.buttonRadius },
                    isM3 && { minWidth: 42, height: 36 },
                    !inputText.trim() && styles.sendBtnDisabled,
                  ]}
                  onPress={handlePressSend}
                  disabled={!inputText.trim()}
                  activeOpacity={0.8}
                  accessibilityLabel="Send message"
                >
                  <Send size={16} color={palette.bgDark} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>
        )}
      </View>
      </View>
    );
  })
);

const createStyles = (palette: ThemePalette, skin: UiSkinTokens) =>
  StyleSheet.create({
    composerWrapper: {
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.04)',
      backgroundColor: 'rgba(10, 13, 20, 0.65)',
      paddingTop: 6,
      paddingBottom: Platform.OS === 'ios' ? 14 : 10,
    },
    actionDeck: {
      backgroundColor: GLASS.bgModal,
      borderWidth: 1,
      borderColor: GLASS.borderBright,
      padding: 10,
      gap: 8,
      marginHorizontal: 12,
      marginBottom: 8,
      borderRadius: 16,
      ...GLASS.backdropStrong,
      ...GLASS.shadow,
    },
    actionDeckGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    actionGridTile: {
      width: '48.5%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 11,
      paddingVertical: 10,
      borderRadius: skin.id === 'material' ? 18 : 14,
      backgroundColor:
        skin.id === 'material'
          ? getM3TonalContainer(palette, 'container')
          : 'rgba(255, 255, 255, 0.045)',
      borderWidth: skin.id === 'material' ? 0 : 1,
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    actionGridIconBox: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionGridTitle: {
      color: '#f8fafc',
      fontSize: 12.5,
      fontWeight: '700',
    },
    actionGridSub: {
      color: '#94a3b8',
      fontSize: 10.5,
      marginTop: 1,
    },
    unifiedComposerCard: {
      backgroundColor: GLASS.bgModal,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: GLASS.borderBright,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 8,
      marginHorizontal: 12,
      marginBottom: 4,
      ...GLASS.backdropStrong,
      ...GLASS.shadow,
      shadowColor: palette.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    unifiedTextInput: {
      color: '#FFFFFF',
      fontSize: 14,
      lineHeight: 20,
      minHeight: 34,
      maxHeight: 200,
      paddingVertical: 4,
      paddingHorizontal: 2,
      textAlignVertical: 'top',
    },
    composerControlRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255, 255, 255, 0.06)',
    },
    composerLeftControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    composerActionBtn: {
      width: 34,
      height: 34,
      borderRadius: Math.min(12, skin.buttonRadius),
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    composerActionBtnActive: {
      backgroundColor: palette.accent,
      borderColor: palette.accent,
    },
    composerRightControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    expandToggleBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendBtnLime: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: palette.accent,
      justifyContent: 'center',
      alignItems: 'center',
      ...(skin.cardGlowOpacity > 0
        ? {
            shadowColor: palette.accent,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.45,
          }
        : {}),
      shadowRadius: 6,
      elevation: 4,
    },
    sendBtnDisabled: {
      opacity: 0.4,
    },
    stopBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: '#ef4444',
      justifyContent: 'center',
      alignItems: 'center',
    },
    bentoComposerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginHorizontal: 12,
      marginBottom: 4,
      gap: 8,
    },
    bentoRightStack: {
      width: 48,
      alignItems: 'stretch',
    },
    bentoInputCard: {
      flex: 1,
      borderRadius: 18,
      backgroundColor: palette.bgSurface,
      borderWidth: 1,
      borderColor: `rgba(${palette.accentRgb}, 0.24)`,
      borderTopColor: 'rgba(255, 255, 255, 0.14)',
      borderBottomWidth: 3,
      borderBottomColor: 'rgba(0, 0, 0, 0.60)',
      paddingHorizontal: 7,
      paddingVertical: 5,
      elevation: 6,
    },
    bentoInputCardActive: {
      borderColor: `rgba(${palette.accentRgb}, 0.55)`,
      borderTopColor: `rgba(${palette.accentRgb}, 0.62)`,
      borderBottomWidth: 3,
      borderBottomColor: 'rgba(0, 0, 0, 0.60)',
    },
    bentoKeycapBtn: {
      width: 34,
      height: 34,
      borderRadius: 11,
      backgroundColor: 'rgba(255, 255, 255, 0.065)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.11)',
      borderTopColor: 'rgba(255, 255, 255, 0.18)',
      borderBottomWidth: 2,
      borderBottomColor: 'rgba(0, 0, 0, 0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bentoKeycapBtnActive: {
      backgroundColor: palette.accent,
      borderColor: palette.accent,
      borderTopColor: 'rgba(255, 255, 255, 0.35)',
    },
    bentoPersonaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingLeft: 4,
      paddingRight: 9,
      paddingVertical: 3.5,
      borderRadius: 11,
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.11)',
      borderBottomWidth: 2,
      borderBottomColor: 'rgba(0, 0, 0, 0.42)',
      maxWidth: '100%',
    },
    bentoExpandKeycap: {
      width: 48,
      height: 38,
      borderRadius: 14,
      backgroundColor: palette.bgSurface,
      borderWidth: 1,
      borderColor: `rgba(${palette.accentRgb}, 0.24)`,
      borderTopColor: 'rgba(255, 255, 255, 0.14)',
      borderBottomWidth: 3,
      borderBottomColor: 'rgba(0, 0, 0, 0.60)',
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
    },
    bentoExpandKeycapActive: {
      borderColor: `rgba(${palette.accentRgb}, 0.55)`,
      borderTopColor: `rgba(${palette.accentRgb}, 0.62)`,
      borderBottomWidth: 3,
      borderBottomColor: 'rgba(0, 0, 0, 0.60)',
    },
    bentoSendKeycap: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: palette.bgSurface,
      borderWidth: 1,
      borderColor: `rgba(${palette.accentRgb}, 0.24)`,
      borderTopColor: 'rgba(255, 255, 255, 0.14)',
      borderBottomWidth: 3,
      borderBottomColor: 'rgba(0, 0, 0, 0.60)',
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
    },
    bentoSendKeycapActive: {
      backgroundColor: palette.accent,
      borderColor: `rgba(${palette.accentRgb}, 0.55)`,
      borderTopColor: 'rgba(255, 255, 255, 0.36)',
      borderBottomWidth: 3,
      borderBottomColor: 'rgba(0, 0, 0, 0.45)',
      shadowColor: palette.accent,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
    },
    bentoSendKeycapStop: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: '#ef4444',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.18)',
      borderTopColor: 'rgba(255, 255, 255, 0.34)',
      borderBottomWidth: 3,
      borderBottomColor: 'rgba(127, 29, 29, 0.85)',
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
    },
  });
