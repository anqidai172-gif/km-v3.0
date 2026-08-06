import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, addDays, isToday } from 'date-fns';
import Svg, { Path } from 'react-native-svg';
import { colors, tokens, fontFamily } from '../../src/theme';
import { pageContentPadding } from '../../src/theme/layout';
import { ProgressBar } from '../../src/components/expression/ProgressBar';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { SwipeableTaskCard } from '../../src/components/expression/SwipeableTaskCard';
import {
  renderExpressionIcon,
  ChevronLeftIcon,
  ChartIcon,
  LightningIcon,
  SearchIcon,
  CloseIcon,
  HourglassIcon,
  SparkleIcon,
  EmptyTrayIcon,
  type ExpressionIconName,
} from '../../src/components/ui/ExpressionIcons';
import { useExpressionStore } from '../../src/stores';
import { useKnowledgeStore } from '../../src/stores';
import type { TrainingRecord, TrainingState, KnowledgeCategory } from '../../src/types';

// ── Date window config ────────────────────────────────────
const VISIBLE_DATES = 4;

// ── Helper: build date list ──────────────────────────────
function buildDateList(start: Date): Date[] {
  const list: Date[] = [];
  for (let i = 0; i < VISIBLE_DATES; i++) {
    list.push(addDays(start, i));
  }
  return list;
}

// ── Tab definitions ──────────────────────────────────────
type ListTab = 'pending' | 'completed';

const TAB_CONFIG: Record<ListTab, { label: string; icon: ExpressionIconName; states: TrainingState[] }> = {
  pending: {
    label: '待复述列表',
    icon: 'flame',
    states: ['pending_retell', 'pending_restate'],
  },
  completed: {
    label: '已复述列表',
    icon: 'archive',
    states: ['retold', 'restated'],
  },
};

// ── Sort modes ───────────────────────────────────────────
type SortMode = 'created' | 'score';

const SORT_LABELS: Record<SortMode, string> = {
  created: '按创建时间',
  score: '按分数高低',
};

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
  const loading = useExpressionStore((s) => s.loading);
  const deferRecord = useExpressionStore((s) => s.deferRecord);
  const items = useKnowledgeStore((s) => s.items);
  const categories = useKnowledgeStore((s) => s.categories);
  const loadAll = useKnowledgeStore((s) => s.loadAll);
  // ── Local UI state ────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<ListTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('created');
  const [menuOpen, setMenuOpen] = useState<'status' | 'sort' | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ── Date window ───────────────────────────────────────
  const [windowStart, setWindowStart] = useState<Date>(() => addDays(today, -1));
  const dateList = useMemo(() => buildDateList(windowStart), [windowStart]);

  // ── Arrow handlers ────────────────────────────────────
  const handlePrev = () => setWindowStart((prev) => addDays(prev, -VISIBLE_DATES));
  const handleNext = () => setWindowStart((prev) => addDays(prev, VISIBLE_DATES));

  // ── Data loading ──────────────────────────────────────
  useEffect(() => {
    loadAll();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  // ── Derived: records for selected date, deduped by knowledgeItemId ──
  const dateRecords = useMemo(() => {
    const filtered = records.filter((r) => {
      const reviewDate = r.nextReviewAt?.slice(0, 10) ?? '';
      const createdDate = r.createdAt?.slice(0, 10) ?? '';
      return reviewDate === selectedDate || createdDate === selectedDate;
    });
    // Deduplicate: keep only the most recently updated record per knowledge item
    const seen = new Map<string, typeof filtered[number]>();
    for (const r of filtered) {
      const existing = seen.get(r.knowledgeItemId);
      if (!existing || r.updatedAt > existing.updatedAt) {
        seen.set(r.knowledgeItemId, r);
      }
    }
    return Array.from(seen.values());
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
      switch (sortMode) {
        case 'score':
          return (b.bestScore ?? b.currentScore ?? -1) - (a.bestScore ?? a.currentScore ?? -1);
        case 'created':
        default:
          return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
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
    router.push(`/knowledge/${record.knowledgeItemId}`);
  };

  const handleStartTrain = (record: TrainingRecord) => {
    router.push(`/expression/${record.knowledgeItemId}`);
  };

  const handleDefer = (record: TrainingRecord) => {
    deferRecord(record.id, 1);
  };

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  const handleSortToggle = () => {
    setSortMode((prev) => (prev === 'created' ? 'score' : 'created'));
  };

  const isSelectedToday = selectedDate === todayStr;

  // ── Render ──────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageHeader title="今日复述训练" />

      {/* ═══ Date Switcher ═══ */}
      <View style={styles.dateSwitcher}>
        {/* Left arrow */}
        <TouchableOpacity
          style={styles.dateArrow}
          onPress={handlePrev}
          activeOpacity={0.5}
        >
          <Text style={styles.dateArrowText}>{'<<'}</Text>
        </TouchableOpacity>

        {/* Date row — exactly 4 dates */}
        <View style={styles.dateRow}>
          {dateList.map((d) => {
            const ds = format(d, 'yyyy-MM-dd');
            const active = ds === selectedDate;
            const isTodayDate = isToday(d);
            const hasRecords = records.some((r) => {
              const rd = r.nextReviewAt?.slice(0, 10) ?? '';
              const cd = r.createdAt?.slice(0, 10) ?? '';
              return rd === ds || cd === ds;
            });

            return (
              <TouchableOpacity
                key={ds}
                style={styles.dateItem}
                onPress={() => handleDateSelect(ds)}
                activeOpacity={0.6}
              >
                <View style={styles.dateItemRow}>
                  <Text style={[styles.bracket, active && styles.bracketActive]}>[</Text>
                  <Text
                    style={[
                      styles.dateItemText,
                      active && styles.dateItemTextActive,
                      !active && isTodayDate && styles.dateItemTextToday,
                    ]}
                  >
                    {formatDateChip(d)}
                  </Text>
                  <Text style={[styles.bracket, active && styles.bracketActive]}>]</Text>
                </View>
                <View style={styles.pencilDotWrap}>
                  {hasRecords && (
                    <Svg width={7} height={7} viewBox="0 0 8 8">
                      <Path
                        d="M4 1.2 C5.2 0.8 6.1 1.6 6.4 2.8 C6.8 4.2 6.2 5.6 5 6.2 C3.6 6.8 2.2 6 1.8 4.8 C1.4 3.4 2.2 1.8 4 1.2Z"
                        stroke={active ? '#8B6918' : '#9A948A'}
                        strokeWidth={0.7}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill={active ? 'rgba(154,123,56,0.45)' : 'rgba(154,148,138,0.42)'}
                      />
                    </Svg>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Right arrow */}
        <TouchableOpacity
          style={styles.dateArrow}
          onPress={handleNext}
          activeOpacity={0.5}
        >
          <Text style={styles.dateArrowText}>{'>>'}</Text>
        </TouchableOpacity>
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
            <ChartIcon size={18} />
            <Text style={styles.overviewTitle}>
              {isSelectedToday ? '今日复述概览' : `${selectedDate.slice(5)} 复述概览`}
            </Text>
          </View>

          {/* Progress — single row: label / bar / percent */}
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>已完成</Text>
            <View style={styles.progressBarWrap}>
              <ProgressBar progress={overview.progress} height={16} />
            </View>
            <Text style={styles.progressPercent}>{overview.progress}%</Text>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={styles.statValueRow}>
                <LightningIcon size={16} color={colors.primary} />
                <Text style={styles.statValue}>+{overview.score}</Text>
              </View>
              <Text style={styles.statLabel}>表达力积分</Text>
            </View>
            <View style={styles.statDivider}>
              <Svg width={2} height={32} viewBox="0 0 2 32">
                <Path
                  d="M1 0 Q0.5 8 1.3 16 Q0.6 24 1 32"
                  stroke="#D4CDC0"
                  strokeWidth={0.6}
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.5}
                />
              </Svg>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{overview.pending}</Text>
              <Text style={styles.statLabel}>待复述</Text>
            </View>
            <View style={styles.statDivider}>
              <Svg width={2} height={32} viewBox="0 0 2 32">
                <Path
                  d="M1 0 Q0.5 8 1.3 16 Q0.6 24 1 32"
                  stroke="#D4CDC0"
                  strokeWidth={0.6}
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.5}
                />
              </Svg>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{overview.completed}</Text>
              <Text style={styles.statLabel}>已复述</Text>
            </View>
          </View>
        </View>

        {/* ── Toolbar: search / status dropdown / sort dropdown (single row) ── */}
        <View style={styles.toolbar}>
          {/* Search input */}
          <View style={styles.searchInline}>
            <SearchIcon size={13} />
            <TextInput
              style={styles.searchInput}
              placeholder="搜索知识点..."
              placeholderTextColor={colors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                <CloseIcon size={12} />
              </TouchableOpacity>
            )}
          </View>

          {/* Status filter dropdown */}
          <View style={styles.dropdownWrap}>
            <TouchableOpacity
              style={[styles.iconBtn, activeTab === 'pending' && styles.iconBtnActive]}
              onPress={() => setMenuOpen(menuOpen === 'status' ? null : 'status')}
              activeOpacity={0.7}
            >
              {renderExpressionIcon(
                activeTab === 'pending' ? 'flame' : 'archive',
                14,
                activeTab === 'pending' ? colors.text.inverse : colors.text.primary,
              )}
            </TouchableOpacity>
            {menuOpen === 'status' && (
              <View style={styles.dropdown}>
                <TouchableOpacity
                  style={[styles.dropdownItem, activeTab === 'pending' && styles.dropdownItemActive]}
                  onPress={() => { setActiveTab('pending'); setMenuOpen(null); }}
                  activeOpacity={0.7}
                >
                  {renderExpressionIcon('flame', 13, activeTab === 'pending' ? colors.text.inverse : colors.text.primary)}
                  <Text style={[styles.dropdownItemText, activeTab === 'pending' && styles.dropdownItemTextActive]}>
                    待复述 ({pendingRecords.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dropdownItem, activeTab === 'completed' && styles.dropdownItemActive]}
                  onPress={() => { setActiveTab('completed'); setMenuOpen(null); }}
                  activeOpacity={0.7}
                >
                  {renderExpressionIcon('archive', 13, activeTab === 'completed' ? colors.text.inverse : colors.text.primary)}
                  <Text style={[styles.dropdownItemText, activeTab === 'completed' && styles.dropdownItemTextActive]}>
                    已复述 ({completedRecords.length})
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Sort dropdown */}
          <View style={styles.dropdownWrap}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setMenuOpen(menuOpen === 'sort' ? null : 'sort')}
              activeOpacity={0.7}
            >
              <HourglassIcon size={14} />
            </TouchableOpacity>
            {menuOpen === 'sort' && (
              <View style={styles.dropdown}>
                {(['created', 'score'] as SortMode[]).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.dropdownItem, sortMode === mode && styles.dropdownItemActive]}
                    onPress={() => { setSortMode(mode); setMenuOpen(null); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownItemText, sortMode === mode && styles.dropdownItemTextActive]}>
                      {SORT_LABELS[mode]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ── Task List ── */}
        {visibleRecords.length === 0 && !loading && (
          <View style={styles.emptyState}>
            {activeTab === 'pending' ? (
              <SparkleIcon size={48} />
            ) : (
              <EmptyTrayIcon size={48} />
            )}
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
              onTrain={() => handleStartTrain(record)}
              onDefer={() => handleDefer(record)}
              swipeDisabled={!isPending}
            />
          );
        })}

        <View style={styles.bottomSpacer} />
      </ScrollView>

    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Date Switcher ──
  dateSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: tokens.borderWidth.hairline,
    borderBottomColor: colors.divider,
    paddingVertical: 6,
  },
  dateArrow: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  dateArrowText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.tertiary,
    letterSpacing: -2,
    lineHeight: 22,
  },
  dateRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
    gap: 3,
  },
  dateItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bracket: {
    fontSize: 14,
    fontWeight: '500',
    color: 'transparent',
  },
  bracketActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  dateItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
  dateItemTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  dateItemTextToday: {
    fontWeight: '700',
    color: colors.primary,
    textDecorationLine: 'underline',
    textDecorationColor: colors.accent,
    textDecorationStyle: 'solid',
  },
  pencilDotWrap: {
    height: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Scroll ──
  scrollView: {
    flex: 1,
  },
  scrollContent: { ...pageContentPadding },

  // ── Overview Card ──
  overviewCard: {
    backgroundColor: colors.surface,
    borderRadius: tokens.radius.lg,
    borderWidth: tokens.borderWidth.hairline,
    borderColor: colors.divider,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 0,
    elevation: 2,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  overviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  progressLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  progressBarWrap: {
    flex: 1,
  },
  progressPercent: {
    fontSize: 14,
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
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
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
    width: 2,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Toolbar: search / status dropdown / sort dropdown ──
  toolbar: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  searchInline: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: tokens.radius.md,
    borderWidth: tokens.borderWidth.hairline,
    borderColor: colors.divider,
    paddingHorizontal: 10,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    paddingVertical: 0,
  },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: tokens.radius.md,
    borderWidth: tokens.borderWidth.hairline,
    borderColor: colors.divider,
  },
  iconBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dropdownWrap: {
    position: 'relative',
  },
  dropdown: {
    position: 'absolute',
    top: 42,
    right: 0,
    minWidth: 150,
    backgroundColor: colors.surface,
    borderRadius: tokens.radius.md,
    borderWidth: tokens.borderWidth.hairline,
    borderColor: colors.divider,
    paddingVertical: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 100,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  dropdownItemActive: {
    backgroundColor: colors.primaryLight,
  },
  dropdownItemText: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 16,
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

});
