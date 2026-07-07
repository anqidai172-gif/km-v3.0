import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../theme';
import { Badge } from '../ui/Badge';
import { useKnowledgeStore } from '../../stores/useKnowledgeStore';
import { useExpressionStore } from '../../stores/useExpressionStore';
import { useUIStore } from '../../stores/useUIStore';
import type { TrainingRecord, TrainingState } from '../../types';
import { formatDate } from '../../utils/date';

export function SidebarContent() {
  const router = useRouter();
  const closeSidebar = useUIStore((s) => s.closeSidebar);
  const sidebarTimeFilter = useUIStore((s) => s.sidebarTimeFilter);
  const setSidebarTimeFilter = useUIStore((s) => s.setSidebarTimeFilter);

  const items = useKnowledgeStore((s) => s.items);
  const records = useExpressionStore((s) => s.records);

  // Compute dates locally to avoid infinite Zustand loop
  const itemDates = useMemo(() => {
    const dates = new Set<string>();
    items.forEach((item) => {
      const dateStr = item.createdAt.slice(0, 10);
      dates.add(dateStr);
    });
    return Array.from(dates).sort().reverse();
  }, [items]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handleItemPress = (knowledgeItemId: string) => {
    closeSidebar();
    router.push(`/expression/${knowledgeItemId}`);
  };

  const handleDateFilter = (date: string | null) => {
    setSelectedDate(date);
    setSidebarTimeFilter(date);
  };

  const getRecordForItem = (itemId: string): TrainingRecord | undefined =>
    records.find((r) => r.knowledgeItemId === itemId);

  const getStateLabel = (state: TrainingState): string => {
    const labels: Record<TrainingState, string> = {
      pending_retell: '待复述',
      retold: '已复述',
      pending_restate: '待重述',
      restated: '已重述',
    };
    return labels[state];
  };

  const filteredDates = selectedDate ? [selectedDate] : itemDates;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>知识归档</Text>
        <Pressable onPress={closeSidebar} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[styles.filterChip, !selectedDate && styles.filterChipActive]}
          onPress={() => handleDateFilter(null)}
        >
          <Text style={[styles.filterChipText, !selectedDate && styles.filterChipTextActive]}>
            全部
          </Text>
        </TouchableOpacity>
        {itemDates.map((date) => (
          <TouchableOpacity
            key={date}
            style={[styles.filterChip, selectedDate === date && styles.filterChipActive]}
            onPress={() => handleDateFilter(date)}
          >
            <Text
              style={[styles.filterChipText, selectedDate === date && styles.filterChipTextActive]}
            >
              {formatDate(date)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filteredDates.map((date) => {
          const dateItems = items.filter((i) => i.createdAt.startsWith(date));
          if (dateItems.length === 0) return null;
          return (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateLabel}>{formatDate(date)}</Text>
              {dateItems.map((item) => {
                const record = getRecordForItem(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.item}
                    onPress={() => handleItemPress(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.itemContent}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <View style={styles.itemMeta}>
                        <Badge
                          label={item.status === 'confirmed' ? 'confirmed' : 'draft'}
                          size="sm"
                        />
                        {record && (
                          <View style={styles.itemStateRow}>
                            <Badge label={record.state} size="sm" />
                            {record.currentScore != null && record.state !== 'pending_retell' && (
                              <Text style={styles.scoreText}>
                                {record.currentScore}分
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
        {filteredDates.length === 0 && (
          <Text style={styles.emptyText}>暂无知识条目</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  filterRow: {
    maxHeight: 52,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.divider,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    color: colors.text.inverse,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  dateGroup: {
    marginTop: 8,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.tertiary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  item: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  itemContent: {
    gap: 6,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.primary,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.text.tertiary,
    marginTop: 40,
    fontSize: 15,
  },
});
