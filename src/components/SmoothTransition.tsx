import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { runEnterAnimation, runToggleAnimation } from '../theme/animations';

interface AnimatedCollapsibleProps {
  expanded: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  slideOffset?: number;
}

/**
 * Smoothly fades and slides collapsible content in and out on the native UI
 * driver without JS-thread layout height animation.
 */
export const AnimatedCollapsible: React.FC<AnimatedCollapsibleProps> = ({
  expanded,
  children,
  style,
  slideOffset = -8,
}) => {
  const { skin } = useTheme();
  const anim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const [rendered, setRendered] = useState(expanded);

  useEffect(() => {
    if (expanded) {
      setRendered(true);
      runToggleAnimation(anim, true, skin.animation);
    } else if (rendered) {
      Animated.timing(anim, {
        toValue: 0,
        duration: Math.max(140, Math.round(skin.animation.enterDuration * 0.65)),
        easing: skin.animation.easing,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [expanded, rendered, anim, skin.animation]);

  if (!rendered) return null;

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [slideOffset, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

interface AnimatedChevronProps {
  expanded: boolean;
  color: string;
  size?: number;
  collapsedDeg?: string;
  expandedDeg?: string;
}

/**
 * Rotates a ChevronDown indicator smoothly using the active skin motion curve.
 */
export const AnimatedChevron: React.FC<AnimatedChevronProps> = ({
  expanded,
  color,
  size = 16,
  collapsedDeg = '0deg',
  expandedDeg = '180deg',
}) => {
  const { skin } = useTheme();
  const rot = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    runToggleAnimation(rot, expanded, skin.animation);
  }, [expanded, rot, skin.animation]);

  return (
    <Animated.View
      style={{
        transform: [
          {
            rotate: rot.interpolate({
              inputRange: [0, 1],
              outputRange: [collapsedDeg, expandedDeg],
            }),
          },
        ],
      }}
    >
      <ChevronDown size={size} color={color} />
    </Animated.View>
  );
};

interface AnimatedTabTransitionProps {
  transitionKey: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  slideOffset?: number;
}

/**
 * Cross-fades and softly slides tab/mode content whenever `transitionKey` changes.
 */
export const AnimatedTabTransition: React.FC<AnimatedTabTransitionProps> = ({
  transitionKey,
  children,
  style,
  slideOffset = 8,
}) => {
  const { skin } = useTheme();
  const anim = useRef(new Animated.Value(1)).current;
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: Math.max(150, Math.round(skin.animation.enterDuration * 0.72)),
      easing: skin.animation.easing,
      useNativeDriver: true,
    }).start();
  }, [transitionKey, anim, skin.animation]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.25, 1],
          }),
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [slideOffset, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

interface AnimatedEnterRowProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  slideOffset?: number;
}

/**
 * Runs a lightweight mount entrance animation for dynamic accordion/list items.
 */
export const AnimatedEnterRow: React.FC<AnimatedEnterRowProps> = React.memo(
  function AnimatedEnterRow({ children, style, slideOffset = 8 }) {
    const { skin } = useTheme();
    const enterAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      runEnterAnimation(enterAnim, skin.animation);
    }, [enterAnim, skin.animation]);

    return (
      <Animated.View
        style={[
          style,
          {
            opacity: enterAnim,
            transform: [
              {
                translateY: enterAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [slideOffset, 0],
                }),
              },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    );
  }
);
