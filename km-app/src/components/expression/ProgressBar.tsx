import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Svg, { Rect, Path } from 'react-native-svg';

interface ProgressBarProps {
  progress: number;
  height?: number;
  animated?: boolean;
}

const INK = '#171513';
const INK_LIGHT = '#3A3530';
const INSET = 2;

export function ProgressBar({ progress, height = 16, animated = true }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(animWidth, {
        toValue: clamped,
        duration: 600,
        useNativeDriver: false,
      }).start();
    } else {
      animWidth.setValue(clamped);
    }
  }, [clamped, animated]);

  const innerH = height - INSET * 2;

  return (
    <View style={[styles.track, { height }]}>
      {/* Fill — inset inside border */}
      <View style={[styles.fillInset, { height: innerH }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              height: innerH,
              width: animWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      </View>

      {/* Pencil-drawn border overlay */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
          {/* Layer 1 — outer stroke */}
          <Rect
            x={1.5} y={1.5} width={97} height={height - 3}
            stroke={INK} strokeWidth={1.2}
            strokeDasharray="18 5 10 3 20 6 12 4"
            strokeLinecap="round" fill="none" opacity={0.5}
          />
          {/* Layer 2 — offset, fills gaps */}
          <Rect
            x={0.8} y={2.5} width={98.4} height={height - 5}
            stroke={INK_LIGHT} strokeWidth={0.9}
            strokeDasharray="8 5 14 4 19 5 7 3"
            strokeLinecap="round" fill="none" opacity={0.38}
          />
          {/* Layer 3 — fine inner accent */}
          <Rect
            x={1.0} y={1.0} width={98} height={height - 2}
            stroke={INK} strokeWidth={0.6}
            strokeDasharray="22 4 13 6 9 3 16 5"
            strokeLinecap="round" fill="none" opacity={0.3}
          />
          {/* Top wavy edge */}
          <Path
            d={`M 1.5,${1 + height * 0.12} Q 50,${0.5} 98.5,${1.2 + height * 0.08}`}
            stroke={INK_LIGHT} strokeWidth={0.6} strokeLinecap="round" fill="none" opacity={0.25}
          />
          {/* Bottom wavy edge */}
          <Path
            d={`M 1.5,${height - 1.5 - height * 0.12} Q 48,${height - 0.6} 98.5,${height - 1 - height * 0.08}`}
            stroke={INK_LIGHT} strokeWidth={0.6} strokeLinecap="round" fill="none" opacity={0.25}
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  fillInset: {
    position: 'absolute',
    left: INSET,
    right: INSET,
    top: INSET,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: '#2E2A27',
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
