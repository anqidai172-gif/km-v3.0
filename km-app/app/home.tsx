/**
 * 首页 — 文学手作拓印 (Woodcut Letterpress)
 * 朱伊暗纹 + 干笔拓印边框 + 3D 凸版卡片
 */
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
  Animated, PanResponder, TextInput,
} from 'react-native';
import Svg, { Path, Circle, Rect, Line, G } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, addDays, subDays } from 'date-fns';
import { colors, tokens, fontFamily } from '../src/theme';
import { EmptyTrayIcon, SendIcon } from '../src/components/ui/ExpressionIcons';
import { useExpressionStore } from '../src/stores/useExpressionStore';
import { useKnowledgeStore } from '../src/stores/useKnowledgeStore';
import type { TrainingRecord, TrainingState } from '../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = SCREEN_WIDTH * 0.72;


const STATE_GLYPH: Record<TrainingState, { label: string; glyph: string }> = {
  pending_retell:{label:'待复述',glyph:'○'}, retold:{label:'已复述',glyph:'●'},
  pending_restate:{label:'待重述',glyph:'◑'}, restated:{label:'已重述',glyph:'◉'},
};
const WEEKDAYS = ['周日','周一','周二','周三','周四','周五','周六'];

/* ═══════════════════════════════════════════════════════════
   SVG 朱伊暗纹元素
   ═══════════════════════════════════════════════════════════ */

/** 朱伊飞鸟 */
/** 木刻嫩芽 */
function WoodcutSprout() {
  return (
    <Svg width={30} height={30} viewBox="0 0 100 100" fill="none">
      <Path d="M 50 85 C 48 55, 35 35, 15 20 M 50 50 C 65 38, 80 32, 88 30" stroke={colors.primary} strokeWidth={7} strokeLinecap="round" />
      <Circle cx={20} cy={18} r={4} fill={colors.accent} />
    </Svg>
  );
}

/** 素材库图标1 — 唤醒铃 (18px) */
function IconWake() {
  return (
    <Svg width={18} height={18} viewBox="0 0 100 100" fill="none">
      <Path d="M 50 15 C 28 15, 15 35, 18 62 L 20 65 L 80 65 L 82 62 C 85 35, 72 15, 50 15 Z" stroke={colors.primary} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M 35 65 L 32 82 C 30 92, 70 92, 68 82 L 65 65" stroke={colors.primary} strokeWidth={6} strokeLinecap="round" fill="none" />
      <Circle cx={50} cy={52} r={5} fill={colors.primary} />
      <Path d="M 82 18 L 92 8 M 18 18 L 8 8" stroke={colors.primary} strokeWidth={5} strokeLinecap="round" />
    </Svg>
  );
}

/** 素材库图标2 — 生长芽 (18px) */
function IconGrow() {
  return (
    <Svg width={18} height={18} viewBox="0 0 100 100" fill="none">
      <Path d="M 50 90 L 50 25" stroke={colors.primary} strokeWidth={6} strokeLinecap="round" />
      <Path d="M 50 50 C 35 38, 22 28, 18 18" stroke={colors.primary} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d="M 50 50 C 65 40, 78 32, 82 22" stroke={colors.primary} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d="M 50 30 C 38 22, 30 12, 32 5" stroke={colors.primary} strokeWidth={4} strokeLinecap="round" fill="none" />
      <Path d="M 50 30 C 62 22, 70 15, 68 8" stroke={colors.primary} strokeWidth={4} strokeLinecap="round" fill="none" />
      <Circle cx={50} cy={20} r={5} fill={colors.accent} />
    </Svg>
  );
}

/** 素材库图标 — 语音输入 (18px) */
function IconMic() {
  return (
    <Svg width={18} height={18} viewBox="0 0 100 100" fill="none">
      <Rect x={38} y={8} width={24} height={42} rx={12} stroke={colors.primary} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M 20 45 C 20 65, 35 78, 50 78 C 65 78, 80 65, 80 45" stroke={colors.primary} strokeWidth={7} strokeLinecap="round" fill="none" />
      <Path d="M 50 78 L 50 95" stroke={colors.primary} strokeWidth={6} strokeLinecap="round" />
      <Path d="M 35 95 L 65 95" stroke={colors.primary} strokeWidth={5} strokeLinecap="round" />
    </Svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   组件
   ═══════════════════════════════════════════════════════════ */

/** 页眉 — 朱伊暗纹 + 品牌 */
function HeaderLayer() {
  return (
    <View style={S.headerLayer}>
      <View style={S.brandSprout}>
        <WoodcutSprout />
        <Text style={S.brandTitle}>灵感绿芽</Text>
      </View>
    </View>
  );
}

/** 状态概览 */
function StatusOverview({ count }:{count:number}) {
  return (
    <Text style={S.statusBanner}>
      今天已成功内化知识 <Text style={S.goldAccent}>{count}</Text> 条
    </Text>
  );
}

/** 日期切换 */
function DateSwitcher({ date, dayOfWeek, onPrev, onNext, onToday }: {
  date:string; dayOfWeek:string; onPrev:()=>void; onNext:()=>void; onToday:()=>void;
}) {
  return (
    <View style={S.dateBar}>
      <TouchableOpacity onPress={onPrev} activeOpacity={0.5}>
        <Text style={S.dateBtn}>{'< 前一天'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onToday} activeOpacity={0.7}>
        <View style={S.dateCurrentWrap}>
          {/* SVG 铅笔手绘选中框 */}
          <View style={S.datePencilCanvas} pointerEvents="none">
            <Svg width={160} height={36} viewBox="0 0 160 36">
              <Rect x={3} y={3} width={154} height={30}
                stroke="#3A3530" strokeWidth={1.5} strokeDasharray="18 5 10 3 22 4"
                strokeLinecap="round" fill="none" opacity={0.44} rx={6} ry={5} />
              <Rect x={5} y={2} width={150} height={32}
                stroke="#4A4440" strokeWidth={1.2} strokeDasharray="12 6 8 3 16 5 6 4"
                strokeLinecap="round" fill="none" opacity={0.36} rx={5} ry={6} />
              <Rect x={2} y={4} width={156} height={28}
                stroke="#3F3A36" strokeWidth={1.4} strokeDasharray="28 4 14 3 32 5"
                strokeLinecap="round" fill="none" opacity={0.40} rx={7} ry={4} />
              {/* 游离抖动 */}
              <Path d="M 6,4 Q 78,1 154,5"
                stroke="#3A3530" strokeWidth={0.8} strokeLinecap="round"
                fill="none" opacity={0.28} />
              <Path d="M 3,30 Q 80,34 156,32"
                stroke="#3A3530" strokeWidth={0.8} strokeLinecap="round"
                fill="none" opacity={0.28} />
            </Svg>
          </View>
          <Text style={S.dateCurrent}>{date} ({dayOfWeek})</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={onNext} activeOpacity={0.5}>
        <Text style={S.dateBtn}>后一天 {'>'}</Text>
      </TouchableOpacity>
    </View>
  );
}

/** 分割线 */
function SectionDivider() {
  return (
    <Text style={S.dividerText}>──────── 开始你的复述吧 ────────</Text>
  );
}

/** 知识卡片 — 中心卡为侘寂凸版印刷风格，侧卡为简洁索引卡 */
function KnowledgeCard({ record, item, cat, pos, onPress }: {
  record:TrainingRecord; item:{title:string;contentPreview?:string}|undefined;
  cat:{name:string}|undefined; pos:'left'|'center'|'right'; onPress:()=>void;
}) {
  const g=STATE_GLYPH[record.state]; const isCenter=pos==='center';

  if (isCenter) {
    return (
      <TouchableOpacity style={S.ccWrap} onPress={onPress} activeOpacity={0.85}>
        {/* 铅笔手绘边框 — SVG 路径模拟断线、抖动、反复勾勒 */}
        <View style={S.pencilCanvas} pointerEvents="none">
          <Svg width={CARD_W + 20} height={326} viewBox={`0 0 ${CARD_W + 20} ${326}`}>
            {/* 7层铅笔描边 — 四边均匀超出卡片边缘 */}
            {/* Layer 1 — 中心主笔触 */}
            <Rect x={7} y={15} width={CARD_W + 6} height={296}
              stroke="#3A3530" strokeWidth={1.7} strokeDasharray="22 5 14 4 28 5"
              strokeLinecap="round" fill="none" opacity={0.45} rx={10} ry={10} />
            {/* Layer 2 — 右偏上 */}
            <Rect x={8} y={14} width={CARD_W + 4} height={298}
              stroke="#4A4440" strokeWidth={1.5} strokeDasharray="14 7 8 3 20 5 10 4"
              strokeLinecap="round" fill="none" opacity={0.38} rx={11} ry={9} />
            {/* Layer 3 — 左下偏移 */}
            <Rect x={6} y={16} width={CARD_W + 8} height={294}
              stroke="#3F3A36" strokeWidth={1.8} strokeDasharray="30 4 16 5 34 3"
              strokeLinecap="round" fill="none" opacity={0.48} rx={9} ry={11} />
            {/* Layer 4 — 右下偏移淡细线 */}
            <Rect x={9} y={17} width={CARD_W + 2} height={292}
              stroke="#554F4A" strokeWidth={1.4} strokeDasharray="8 4 12 3 6 5 10 3"
              strokeLinecap="round" fill="none" opacity={0.42} rx={12} ry={8} />
            {/* Layer 5 — 左上偏移压笔 */}
            <Rect x={7} y={14} width={CARD_W + 6} height={298}
              stroke="#353230" strokeWidth={1.6} strokeDasharray="26 3 18 5 30 4"
              strokeLinecap="round" fill="none" opacity={0.50} rx={8} ry={12} />
            {/* Layer 6 — 右下轻飘短划 */}
            <Rect x={8} y={16} width={CARD_W + 4} height={294}
              stroke="#5A5450" strokeWidth={1.3} strokeDasharray="5 4 9 3 7 5 11 4"
              strokeLinecap="round" fill="none" opacity={0.35} rx={10} ry={10} />
            {/* Layer 7 — 左下收束 */}
            <Rect x={6} y={15} width={CARD_W + 8} height={296}
              stroke="#4A4440" strokeWidth={1.5} strokeDasharray="36 6 20 5 42 4"
              strokeLinecap="round" fill="none" opacity={0.44} rx={11} ry={9} />

            {/* 手绘抖动路径 — 四边等权游离笔触 */}
            <Path d={`M 12,13 Q ${CARD_W*0.3},11 ${CARD_W*0.6},15 T ${CARD_W+8},14`}
              stroke="#3A3530" strokeWidth={1.0} strokeLinecap="round"
              fill="none" opacity={0.30} />
            <Path d={`M ${CARD_W+13},20 Q ${CARD_W+11},${165} ${CARD_W+14},${305}`}
              stroke="#3A3530" strokeWidth={1.0} strokeLinecap="round" strokeDasharray="12 8 20 6"
              fill="none" opacity={0.30} />
            <Path d={`M ${CARD_W+8},${315} Q ${CARD_W*0.5},${319} 5,${313}`}
              stroke="#3A3530" strokeWidth={1.0} strokeLinecap="round" strokeDasharray="15 10 25 5"
              fill="none" opacity={0.30} />
            <Path d={`M 10,${307} Q 6,${165} 8,11`}
              stroke="#3A3530" strokeWidth={1.0} strokeLinecap="round" strokeDasharray="8 6 18 4"
              fill="none" opacity={0.30} />
          </Svg>
        </View>

        {/* 羊皮纸主体 */}
        <View style={S.parchment}>
          <View>
            <Text style={S.parchTitle} numberOfLines={1}>{item?.title||'—'}</Text>
            {item?.contentPreview
              ? <Text style={S.parchQuote} numberOfLines={9}>{'　　'}{item.contentPreview}</Text>
              : null}
          </View>
          {/* 底部栏 */}
          <View style={S.parchFoot}>
            {cat ? (
              <View style={S.cardTagWrap}>
                <View style={S.cardTagPencil} pointerEvents="none">
                  <Svg width="100%" height="100%" viewBox="0 0 80 24" preserveAspectRatio="none">
                    <Rect x={2} y={2} width={76} height={20}
                      stroke="#3A3530" strokeWidth={1.2} strokeDasharray="12 4 8 3 16 4"
                      strokeLinecap="round" fill="none" opacity={0.38} rx={3} ry={3} />
                    <Rect x={3} y={1} width={74} height={22}
                      stroke="#4A4440" strokeWidth={0.9} strokeDasharray="6 5 10 3 8 4"
                      strokeLinecap="round" fill="none" opacity={0.30} rx={4} ry={2} />
                  </Svg>
                </View>
                <View style={S.cardTagInner}>
                  <Text style={S.cardTagText}>{cat.name}</Text>
                </View>
              </View>
            ) : null}
            <View style={S.cardTagWrap}>
              <View style={S.cardTagPencil} pointerEvents="none">
                <Svg width="100%" height="100%" viewBox="0 0 80 24" preserveAspectRatio="none">
                  <Rect x={2} y={2} width={76} height={20}
                    stroke="#3A3530" strokeWidth={1.2} strokeDasharray="12 4 8 3 16 4"
                    strokeLinecap="round" fill="none" opacity={0.38} rx={3} ry={3} />
                  <Rect x={3} y={1} width={74} height={22}
                    stroke="#4A4440" strokeWidth={0.9} strokeDasharray="6 5 10 3 8 4"
                    strokeLinecap="round" fill="none" opacity={0.30} rx={4} ry={2} />
                </Svg>
              </View>
              <View style={S.cardTagInner}>
                <Text style={S.cardTagText}>{g.glyph} {g.label}</Text>
              </View>
            </View>
            <View style={S.footSpacer} />
            {record.bestScore!=null
              ? <Text style={S.parchScore}>{record.bestScore}分</Text> : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  /* ── 侧卡 (由外层 Animated 控制位置/缩放) ────────── */
  return (
    <TouchableOpacity
      style={S.sideCard}
      onPress={onPress} activeOpacity={0.7}
    >
      <View style={S.sidePencilCanvas} pointerEvents="none">
        <Svg width={CARD_W + 16} height={224} viewBox={`0 0 ${CARD_W + 16} ${224}`}>
          {/* 3层铅笔描边 — 四边均匀超出卡片 */}
          <Rect x={7} y={7} width={CARD_W + 2} height={210}
            stroke="#3A3530" strokeWidth={1.6} strokeDasharray="18 5 12 4 22 5"
            strokeLinecap="round" fill="none" opacity={0.42} rx={8} ry={8} />
          <Rect x={6} y={6} width={CARD_W + 4} height={212}
            stroke="#4A4440" strokeWidth={1.4} strokeDasharray="10 5 14 3 8 4"
            strokeLinecap="round" fill="none" opacity={0.48} rx={7} ry={9} />
          <Rect x={8} y={8} width={CARD_W} height={208}
            stroke="#554F4A" strokeWidth={1.5} strokeDasharray="24 6 12 4 18 5"
            strokeLinecap="round" fill="none" opacity={0.36} rx={9} ry={7} />
        </Svg>
      </View>
      <View style={S.sideBody}>
        <View style={S.sideContent}>
          <Text style={S.sideTitle} numberOfLines={2}>{item?.title||'—'}</Text>
        </View>
        <View style={S.sideFoot}>
          {cat ? (
            <View style={S.cardTagSmWrap}>
              <View style={S.cardTagSmPencil} pointerEvents="none">
                <Svg width="100%" height="100%" viewBox="0 0 60 20" preserveAspectRatio="none">
                  <Rect x={2} y={2} width={56} height={16}
                    stroke="#3A3530" strokeWidth={1.0} strokeDasharray="10 3 6 2 12 3"
                    strokeLinecap="round" fill="none" opacity={0.34} rx={2} ry={2} />
                  <Rect x={3} y={1} width={54} height={18}
                    stroke="#4A4440" strokeWidth={0.7} strokeDasharray="5 4 8 2 6 3"
                    strokeLinecap="round" fill="none" opacity={0.26} rx={3} ry={2} />
                </Svg>
              </View>
              <View style={S.cardTagSmInner}>
                <Text style={S.cardTagSmText}>{cat.name}</Text>
              </View>
            </View>
          ) : null}
          <View style={S.cardTagSmWrap}>
            <View style={S.cardTagSmPencil} pointerEvents="none">
              <Svg width="100%" height="100%" viewBox="0 0 60 20" preserveAspectRatio="none">
                <Rect x={2} y={2} width={56} height={16}
                  stroke="#3A3530" strokeWidth={1.0} strokeDasharray="10 3 6 2 12 3"
                  strokeLinecap="round" fill="none" opacity={0.34} rx={2} ry={2} />
                <Rect x={3} y={1} width={54} height={18}
                  stroke="#4A4440" strokeWidth={0.7} strokeDasharray="5 4 8 2 6 3"
                  strokeLinecap="round" fill="none" opacity={0.26} rx={3} ry={2} />
              </Svg>
            </View>
            <View style={S.cardTagSmInner}>
              <Text style={S.cardTagSmText}>{g.glyph} {g.label}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** 页面指示点 — 紧凑居中，超过 7 张时显示序号 */
function PageDots({ total, current, onPress }:{total:number;current:number;onPress:(i:number)=>void}) {
  if(total<=1)return null;
  return (
    <View style={S.dotsRow}>
      {total <= 7
        ? Array.from({length:total}).map((_,i)=>(
            <TouchableOpacity key={i} onPress={()=>onPress(i)}>
              <View style={[S.dot, i===current&&S.dotActive]}/>
            </TouchableOpacity>
          ))
        : <Text style={S.dotCounter}>{current + 1} / {total}</Text>
      }
    </View>
  );
}

/** 操作徽章 — SVG 铅笔手绘边框 + 硬影 */
function ActionBadges({ inProgress, onRandomWake }:{inProgress:number;onRandomWake:()=>void}) {
  return (
    <View style={S.badgesRow}>
      <TouchableOpacity style={S.badgeWrap} onPress={onRandomWake} activeOpacity={0.6}>
        {/* SVG 铅笔边框 */}
        <View style={S.badgePencilCanvas} pointerEvents="none">
          <Svg width={120} height={42} viewBox="0 0 120 42">
            <Rect x={3} y={3} width={114} height={36}
              stroke="#3A3530" strokeWidth={1.8} strokeDasharray="16 5 10 3 20 4"
              strokeLinecap="round" fill="none" opacity={0.44} rx={2} ry={2} />
            <Rect x={5} y={2} width={110} height={38}
              stroke="#4A4440" strokeWidth={1.3} strokeDasharray="10 6 8 3 14 5 6 4"
              strokeLinecap="round" fill="none" opacity={0.35} rx={3} ry={2} />
            <Rect x={2} y={4} width={116} height={34}
              stroke="#3F3A36" strokeWidth={1.5} strokeDasharray="24 3 14 4 28 3"
              strokeLinecap="round" fill="none" opacity={0.40} rx={2} ry={3} />
            <Path d="M 4,4 Q 60,2 116,5"
              stroke="#3A3530" strokeWidth={0.7} strokeLinecap="round"
              fill="none" opacity={0.26} />
            <Path d="M 3,36 Q 58,40 118,38"
              stroke="#3A3530" strokeWidth={0.7} strokeLinecap="round"
              fill="none" opacity={0.26} />
          </Svg>
        </View>
        <View style={S.badgeBody}>
          <View style={S.badgeIconRow}>
            <IconWake />
            <Text style={S.badgeText}>随机训练</Text>
          </View>
        </View>
      </TouchableOpacity>
      <View style={S.badgeWrap}>
        {/* SVG 铅笔边框 */}
        <View style={S.badgePencilCanvas} pointerEvents="none">
          <Svg width={130} height={42} viewBox="0 0 130 42">
            <Rect x={3} y={3} width={124} height={36}
              stroke="#3A3530" strokeWidth={1.8} strokeDasharray="16 5 10 3 20 4"
              strokeLinecap="round" fill="none" opacity={0.44} rx={2} ry={2} />
            <Rect x={5} y={2} width={120} height={38}
              stroke="#4A4440" strokeWidth={1.3} strokeDasharray="10 6 8 3 14 5 6 4"
              strokeLinecap="round" fill="none" opacity={0.35} rx={3} ry={2} />
            <Rect x={2} y={4} width={126} height={34}
              stroke="#3F3A36" strokeWidth={1.5} strokeDasharray="24 3 14 4 28 3"
              strokeLinecap="round" fill="none" opacity={0.40} rx={2} ry={3} />
            <Path d="M 4,4 Q 65,2 126,5"
              stroke="#3A3530" strokeWidth={0.7} strokeLinecap="round"
              fill="none" opacity={0.26} />
            <Path d="M 3,36 Q 63,40 128,38"
              stroke="#3A3530" strokeWidth={0.7} strokeLinecap="round"
              fill="none" opacity={0.26} />
          </Svg>
        </View>
        <View style={S.badgeBody}>
          <View style={S.badgeIconRow}>
            <IconGrow />
            <Text style={S.badgeText}>{inProgress}条内化中</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** 全局输入 — SVG 铅笔手绘边框 + TextInput + 发送按钮 */
function GlobalInput({ itemId, itemTitle }: { itemId: string | null; itemTitle: string }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const inputW = SCREEN_WIDTH - 32;

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !itemId) return;
    router.push({
      pathname: `/expression/${itemId}`,
      params: { initialText: trimmed },
    });
    setText('');
  };

  return (
    <View style={S.inputWrap}>
      <View style={S.inputBoxWrap}>
        {/* SVG 铅笔边框 */}
        <View style={S.inputPencilCanvas} pointerEvents="none">
          <Svg width={inputW} height={52} viewBox={`0 0 ${inputW} 52`}>
            <Rect x={3} y={3} width={inputW - 6} height={46}
              stroke="#3A3530" strokeWidth={1.8} strokeDasharray="18 5 12 4 22 5"
              strokeLinecap="round" fill="none" opacity={0.44} rx={2} ry={2} />
            <Rect x={5} y={2} width={inputW - 10} height={48}
              stroke="#4A4440" strokeWidth={1.3} strokeDasharray="10 6 8 3 14 5 6 4"
              strokeLinecap="round" fill="none" opacity={0.35} rx={3} ry={2} />
            <Rect x={2} y={4} width={inputW - 4} height={44}
              stroke="#3F3A36" strokeWidth={1.5} strokeDasharray="26 4 16 4 30 3"
              strokeLinecap="round" fill="none" opacity={0.40} rx={2} ry={3} />
            <Path d={`M 4,4 Q ${inputW/2},2 ${inputW-4},5`}
              stroke="#3A3530" strokeWidth={0.7} strokeLinecap="round"
              fill="none" opacity={0.26} />
            <Path d={`M 3,46 Q ${inputW/2},50 ${inputW-3},48`}
              stroke="#3A3530" strokeWidth={0.7} strokeLinecap="round"
              fill="none" opacity={0.26} />
          </Svg>
        </View>
        <View style={S.inputBody}>
          <TextInput
            style={S.textInput}
            value={text}
            onChangeText={setText}
            placeholder={`复述「${itemTitle}」…`}
            placeholderTextColor={colors.text.tertiary}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity onPress={handleSend} activeOpacity={0.7} style={S.sendBtn}>
            <SendIcon size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
   主页面
   ═══════════════════════════════════════════════════════════ */
export default function HomePage() {
  const router=useRouter();
  const records=useExpressionStore(s=>s.records);
  const items=useKnowledgeStore(s=>s.items);
  const categories=useKnowledgeStore(s=>s.categories);
  const [selectedDate,setSelectedDate]=useState(new Date());
  const todayStr=useMemo(()=>format(new Date(),'yyyy-MM-dd'),[]);
  const selectedDateStr = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);
  const confirmedItemIds=useMemo(()=>new Set(items.filter(i=>i.status==='confirmed').map(i=>i.id)),[items]);
  const todayStats=useMemo(()=>{
    const rel=records.filter(r=>confirmedItemIds.has(r.knowledgeItemId));
    return {
      internalized:rel.filter(r=>(r.state==='retold'||r.state==='restated')&&r.updatedAt?.startsWith(todayStr)).length,
      inProgress:rel.filter(r=>r.state==='pending_retell'||r.state==='pending_restate').length,
    };
  },[records,confirmedItemIds,todayStr]);
  const getItem=useCallback((id:string)=>items.find(i=>i.id===id),[items]);
  const getCat=useCallback((id:string)=>categories.find(c=>c.id===id),[categories]);

  // Carousel: only today's confirmed items
  const carouselCards=useMemo(()=>{
    const seen=new Set<string>();
    return records
      .filter(r=>{
        if(!confirmedItemIds.has(r.knowledgeItemId)) return false;
        const it = getItem(r.knowledgeItemId);
        return !!it?.createdAt?.startsWith(selectedDateStr);
      })
      .sort((a,b)=>b.priority-a.priority)
      .filter(r=>{if(seen.has(r.knowledgeItemId))return false;seen.add(r.knowledgeItemId);return true;});
  },[records,confirmedItemIds,selectedDateStr,getItem]);

  // Load data on mount (expression records + knowledge items)
  const loadAllExpr = useExpressionStore((s) => s.loadAll);
  const loadAllKn = useKnowledgeStore((s) => s.loadAll);
  useEffect(() => { loadAllExpr(); loadAllKn(); }, []);

  // === 堆叠拖拽轮播状态 ===
  const [activeIndex, setActiveIndex] = useState(0);
  const total = carouselCards.length;
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < total - 1;
  const prevIdx = activeIndex - 1;
  const nextIdx = activeIndex + 1;
  const SWIPE_THRESHOLD = CARD_W * 0.3;

  // 动画值
  const dragX = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  // 用 ref 保持最新值供 PanResponder 回调访问
  const activeIdxRef = useRef(activeIndex);
  activeIdxRef.current = activeIndex;
  const totalRef = useRef(total);
  totalRef.current = total;

  const animateToIndex = useCallback((targetIdx: number, dir: number) => {
    if (isAnimating.current || totalRef.current <= 1) return;
    isAnimating.current = true;
    Animated.timing(dragX, {
      toValue: dir * CARD_W,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      dragX.setValue(0);
      setActiveIndex(targetIdx);
      isAnimating.current = false;
    });
  }, [dragX]);

  // PanResponder — 用 ref 读取最新值
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2 && !isAnimating.current && totalRef.current > 1,
    onPanResponderMove: (_, gs) => {
      if (!isAnimating.current) dragX.setValue(gs.dx);
    },
    onPanResponderRelease: (_, gs) => {
      if (isAnimating.current) return;
      const t = totalRef.current;
      const idx = activeIdxRef.current;
      if (gs.dx < -SWIPE_THRESHOLD && t > 1 && idx < t - 1) {
        animateToIndex(idx + 1, -1);
      } else if (gs.dx > SWIPE_THRESHOLD && t > 1 && idx > 0) {
        animateToIndex(idx - 1, 1);
      } else {
        Animated.spring(dragX, {
          toValue: 0, useNativeDriver: true,
          tension: 120, friction: 14,
        }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(dragX, {
        toValue: 0, useNativeDriver: true,
        tension: 120, friction: 14,
      }).start();
    },
  })).current;

  const goPrevDay=()=>setSelectedDate(d=>subDays(d,1));
  const goNextDay=()=>setSelectedDate(d=>addDays(d,1));
  const goToday=()=>setSelectedDate(new Date());
  const dayOfWeek=WEEKDAYS[selectedDate.getDay()];
  const dateDisplay=format(selectedDate,'yyyy年 M月 d日');
  const handleCardPress=(r:TrainingRecord)=>router.push(`/knowledge/${r.knowledgeItemId}`);
  const handleRandomWake=()=>{
    const pending=records.filter(r=>confirmedItemIds.has(r.knowledgeItemId)&&(r.state==='pending_retell'||r.state==='pending_restate'));
    if(pending.length)router.push(`/expression/${pending[Math.floor(Math.random()*pending.length)].knowledgeItemId}`);
  };

  // 渲染单张卡片 — 只展示第一个选中的父分类
  const renderCard = (record: TrainingRecord, pos: 'left'|'center'|'right', animStyle?: any) => {
    const item = getItem(record.knowledgeItemId);
    const cat = item ? getCat(item.categoryId) : undefined;
    return (
      <Animated.View style={animStyle}>
        <KnowledgeCard
          record={record}
          item={item}
          cat={cat}
          pos={pos}
          onPress={() => handleCardPress(record)}
        />
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={S.root} edges={['top']}>
      {/* 页眉 */}
      <HeaderLayer />

      {/* 上浮层 */}
      <View style={S.floatingSheet}>
        {/* SVG 铅笔手绘上缘曲线 */}
        <View style={S.sheetPencilCanvas} pointerEvents="none">
          <Svg width={SCREEN_WIDTH} height={80} viewBox={`0 0 ${SCREEN_WIDTH} 80`}>
            {/* Layer 1 — 主笔触 */}
            <Path d={`M 0,68 Q 4,2 68,1 L ${SCREEN_WIDTH-68},1 Q ${SCREEN_WIDTH-4},2 ${SCREEN_WIDTH},68`}
              stroke="#3A3530" strokeWidth={1.8} strokeDasharray="22 5 14 4 28 5"
              strokeLinecap="round" fill="none" opacity={0.48} />
            {/* Layer 2 — 微偏移 */}
            <Path d={`M 0,66 Q 2,4 66,3 L ${SCREEN_WIDTH-66},3 Q ${SCREEN_WIDTH-2},4 ${SCREEN_WIDTH},66`}
              stroke="#4A4440" strokeWidth={1.4} strokeDasharray="14 7 8 3 20 5 10 4"
              strokeLinecap="round" fill="none" opacity={0.38} />
            {/* Layer 3 — 断续短划 */}
            <Path d={`M 0,70 Q 6,1 70,2 L ${SCREEN_WIDTH-70},2 Q ${SCREEN_WIDTH-6},1 ${SCREEN_WIDTH},70`}
              stroke="#3F3A36" strokeWidth={1.6} strokeDasharray="30 4 16 5 34 3"
              strokeLinecap="round" fill="none" opacity={0.42} />
            {/* Layer 4 — 轻细线 */}
            <Path d={`M 0,67 Q 3,3 67,2 L ${SCREEN_WIDTH-67},2 Q ${SCREEN_WIDTH-3},3 ${SCREEN_WIDTH},67`}
              stroke="#5A5450" strokeWidth={1.2} strokeDasharray="8 4 12 3 6 5 10 3"
              strokeLinecap="round" fill="none" opacity={0.35} />
            {/* Layer 5 — 游离抖动 */}
            <Path d={`M 4,71 Q 8,0 72,0 L ${SCREEN_WIDTH-72},0 Q ${SCREEN_WIDTH-8},0 ${SCREEN_WIDTH-4},71`}
              stroke="#4A4440" strokeWidth={1.0} strokeDasharray="10 8 18 6 24 5"
              strokeLinecap="round" fill="none" opacity={0.30} />
          </Svg>
        </View>

        <ScrollView style={S.sheetScroll} contentContainerStyle={S.sheetInner} showsVerticalScrollIndicator={false}>
          <StatusOverview count={todayStats.internalized} />
          <DateSwitcher date={dateDisplay} dayOfWeek={dayOfWeek} onPrev={goPrevDay} onNext={goNextDay} onToday={goToday} />
          <SectionDivider />

          {/* 堆叠拖拽轮播 */}
          {total > 0 ? (
            <View style={S.carouselWrap}>
              <View style={S.carouselStage}>
                {/* 左后景 — 右滑时滑入中心 (only if hasPrev) */}
                {hasPrev && (
                  <Animated.View style={[S.stackLeft, {
                    transform: [
                      { perspective: CARD_W * 2 },
                      { translateX: dragX.interpolate({ inputRange: [-CARD_W, 0, CARD_W], outputRange: [0, 0, CARD_W * 0.35], extrapolate: 'clamp' }) },
                      { rotateY: dragX.interpolate({ inputRange: [-CARD_W, 0, CARD_W], outputRange: ['-15deg', '-8deg', '0deg'], extrapolate: 'clamp' }) },
                      { scale: dragX.interpolate({ inputRange: [-CARD_W, 0, CARD_W], outputRange: [0.82, 0.82, 1.0], extrapolate: 'clamp' }) },
                    ],
                    opacity: dragX.interpolate({ inputRange: [-CARD_W, 0, CARD_W], outputRange: [0.3, 0.45, 1.0], extrapolate: 'clamp' }),
                  }]}>
                    {carouselCards[prevIdx] && renderCard(carouselCards[prevIdx], 'left')}
                  </Animated.View>
                )}

                {/* 右后景 — 左滑时滑入中心 (only if hasNext) */}
                {hasNext && (
                  <Animated.View style={[S.stackRight, {
                    transform: [
                      { perspective: CARD_W * 2 },
                      { translateX: dragX.interpolate({ inputRange: [-CARD_W, 0, CARD_W], outputRange: [-CARD_W * 0.65, 0, 0], extrapolate: 'clamp' }) },
                      { rotateY: dragX.interpolate({ inputRange: [-CARD_W, 0, CARD_W], outputRange: ['0deg', '8deg', '15deg'], extrapolate: 'clamp' }) },
                      { scale: dragX.interpolate({ inputRange: [-CARD_W, 0, CARD_W], outputRange: [1.0, 0.82, 0.82], extrapolate: 'clamp' }) },
                    ],
                    opacity: dragX.interpolate({ inputRange: [-CARD_W, 0, CARD_W], outputRange: [1.0, 0.45, 0.3], extrapolate: 'clamp' }),
                  }]}>
                    {carouselCards[nextIdx] && renderCard(carouselCards[nextIdx], 'right')}
                  </Animated.View>
                )}

                {/* 前景中心卡 — 可拖拽，翻页抬起 */}
                <Animated.View
                  style={[S.stackCenter, {
                    transform: [
                      { perspective: CARD_W * 2 },
                      { rotateY: dragX.interpolate({ inputRange: [-CARD_W, 0, CARD_W], outputRange: ['8deg', '0deg', '-8deg'], extrapolate: 'clamp' }) },
                      { translateX: dragX },
                      { scale: dragX.interpolate({ inputRange: [-CARD_W, 0, CARD_W], outputRange: [0.97, 1.0, 0.97], extrapolate: 'clamp' }) },
                    ],
                  }]}
                  {...panResponder.panHandlers}
                >
                  {renderCard(carouselCards[activeIndex], 'center')}
                </Animated.View>
              </View>
              <PageDots total={total} current={activeIndex} onPress={(i) => {
                if (i === activeIndex || isAnimating.current) return;
                animateToIndex(i, i > activeIndex ? 1 : -1);
              }}/>
            </View>
          ) : (
            <View style={S.emptyWrap}>
              <EmptyTrayIcon size={48} color={colors.text.secondary} />
              <Text style={S.emptyTitle}>暂无训练内容</Text>
              <Text style={S.emptyHint}>前往「知识输入」添加文章或文本，{'\n'}AI 解析后即可开始复述训练</Text>
            </View>
          )}

          <ActionBadges inProgress={todayStats.inProgress} onRandomWake={handleRandomWake}/>

          {/* 底部留白，避免被固定输入框遮挡 */}
          <View style={{height: 56}}/>
        </ScrollView>

        {/* 固定于底部的语音输入框 */}
        <View style={S.inputFixedWrap}>
          <GlobalInput
            itemId={carouselCards[activeIndex]?.knowledgeItemId ?? null}
            itemTitle={(() => {
              const item = getItem(carouselCards[activeIndex]?.knowledgeItemId ?? '');
              return item?.title || '当前知识';
            })()}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════
   样式
   ═══════════════════════════════════════════════════════════ */
const HDR_HEIGHT = 90;

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  /* 纸张纤维纹理 (全局底层) */
  rootTexture: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.06, pointerEvents: 'none' as const },

  /* ── 页眉 — 朱伊暗纹区 ──────────────────────────────── */
  headerLayer: { height: HDR_HEIGHT, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', zIndex: 3 },
  brandSprout: { zIndex: 2, alignItems: 'center', gap: 2 },
  /* 笨拙雕刻感标题 — 不完美的字距与粗细 */
  brandTitle: { fontFamily, fontSize: 14, letterSpacing: 3, fontWeight: '700', color: colors.primary, borderBottomWidth: 1, borderBottomColor: 'rgba(23,21,19,0.4)', paddingBottom: 2 },

  /* ── 上浮层 ────────────────────────────────────────── */
  floatingSheet: {
    flex: 1, zIndex: 4,
    marginTop: 0,
    borderTopLeftRadius: 65, borderTopRightRadius: 65,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  sheetPencilCanvas: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 80, zIndex: 1,
  },
  sheetScroll: { flex: 1, zIndex: 2 },
  sheetInner: { paddingHorizontal: 14, paddingTop: 24, paddingBottom: 10, flexGrow: 1, justifyContent: 'space-between' },

  /* ── 状态概览 ──────────────────────────────────────── */
  statusBanner: { textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.primary, letterSpacing: 0.5, paddingHorizontal: 20 },
  goldAccent: { color: colors.accent, fontFamily, fontWeight: '700', fontSize: 17 },

  /* ── 日期条 ────────────────────────────────────────── */
  dateBar: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 8, marginBottom: 4 },
  dateBtn: { color: colors.text.secondary, fontSize: 12, fontWeight: '300' },
  dateCurrentWrap: {
    position: 'relative',
    backgroundColor: 'rgba(245,240,230,0.8)',
    paddingVertical: 4, paddingHorizontal: 12,
    borderRadius: 6,
  },
  datePencilCanvas: {
    position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, zIndex: 1,
  },
  dateCurrent: { fontSize: 12, color: colors.primary, fontWeight: '600', zIndex: 2 },

  /* ── 分割线 ────────────────────────────────────────── */
  dividerText: { textAlign: 'center', fontSize: 11, color: colors.text.secondary, letterSpacing: 2, marginVertical: 6 },

  /* ── 堆叠拖拽轮播 ──────────────────────────────────── */
  carouselWrap: { height: 320, justifyContent: 'center', alignItems: 'center' },
  carouselStage: { width: SCREEN_WIDTH, height: 300, alignItems: 'center', justifyContent: 'center' },
  stackCenter: { position: 'absolute', alignSelf: 'center', zIndex: 3 },
  stackLeft: { position: 'absolute', top: 45, left: (SCREEN_WIDTH - CARD_W) / 2 - CARD_W * 0.35, zIndex: 1 },
  stackRight: { position: 'absolute', top: 45, left: (SCREEN_WIDTH - CARD_W) / 2 + CARD_W * 0.65, zIndex: 1 },

  /* ══════════════════════════════════════════════════════
     中心卡 — 侘寂凸版印刷 (Wabi-Sabi Letterpress)
     ══════════════════════════════════════════════════════ */
  ccWrap: { position: 'relative', width: CARD_W, height: 290, overflow: 'visible' },

  /* SVG 铅笔边框画布 — 四边均匀超出卡片 */
  pencilCanvas: {
    position: 'absolute', top: -18, left: -10, right: -10, bottom: -18, zIndex: 1,
  },

  /* — 羊皮纸主体 — 固定大小，底部固定 */
  parchment: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2,
    justifyContent: 'space-between',
    backgroundColor: '#FAF6ED', borderWidth: 0, borderRadius: 12,
    paddingTop: 20, paddingBottom: 14, paddingHorizontal: 18,
    overflow: 'visible',
    shadowColor: '#3A3530', shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 0,
  },
  parchTitle: { fontSize: 17, lineHeight: 18, fontWeight: '600', color: '#24211D' },
  parchQuote: { fontSize: 14, lineHeight: 19, color: '#3A3530', marginTop: 7, letterSpacing: 0.3 },
  parchFoot: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 8, paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(23,21,19,0.1)',
  },
  footSpacer: { flex: 1 },
  parchScore: { fontSize: 15, color: colors.accent, fontFamily, fontWeight: '700' },

  /* ══════════════════════════════════════════════════════
     侧卡 — 固定大小
     ══════════════════════════════════════════════════════ */
  sideCard: { opacity: 0.5, width: CARD_W, height: 200, position: 'relative' },
  sidePencilCanvas: {
    position: 'absolute', top: -12, left: -8, right: -8, bottom: -12, zIndex: 1,
  },
  sideBody: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2,
    backgroundColor: '#FAF6ED', borderRadius: 8,
    padding: 14, justifyContent: 'space-between',
  },
  sideContent: { flex: 1 },
  sideTitle: { fontSize: 13, fontWeight: '600', color: colors.primary, lineHeight: 20 },
  sideFoot: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 10, paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(23,21,19,0.08)',
  },
  /* ── 卡片内标签（手绘铅笔描边，与 SwipeableTaskCard 一致） ── */
  cardTagWrap: { position: 'relative', marginRight: 4 },
  cardTagPencil: { position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, zIndex: 0 },
  cardTagInner: {
    borderRadius: 3, backgroundColor: 'rgba(245,240,230,0.5)',
    paddingVertical: 3, paddingHorizontal: 8,
  },
  cardTagText: { fontSize: 11, fontWeight: '500', color: colors.text.secondary },
  cardTagSmWrap: { position: 'relative', marginRight: 2 },
  cardTagSmPencil: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, zIndex: 0 },
  cardTagSmInner: {
    borderRadius: 2, backgroundColor: 'rgba(245,240,230,0.5)',
    paddingVertical: 2, paddingHorizontal: 5,
  },
  cardTagSmText: { fontSize: 10, color: colors.text.secondary },

  /* ── 指示点 ────────────────────────────────────────── */
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 14, height: 20 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.text.tertiary },
  dotActive: { backgroundColor: colors.primary, width: 6, height: 6, borderRadius: 3 },
  dotCounter: { fontSize: 12, color: colors.text.tertiary, fontFamily, letterSpacing: 1 },

  /* ── 空状态 ────────────────────────────────────────── */
  emptyWrap: { alignItems: 'center', justifyContent: 'center', height: 300 },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { fontSize: 16, color: colors.text.primary, fontFamily, letterSpacing: 2, marginBottom: 6 },
  emptyHint: { fontSize: 13, color: colors.text.tertiary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 40 },

  /* ── 操作徽章 (三层粗线重叠) ───────────────────────── */
  badgesRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 18, marginBottom: 10 },
  badgeWrap: { position: 'relative' },
  badgePencilCanvas: {
    position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, zIndex: 5,
  },
  badgeBody: {
    position: 'relative', zIndex: 4,
    backgroundColor: colors.background,
    borderRadius: 2,
    paddingVertical: 6, paddingHorizontal: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeText: { fontSize: 14, color: colors.primary, fontWeight: '600', textAlign: 'center' },

  /* ── 全局输入 (三层粗线重叠) ────────────────────────── */
  inputWrap: {},
  inputFixedWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: colors.background,
    paddingHorizontal: 14, paddingBottom: 12, paddingTop: 6,
  },
  inputBoxWrap: { position: 'relative', height: 50 },
  inputPencilCanvas: {
    position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, zIndex: 5,
  },
  inputBody: {
    position: 'relative', zIndex: 4, flex: 1,
    backgroundColor: colors.background, borderRadius: 2,
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 14, paddingRight: 14,
    paddingBottom: 6, // nudge text + send btn up 3px
  },
  textInput: {
    flex: 1, fontSize: 15, color: colors.text.primary,
    textAlignVertical: 'center', fontFamily, paddingVertical: 0,
  },
  sendBtn: {
    width: 38, height: 38,
    alignItems: 'center', justifyContent: 'center',
  },

  /* ── 尾注 (极致干净、细小、无手绘滤镜) ────────────── */
  posterFooter: { alignItems: 'center', paddingTop: 12, marginBottom: 4 },
  footerDivider: { width: 18, height: 1, backgroundColor: colors.accent, opacity: 0.5, marginBottom: 8 },
  footerText: { fontSize: 9, color: colors.text.secondary, letterSpacing: 3, opacity: 0.75 },
});
