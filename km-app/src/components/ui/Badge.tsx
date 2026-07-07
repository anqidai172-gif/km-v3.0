import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme';

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
    <View
      style={[
        styles.base,
        styles[`size_${size}`],
        variant === 'filled'
          ? { backgroundColor: badgeColor + '20' }
          : { borderWidth: 1, borderColor: badgeColor },
      ]}
    >
      <Text
        style={[
          styles.text,
          styles[`textSize_${size}`],
          { color: variant === 'filled' ? badgeColor : badgeColor },
        ]}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  size_sm: {
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  size_md: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  text: {
    fontWeight: '500',
  },
  textSize_sm: {
    fontSize: 11,
  },
  textSize_md: {
    fontSize: 13,
  },
});
