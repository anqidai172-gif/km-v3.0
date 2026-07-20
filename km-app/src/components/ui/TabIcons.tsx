/**
 * Tab bar custom icons — hand-drawn ink style using react-native-svg paths.
 * Replaces emoji-based icons with consistent vector artwork.
 */
import React from 'react';
import Svg, { Circle, Path, Line, Rect, G } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  active?: boolean;
}

const DEFAULT_SIZE = 24;

/* ── 训练 (Training) — Target / Concentric ────────────────────── */
export function TrainIcon({ size = DEFAULT_SIZE, color = '#242220', active }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.5} opacity={active ? 1 : 0.5} />
      <Circle cx={12} cy={12} r={6} stroke={color} strokeWidth={1.5} />
      <Circle cx={12} cy={12} r={2} fill={color} />
      <Line x1={12} y1={2} x2={12} y2={6} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

/* ── 输入 (Input) — Pen / Write ────────────────────────────────── */
export function InputIcon({ size = DEFAULT_SIZE, color = '#242220', active }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 3L21 8L8 21H3V16L16 3Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        fill="none"
        opacity={active ? 1 : 0.5}
      />
      <Line x1={3} y1={21} x2={8} y2={16} stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

/* ── 网状 (Mesh) — Network / Nodes ─────────────────────────────── */
export function MeshIcon({ size = DEFAULT_SIZE, color = '#242220', active }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={5} r={3} stroke={color} strokeWidth={1.5} fill="none" opacity={active ? 1 : 0.5} />
      <Circle cx={5} cy={19} r={3} stroke={color} strokeWidth={1.5} fill="none" />
      <Circle cx={19} cy={19} r={3} stroke={color} strokeWidth={1.5} fill="none" />
      <Line x1={10.5} y1={7.5} x2={7} y2={16.5} stroke={color} strokeWidth={1.2} />
      <Line x1={13.5} y1={7.5} x2={17} y2={16.5} stroke={color} strokeWidth={1.2} />
      <Line x1={8} y1={19} x2={16} y2={19} stroke={color} strokeWidth={1.2} />
    </Svg>
  );
}

/* ── 设置 (Settings) — Gear ───────────────────────────────────── */
export function SettingsIcon({ size = DEFAULT_SIZE, color = '#242220', active }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.5} fill="none" />
      <G opacity={active ? 1 : 0.5}>
        <Path
          d="M12 1L14 5.2L18.5 4L19.5 8.5L15.6 11L18.5 13.5L19.5 18L14 16.8L12 21L10 16.8L4.5 18L3.5 13.5L6.4 11L3.5 8.5L4.5 4L10 5.2L12 1Z"
          stroke={color}
          strokeWidth={1.5}
          fill="none"
        />
      </G>
    </Svg>
  );
}

/* ── 首页 (Home) — House ───────────────────────────────────────── */
export function HomeIcon({ size = DEFAULT_SIZE, color = '#242220', active }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12L12 3L21 12" stroke={color} strokeWidth={1.5} strokeLinejoin="round" opacity={active ? 1 : 0.5} />
      <Path d="M5 10V20H19V10" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <Rect x={9} y={14} width={6} height={6} stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}
