/**
 * BottomSheetModal — Reusable bottom sheet with:
 * 1. Smooth slide-up & backdrop fade entrance
 * 2. Tap/click outside backdrop to close
 * 3. Swipe down on the drag handle / top bar to dismiss
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
  PanResponder,
  StyleProp,
  ViewStyle,
  Keyboard,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GLASS } from '../theme/glassTheme';
import { getM3TonalContainer } from '../theme/skins';
import { useTheme } from '../theme/ThemeContext';
import { runSheetCloseAnimation, runSheetOpenAnimation } from '../theme/animations';

interface BottomSheetGestureContextValue {
  setScrollAtTop: (atTop: boolean) => void;
  setInnerGestureLocked: (locked: boolean) => void;
  isSheetDragging: boolean;
}

const BottomSheetGestureContext = createContext<BottomSheetGestureContextValue | null>(null);

export const useBottomSheetGesture = () => useContext(BottomSheetGestureContext);

export const BottomSheetScrollView = forwardRef<React.ComponentRef<typeof ScrollView>, ScrollViewProps>(
  function BottomSheetScrollViewInner({ onScroll, scrollEnabled, scrollEventThrottle, bounces, overScrollMode, ...props }, ref) {
    const ctx = useContext(BottomSheetGestureContext);
    const setScrollAtTop = ctx?.setScrollAtTop;

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
      <ScrollView
        {...props}
        ref={ref}
        scrollEventThrottle={scrollEventThrottle ?? 16}
        bounces={bounces ?? false}
        overScrollMode={overScrollMode ?? 'never'}
        scrollEnabled={ctx?.isSheetDragging ? false : scrollEnabled}
        onScroll={handleScroll}
      />
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
  return (
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
  const sheetRef = useRef<any>(null);
  const sheetTopYRef = useRef<number | null>(null);
  const overlayHeightRef = useRef<number>(0);
  const sheetHeightRef = useRef<number>(0);
  const insetsTopRef = useRef<number>(insets.top);
  insetsTopRef.current = insets.top;
  const scrollAtTopRef = useRef<boolean>(true);
  const touchStartedAtTopRef = useRef<boolean>(true);
  const innerGestureLockedRef = useRef<boolean>(false);
  const [isSheetDragging, setIsSheetDragging] = useState(false);

  const setScrollAtTop = useCallback((atTop: boolean) => {
    scrollAtTopRef.current = atTop;
  }, []);

  const setInnerGestureLocked = useCallback((locked: boolean) => {
    innerGestureLockedRef.current = locked;
  }, []);

  const gestureContextValue = useMemo<BottomSheetGestureContextValue>(
    () => ({
      setScrollAtTop,
      setInnerGestureLocked,
      isSheetDragging,
    }),
    [setScrollAtTop, setInnerGestureLocked, isSheetDragging]
  );

  const measureSheetTop = () => {
    sheetRef.current?.measureInWindow?.((_x: number, y: number) => {
      if (typeof y === 'number' && !Number.isNaN(y)) {
        sheetTopYRef.current = y;
      }
    });
  };

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

  useEffect(() => {
    if (visible) {
      isAnimatingOutRef.current = false;
      scrollAtTopRef.current = true;
      touchStartedAtTopRef.current = true;
      innerGestureLockedRef.current = false;
      setIsSheetDragging(false);
      setInternalVisible(true);
      runSheetOpenAnimation(translateY, backdropOpacity, skin.animation);
      const timer = setTimeout(measureSheetTop, 320);
      return () => clearTimeout(timer);
    } else if (internalVisible && !isAnimatingOutRef.current) {
      sheetTopYRef.current = null;
      scrollAtTopRef.current = true;
      touchStartedAtTopRef.current = true;
      innerGestureLockedRef.current = false;
      setIsSheetDragging(false);
      isAnimatingOutRef.current = true;
      runSheetCloseAnimation(translateY, backdropOpacity, skin.animation, () => {
        isAnimatingOutRef.current = false;
        setInternalVisible(false);
      });
    }
  }, [visible, internalVisible, translateY, backdropOpacity, skin.animation]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(measureSheetTop, 120);
    return () => clearTimeout(timer);
  }, [visible, keyboardHeight]);

  const animateClose = () => {
    if (isAnimatingOutRef.current) return;
    isAnimatingOutRef.current = true;
    runSheetCloseAnimation(translateY, backdropOpacity, skin.animation, () => {
      isAnimatingOutRef.current = false;
      setInternalVisible(false);
      onCloseRef.current();
    });
  };

  const animateCloseRef = useRef(animateClose);
  useEffect(() => {
    animateCloseRef.current = animateClose;
  });

  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 90 || gesture.vy > 0.55) {
          animateCloseRef.current();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 120,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 120,
        }).start();
      },
    })
  );

  const [sheetPanResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => {
        touchStartedAtTopRef.current = scrollAtTopRef.current;
        innerGestureLockedRef.current = false;
        return false;
      },
      onMoveShouldSetPanResponderCapture: (evt, gesture) => {
        if (innerGestureLockedRef.current) {
          return false;
        }
        if (gesture.dy <= 12 || Math.abs(gesture.dy) <= Math.abs(gesture.dx) * 1.45) {
          return false;
        }
        if (touchStartedAtTopRef.current && scrollAtTopRef.current) {
          return true;
        }
        const measuredTop = sheetTopYRef.current;
        const layoutTop =
          overlayHeightRef.current > 0 && sheetHeightRef.current > 0
            ? Math.max(0, overlayHeightRef.current - sheetHeightRef.current)
            : null;
        const minTop =
          measuredTop !== null && layoutTop !== null
            ? Math.min(measuredTop, layoutTop)
            : (measuredTop ?? layoutTop);
        const maxTop =
          measuredTop !== null && layoutTop !== null
            ? Math.max(measuredTop, layoutTop)
            : (measuredTop ?? layoutTop);
        if (minTop === null || maxTop === null) return false;
        const startPageY = evt.nativeEvent.pageY - gesture.dy;
        return startPageY >= minTop - Math.max(12, insetsTopRef.current) && startPageY <= maxTop + 96;
      },
      onMoveShouldSetPanResponder: (evt, gesture) => {
        if (innerGestureLockedRef.current) {
          return false;
        }
        if (gesture.dy <= 12 || Math.abs(gesture.dy) <= Math.abs(gesture.dx) * 1.45) {
          return false;
        }
        if (touchStartedAtTopRef.current && scrollAtTopRef.current) {
          return true;
        }
        const measuredTop = sheetTopYRef.current;
        const layoutTop =
          overlayHeightRef.current > 0 && sheetHeightRef.current > 0
            ? Math.max(0, overlayHeightRef.current - sheetHeightRef.current)
            : null;
        const minTop =
          measuredTop !== null && layoutTop !== null
            ? Math.min(measuredTop, layoutTop)
            : (measuredTop ?? layoutTop);
        const maxTop =
          measuredTop !== null && layoutTop !== null
            ? Math.max(measuredTop, layoutTop)
            : (measuredTop ?? layoutTop);
        if (minTop === null || maxTop === null) return false;
        const startPageY = evt.nativeEvent.pageY - gesture.dy;
        return startPageY >= minTop - Math.max(12, insetsTopRef.current) && startPageY <= maxTop + 96;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setIsSheetDragging(true);
      },
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        setIsSheetDragging(false);
        if (gesture.dy > 110 || (gesture.dy > 45 && gesture.vy > 0.65)) {
          animateCloseRef.current();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 120,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        setIsSheetDragging(false);
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 120,
        }).start();
      },
    })
  );

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
      <Animated.View
        style={[styles.overlay, { opacity: backdropOpacity }]}
        onLayout={e => {
          overlayHeightRef.current = e.nativeEvent.layout.height;
        }}
      >
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

        {/* Sheet Card (supports swiping down only from top drag bar / header zone) */}
        <Animated.View
          ref={sheetRef}
          onLayout={e => {
            sheetHeightRef.current = e.nativeEvent.layout.height;
            measureSheetTop();
          }}
          {...sheetPanResponder.panHandlers}
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
            <View
              style={[
                styles.dragZone,
                Platform.OS === 'web'
                  ? ({ touchAction: 'none', cursor: 'grab' } as any)
                  : null,
              ]}
              {...panResponder.panHandlers}
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
          )}

          <BottomSheetGestureContext.Provider value={gestureContextValue}>
            {children}
          </BottomSheetGestureContext.Provider>
        </Animated.View>
      </Animated.View>
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

