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
import { Badge } from '../ui/Badge';
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
  onDefer: () => void;
  /** If true, disable swipe (e.g. for completed items) */
  swipeDisabled?: boolean;
}

export function SwipeableTaskCard({
  record,
  item,
  category,
  onPress,
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
          <Text style={styles.deferIcon}>📅</Text>
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
            <Text style={styles.itemIcon}>📦</Text>
            <Text style={styles.title} numberOfLines={2}>
              {item?.title || '未知条目'}
            </Text>
            <View style={styles.scoreArea}>
              <Text style={styles.scoreIcon}>🏆</Text>
              <Text style={[styles.scoreText, !hasScore && styles.scoreTextMuted]}>
                {hasScore ? `${score}分` : '--分'}
              </Text>
            </View>
          </View>

          {/* Bottom row: category + state badge + action hint */}
          <View style={styles.bottomRow}>
            {category && (
              <View style={styles.categoryTag}>
                <View style={[styles.catDot, { backgroundColor: category.color }]} />
                <Text style={styles.catText}>{category.name}</Text>
              </View>
            )}
            <Badge label={record.state} size="sm" />
            <View style={styles.spacer} />
            <View style={styles.actionHint}>
              <Text style={styles.actionHintIcon}>🎙️</Text>
              <Text style={styles.actionHintText}>开始复述</Text>
            </View>
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
  deferIcon: {
    fontSize: 20,
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
    borderWidth: tokens.borderWidth.thin,
    borderColor: colors.border,
    // Hard shadow
    shadowColor: colors.primary,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 0,
    elevation: 2,
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
  itemIcon: {
    fontSize: 18,
    marginTop: 1,
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
  scoreIcon: {
    fontSize: 14,
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
    gap: 8,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  catDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  catText: {
    fontSize: 12,
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
  actionHintIcon: {
    fontSize: 12,
  },
  actionHintText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.inverse,
  },
});
