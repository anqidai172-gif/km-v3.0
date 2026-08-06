import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, tokens, typography, fontFamily } from '../../theme';

interface PageHeaderProps {
  title: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
}

export function PageHeader({ title, leftAction, rightAction }: PageHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.sideLeft}>{leftAction}</View>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={styles.sideRight}>{rightAction}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: tokens.borderWidth.hairline,
    borderBottomColor: colors.divider,
  },
  sideLeft: {
    minWidth: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideRight: {
    minWidth: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: typography.h3.fontSize,
    fontWeight: '700',
    letterSpacing: 3,
    color: colors.text.primary,
    fontFamily,
    textAlign: 'center',
  },
});
