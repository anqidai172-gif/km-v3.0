/**
 * 知识星图 — Scholar's Desk 浅色主题
 * 网状知识节点图谱，按分类分组展示
 */
import React, { useState, useEffect, useRef } from 'react';
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
import { colors, tokens, fontFamily } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { ConstellationIcon, PaperclipIcon, TargetIcon } from '../../src/components/ui/ExpressionIcons';
import { useKnowledgeStore } from '../../src/stores';
import { useExpressionStore } from '../../src/stores';
import type { KnowledgeItem, KnowledgeCategory, TrainingRecord } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_SIZE = (SCREEN_WIDTH - 48) / 2;

interface NodeWithAnim {
  item: KnowledgeItem;
  category: KnowledgeCategory | undefined;
  record: TrainingRecord | undefined;
  anim: Animated.Value;
}

export default function MeshPage() {
  const router = useRouter();

  // Stores
  const items = useKnowledgeStore((s) => s.items);
  const categories = useKnowledgeStore((s) => s.categories);
  const loadAll = useKnowledgeStore((s) => s.loadAll);
  const records = useExpressionStore((s) => s.records);
  const getConfirmedItems = useKnowledgeStore((s) => s.getConfirmedItems);

  // Local state
  const [selectedNode, setSelectedNode] = useState<NodeWithAnim | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Floating animation for nodes
  const animValues = useRef<Map<string, Animated.Value>>(new Map());

  const confirmedItems = getConfirmedItems();

  useEffect(() => {
    loadAll();
  }, []);

  // Start floating animations for each node
  useEffect(() => {
    confirmedItems.forEach((item, idx) => {
      if (!animValues.current.has(item.id)) {
        animValues.current.set(item.id, new Animated.Value(0));
      }
      const anim = animValues.current.get(item.id)!;
      const delay = idx * 200;

      const float = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 3000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 3000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
        ])
      );
      float.start();
    });

    return () => {
      animValues.current.forEach((anim) => {
        anim.stopAnimation();
      });
    };
  }, [confirmedItems.length]);

  const getCategory = (categoryId: string): KnowledgeCategory | undefined =>
    categories.find((c) => c.id === categoryId);

  const getRecord = (itemId: string): TrainingRecord | undefined =>
    records.find((r) => r.knowledgeItemId === itemId);

  const getCategoryColor = (categoryId: string): string => {
    const cat = getCategory(categoryId);
    return cat?.color || colors.primary;
  };

  const getCategoryName = (categoryId: string): string => {
    const cat = getCategory(categoryId);
    return cat?.name || '未分类';
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleNodePress = (item: KnowledgeItem) => {
    const node: NodeWithAnim = {
      item,
      category: getCategory(item.categoryId),
      record: getRecord(item.id),
      anim: animValues.current.get(item.id) || new Animated.Value(0),
    };
    setSelectedNode(node);
  };

  const handleStartTraining = (itemId: string) => {
    setSelectedNode(null);
    router.push(`/expression/${itemId}`);
  };

  // Group by category
  const groupedByCategory = confirmedItems.reduce<Record<string, KnowledgeItem[]>>(
    (acc, item) => {
      const catName = getCategoryName(item.categoryId);
      if (!acc[catName]) acc[catName] = [];
      acc[catName].push(item);
      return acc;
    },
    {}
  );

  // Category stats
  const categoryStats = categories.map((cat) => ({
    category: cat,
    count: confirmedItems.filter((i) => i.categoryId === cat.id).length,
  })).filter((stat) => stat.count > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>网状知识库</Text>
        <Text style={styles.headerSubtitle}>
          {confirmedItems.length} 个知识节点
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Stats Overview */}
        {categoryStats.length > 0 && (
          <View style={styles.statsRow}>
            {categoryStats.slice(0, 4).map((stat) => (
              <View key={stat.category.id} style={styles.statItem}>
                <View style={[styles.statDot, { backgroundColor: stat.category.color }]} />
                <Text style={styles.statCount}>{stat.count}</Text>
                <Text style={styles.statLabel}>{stat.category.name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {confirmedItems.length === 0 && (
          <View style={styles.emptyState}>
            <ConstellationIcon size={56} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>知识星系尚未形成</Text>
            <Text style={styles.emptyDesc}>
              去「知识输入」添加内容并确认后，知识节点将在此汇聚成星系图谱
            </Text>
          </View>
        )}

        {/* Category Groups */}
        {Object.entries(groupedByCategory).map(([categoryName, categoryItems]) => (
          <View key={categoryName} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <View
                style={[
                  styles.categoryDot,
                  { backgroundColor: getCategoryColor(categoryItems[0]?.categoryId) },
                ]}
              />
              <Text style={styles.categoryTitle}>{categoryName}</Text>
              <Text style={styles.categoryCount}>{categoryItems.length}</Text>
            </View>

            {/* Node Grid */}
            <View style={styles.nodeGrid}>
              {categoryItems.map((item) => {
                const catColor = getCategoryColor(item.categoryId);
                const anim = animValues.current.get(item.id);
                const translateY = anim
                  ? anim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, -4, 0],
                    })
                  : 0;

                return (
                  <Animated.View
                    key={item.id}
                    style={[
                      styles.nodeCard,
                      { transform: [{ translateY: translateY || 0 }] },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => handleNodePress(item)}
                      activeOpacity={0.8}
                      style={styles.nodeCardInner}
                    >
                      <View
                        style={[
                          styles.nodeCardTop,
                          { backgroundColor: catColor + '15' },
                        ]}
                      >
                        <View
                          style={[
                            styles.nodeIndicator,
                            { backgroundColor: catColor },
                          ]}
                        />
                        <Text style={styles.nodeTitle} numberOfLines={3}>
                          {item.title}
                        </Text>
                      </View>
                      <View style={styles.nodeCardBottom}>
                        <Text style={styles.nodePreview} numberOfLines={1}>
                          {item.contentPreview || item.content.slice(0, 50)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Node Detail Modal */}
      <Modal
        visible={!!selectedNode}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedNode(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSelectedNode(null)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {selectedNode && (
              <>
                <View style={styles.modalHeader}>
                  <View
                    style={[
                      styles.modalCategoryTag,
                      { backgroundColor: selectedNode.category?.color || colors.primary },
                    ]}
                  >
                    <Text style={styles.modalCategoryText}>
                      {selectedNode.category?.name || '未分类'}
                    </Text>
                  </View>
                  {selectedNode.record && (
                    <Badge
                      label={
                        selectedNode.record.state === 'restated'
                          ? '已掌握'
                          : '训练中'
                      }
                      size="sm"
                      color={
                        selectedNode.record.state === 'restated'
                          ? colors.success
                          : colors.warning
                      }
                    />
                  )}
                </View>

                <Text style={styles.modalTitle}>{selectedNode.item.title}</Text>

                <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                  <Text style={styles.modalBodyText}>{selectedNode.item.content}</Text>

                  {selectedNode.item.sourceURL && (
                    <View style={styles.modalSourceRow}>
                      <PaperclipIcon size={12} color={colors.accent} />
                      <Text style={styles.modalSource}> {selectedNode.item.sourceURL}</Text>
                    </View>
                  )}

                  {/* Stats */}
                  {selectedNode.record && (
                    <View style={styles.modalStats}>
                      <View style={styles.modalStatItem}>
                        <Text style={styles.modalStatValue}>
                          {selectedNode.record.bestScore ?? '-'}
                        </Text>
                        <Text style={styles.modalStatLabel}>最佳分</Text>
                      </View>
                      <View style={styles.modalStatItem}>
                        <Text style={styles.modalStatValue}>
                          {selectedNode.record.attempts.length}
                        </Text>
                        <Text style={styles.modalStatLabel}>训练次数</Text>
                      </View>
                      <View style={styles.modalStatItem}>
                        <Text style={styles.modalStatValue}>
                          {selectedNode.record.currentScore ?? '-'}
                        </Text>
                        <Text style={styles.modalStatLabel}>当前分</Text>
                      </View>
                    </View>
                  )}

                  {/* Action */}
                  <Button
                    variant="accent"
                    onPress={() => handleStartTraining(selectedNode.item.id)}
                    style={styles.startTrainingBtn}
                  >
                    <TargetIcon size={14} color={colors.text.inverse} />
                    {' '}开始训练
                  </Button>
                </ScrollView>
              </>
            )}
          </View>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: tokens.borderWidth.hairline,
    borderBottomColor: '#D4CDC0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
    backgroundColor: colors.surface,
    borderRadius: tokens.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: tokens.borderWidth.hairline,
    borderColor: '#D4CDC0',
    shadowColor: '#171513',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: tokens.radius.full,
  },
  statCount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  // Empty
  emptyState: {
    alignItems:'center',
    paddingTop: 60,
    paddingHorizontal: 30,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 8,
    fontFamily,
  },
  emptyDesc: {
    fontSize: 14,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Category sections
  categorySection: {
    marginBottom: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: tokens.radius.full,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  categoryCount: {
    fontSize: 13,
    color: colors.text.tertiary,
    fontWeight: '600',
  },
  // Node grid
  nodeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  nodeCard: {
    width: CARD_SIZE,
    borderRadius: tokens.radius.lg,
    backgroundColor: colors.surface,
    borderWidth: tokens.borderWidth.hairline,
    borderColor: '#D4CDC0',
    overflow: 'hidden',
    shadowColor: '#171513',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  nodeCardInner: {
    flex: 1,
  },
  nodeCardTop: {
    padding: 12,
    minHeight: 90,
    justifyContent: 'center',
  },
  nodeIndicator: {
    width: 4,
    height: 24,
    borderRadius: 2,
    position: 'absolute',
    left: 8,
    top: 12,
  },
  nodeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    lineHeight: 18,
    marginLeft: 6,
  },
  nodeCardBottom: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: tokens.borderWidth.hairline,
    borderTopColor: '#D4CDC0',
  },
  nodePreview: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  bottomSpacer: {
    height: 20,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(36,34,32,0.4)',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D4CDC0',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  modalCategoryTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radius.lg,
  },
  modalCategoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    paddingHorizontal: 20,
    marginBottom: 12,
    fontFamily,
  },
  modalContent: {
    paddingHorizontal: 20,
    maxHeight: 300,
  },
  modalBodyText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  modalSourceRow: { flexDirection:'row', alignItems:'flex-start', marginBottom:16 },
  modalSource: {
    fontSize: 12,
    color: colors.accent,
    flex: 1,
  },
  modalStats: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: tokens.radius.lg,
    padding: 14,
    marginBottom: 16,
  },
  modalStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  modalStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalStatLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  startTrainingBtn: {
    width: '100%',
  },
});
