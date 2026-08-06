import { spacing } from './spacing';

/** Standard page content padding — used by all ScrollView content containers */
export const pageContentPadding = {
  paddingHorizontal: spacing.lg,   // 16
  paddingTop: spacing.md,          // 12
  paddingBottom: spacing['4xl'],   // 40
} as const;
