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
    borderWidth: tokens.borderWidth.hairline,
    borderColor: colors.divider,
  },
  elevated: {
    shadowColor: '#171513',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
});
