/**
 * BottomSheetModal — Reusable bottom sheet with:
 * 1. Smooth slide-up & backdrop fade entrance
 * 2. Tap/click outside backdrop to close
 * 3. Native RNGH v3 swipe-down dismissal (top grabber everywhere + sheet body when scrolled to top)
 */

import React, { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  ViewProps,
  ScrollView,
  ScrollViewProps,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StyleProp,
  ViewStyle,
  Keyboard,
  Platform,
  useWindowDimensions,
} from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  PanGesture,
  useNativeGesture,
  usePanGesture,
} from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GLASS } from '../theme/glassTheme';
import { getM3TonalContainer } from '../theme/skins';
import { useTheme } from '../theme/ThemeContext';
import { runSheetCloseAnimation, runSheetOpenAnimation } from '../theme/animations';

interface UseSheetDismissGesturesOptions {
  translateY: Animated.Value;
  onDismiss: () => void;
}

/**
 * Coordinates native Android/iOS/Web pan gestures for dismissing a sheet via
 * either its top drag handle (always enabled) or its body (enabled at top of scroll).
 */
export function useSheetDismissGestures({ translateY, onDismiss }: UseSheetDismissGesturesOptions) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const [scrollAtTop, setScrollAtTopState] = useState(true);
  const [isSheetDragging, setIsSheetDragging] = useState(false);
  const innerGestureLockedRef = useRef(false);
  const isDraggingBodyRef = useRef(false);
  const isDraggingTopRef = useRef(false);

  const setScrollAtTop = useCallback((atTop: boolean) => {
    setScrollAtTopState(prev => (prev === atTop ? prev : atTop));
  }, []);

  const setInnerGestureLocked = useCallback((locked: boolean) => {
    innerGestureLockedRef.current = locked;
  }, []);

  const resetGestureState = useCallback(() => {
    setScrollAtTopState(true);
    innerGestureLockedRef.current = false;
    isDraggingBodyRef.current = false;
    isDraggingTopRef.current = false;
    setIsSheetDragging(false);
  }, []);

  const springBack = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 120,
    }).start();
  }, [translateY]);

  const bodyPanGesture = usePanGesture({
    disableReanimated: true,
    enabled: scrollAtTop,
    activeOffsetY: 10,
    failOffsetY: -8,
    failOffsetX: [-14, 14],
    onActivate: () => {
      if (innerGestureLockedRef.current) return;
      isDraggingBodyRef.current = true;
      setIsSheetDragging(true);
    },
    onUpdate: e => {
      if (innerGestureLockedRef.current || !isDraggingBodyRef.current) return;
      translateY.setValue(e.translationY > 0 ? e.translationY : 0);
    },
    onDeactivate: e => {
      const wasDragging = isDraggingBodyRef.current;
      isDraggingBodyRef.current = false;
      setIsSheetDragging(false);
      innerGestureLockedRef.current = false;
      if (!wasDragging) return;
      if (!e.canceled && (e.translationY > 100 || (e.translationY > 40 && e.velocityY > 650))) {
        onDismissRef.current();
      } else {
        springBack();
      }
    },
    onFinalize: () => {
      isDraggingBodyRef.current = false;
      setIsSheetDragging(false);
      innerGestureLockedRef.current = false;
    },
  });

  const topPanGesture = usePanGesture({
    disableReanimated: true,
    activeOffsetY: 6,
    failOffsetY: -8,
    failOffsetX: [-20, 20],
    block: bodyPanGesture,
    onActivate: () => {
      isDraggingTopRef.current = true;
      setIsSheetDragging(true);
    },
    onUpdate: e => {
      if (!isDraggingTopRef.current) return;
      translateY.setValue(e.translationY > 0 ? e.translationY : 0);
    },
    onDeactivate: e => {
      const wasDragging = isDraggingTopRef.current;
      isDraggingTopRef.current = false;
      setIsSheetDragging(false);
      if (!wasDragging) return;
      if (!e.canceled && (e.translationY > 90 || (e.translationY > 35 && e.velocityY > 550))) {
        onDismissRef.current();
      } else {
        springBack();
      }
    },
    onFinalize: () => {
      isDraggingTopRef.current = false;
      setIsSheetDragging(false);
    },
  });

  return {
    scrollAtTop,
    setScrollAtTop,
    isSheetDragging,
    setInnerGestureLocked,
    innerGestureLockedRef,
    bodyPanGesture,
    topPanGesture,
    resetGestureState,
  };
}

interface BottomSheetGestureContextValue {
  setScrollAtTop: (atTop: boolean) => void;
  setInnerGestureLocked: (locked: boolean) => void;
  isSheetDragging: boolean;
  sheetPanGesture: PanGesture;
}

const BottomSheetGestureContext = createContext<BottomSheetGestureContextValue | null>(null);

export const useBottomSheetGesture = () => useContext(BottomSheetGestureContext);

export const BottomSheetScrollView = forwardRef<React.ComponentRef<typeof ScrollView>, ScrollViewProps>(
  function BottomSheetScrollViewInner({ onScroll, scrollEnabled, scrollEventThrottle, bounces, overScrollMode, ...props }, ref) {
    const ctx = useContext(BottomSheetGestureContext);
    const setScrollAtTop = ctx?.setScrollAtTop;

    const nativeScrollGesture = useNativeGesture(
      ctx?.sheetPanGesture
        ? {
            disableReanimated: true,
            simultaneousWith: ctx.sheetPanGesture,
          }
        : { disableReanimated: true }
    );

    useEffect(() => {
      setScrollAtTop?.(true);
      return () => {
        setScrollAtTop?.(true);
      };
    }, [setScrollAtTop]);

    const handleScroll = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        setScrollAtTop?.(e.nativeEvent.contentOffset.y <= 2);
        onScroll?.(e);
      },
      [setScrollAtTop, onScroll]
    );

    return (
      <GestureDetector gesture={nativeScrollGesture}>
        <ScrollView
          {...props}
          ref={ref}
          scrollEventThrottle={scrollEventThrottle ?? 16}
          bounces={bounces ?? false}
          overScrollMode={overScrollMode ?? 'never'}
          scrollEnabled={ctx?.isSheetDragging ? false : scrollEnabled}
          onScroll={handleScroll}
        />
      </GestureDetector>
    );
  }
);

export const BottomSheetGestureLock: React.FC<ViewProps> = ({
  onTouchStartCapture,
  onTouchStart,
  onTouchEnd,
  onTouchCancel,
  children,
  ...rest
}) => {
  const ctx = useContext(BottomSheetGestureContext);
  const lockGesture = useNativeGesture({
    disableReanimated: true,
    shouldActivateOnStart: true,
    disallowInterruption: true,
    ...(ctx?.sheetPanGesture ? { block: ctx.sheetPanGesture } : {}),
  });

  return (
    <GestureDetector gesture={lockGesture}>
      <View
        {...rest}
        onTouchStartCapture={e => {
          ctx?.setInnerGestureLocked(true);
          onTouchStartCapture?.(e);
        }}
        onTouchStart={e => {
          ctx?.setInnerGestureLocked(true);
          onTouchStart?.(e);
        }}
        onTouchEnd={e => {
          ctx?.setInnerGestureLocked(false);
          onTouchEnd?.(e);
        }}
        onTouchCancel={e => {
          ctx?.setInnerGestureLocked(false);
          onTouchCancel?.(e);
        }}
      >
        {children}
      </View>
    </GestureDetector>
  );
};

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  showDragHandle?: boolean;
  fullScreen?: boolean;
}

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  visible,
  onClose,
  children,
  sheetStyle,
  showDragHandle = true,
  fullScreen = false,
}) => {
  const insets = useSafeAreaInsets();
  const { palette, skin } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [internalVisible, setInternalVisible] = useState(visible);
  const [translateY] = useState(() => new Animated.Value(420));
  const [backdropOpacity] = useState(() => new Animated.Value(0));
  const onCloseRef = useRef(onClose);
  const isAnimatingOutRef = useRef(false);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvt, e => {
      setKeyboardHeight(e.endCoordinates?.height || 0);
    });
    const subHide = Keyboard.addListener(hideEvt, () => {
      setKeyboardHeight(0);
    });
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const animateClose = useCallback(() => {
    if (isAnimatingOutRef.current) return;
    isAnimatingOutRef.current = true;
    runSheetCloseAnimation(translateY, backdropOpacity, skin.animation, () => {
      isAnimatingOutRef.current = false;
      setInternalVisible(false);
      onCloseRef.current();
    });
  }, [translateY, backdropOpacity, skin.animation]);

  const {
    setScrollAtTop,
    isSheetDragging,
    setInnerGestureLocked,
    innerGestureLockedRef,
    bodyPanGesture,
    topPanGesture,
    resetGestureState,
  } = useSheetDismissGestures({
    translateY,
    onDismiss: animateClose,
  });

  const gestureContextValue = useMemo<BottomSheetGestureContextValue>(
    () => ({
      setScrollAtTop,
      setInnerGestureLocked,
      isSheetDragging,
      sheetPanGesture: bodyPanGesture,
    }),
    [setScrollAtTop, setInnerGestureLocked, isSheetDragging, bodyPanGesture]
  );

  useEffect(() => {
    if (visible) {
      isAnimatingOutRef.current = false;
      resetGestureState();
      setInternalVisible(true);
      runSheetOpenAnimation(translateY, backdropOpacity, skin.animation);
    } else if (internalVisible && !isAnimatingOutRef.current) {
      resetGestureState();
      isAnimatingOutRef.current = true;
      runSheetCloseAnimation(translateY, backdropOpacity, skin.animation, () => {
        isAnimatingOutRef.current = false;
        setInternalVisible(false);
      });
    }
  }, [visible, internalVisible, translateY, backdropOpacity, skin.animation, resetGestureState]);

  const isFloatingIosSheet = skin.id === 'ios' && !fullScreen;
  const safeBottomPad =
    keyboardHeight > 0
      ? 14
      : isFloatingIosSheet
        ? 18
        : Platform.OS === 'android'
          ? Math.max(insets.bottom + 18, 44)
          : Math.max(insets.bottom + 12, 24);

  return (
    <Modal
      visible={internalVisible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={animateClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }} unstable_forceActive>
        <Animated.View style={[styles.overlay, { opacity: backdropOpacity }]}>
          {/* Progressive Dark Gradient Backdrop */}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(6, 8, 14, 0.12)', 'rgba(6, 8, 14, 0.48)', 'rgba(6, 8, 14, 0.88)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Click outside backdrop */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={animateClose}
          />

          {/* Sheet Card (top drag handle always dismisses; body dismisses when scrolled to top) */}
          <GestureDetector gesture={bodyPanGesture}>
            <Animated.View
              onTouchStartCapture={() => {
                innerGestureLockedRef.current = false;
              }}
              style={[
                styles.sheet,
                {
                  borderTopLeftRadius: skin.sheetRadius,
                  borderTopRightRadius: skin.sheetRadius,
                  backgroundColor:
                    skin.id === 'ios'
                      ? Platform.OS === 'android'
                        ? 'rgba(20, 22, 32, 0.78)'
                        : 'rgba(20, 22, 32, 0.56)'
                      : skin.id === 'material'
                        ? getM3TonalContainer(palette, 'low')
                        : skin.surfaceBg
                          ? skin.surfaceBg
                          : skin.surfaceMode === 'tonal'
                            ? palette.bgSurfaceSubtle
                            : palette.bgSurface,
                  borderWidth: skin.id === 'material' ? 0 : 1,
                  borderColor:
                    skin.id === 'janitor'
                      ? `rgba(${palette.accentRgb}, 0.35)`
                      : skin.id === 'ios'
                        ? 'rgba(255, 255, 255, 0.24)'
                        : 'rgba(255, 255, 255, 0.12)',
                  ...(skin.id === 'ios'
                    ? {
                        borderTopColor: 'rgba(255, 255, 255, 0.56)',
                        borderBottomColor: 'rgba(0, 0, 0, 0.48)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 14 },
                        shadowOpacity: 0.58,
                        shadowRadius: 28,
                        elevation: 20,
                        ...(!fullScreen
                          ? {
                              marginHorizontal: 8,
                              borderRadius: 32,
                              borderTopLeftRadius: 32,
                              borderTopRightRadius: 32,
                            }
                          : null),
                        ...(Platform.OS === 'web'
                          ? ({ backdropFilter: 'blur(30px) saturate(185%)' } as any)
                          : null),
                      }
                    : null),
                  marginBottom: isFloatingIosSheet
                    ? keyboardHeight > 0
                      ? keyboardHeight + 6
                      : Platform.OS === 'android'
                        ? Math.max(insets.bottom + 10, 32)
                        : Math.max(10, insets.bottom)
                    : keyboardHeight,
                  maxHeight: Math.max(240, windowHeight - keyboardHeight - insets.top - (fullScreen ? 8 : 28)),
                },
                fullScreen && {
                  height: Math.max(280, windowHeight - keyboardHeight - insets.top - 8),
                },
                sheetStyle,
                { paddingBottom: safeBottomPad },
                { transform: [{ translateY }] },
              ]}
            >
              {skin.id === 'ios' && Platform.OS === 'ios' && (
                <BlurView
                  intensity={55}
                  tint="dark"
                  style={[StyleSheet.absoluteFill, { borderRadius: fullScreen ? 0 : 32 }]}
                />
              )}
              {skin.id !== 'material' && (
                <LinearGradient
                  pointerEvents="none"
                  colors={
                    skin.id === 'ios'
                      ? [
                          'rgba(255, 255, 255, 0.18)',
                          'rgba(255, 255, 255, 0.02)',
                          'rgba(255, 255, 255, 0.08)',
                        ]
                      : GLASS.sheenColors
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              {skin.id === 'ios' && (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 24,
                    right: 24,
                    height: 1.5,
                    backgroundColor: 'rgba(255, 255, 255, 0.46)',
                  }}
                />
              )}
              {/* Swipe-Down Drag Handle Zone */}
              {showDragHandle && (
                <GestureDetector gesture={topPanGesture}>
                  <View
                    style={[
                      styles.dragZone,
                      Platform.OS === 'web'
                        ? ({ touchAction: 'none', cursor: 'grab' } as any)
                        : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.dragPill,
                        {
                          width: skin.grabberWidth,
                          height: skin.grabberHeight,
                          borderRadius: skin.grabberHeight / 2,
                        },
                        skin.id === 'material' && { backgroundColor: 'rgba(255, 255, 255, 0.36)' },
                      ]}
                    />
                  </View>
                </GestureDetector>
              )}

              <BottomSheetGestureContext.Provider value={gestureContextValue}>
                {children}
              </BottomSheetGestureContext.Provider>
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  sheet: {
    overflow: 'hidden',
    backgroundColor: GLASS.bgModal,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: GLASS.borderBright,
    ...GLASS.backdropStrong,
    ...GLASS.shadow,
  },
  dragZone: {
    width: '100%',
    paddingTop: 14,
    paddingBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragPill: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
});

