export const colors = {
  primary: '#4A90D9',
  primaryLight: '#E6F4FE',
  primaryDark: '#2E6DB4',

  success: '#34C759',
  successLight: '#E8F8ED',

  warning: '#FF9500',
  warningLight: '#FFF4E5',

  danger: '#FF3B30',
  dangerLight: '#FFEBEA',

  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',

  text: {
    primary: '#1A1A2E',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    inverse: '#FFFFFF',
  },

  border: '#E5E7EB',
  divider: '#F3F4F6',

  categoryColors: [
    '#4A90D9', '#34C759', '#FF9500', '#FF3B30',
    '#AF52DE', '#FF2D55', '#5856D6', '#007AFF',
    '#5AC8FA', '#FFD60A', '#32D74B', '#BF5AF2',
  ],

  stateColors: {
    pending_retell: '#4A90D9',
    retold: '#34C759',
    pending_restate: '#FF9500',
    restated: '#AF52DE',
  },
} as const;

export type ColorKey = keyof typeof colors;
