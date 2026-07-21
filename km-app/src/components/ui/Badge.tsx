import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { colors, tokens } from '../../theme';

interface BadgeProps {
  label: string;
  color?: string;
  variant?: 'filled' | 'outline';
  size?: 'sm' | 'md';
}

const stateLabels: Record<string, string> = {
  pending_retell: '待复述',
  retold: '已复述',
  pending_restate: '待重述',
  restated: '已重述',
  draft: '未确认',
  confirmed: '已入库',
  archived: '已归档',
};

const stateColors: Record<string, string> = {
  pending_retell: colors.stateColors.pending_retell,
  retold: colors.stateColors.retold,
  pending_restate: colors.stateColors.pending_restate,
  restated: colors.stateColors.restated,
  draft: colors.warning,
  confirmed: colors.success,
  archived: colors.text.tertiary,
};

export function Badge({ label, color, variant = 'filled', size = 'sm' }: BadgeProps) {
  const displayLabel = stateLabels[label] || label;
  const badgeColor = color || stateColors[label] || colors.primary;

  return (
    <View style={styles.wrap}>
      {/* Pencil-drawn border overlay (ref: home.tsx tag style) */}
      <View style={styles.pencilCanvas} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 72 24" preserveAspectRatio="none">
          <Rect x={2} y={2} width={68} height={20}
            stroke="#3A3530" strokeWidth={1.2} strokeDasharray="12 4 8 3 16 4"
            strokeLinecap="round" fill="none" opacity={0.38} rx={3} ry={3} />
          <Rect x={3} y={1} width={66} height={22}
            stroke="#4A4440" strokeWidth={0.9} strokeDasharray="6 5 10 3 8 4"
            strokeLinecap="round" fill="none" opacity={0.30} rx={4} ry={2} />
        </Svg>
      </View>
      <View style={[styles.badge, variant === 'outline' && { borderWidth: 1, borderColor: badgeColor }]}>
        <Text style={[styles.text, { color: variant === 'outline' ? badgeColor : colors.text.secondary }]}>
          {displayLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  pencilCanvas: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    zIndex: 0,
  },
  badge: {
    borderRadius: 3,
    backgroundColor: 'rgba(245,240,230,0.5)',
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  text: {
    fontSize: 11,
    fontWeight: '500',
  },
});
