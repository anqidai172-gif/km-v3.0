import React, { useCallback } from 'react';
import { View, Text, StyleSheet, PanResponder, type LayoutChangeEvent } from 'react-native';
import { colors } from '../../theme';

interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  label?: string;
  valueSuffix?: string;
}

export function Slider({
  value,
  onValueChange,
  minimumValue = 60,
  maximumValue = 100,
  step = 5,
  label,
  valueSuffix = '分',
}: SliderProps) {
  const trackRef = React.useRef<View>(null);
  const trackWidth = React.useRef(0);
  const trackX = React.useRef(0);

  const roundToStep = (val: number) => {
    return Math.round(val / step) * step;
  };

  const clamp = (val: number) => {
    return Math.max(minimumValue, Math.min(maximumValue, val));
  };

  const getValueFromX = useCallback(
    (pageX: number) => {
      const ratio = (pageX - trackX.current) / trackWidth.current;
      return roundToStep(minimumValue + ratio * (maximumValue - minimumValue));
    },
    [minimumValue, maximumValue, step]
  );

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const val = clamp(getValueFromX(evt.nativeEvent.pageX));
          onValueChange(val);
        },
        onPanResponderMove: (evt) => {
          const val = clamp(getValueFromX(evt.nativeEvent.pageX));
          onValueChange(val);
        },
      }),
    [getValueFromX, onValueChange]
  );

  const onTrackLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
    // Measure position
    if (trackRef.current) {
      trackRef.current.measureInWindow((x) => {
        trackX.current = x;
      });
    }
  };

  const fillPercent = ((value - minimumValue) / (maximumValue - minimumValue)) * 100;

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        <Text style={styles.minMax}>{minimumValue}</Text>
        <View
          ref={trackRef}
          style={styles.track}
          onLayout={onTrackLayout}
          {...panResponder.panHandlers}
        >
          <View style={[styles.trackFill, { width: `${fillPercent}%` as any }]} />
          <View
            style={[
              styles.thumb,
              { left: `${fillPercent}%` as any },
            ]}
          />
        </View>
        <Text style={styles.minMax}>{maximumValue}</Text>
      </View>
      <Text style={styles.value}>
        当前: {value}{valueSuffix}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  track: {
    flex: 1,
    marginHorizontal: 8,
    height: 40,
    justifyContent: 'center',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    marginLeft: -12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  minMax: {
    fontSize: 12,
    color: colors.text.tertiary,
    width: 30,
    textAlign: 'center',
  },
  value: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 8,
  },
});
