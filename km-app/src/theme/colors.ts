// ============================================================
// Woodcut Letterpress — Design Token System
// 手作拓印 / 干笔木刻风格
// ============================================================
//
// 色彩规则:
//   主背景: 羊皮纸浅米色 #F5F0E6 + 纤维纹理
//   主文字: 干笔深炭黑 #171513
//   哑光金: #9A7B38 — 仅极小面积点缀，绝不喧宾夺主
// ============================================================

export const colors = {
  // ── Core palette ──
  /** 羊皮纸 — main screen & sheet background */
  background: '#F5F0E6',
  /** 书页白 — cards, elevated surfaces */
  surface: '#FAF6EE',
  /** 羊皮纸暖 — slightly warmer card variant */
  surfaceElevated: '#FAF5EB',
  /** 最亮浮层 */
  surfaceLight: '#FDFAF4',
  /** 半透叠层 */
  surfaceOverlay: 'rgba(245,240,230,0.82)',

  // ── Ink hierarchy ──
  /** 深炭黑 — primary text, ink borders, icons */
  primary: '#171513',
  primaryLight: 'rgba(23,21,19,0.06)',
  primaryDark: '#0D0B0A',

  // ── Accent ──
  /** 哑光古铜金 — 极小面积点缀：字母首笔、鸟眼、分值 */
  accent: '#9A7B38',
  accentLight: 'rgba(154,123,56,0.10)',
  accentDark: '#6B5425',

  // ── Semantic ──
  success: '#5C7A62',
  successLight: '#EDF2ED',

  warning: '#B8934E',
  warningLight: '#F9F4EA',

  danger: '#B85555',
  dangerLight: '#FAEEEE',

  // ── Text ──
  text: {
    primary: '#171513',
    secondary: '#6E675D',
    tertiary: '#9A948A',
    inverse: '#FAF6EE',
  },

  // ── Borders & dividers ──
  border: '#171513',
  divider: '#D4CDC0',

  // ── Overlay ──
  overlay: 'rgba(23,21,19,0.50)',

  // ── Category palette ──
  categoryColors: [
    '#171513', '#9A7B38', '#5C7A62', '#B8934E',
    '#6B5B7C', '#B06868', '#5C7A8C', '#6B8C5C',
    '#8C7A5C', '#A87850', '#5C8C7A', '#8C5C6B',
  ],

  // ── Training state colors ──
  stateColors: {
    pending_retell: '#171513',
    retold: '#5C7A62',
    pending_restate: '#9A7B38',
    restated: '#6B5B7C',
  },
} as const;

// ============================================================
// Design Tokens
// ============================================================

export const tokens = {
  radius: {
    sm: 5,
    md: 8,
    lg: 12,
    xl: 20,
    full: 9999,
  },

  borderWidth: {
    hairline: 0.5,
    thin: 1,
    standard: 2,
    thick: 3,
  },

  shadow: {
    hard: {
      shadowColor: '#171513',
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 0.85,
      shadowRadius: 0,
      elevation: 4,
    },
    hardSm: {
      shadowColor: '#171513',
      shadowOffset: { width: 1.5, height: 1.5 },
      shadowOpacity: 0.7,
      shadowRadius: 0,
      elevation: 2,
    },
    elevated: {
      shadowColor: '#171513',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius: 8,
      elevation: 4,
    },
  },
} as const;

export type ColorKey = keyof typeof colors;
