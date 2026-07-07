import React, { useEffect, useMemo, useRef } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography } from '../../src/theme';
import { Badge } from '../../src/components/ui/Badge';
import { SidebarContent } from '../../src/components/sidebar/SidebarContent';
import { useExpressionStore } from '../../src/stores';
import { useKnowledgeStore } from '../../src/stores';
import { useUIStore } from '../../src/stores';
import type { TrainingRecord, TrainingState, KnowledgeCategory } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.82;

const STATE_CONFIG: Record<TrainingState, { label: string; color: string; bg: string; icon: string }> = {
  pending_retell: { label: '待复述', color: '#4A90D9', bg: '#EBF4FD', icon: '📝' },
  retold: { label: '已复述', color: '#34C759', bg: '#E8F8ED', icon: '✅' },
  pending_restate: { label: '待重述', color: '#FF9500', bg: '#FFF4E5', icon: '🔄' },
  restated: { label: '已重述', color: '#AF52DE', bg: '#F5EDFC', icon: '🌟' },
};

export default function ExpressionPage() {
  const router = useRouter();

  // Stores — subscribe to raw data only, compute derived data with useMemo
  const records = useExpressionStore((s) => s.records);
  const loadTodayBoard = useExpressionStore((s) => s.loadTodayBoard);
  const loading = useExpressionStore((s) => s.loading);
  const items = useKnowledgeStore((s) => s.items);
  const categories = useKnowledgeStore((s) => s.categories);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const openSidebar = useUIStore((s) => s.openSidebar);
  const closeSidebar = useUIStore((s) => s.closeSidebar);
  const loadAll = useKnowledgeStore((s) => s.loadAll);

  // Compute derived data locally to avoid infinite Zustand loops
  const todayBoard = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return records.filter((r) => {
      return r.nextReviewAt.startsWith(today) || r.createdAt.startsWith(today);
    }).sort((a, b) => b.priority - a.priority);
  }, [records]);

  // Sidebar animation
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    loadTodayBoard();
    loadAll();
  }, []);

  useEffect(() => {
    if (sidebarOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [sidebarOpen]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTodayBoard();
    await loadAll();
    setRefreshing(false);
  };

  const getKnowledgeItem = (itemId: string) =>
    items.find((i) => i.id === itemId);

  const getCategory = (categoryId: string): KnowledgeCategory | undefined =>
    categories.find((c) => c.id === categoryId);

  const getStateColor = (state: TrainingState) => STATE_CONFIG[state];

  // Group records by state
  const groupedRecords = todayBoard.reduce<Record<TrainingState, TrainingRecord[]>>(
    (acc, record) => {
      const state = record.state;
      if (!acc[state]) acc[state] = [];
      acc[state].push(record);
      return acc;
    },
    { pending_retell: [], retold: [], pending_restate: [], restated: [] }
  );

  const stateOrder: TrainingState[] = ['pending_retell', 'retold', 'pending_restate', 'restated'];

  const totalTasks = todayBoard.length;

  const handleTaskPress = (record: TrainingRecord) => {
    router.push(`/expression/${record.knowledgeItemId}`);
  };

  const renderTaskCard = (record: TrainingRecord) => {
    const item = getKnowledgeItem(record.knowledgeItemId);
    const category = item ? getCategory(item.categoryId) : undefined;
    const stateCfg = getStateColor(record.state);

    return (
      <TouchableOpacity
        key={record.id}
        style={styles.taskCard}
        onPress={() => handleTaskPress(record)}
        activeOpacity={0.7}
      >
        <View style={styles.taskHeader}>
          <Text style={styles.taskTitle} numberOfLines={2}>
            {item?.title || '未知条目'}
          </Text>
          <View style={styles.taskRight}>
            {record.currentScore != null && record.state !== 'pending_retell' && (
              <Text style={[styles.scoreBadge, { color: stateCfg?.color }]}>
                {record.currentScore}分
              </Text>
            )}
          </View>
        </View>

        <View style={styles.taskMeta}>
          {category && (
            <View style={styles.categoryTag}>
              <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
              <Text style={styles.categoryText}>{category.name}</Text>
            </View>
          )}
          <Text style={styles.attemptCount}>
            {record.attempts.length > 0
              ? `第${record.attempts.length}次`
              : '未开始'}
          </Text>
          {record.bestScore != null && (
            <Text style={styles.bestScore}>最佳 {record.bestScore}分</Text>
          )}
        </View>

        {item?.contentPreview && (
          <Text style={styles.taskPreview} numberOfLines={1}>
            {item.contentPreview}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={openSidebar} style={styles.menuBtn} activeOpacity={0.7}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>表达训练</Text>
          {totalTasks > 0 && (
            <View style={styles.taskCountBadge}>
              <Text style={styles.taskCountText}>{totalTasks}</Text>
            </View>
          )}
        </View>
        <View style={styles.menuBtn} />
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {totalTasks === 0 && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyTitle}>暂无训练任务</Text>
            <Text style={styles.emptyDesc}>去「知识输入」添加新的知识条目，开始训练吧</Text>
          </View>
        )}

        {stateOrder.map((state) => {
          const stateRecords = groupedRecords[state] || [];
          if (stateRecords.length === 0) return null;
          const cfg = STATE_CONFIG[state];

          return (
            <View key={state} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconWrap, { backgroundColor: cfg.bg }]}>
                  <Text style={styles.sectionIcon}>{cfg.icon}</Text>
                </View>
                <Text style={[styles.sectionTitle, { color: cfg.color }]}>{cfg.label}</Text>
                <View style={[styles.sectionCount, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.sectionCountText, { color: cfg.color }]}>
                    {stateRecords.length}
                  </Text>
                </View>
              </View>
              {stateRecords.map(renderTaskCard)}
            </View>
          );
        })}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Sidebar Modal */}
      <Modal
        visible={sidebarOpen}
        animationType="none"
        transparent
        onRequestClose={closeSidebar}
      >
        <View style={styles.sidebarOverlay}>
          {/* Backdrop */}
          <Animated.View style={[styles.backdrop, { opacity: overlayAnim }]}>
            <Pressable style={styles.backdropPress} onPress={closeSidebar} />
          </Animated.View>

          {/* Sidebar Panel */}
          <Animated.View
            style={[
              styles.sidebarPanel,
              { transform: [{ translateX: slideAnim }] },
            ]}
          >
            <SidebarContent />
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    fontSize: 22,
    color: colors.text.primary,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  taskCountBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  taskCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
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
  // Sections
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIcon: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  sectionCount: {
    borderRadius: 10,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sectionCountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  // Task cards
  taskCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
    marginRight: 12,
    lineHeight: 21,
  },
  taskRight: {
    alignItems: 'flex-end',
  },
  scoreBadge: {
    fontSize: 16,
    fontWeight: '700',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  attemptCount: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  bestScore: {
    fontSize: 11,
    color: colors.success,
    fontWeight: '600',
  },
  taskPreview: {
    fontSize: 13,
    color: colors.text.tertiary,
    lineHeight: 18,
  },
  bottomSpacer: {
    height: 20,
  },
  // Sidebar
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
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    backgroundColor: colors.background,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
});
