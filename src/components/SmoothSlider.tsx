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
import { colors } from '../theme/colors';

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
  accentColor = colors.lime,
  minLabel,
  maxLabel,
}) => {
  const [trackWidth, setTrackWidth] = useState(0);
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

  return (
    <View style={styles.wrapper}>
      <View
        ref={trackRef}
        style={styles.touchArea}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        {/* Background Track */}
        <View style={styles.trackBg}>
          {/* Active Fill */}
          <View
            style={[
              styles.trackFill,
              {
                width: `${ratio * 100}%`,
                backgroundColor: accentColor,
              },
            ]}
          />
        </View>

        {/* Thumb */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              left: Math.max(0, Math.min(trackWidth - 20, thumbLeft - 10)),
              borderColor: accentColor,
              shadowColor: accentColor,
              transform: [{ scale: thumbScale }],
            },
          ]}
        >
          <View style={[styles.thumbInner, { backgroundColor: accentColor }]} />
        </Animated.View>
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
    backgroundColor: '#0c0e14',
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
