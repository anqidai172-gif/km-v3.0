import { Platform, StyleSheet } from 'react-native';

// ============================================================
// Scholar's Desk — Typography System
// ============================================================
//
// Display: KaiTi (iOS) / serif (Android) — used sparingly
//   for titles, headers, and key numbers only.
// Body: system sans-serif (PingFang SC / Roboto) — used for
//   all functional UI, labels, body text, captions.
// ============================================================

export const fontFamily = Platform.select({
  ios: 'KaiTi',
  android: 'serif',
  default: 'serif',
});

export const typography = StyleSheet.create({
  // ── Display (serif/KaiTi) — titles & key moments ──
  displayLarge: {
    fontFamily,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
  },
  display: {
    fontFamily,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  displaySmall: {
    fontFamily,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },

  // ── Heading (sans-serif) — section headers ──
  h1: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
  },
  h2: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 30,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
  },

  // ── Body (sans-serif) — content ──
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },

  // ── Utility ──
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  score: {
    fontFamily,
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 56,
  },
});
