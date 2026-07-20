import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { colors } from '../../theme';
import { Button } from '../ui/Button';

interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (start: string | null, end: string | null) => void;
  currentStart: string | null;
  currentEnd: string | null;
  availableDates: string[]; // 'YYYY-MM-DD' strings that have items
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

export function CalendarModal({
  visible,
  onClose,
  onConfirm,
  currentStart,
  currentEnd,
  availableDates,
}: CalendarModalProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [rangeStart, setRangeStart] = useState<string | null>(currentStart);
  const [rangeEnd, setRangeEnd] = useState<string | null>(currentEnd);

  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Mon=0

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDayPress = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (!rangeStart || (rangeStart && rangeEnd)) {
      // Start new range
      setRangeStart(dateStr);
      setRangeEnd(null);
    } else {
      // Set end
      if (dateStr < rangeStart) {
        setRangeEnd(rangeStart);
        setRangeStart(dateStr);
      } else {
        setRangeEnd(dateStr);
      }
    }
  };

  const handleConfirm = () => {
    onConfirm(rangeStart, rangeEnd);
    onClose();
  };

  const handleClear = () => {
    setRangeStart(null);
    setRangeEnd(null);
    onConfirm(null, null);
    onClose();
  };

  const isInRange = (day: number): boolean => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!rangeStart) return false;
    if (!rangeEnd) return dateStr === rangeStart;
    return dateStr >= rangeStart && dateStr <= rangeEnd;
  };

  const isRangeEdge = (day: number): boolean => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr === rangeStart || dateStr === rangeEnd;
  };

  // Build calendar grid: 6 rows x 7 cols
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length < 42) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let r = 0; r < 6; r++) {
    rows.push(cells.slice(r * 7, r * 7 + 7));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={() => {}}>
          {/* Header */}
          <View style={styles.navRow}>
            <TouchableOpacity onPress={goPrevMonth} style={styles.navBtn}>
              <Text style={styles.navText}>◀</Text>
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {viewYear}年{viewMonth + 1}月
            </Text>
            <TouchableOpacity onPress={goNextMonth} style={styles.navBtn}>
              <Text style={styles.navText}>▶</Text>
            </TouchableOpacity>
          </View>

          {/* Weekday headers */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={styles.weekDay}>{w}</Text>
            ))}
          </View>

          {/* Day grid */}
          {rows.map((row, ri) => (
            <View key={ri} style={styles.dayRow}>
              {row.map((day, di) => {
                if (day === null) {
                  return <View key={`e-${ri}-${di}`} style={styles.dayCell} />;
                }
                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const available = availableSet.has(dateStr);
                const inRange = isInRange(day);
                const edge = isRangeEdge(day);

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      styles.dayCell,
                      inRange && styles.dayInRange,
                      edge && styles.dayEdge,
                    ]}
                    onPress={() => handleDayPress(day)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        available && styles.dayHasRecords,
                        inRange && styles.dayTextInRange,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* Selected range indicator */}
          <View style={styles.rangeBar}>
            <Text style={styles.rangeText}>
              {rangeStart
                ? rangeEnd
                  ? `${rangeStart} ~ ${rangeEnd}`
                  : `${rangeStart} ~ 选择结束日期`
                : '请选择日期范围'}
            </Text>
            <TouchableOpacity onPress={handleClear}>
              <Text style={styles.clearText}>清除</Text>
            </TouchableOpacity>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button variant="ghost" size="sm" onPress={onClose}>
              取消
            </Button>
            <Button size="sm" onPress={handleConfirm}>
              确认
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: 340,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navBtn: {
    padding: 8,
  },
  navText: {
    fontSize: 16,
    color: colors.primary,
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: colors.text.tertiary,
    paddingVertical: 6,
  },
  dayRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  dayInRange: {
    backgroundColor: colors.primaryLight,
    borderRadius: 0,
  },
  dayEdge: {
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  dayText: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  dayHasRecords: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  dayTextInRange: {
    fontWeight: '600',
    color: colors.text.inverse,
  },
  rangeBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  rangeText: {
    fontSize: 13,
    color: colors.text.secondary,
    flex: 1,
  },
  clearText: {
    fontSize: 13,
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
});
