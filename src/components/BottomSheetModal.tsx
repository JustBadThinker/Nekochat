/**
 * BottomSheetModal — Reusable bottom sheet with:
 * 1. Smooth slide-up & backdrop fade entrance
 * 2. Tap/click outside backdrop to close
 * 3. Swipe down on the drag handle / top bar to dismiss
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  PanResponder,
  StyleProp,
  ViewStyle,
  Keyboard,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GLASS } from '../theme/glassTheme';

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
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [translateY] = useState(() => new Animated.Value(420));
  const [backdropOpacity] = useState(() => new Animated.Value(0));
  const onCloseRef = useRef(onClose);

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
      translateY.setValue(420);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, backdropOpacity]);

  const animateClose = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 520,
        duration: 210,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 210,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={animateClose}
    >
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

        {/* Sheet Card */}
        <Animated.View
          style={[
            styles.sheet,
            {
              marginBottom: keyboardHeight,
              maxHeight: Math.max(240, windowHeight - keyboardHeight - insets.top - (fullScreen ? 8 : 28)),
              paddingBottom: keyboardHeight > 0 ? 14 : Math.max(24, insets.bottom + 12),
            },
            fullScreen && {
              height: Math.max(280, windowHeight - keyboardHeight - insets.top - 8),
            },
            sheetStyle,
            { transform: [{ translateY }] },
          ]}
        >
          <LinearGradient
            pointerEvents="none"
            colors={GLASS.sheenColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Swipe-Down Drag Handle Zone */}
          {showDragHandle && (
            <View style={styles.dragZone} {...panResponder.panHandlers}>
              <View style={styles.dragPill} />
            </View>
          )}

          {children}
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
    ...GLASS.backdrop,
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
    paddingVertical: 8,
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

