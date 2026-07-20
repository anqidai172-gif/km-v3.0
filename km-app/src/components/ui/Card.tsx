import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { colors, tokens } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
}

export function Card({ children, style, elevated = false }: CardProps) {
  return (
    <View style={[styles.card, elevated && styles.elevated, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: tokens.radius.lg,
    padding: 16,
    borderWidth: tokens.borderWidth.thin,
    borderColor: colors.border,
  },
  elevated: {
    ...tokens.shadow.elevated,
  },
});
