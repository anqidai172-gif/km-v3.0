import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors, tokens } from '../../theme';

interface ProgressBarProps {
  /** 0–100 */
  progress: number;
  height?: number;
  /** Animate the fill on mount / change */
  animated?: boolean;
}

export function ProgressBar({ progress, height = 10, animated = true }: ProgressBarProps) {
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

  return (
    <View style={[styles.track, { height }]}>
      <Animated.View
        style={[
          styles.fill,
          {
            height,
            width: animWidth.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
              extrapolate: 'clamp',
            }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.divider,
    borderRadius: tokens.radius.full,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: colors.primary,
    borderRadius: tokens.radius.full,
  },
});
