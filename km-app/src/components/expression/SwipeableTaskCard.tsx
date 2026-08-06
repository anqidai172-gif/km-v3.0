import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { colors, tokens, fontFamily } from '../../theme';
import Svg, { Rect } from 'react-native-svg';
import { Badge } from '../ui/Badge';
import { CalendarIcon, BoxIcon, TrophyIcon, MicIcon } from '../ui/ExpressionIcons';
import type { TrainingRecord, KnowledgeItem, KnowledgeCategory } from '../../types';

// ── Constants ──────────────────────────────────────────────

const ACTION_WIDTH = 88;
const SWIPE_THRESHOLD = -44; // half of action width triggers open
const VERTICAL_THRESHOLD = 15; // ignore if vertical movement exceeds this

// ── Component ──────────────────────────────────────────────

interface SwipeableTaskCardProps {
  record: TrainingRecord;
  item?: KnowledgeItem;
  category?: KnowledgeCategory;
  onPress: () => void;
  onTrain: () => void;
  onDefer: () => void;
  /** If true, disable swipe (e.g. for completed items) */
  swipeDisabled?: boolean;
}

export function SwipeableTaskCard({
  record,
  item,
  category,
  onPress,
  onTrain,
  onDefer,
  swipeDisabled = false,
}: SwipeableTaskCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  // ── Helpers ────────────────────────────────────────────

  const snapOpen = useCallback(() => {
    isOpen.current = true;
    Animated.spring(translateX, {
      toValue: -ACTION_WIDTH,
      useNativeDriver: true,
      speed: 18,
      bounciness: 3,
    }).start();
  }, [translateX]);

  const snapClosed = useCallback(() => {
    isOpen.current = false;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 3,
    }).start();
  }, [translateX]);

  // ── PanResponder ────────────────────────────────────────

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (
        _: GestureResponderEvent,
        gs: PanResponderGestureState,
      ) => {
        if (swipeDisabled) return false;
        // Only claim horizontal gestures — let vertical scroll through
        return Math.abs(gs.dx) > 12 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.8;
      },
      onPanResponderGrant: () => {
        // Flatten any in-progress animation so the value is accurate
        translateX.setOffset((translateX as any)._value ?? 0);
        translateX.setValue(0);
      },
      onPanResponderMove: (_: GestureResponderEvent, gs: PanResponderGestureState) => {
        const base = isOpen.current ? -ACTION_WIDTH : 0;
        const next = base + gs.dx;
        // Clamp: can't swipe right past 0, allow a little overscroll left
        translateX.setValue(Math.max(-ACTION_WIDTH - 20, Math.min(0, next)));
      },
      onPanResponderRelease: (_: GestureResponderEvent, gs: PanResponderGestureState) => {
        translateX.flattenOffset();
        const base = isOpen.current ? -ACTION_WIDTH : 0;
        const net = base + gs.dx;

        if (net < SWIPE_THRESHOLD) {
          snapOpen();
        } else {
          snapClosed();
        }
      },
      onPanResponderTerminate: () => {
        translateX.flattenOffset();
        snapClosed();
      },
    }),
  ).current;

  // ── Handlers ────────────────────────────────────────────

  const handlePress = () => {
    if (isOpen.current) {
      snapClosed();
    } else {
      onPress();
    }
  };

  const handleDefer = () => {
    snapClosed();
    // Small delay so the close animation plays before the item disappears
    setTimeout(() => onDefer(), 200);
  };

  // ── Derived values ─────────────────────────────────────

  const score = record.bestScore ?? record.currentScore;
  const hasScore = score != null;

  return (
    <View style={styles.wrapper}>
      {/* ── Action behind the card ── */}
      <View style={styles.actionBehind}>
        <TouchableOpacity
          style={styles.deferBtn}
          onPress={handleDefer}
          activeOpacity={0.75}
        >
          <CalendarIcon size={20} color="#FFF" />
          <Text style={styles.deferLabel}>延期</Text>
        </TouchableOpacity>
      </View>

      {/* ── Swipeable card ── */}
      <Animated.View
        style={[styles.cardOuter, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.75}
          style={styles.cardInner}
        >
          {/* Top row: title + score */}
          <View style={styles.topRow}>
            <BoxIcon size={18} />
            <Text style={styles.title} numberOfLines={1}>
              {item?.title || '未知条目'}
            </Text>
            <View style={styles.scoreArea}>
              <TrophyIcon size={14} />
              <Text style={[styles.scoreText, !hasScore && styles.scoreTextMuted]}>
                {hasScore ? `${score}分` : '--分'}
              </Text>
            </View>
          </View>

          {/* Bottom row: category + state badge + action hint */}
          <View style={styles.bottomRow}>
            {category && (
              <View style={styles.categoryTag}>
                <View style={styles.tagPencilCanvas} pointerEvents="none">
                  <Svg width="100%" height="100%" viewBox="0 0 80 24" preserveAspectRatio="none">
                    <Rect x={2} y={2} width={76} height={20}
                      stroke="#3A3530" strokeWidth={1.2} strokeDasharray="12 4 8 3 16 4"
                      strokeLinecap="round" fill="none" opacity={0.38} rx={3} ry={3} />
                    <Rect x={3} y={1} width={74} height={22}
                      stroke="#4A4440" strokeWidth={0.9} strokeDasharray="6 5 10 3 8 4"
                      strokeLinecap="round" fill="none" opacity={0.30} rx={4} ry={2} />
                  </Svg>
                </View>
                <View style={styles.tagInner}>
                  <Text style={styles.tagText}>{category.name}</Text>
                </View>
              </View>
            )}
            <Badge label={record.state} size="sm" />
            <View style={styles.spacer} />
            <TouchableOpacity style={styles.actionHint} onPress={onTrain} activeOpacity={0.7}>
              <MicIcon size={12} />
              <Text style={styles.actionHintText}>开始复述</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 10,
    position: 'relative',
  },

  // ── Action behind ──
  actionBehind: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deferBtn: {
    width: ACTION_WIDTH - 8,
    height: '100%',
    borderRadius: tokens.radius.lg,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deferLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },

  // ── Card ──
  cardOuter: {
    backgroundColor: colors.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: tokens.borderWidth.hairline,
    borderColor: colors.divider,
    // Soft shadow
    shadowColor: colors.primary,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  cardInner: {
    paddingVertical: 14,
    paddingHorizontal: 14,
  },

  // ── Top row ──
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    lineHeight: 21,
  },
  scoreArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 8,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accent,
    fontFamily,
  },
  scoreTextMuted: {
    color: colors.text.tertiary,
    fontWeight: '400',
    fontFamily: undefined,
  },

  // ── Bottom row ──
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryTag: {
    position: 'relative',
    marginRight: 4,
  },
  tagPencilCanvas: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    zIndex: 0,
  },
  tagInner: {
    borderRadius: 3,
    backgroundColor: 'rgba(245,240,230,0.5)',
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  spacer: {
    flex: 1,
  },
  actionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: tokens.radius.md,
  },
  actionHintText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.inverse,
  },
});
