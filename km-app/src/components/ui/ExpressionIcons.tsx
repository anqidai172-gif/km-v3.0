/**
 * Expression page — hand-drawn icons replacing emoji.
 * Woodcut / letterpress ink style, all SVG paths.
 */
import React from 'react';
import Svg, { Path, Circle, Line, Rect, G } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
}

const INK = '#171513';
const DIM = '#6E675D';

/* ── Flame (🔥 → 待复述) ─────────────────────────────────── */
export function FlameIcon({ size = 16, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 1C7 3.5 5 5 4.5 7.5C4 10 5.5 13 8 14.5C10.5 13 12 10 11.5 7.5C11 5 9 3.5 8 1Z"
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M6.5 9C6.8 10.5 8 12 8 12C8 12 9.2 10.5 9.5 9"
        stroke={color}
        strokeWidth={0.8}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/* ── Archive (📂 → 已复述) ───────────────────────────────── */
export function ArchiveIcon({ size = 16, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M1.5 5.5H14.5V14H1.5V5.5Z"
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M1.5 5.5L3.5 2.5H12.5L14.5 5.5"
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
        fill="none"
      />
      <Line x1={6} y1={8.5} x2={10} y2={8.5} stroke={color} strokeWidth={0.8} strokeLinecap="round" />
      <Line x1={7} y1={10.5} x2={9} y2={10.5} stroke={color} strokeWidth={0.6} strokeLinecap="round" />
    </Svg>
  );
}

/* ── Left Arrow (◀ → back) ───────────────────────────────── */
export function ChevronLeftIcon({ size = 18, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path
        d="M11 4L6 9L11 14"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ── Hamburger (☰ → menu) ────────────────────────────────── */
export function MenuIcon({ size = 20, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Line x1={3.5} y1={5.5} x2={16.5} y2={5.5} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={3.5} y1={10} x2={16.5} y2={10} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={3.5} y1={14.5} x2={12} y2={14.5} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/* ── Bar Chart (📊 → overview) ────────────────────────────── */
export function ChartIcon({ size = 18, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Rect x={2} y={9} width={3.5} height={6.5} rx={0.5} stroke={color} strokeWidth={1.2} fill="none" />
      <Rect x={7.25} y={5} width={3.5} height={10.5} rx={0.5} stroke={color} strokeWidth={1.2} fill="none" />
      <Rect x={12.5} y={7} width={3.5} height={8.5} rx={0.5} stroke={color} strokeWidth={1.2} fill="none" />
      <Line x1={1} y1={15.5} x2={17} y2={15.5} stroke={color} strokeWidth={1} strokeLinecap="round" />
    </Svg>
  );
}

/* ── Lightning (⚡ → score) ───────────────────────────────── */
export function LightningIcon({ size = 16, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M9.5 1L4 9H7.5L6.5 15L12 7H8.5L9.5 1Z"
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/* ── Magnify (🔍 → search) ───────────────────────────────── */
export function SearchIcon({ size = 14, color = DIM }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Circle cx={5.5} cy={5.5} r={4.5} stroke={color} strokeWidth={1.3} fill="none" />
      <Line x1={9} y1={9} x2={13} y2={13} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

/* ── Close (✕ → clear) ───────────────────────────────────── */
export function CloseIcon({ size = 14, color = DIM }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Line x1={3} y1={3} x2={11} y2={11} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={11} y1={3} x2={3} y2={11} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

/* ── Hourglass (⏳ → sort) ────────────────────────────────── */
export function HourglassIcon({ size = 14, color = DIM }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M3 1H11" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <Path d="M3 13H11" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <Path
        d="M4.5 1.5V5C4.5 6.5 5.5 7.5 7 8C8.5 7.5 9.5 6.5 9.5 5V1.5"
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M4.5 12.5V9C4.5 7.5 5.5 6.5 7 6C8.5 6.5 9.5 7.5 9.5 9V12.5"
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/* ── Sparkle (🎉 → empty pending) ──────────────────────────── */
export function SparkleIcon({ size = 48, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* Star / sparkle shape */}
      <Path
        d="M24 4L26.5 18L30 11L29 20L35 15L31.5 23L38 21L32.5 26.5L39 28L32 30L37 34L30 32.5L34 38L27 33.5L28 40L24 34L20 40L21 33.5L14 38L18 32.5L11 34L16 30L9 28L17 26.5L10 21L18 23L14.5 15L21 20L19.5 11L23 18L24 4Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        fill="none"
        opacity={0.6}
      />
      <Circle cx={24} cy={24} r={5} stroke={color} strokeWidth={1.2} fill="none" opacity={0.8} />
      <Circle cx={24} cy={24} r={1.5} fill={color} opacity={0.7} />
    </Svg>
  );
}

/* ── Empty Tray (📭 → empty completed) ────────────────────── */
export function EmptyTrayIcon({ size = 48, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* Tray with open lid */}
      <Path
        d="M8 28L12 16H36L40 28V38H8V28Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        fill="none"
        opacity={0.7}
      />
      {/* Lid slightly ajar */}
      <Path
        d="M6 24L12 16H36L42 24"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        fill="none"
        opacity={0.5}
      />
      <Line x1={8} y1={28} x2={40} y2={28} stroke={color} strokeWidth={1.2} opacity={0.6} />
      {/* Empty indicator — small wavy line */}
      <Path
        d="M18 34C20 33 22 35 24 34C26 33 28 35 30 34"
        stroke={color}
        strokeWidth={0.8}
        strokeLinecap="round"
        fill="none"
        opacity={0.4}
      />
    </Svg>
  );
}

/* ── Calendar (📅 → defer) ──────────────────────────────── */
export function CalendarIcon({ size = 20, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Rect x={2.5} y={3.5} width={15} height={14.5} rx={1.5} stroke={color} strokeWidth={1.3} fill="none" />
      <Line x1={2.5} y1={8} x2={17.5} y2={8} stroke={color} strokeWidth={1.3} />
      <Line x1={6} y1={1.5} x2={6} y2={5.5} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
      <Line x1={14} y1={1.5} x2={14} y2={5.5} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
      <Line x1={6} y1={10.5} x2={8} y2={10.5} stroke={color} strokeWidth={0.8} strokeLinecap="round" opacity={0.6} />
      <Line x1={10} y1={10.5} x2={12} y2={10.5} stroke={color} strokeWidth={0.8} strokeLinecap="round" opacity={0.6} />
    </Svg>
  );
}

/* ── Box / Package (📦 → item) ───────────────────────────── */
export function BoxIcon({ size = 18, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path d="M2.5 5.5L9 2L15.5 5.5V14.5L9 18L2.5 14.5V5.5Z" stroke={color} strokeWidth={1.3} strokeLinejoin="round" fill="none" />
      <Path d="M2.5 5.5L9 9L15.5 5.5" stroke={color} strokeWidth={1.3} strokeLinejoin="round" fill="none" />
      <Line x1={9} y1={9} x2={9} y2={18} stroke={color} strokeWidth={1.3} />
    </Svg>
  );
}

/* ── Trophy (🏆 → score) ─────────────────────────────────── */
export function TrophyIcon({ size = 14, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M4 1.5H10V5C10 7 8 8.5 7 9.5C6 8.5 4 7 4 5V1.5Z" stroke={color} strokeWidth={1.2} strokeLinejoin="round" fill="none" />
      <Path d="M3.5 3H2C1.2 3 0.8 4 1.2 4.8L2.5 6.5" stroke={color} strokeWidth={1.1} strokeLinecap="round" fill="none" />
      <Path d="M10.5 3H12C12.8 3 13.2 4 12.8 4.8L11.5 6.5" stroke={color} strokeWidth={1.1} strokeLinecap="round" fill="none" />
      <Line x1={5.5} y1={9.5} x2={8.5} y2={9.5} stroke={color} strokeWidth={1} strokeLinecap="round" />
      <Line x1={7} y1={9.5} x2={7} y2={12.5} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <Line x1={5} y1={13} x2={9} y2={13} stroke={color} strokeWidth={1} strokeLinecap="round" />
    </Svg>
  );
}

/* ── Microphone (🎙️ → action) ──────────────────────────── */
export function MicIcon({ size = 12, color = '#FAF6EE' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Rect x={4} y={0.5} width={4} height={6} rx={2} stroke={color} strokeWidth={1.2} fill="none" />
      <Path d="M2.5 4.5V5.5C2.5 8 4.5 10 6 10.5C7.5 10 9.5 8 9.5 5.5V4.5" stroke={color} strokeWidth={1.2} strokeLinecap="round" fill="none" />
      <Line x1={6} y1={10.5} x2={6} y2={12} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <Line x1={4} y1={12} x2={8} y2={12} stroke={color} strokeWidth={1} strokeLinecap="round" />
    </Svg>
  );
}

/* ── Link / chain (🔗 → url input) ────────────────────────── */
export function LinkIcon({ size = 14, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M5.5 8.5C4.8 9.5 4 10.5 4 11C3.2 11.8 2.5 11.5 2 11C1.5 10.5 1.2 9.8 2 9L3.5 7.5" stroke={color} strokeWidth={1.2} strokeLinecap="round" fill="none" />
      <Path d="M8.5 5.5C9.2 4.5 10 3.5 10 3C10.8 2.2 11.5 2.5 12 3C12.5 3.5 12.8 4.2 12 5L10.5 6.5" stroke={color} strokeWidth={1.2} strokeLinecap="round" fill="none" />
      <Path d="M6 3.5L7.5 2C9 0.5 10.5 1.5 10.5 3L8 5.5" stroke={color} strokeWidth={1.2} strokeLinecap="round" fill="none" />
      <Path d="M8 10.5L6.5 12C5 13.5 3.5 12.5 3.5 11L6 8.5" stroke={color} strokeWidth={1.2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/* ── Pencil / write (✍️📝 → edit) ──────────────────────────── */
export function PencilIcon({ size = 14, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M2 10.5V12.5H4L11 5.5L9 3.5L2 10.5Z" stroke={color} strokeWidth={1.2} strokeLinejoin="round" fill="none" />
      <Path d="M9.5 3L11 4.5" stroke={color} strokeWidth={1.2} strokeLinecap="round" fill="none" />
      <Line x1={8} y1={1.5} x2={12.5} y2={1.5} stroke={color} strokeWidth={0.8} strokeLinecap="round" opacity={0.5} />
    </Svg>
  );
}

/* ── Refresh / regenerate (🔄 → AI regenerate) ─────────────── */
export function RefreshIcon({ size = 14, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M2.5 5.5C3.5 3 6 1.5 9 2C11.5 2.5 13 5 12.5 7.5C12 10 9.5 12 7 11.5" stroke={color} strokeWidth={1.2} strokeLinecap="round" fill="none" />
      <Path d="M4 4L2 5.5L4 7" stroke={color} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M12 8.5C11 11 8.5 12.5 6 12C3.5 11.5 2 9 2.5 6.5" stroke={color} strokeWidth={0.6} strokeLinecap="round" fill="none" opacity={0.4} />
    </Svg>
  );
}

/* ── Chevron Down (🔽 → expand) ────────────────────────────── */
export function ChevronDownIcon({ size = 14, color = DIM }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M3 5L7 10L11 5" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/* ── Chevron Right (▶ → next page) ─────────────────────────── */
export function ChevronRightIcon({ size = 14, color = DIM }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M5 3L10 7L5 11" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/* ── Trash (🗑️ → delete / discard) ────────────────────────── */
export function TrashIcon({ size = 14, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Line x1={4} y1={3.5} x2={10} y2={3.5} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <Path d="M5.5 2.5H8.5L9.5 3.5H11.5V5H2.5V3.5H4.5L5.5 2.5Z" stroke={color} strokeWidth={1.1} strokeLinejoin="round" fill="none" />
      <Rect x={4.5} y={5.5} width={5} height={6} rx={0.5} stroke={color} strokeWidth={1.1} fill="none" />
      <Line x1={5.5} y1={7.5} x2={8.5} y2={7.5} stroke={color} strokeWidth={0.7} strokeLinecap="round" opacity={0.5} />
    </Svg>
  );
}

/* ── Check (✅ → done / confirm) ───────────────────────────── */
export function CheckIcon({ size = 14, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M2.5 7L5.5 10.5L11.5 3.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/* ── Folder (📂 → history / sidebar) ───────────────────────── */
export function FolderIcon({ size = 14, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M2 3.5H5.5L7 5H12V11.5H2V3.5Z" stroke={color} strokeWidth={1.2} strokeLinejoin="round" fill="none" />
      <Line x1={2} y1={5} x2={12} y2={5} stroke={color} strokeWidth={1} opacity={0.4} />
      <Path d="M3.5 7.5H6.5" stroke={color} strokeWidth={0.7} strokeLinecap="round" opacity={0.5} />
    </Svg>
  );
}

/* ── Constellation / galaxy (🌌 → empty star map) ─────────── */
export function ConstellationIcon({ size = 48, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* Stars / nodes */}
      <Circle cx={24} cy={8} r={2.5} stroke={color} strokeWidth={1.2} fill="none" opacity={0.8} />
      <Circle cx={10} cy={18} r={2} stroke={color} strokeWidth={1.1} fill="none" opacity={0.7} />
      <Circle cx={38} cy={16} r={1.8} stroke={color} strokeWidth={1} fill="none" opacity={0.65} />
      <Circle cx={16} cy={32} r={2.2} stroke={color} strokeWidth={1.2} fill="none" opacity={0.75} />
      <Circle cx={34} cy={30} r={1.5} stroke={color} strokeWidth={0.9} fill="none" opacity={0.6} />
      <Circle cx={26} cy={38} r={2} stroke={color} strokeWidth={1.1} fill="none" opacity={0.7} />
      <Circle cx={8} cy={38} r={1.3} stroke={color} strokeWidth={0.8} fill="none" opacity={0.5} />
      <Circle cx={42} cy={38} r={1.5} stroke={color} strokeWidth={0.9} fill="none" opacity={0.55} />
      {/* Connecting lines */}
      <Line x1={24} y1={8} x2={10} y2={18} stroke={color} strokeWidth={0.7} strokeLinecap="round" opacity={0.35} />
      <Line x1={24} y1={8} x2={38} y2={16} stroke={color} strokeWidth={0.6} strokeLinecap="round" opacity={0.3} />
      <Line x1={10} y1={18} x2={16} y2={32} stroke={color} strokeWidth={0.7} strokeLinecap="round" opacity={0.35} />
      <Line x1={38} y1={16} x2={34} y2={30} stroke={color} strokeWidth={0.6} strokeLinecap="round" opacity={0.3} />
      <Line x1={16} y1={32} x2={26} y2={38} stroke={color} strokeWidth={0.7} strokeLinecap="round" opacity={0.35} />
      <Line x1={16} y1={32} x2={8} y2={38} stroke={color} strokeWidth={0.6} strokeLinecap="round" opacity={0.3} />
      <Line x1={34} y1={30} x2={26} y2={38} stroke={color} strokeWidth={0.6} strokeLinecap="round" opacity={0.3} />
      <Line x1={34} y1={30} x2={42} y2={38} stroke={color} strokeWidth={0.5} strokeLinecap="round" opacity={0.25} />
    </Svg>
  );
}

/* ── Paperclip (📎 → attachment / source link) ─────────────── */
export function PaperclipIcon({ size = 14, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path
        d="M7.5 2C6 0.5 3.5 1 2.5 2.5C1.5 4 2 6 3.5 7L8.5 12C9.5 13 11.5 13 12.5 11.5C13.5 10 13 8 11.5 7L7 2.5"
        stroke={color} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
    </Svg>
  );
}

/* ── Target / aim (🎯 → start training) ────────────────────── */
export function TargetIcon({ size = 14, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Circle cx={7} cy={7} r={5.5} stroke={color} strokeWidth={1.2} fill="none" />
      <Circle cx={7} cy={7} r={2.5} stroke={color} strokeWidth={1} fill="none" />
      <Circle cx={7} cy={7} r={0.8} fill={color} opacity={0.7} />
      <Line x1={7} y1={1} x2={7} y2={2.5} stroke={color} strokeWidth={1} strokeLinecap="round" opacity={0.5} />
      <Line x1={7} y1={11.5} x2={7} y2={13} stroke={color} strokeWidth={1} strokeLinecap="round" opacity={0.5} />
      <Line x1={1} y1={7} x2={2.5} y2={7} stroke={color} strokeWidth={1} strokeLinecap="round" opacity={0.5} />
      <Line x1={11.5} y1={7} x2={13} y2={7} stroke={color} strokeWidth={1} strokeLinecap="round" opacity={0.5} />
    </Svg>
  );
}

/* ── Up Arrow (🔼 → modal header accent) ──────────────────── */
export function UpArrowIcon({ size = 14, color = INK }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M3 9L7 4L11 9" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/* ── Composite: tab icon renderer ──────────────────────────── */
export type ExpressionIconName =
  | 'flame'
  | 'archive'
  | 'chevron-left'
  | 'chevron-down'
  | 'chevron-right'
  | 'menu'
  | 'chart'
  | 'lightning'
  | 'search'
  | 'close'
  | 'hourglass'
  | 'sparkle'
  | 'empty-tray'
  | 'calendar'
  | 'box'
  | 'trophy'
  | 'mic'
  | 'link'
  | 'pencil'
  | 'refresh'
  | 'trash'
  | 'check'
  | 'folder'
  | 'up-arrow'
  | 'constellation'
  | 'paperclip'
  | 'target';

export function renderExpressionIcon(name: ExpressionIconName, size?: number, color?: string) {
  const props = { size, color };
  switch (name) {
    case 'flame':          return <FlameIcon {...props} />;
    case 'archive':        return <ArchiveIcon {...props} />;
    case 'chevron-left':   return <ChevronLeftIcon {...props} />;
    case 'chevron-down':   return <ChevronDownIcon {...props} />;
    case 'chevron-right':  return <ChevronRightIcon {...props} />;
    case 'menu':           return <MenuIcon {...props} />;
    case 'chart':          return <ChartIcon {...props} />;
    case 'lightning':      return <LightningIcon {...props} />;
    case 'search':         return <SearchIcon {...props} />;
    case 'close':          return <CloseIcon {...props} />;
    case 'hourglass':      return <HourglassIcon {...props} />;
    case 'sparkle':        return <SparkleIcon {...props} />;
    case 'empty-tray':     return <EmptyTrayIcon {...props} />;
    case 'calendar':       return <CalendarIcon {...props} />;
    case 'box':            return <BoxIcon {...props} />;
    case 'trophy':         return <TrophyIcon {...props} />;
    case 'mic':            return <MicIcon {...props} />;
    case 'link':           return <LinkIcon {...props} />;
    case 'pencil':         return <PencilIcon {...props} />;
    case 'refresh':        return <RefreshIcon {...props} />;
    case 'trash':          return <TrashIcon {...props} />;
    case 'check':          return <CheckIcon {...props} />;
    case 'folder':         return <FolderIcon {...props} />;
    case 'up-arrow':       return <UpArrowIcon {...props} />;
    case 'constellation':  return <ConstellationIcon {...props} />;
    case 'paperclip':      return <PaperclipIcon {...props} />;
    case 'target':         return <TargetIcon {...props} />;
  }
}
