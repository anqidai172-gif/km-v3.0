import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Pressable,
  Dimensions,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, addDays, isToday } from 'date-fns';
import { colors, tokens, fontFamily } from '../../src/theme';
import { ProgressBar } from '../../src/components/expression/ProgressBar';
import { SwipeableTaskCard } from '../../src/components/expression/SwipeableTaskCard';
import { SidebarContent } from '../../src/components/sidebar/SidebarContent';
import { useExpressionStore } from '../../src/stores';
import { useKnowledgeStore } from '../../src/stores';
import { useUIStore } from '../../src/stores';
import type { TrainingRecord, TrainingState, KnowledgeCategory } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.82;

// ── Date range for the switcher ──────────────────────────
const DATE_RANGE = 7; // ±7 days around today

// ── Helper: build date list ──────────────────────────────
function buildDateList(today: Date): Date[] {
  const list: Date[] = [];
  for (let i = -DATE_RANGE; i <= DATE_RANGE; i++) {
    list.push(addDays(today, i));
  }
  return list;
}

// ── Tab definitions ──────────────────────────────────────
type ListTab = 'pending' | 'completed';

const TAB_CONFIG: Record<ListTab, { label: string; icon: string; states: TrainingState[] }> = {
  pending: {
    label: '待复述列表',
    icon: '🔥',
    states: ['pending_retell', 'pending_restate'],
  },
  completed: {
    label: '已复述列表',
    icon: '📂',
    states: ['retold', 'restated'],
  },
};

// ── Sort modes ───────────────────────────────────────────
type SortMode = 'priority' | 'name' | 'score';

const SORT_LABELS: Record<SortMode, string> = {
  priority: '按遗忘曲线排序',
  name: '按名称排序',
  score: '按分数排序',
};

// ── Chinese weekday names ────────────────────────────────
const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// ── Helper: format date chip label ───────────────────────
function formatDateChip(d: Date): string {
  return format(d, 'MM月dd日');
}

// ── Page ──────────────────────────────────────────────────

export default function ExpressionPage() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);

  // ── Stores ────────────────────────────────────────────
  const records = useExpressionStore((s) => s.records);
  const loadTodayBoard = useExpressionStore((s) => s.loadTodayBoard);
  const loading = useExpressionStore((s) => s.loading);
  const deferRecord = useExpressionStore((s) => s.deferRecord);
  const items = useKnowledgeStore((s) => s.items);
  const categories = useKnowledgeStore((s) => s.categories);
  const loadAll = useKnowledgeStore((s) => s.loadAll);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const openSidebar = useUIStore((s) => s.openSidebar);
  const closeSidebar = useUIStore((s) => s.closeSidebar);

  // ── Local UI state ────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<ListTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [refreshing, setRefreshing] = useState(false);

  // ── Date list & scroller ──────────────────────────────
  const dateList = useMemo(() => buildDateList(today), [today]);
  const dateScrollerRef = useRef<ScrollView>(null);

  // Scroll to today on mount
  useEffect(() => {
    const idx = dateList.findIndex((d) => format(d, 'yyyy-MM-dd') === todayStr);
    if (idx > 0 && dateScrollerRef.current) {
      const offset = idx * 72 - SCREEN_WIDTH / 2 + 36; // center today
      setTimeout(() => {
        dateScrollerRef.current?.scrollTo({ x: Math.max(0, offset), animated: false });
      }, 300);
    }
  }, []);

  // ── Sidebar animation ─────────────────────────────────
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (sidebarOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -SIDEBAR_WIDTH, duration: 220, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [sidebarOpen]);

  // ── Data loading ──────────────────────────────────────
  useEffect(() => {
    loadTodayBoard();
    loadAll();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTodayBoard();
    await loadAll();
    setRefreshing(false);
  }, [loadTodayBoard, loadAll]);

  // ── Derived: records for selected date ────────────────
  const dateRecords = useMemo(() => {
    return records.filter((r) => {
      const reviewDate = r.nextReviewAt?.slice(0, 10) ?? '';
      const createdDate = r.createdAt?.slice(0, 10) ?? '';
      return reviewDate === selectedDate || createdDate === selectedDate;
    });
  }, [records, selectedDate]);

  // ── Derived: pending vs completed ─────────────────────
  const pendingRecords = useMemo(
    () => dateRecords.filter((r) => (TAB_CONFIG.pending.states as string[]).includes(r.state)),
    [dateRecords],
  );

  const completedRecords = useMemo(
    () => dateRecords.filter((r) => (TAB_CONFIG.completed.states as string[]).includes(r.state)),
    [dateRecords],
  );

  const activeRecords = activeTab === 'pending' ? pendingRecords : completedRecords;

  // ── Derived: overview stats ────────────────────────────
  const overview = useMemo(() => {
    const total = dateRecords.length;
    const completed = completedRecords.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    // Expression score: sum of best scores from today's completed items
    const score = dateRecords.reduce((sum, r) => sum + (r.bestScore ?? r.currentScore ?? 0), 0);
    return { total, completed, pending: total - completed, progress, score };
  }, [dateRecords, completedRecords.length]);

  // ── Derived: filtered & sorted visible records ────────
  const visibleRecords = useMemo(() => {
    let filtered = [...activeRecords];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((r) => {
        const it = items.find((i) => i.id === r.knowledgeItemId);
        return it?.title?.toLowerCase().includes(q);
      });
    }

    // Sort
    filtered.sort((a, b) => {
      const itemA = items.find((i) => i.id === a.knowledgeItemId);
      const itemB = items.find((i) => i.id === b.knowledgeItemId);
      switch (sortMode) {
        case 'name':
          return (itemA?.title ?? '').localeCompare(itemB?.title ?? '');
        case 'score':
          return (b.bestScore ?? b.currentScore ?? -1) - (a.bestScore ?? a.currentScore ?? -1);
        case 'priority':
        default:
          return b.priority - a.priority;
      }
    });

    return filtered;
  }, [activeRecords, searchQuery, sortMode, items]);

  // ── Helpers ────────────────────────────────────────────
  const getKnowledgeItem = (itemId: string) => items.find((i) => i.id === itemId);
  const getCategory = (categoryId: string): KnowledgeCategory | undefined =>
    categories.find((c) => c.id === categoryId);

  // ── Handlers ───────────────────────────────────────────
  const handleTaskPress = (record: TrainingRecord) => {
    router.push(`/expression/${record.knowledgeItemId}`);
  };

  const handleDefer = (record: TrainingRecord) => {
    deferRecord(record.id, 1);
  };

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  const handleSortToggle = () => {
    const modes: SortMode[] = ['priority', 'name', 'score'];
    const idx = modes.indexOf(sortMode);
    setSortMode(modes[(idx + 1) % modes.length]);
  };

  const isSelectedToday = selectedDate === todayStr;

  // ── Render ──────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ═══ Header ═══ */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace('/home')}
          style={styles.headerBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.backIcon}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>今日复述训练</Text>
        <TouchableOpacity onPress={openSidebar} style={styles.headerBtn} activeOpacity={0.7}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* ═══ Date Switcher ═══ */}
      <View style={styles.dateSwitcher}>
        <ScrollView
          ref={dateScrollerRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateScrollContent}
        >
          {dateList.map((d) => {
            const ds = format(d, 'yyyy-MM-dd');
            const active = ds === selectedDate;
            const today_ = isToday(d);
            const hasRecords = records.some((r) => {
              const rd = r.nextReviewAt?.slice(0, 10) ?? '';
              const cd = r.createdAt?.slice(0, 10) ?? '';
              return rd === ds || cd === ds;
            });

            return (
              <TouchableOpacity
                key={ds}
                style={[styles.dateChip, active && styles.dateChipActive]}
                onPress={() => handleDateSelect(ds)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateChipLabel, active && styles.dateChipLabelActive]}>
                  {formatDateChip(d)}
                </Text>
                <Text style={[styles.dateChipSub, active && styles.dateChipSubActive]}>
                  {today_ ? '今天' : WEEKDAY_NAMES[d.getDay()]}
                </Text>
                {hasRecords && (
                  <View style={[styles.dateDot, active && styles.dateDotActive]} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ═══ Main Scroll Content ═══ */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* ── Overview Card ── */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Text style={styles.overviewIcon}>📊</Text>
            <Text style={styles.overviewTitle}>
              {isSelectedToday ? '今日复述概览' : `${selectedDate.slice(5)} 复述概览`}
            </Text>
          </View>

          {/* Progress */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>已完成</Text>
              <Text style={styles.progressPercent}>{overview.progress}%</Text>
            </View>
            <ProgressBar progress={overview.progress} height={10} />
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>⚡ +{overview.score}</Text>
              <Text style={styles.statLabel}>表达力积分</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{overview.pending}</Text>
              <Text style={styles.statLabel}>待复述</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.success }]}>{overview.completed}</Text>
              <Text style={styles.statLabel}>已复述</Text>
            </View>
          </View>
        </View>

        {/* ── Tab Switcher ── */}
        <View style={styles.tabRow}>
          {(['pending', 'completed'] as ListTab[]).map((tab) => {
            const cfg = TAB_CONFIG[tab];
            const count = tab === 'pending' ? pendingRecords.length : completedRecords.length;
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text style={styles.tabIcon}>{cfg.icon}</Text>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {cfg.label}
                </Text>
                <View style={[styles.tabCount, isActive && styles.tabCountActive]}>
                  <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Search & Filter Bar ── */}
        <View style={styles.filterBar}>
          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="输入知识点搜索..."
              placeholderTextColor={colors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={handleSortToggle}
            activeOpacity={0.7}
          >
            <Text style={styles.sortIcon}>⏳</Text>
            <Text style={styles.sortLabel}>{SORT_LABELS[sortMode]}</Text>
            <Text style={styles.sortToggle}>⇅</Text>
          </TouchableOpacity>
        </View>

        {/* ── Task List ── */}
        {visibleRecords.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>
              {activeTab === 'pending' ? '🎉' : '📭'}
            </Text>
            <Text style={styles.emptyTitle}>
              {searchQuery
                ? '未找到匹配的知识点'
                : activeTab === 'pending'
                  ? '暂无待复述任务'
                  : '暂无已复述记录'}
            </Text>
            <Text style={styles.emptyDesc}>
              {searchQuery
                ? '换个关键词试试'
                : activeTab === 'pending'
                  ? '去「知识输入」添加新的知识条目吧'
                  : '完成复述训练后，这里会显示记录'}
            </Text>
          </View>
        )}

        {visibleRecords.map((record) => {
          const item = getKnowledgeItem(record.knowledgeItemId);
          const category = item ? getCategory(item.categoryId) : undefined;
          const isPending = (TAB_CONFIG.pending.states as string[]).includes(record.state);

          return (
            <SwipeableTaskCard
              key={record.id}
              record={record}
              item={item}
              category={category}
              onPress={() => handleTaskPress(record)}
              onDefer={() => handleDefer(record)}
              swipeDisabled={!isPending}
            />
          );
        })}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ═══ Sidebar Modal ═══ */}
      <Modal
        visible={sidebarOpen}
        animationType="none"
        transparent
        onRequestClose={closeSidebar}
      >
        <View style={styles.sidebarOverlay}>
          <Animated.View style={[styles.backdrop, { opacity: overlayAnim }]}>
            <Pressable style={styles.backdropPress} onPress={closeSidebar} />
          </Animated.View>
          <Animated.View
            style={[styles.sidebarPanel, { transform: [{ translateX: slideAnim }] }]}
          >
            <SidebarContent />
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: tokens.borderWidth.thin,
    borderBottomColor: colors.border,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 18,
    color: colors.text.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: 2,
  },
  menuIcon: {
    fontSize: 22,
    color: colors.text.primary,
  },

  // ── Date Switcher ──
  dateSwitcher: {
    backgroundColor: colors.surface,
    borderBottomWidth: tokens.borderWidth.hairline,
    borderBottomColor: colors.divider,
    paddingVertical: 8,
  },
  dateScrollContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  dateChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: tokens.radius.lg,
    borderWidth: tokens.borderWidth.thin,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceLight,
    minWidth: 72,
    gap: 2,
  },
  dateChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  dateChipLabelActive: {
    color: colors.text.inverse,
  },
  dateChipSub: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  dateChipSubActive: {
    color: 'rgba(250,246,238,0.7)',
  },
  dateDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 2,
  },
  dateDotActive: {
    backgroundColor: colors.accent,
  },

  // ── Scroll ──
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  // ── Overview Card ──
  overviewCard: {
    backgroundColor: colors.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: tokens.borderWidth.thin,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
    // Hard letterpress shadow
    shadowColor: colors.primary,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 0,
    elevation: 3,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  overviewIcon: {
    fontSize: 18,
  },
  overviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  progressSection: {
    marginBottom: 14,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    fontFamily,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.divider,
  },

  // ── Tabs ──
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: tokens.radius.md,
    borderWidth: tokens.borderWidth.thin,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceLight,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabIcon: {
    fontSize: 14,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tabLabelActive: {
    color: colors.text.inverse,
  },
  tabCount: {
    backgroundColor: colors.primaryLight,
    borderRadius: tokens.radius.full,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabCountActive: {
    backgroundColor: 'rgba(250,246,238,0.2)',
  },
  tabCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  tabCountTextActive: {
    color: colors.text.inverse,
  },

  // ── Filter Bar ──
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: tokens.radius.md,
    borderWidth: tokens.borderWidth.thin,
    borderColor: colors.border,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    paddingVertical: 10,
  },
  clearIcon: {
    fontSize: 14,
    color: colors.text.tertiary,
    padding: 4,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: tokens.radius.md,
    borderWidth: tokens.borderWidth.thin,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
  },
  sortIcon: {
    fontSize: 12,
  },
  sortLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
    maxWidth: 80,
  },
  sortToggle: {
    fontSize: 14,
    color: colors.text.tertiary,
  },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  bottomSpacer: {
    height: 24,
  },

  // ── Sidebar ──
  sidebarOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(36,34,32,0.4)',
  },
  backdropPress: {
    flex: 1,
  },
  sidebarPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.primary,
    elevation: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
});
