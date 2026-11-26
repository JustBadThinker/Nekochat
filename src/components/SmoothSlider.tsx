/**
 * SmoothSlider — Cross-platform animated slider (Web + iOS + Android).
 * Uses React Native PanResponder & Animated with zero extra native dependencies.
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface SmoothSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (val: number) => void;
  onSlidingComplete?: (val: number) => void;
  accentColor?: string;
  minLabel?: string;
  maxLabel?: string;
}

export const SmoothSlider: React.FC<SmoothSliderProps> = ({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  onSlidingComplete,
  accentColor,
  minLabel,
  maxLabel,
}) => {
  const { palette, skin } = useTheme();
  const isIosGlass = skin.id === 'ios';
  const isM3 = skin.id === 'material';
  const isNeko = skin.id === 'bento';
  const resolvedAccent = accentColor || palette.accent;
  const [trackWidth, setTrackWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const trackWidthRef = useRef(0);
  const trackPageXRef = useRef(0);
  const trackRef = useRef<any>(null);

  const [thumbScale] = useState(() => new Animated.Value(1));
  const clampedValue = Math.min(max, Math.max(min, value));
  const ratio = max > min ? (clampedValue - min) / (max - min) : 0;

  const latestPropsRef = useRef({ min, max, step, onValueChange, onSlidingComplete });
  useEffect(() => {
    latestPropsRef.current = { min, max, step, onValueChange, onSlidingComplete };
  });

  const computeValueFromPageX = (pageX: number) => {
    const width = trackWidthRef.current;
    if (width <= 0) return clampedValue;
    const relX = Math.min(width, Math.max(0, pageX - trackPageXRef.current));
    const pct = relX / width;
    const { min: lo, max: hi, step: st } = latestPropsRef.current;
    const raw = lo + pct * (hi - lo);
    const stepped = Math.round((raw - lo) / st) * st + lo;
    // Fix floating point precision (e.g. 0.30000000000000004)
    const decimals = st < 1 ? String(st).split('.')[1]?.length || 2 : 0;
    const fixed = Number(stepped.toFixed(decimals));
    return Math.min(hi, Math.max(lo, fixed));
  };

  const measureTrack = () => {
    trackRef.current?.measureInWindow((x: number) => {
      if (typeof x === 'number' && !Number.isNaN(x)) {
        trackPageXRef.current = x;
      }
    });
  };

  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        measureTrack();
        setIsDragging(true);
        Animated.spring(thumbScale, {
          toValue: 1.28,
          useNativeDriver: true,
          friction: 6,
          tension: 180,
        }).start();
        const pageX = evt.nativeEvent.pageX;
        // Fallback if measureInWindow hasn't fired yet
        if (trackPageXRef.current === 0 && evt.nativeEvent.locationX !== undefined) {
          trackPageXRef.current = pageX - evt.nativeEvent.locationX;
        }
        const nextVal = computeValueFromPageX(pageX);
        latestPropsRef.current.onValueChange(nextVal);
      },
      onPanResponderMove: (evt) => {
        const nextVal = computeValueFromPageX(evt.nativeEvent.pageX);
        latestPropsRef.current.onValueChange(nextVal);
      },
      onPanResponderRelease: (evt) => {
        setIsDragging(false);
        Animated.spring(thumbScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 6,
          tension: 180,
        }).start();
        const nextVal = computeValueFromPageX(evt.nativeEvent.pageX);
        latestPropsRef.current.onValueChange(nextVal);
        latestPropsRef.current.onSlidingComplete?.(nextVal);
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        Animated.spring(thumbScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 6,
          tension: 180,
        }).start();
      },
    })
  );

  useEffect(() => {
    if (trackWidth > 0) {
      measureTrack();
    }
  }, [trackWidth]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    trackWidthRef.current = w;
    setTrackWidth(w);
    setTimeout(measureTrack, 50);
  };

  const thumbLeft = trackWidth > 0 ? ratio * trackWidth : 0;
  const handleX = trackWidth > 0 ? Math.max(8, Math.min(trackWidth - 8, thumbLeft)) : 8;
  const m3Gap = 7;
  const m3ActiveWidth = Math.max(0, handleX - m3Gap);
  const m3InactiveLeft = handleX + m3Gap;
  const m3InactiveWidth = trackWidth > 0 ? Math.max(0, trackWidth - m3InactiveLeft) : 0;

  return (
    <View style={styles.wrapper}>
      <View
        ref={trackRef}
        style={[styles.touchArea, isM3 && { height: 44 }]}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        {isM3 ? (
          <>
            {/* M3 Expressive Active Left Track Segment */}
            {m3ActiveWidth > 0 && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  width: m3ActiveWidth,
                  height: 16,
                  borderTopLeftRadius: 8,
                  borderBottomLeftRadius: 8,
                  borderTopRightRadius: 3,
                  borderBottomRightRadius: 3,
                  backgroundColor: resolvedAccent,
                }}
              />
            )}

            {/* M3 Expressive Inactive Right Track Segment + Stop Dot */}
            {m3InactiveWidth > 0 && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: m3InactiveLeft,
                  width: m3InactiveWidth,
                  height: 16,
                  borderTopLeftRadius: 3,
                  borderBottomLeftRadius: 3,
                  borderTopRightRadius: 8,
                  borderBottomRightRadius: 8,
                  backgroundColor: `rgba(${palette.accentRgb}, 0.20)`,
                }}
              >
                {ratio < 0.95 && m3InactiveWidth > 14 && (
                  <View
                    style={{
                      position: 'absolute',
                      right: 6,
                      top: 6,
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: resolvedAccent,
                    }}
                  />
                )}
              </View>
            )}

            {/* M3 Expressive Vertical Pill Handle */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: handleX - (isDragging ? 1.5 : 2),
                width: isDragging ? 3 : 4,
                height: isDragging ? 38 : 34,
                borderRadius: 2,
                backgroundColor: resolvedAccent,
                transform: [
                  {
                    scaleY: thumbScale.interpolate({
                      inputRange: [1, 1.28],
                      outputRange: [1, 1.08],
                    }),
                  },
                ],
              }}
            />
          </>
        ) : (
          <>
            {/* Background Track */}
            <View
              style={[
                styles.trackBg,
                isIosGlass && {
                  height: 7,
                  borderRadius: 3.5,
                  backgroundColor: 'rgba(255, 255, 255, 0.14)',
                  borderWidth: 0.75,
                  borderColor: 'rgba(255, 255, 255, 0.18)',
                },
                isNeko && {
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: 'rgba(255, 255, 255, 0.09)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.10)',
                  borderBottomWidth: 2,
                  borderBottomColor: 'rgba(0, 0, 0, 0.45)',
                },
              ]}
            >
              {/* Active Fill */}
              <View
                style={[
                  styles.trackFill,
                  {
                    width: `${ratio * 100}%`,
                    backgroundColor: resolvedAccent,
                    borderRadius: isIosGlass ? 3.5 : isNeko ? 5 : 3,
                  },
                ]}
              />
            </View>

            {/* Thumb */}
            {isIosGlass ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.iosGlassThumb,
                  {
                    left: Math.max(0, Math.min(trackWidth - 36, thumbLeft - 18)),
                    backgroundColor: isDragging
                      ? 'rgba(255, 255, 255, 0.20)'
                      : '#FFFFFF',
                    borderWidth: isDragging ? 1.5 : 0.75,
                    borderColor: isDragging
                      ? 'rgba(255, 255, 255, 0.88)'
                      : 'rgba(255, 255, 255, 0.92)',
                    transform: [{ scale: thumbScale }],
                  },
                ]}
              />
            ) : isNeko ? (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  width: 24,
                  height: 24,
                  borderRadius: 9,
                  left: Math.max(0, Math.min(trackWidth - 24, thumbLeft - 12)),
                  backgroundColor: resolvedAccent,
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                  borderBottomWidth: 3.5,
                  borderBottomColor: 'rgba(0, 0, 0, 0.42)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  elevation: 5,
                  transform: [{ scale: thumbScale }],
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: palette.bgDark,
                  }}
                />
              </Animated.View>
            ) : (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.thumb,
                  {
                    left: Math.max(0, Math.min(trackWidth - 20, thumbLeft - 10)),
                    borderColor: resolvedAccent,
                    shadowColor: resolvedAccent,
                    transform: [{ scale: thumbScale }],
                  },
                ]}
              >
                <View style={[styles.thumbInner, { backgroundColor: resolvedAccent }]} />
              </Animated.View>
            )}
          </>
        )}
      </View>

      {(minLabel || maxLabel) && (
        <View style={styles.labelsRow}>
          <Text style={styles.rangeLabel}>{minLabel || ''}</Text>
          <Text style={styles.rangeLabel}>{maxLabel || ''}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    paddingTop: 4,
  },
  touchArea: {
    height: 34,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#141414',
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 5,
  },
  thumbInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  iosGlassThumb: {
    position: 'absolute',
    width: 36,
    height: 22,
    borderRadius: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  rangeLabel: {
    color: '#6b7280',
    fontSize: 10,
    fontWeight: '600',
  },
});
