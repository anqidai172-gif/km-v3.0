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
import { colors } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
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
            <Text style={styles.emptyIcon}>🌌</Text>
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
                          { backgroundColor: getCategoryColor(item.categoryId) + '18' },
                        ]}
                      >
                        <View
                          style={[
                            styles.nodeIndicator,
                            { backgroundColor: getCategoryColor(item.categoryId) },
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
                    <Text style={styles.modalSource}>📎 {selectedNode.item.sourceURL}</Text>
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
                    onPress={() => handleStartTraining(selectedNode.item.id)}
                    style={styles.startTrainingBtn}
                  >
                    🎯 开始训练
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
    backgroundColor: '#0A0A1A',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  // Empty
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 30,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
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
    borderRadius: 5,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
  },
  categoryCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
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
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
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
    width: 6,
    height: 24,
    borderRadius: 3,
    position: 'absolute',
    left: 8,
    top: 12,
  },
  nodeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
    marginLeft: 6,
  },
  nodeCardBottom: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  nodePreview: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: '#141428',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
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
    borderRadius: 12,
  },
  modalCategoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalContent: {
    paddingHorizontal: 20,
    maxHeight: 300,
  },
  modalBodyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
    marginBottom: 12,
  },
  modalSource: {
    fontSize: 12,
    color: '#4A90D9',
    marginBottom: 16,
  },
  modalStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
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
    color: '#FFFFFF',
  },
  modalStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  startTrainingBtn: {
    width: '100%',
  },
});
