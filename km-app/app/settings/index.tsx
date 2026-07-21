import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, tokens } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Slider } from '../../src/components/ui/Slider';
import { useSettingsStore } from '../../src/stores';
import { useKnowledgeStore } from '../../src/stores';
import { TRAINING, CATEGORY } from '../../src/utils/constants';
import type { KnowledgeCategory } from '../../src/types';

const CATEGORY_COLORS: readonly string[] = colors.categoryColors;

export default function SettingsPage() {
  // Stores
  const settings = useSettingsStore((s) => s.settings);
  const loading = useSettingsStore((s) => s.loading);
  const load = useSettingsStore((s) => s.load);
  const updateReminder = useSettingsStore((s) => s.updateReminder);
  const updateThreshold = useSettingsStore((s) => s.updateThreshold);
  const loadCategories = useSettingsStore((s) => s.loadCategories);
  const addCategoryStore = useSettingsStore((s) => s.addCategory);
  const updateCategory = useSettingsStore((s) => s.updateCategory);
  const categories = useKnowledgeStore((s) => s.categories);
  const loadCat = useKnowledgeStore((s) => s.loadCategories);

  // Local state
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[0]);
  const [editingCat, setEditingCat] = useState<KnowledgeCategory | null>(null);

  useEffect(() => {
    load();
    loadCat();
  }, []);

  const handleReminderToggle = (enabled: boolean) => {
    updateReminder(enabled, settings.dailyReminderTime);
  };

  const handleTimeChange = (time: string) => {
    updateReminder(settings.dailyReminderEnabled, time);
  };

  const handleThresholdChange = (value: number) => {
    updateThreshold(value);
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) {
      Alert.alert('提示', '请输入分类名称');
      return;
    }
    try {
      await addCategoryStore(newCatName.trim(), newCatColor);
      setNewCatName('');
      setShowAddCategory(false);
    } catch (error) {
      Alert.alert('错误', '添加分类失败');
    }
  };

  const handleEditCategory = () => {
    if (!editingCat || !newCatName.trim()) return;
    updateCategory(editingCat.id, newCatName.trim(), newCatColor);
    setEditingCat(null);
    setNewCatName('');
  };

  const openEditCategory = (cat: KnowledgeCategory) => {
    setEditingCat(cat);
    setNewCatName(cat.name);
    setNewCatColor(cat.color);
  };

  const handleTimePreset = (time: string) => {
    handleTimeChange(time);
  };

  const timePresets = [
    { label: '08:00', time: '08:00' },
    { label: '09:00', time: '09:00' },
    { label: '20:00', time: '20:00' },
    { label: '21:00', time: '21:00' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>个人设置</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Daily Reminder */}
        <Text style={styles.sectionLabel}>每日提醒</Text>
        <Card elevated style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>每日复述提醒</Text>
              <Text style={styles.settingDesc}>开启后每天定时提醒你进行表达训练</Text>
            </View>
            <Switch
              value={settings.dailyReminderEnabled}
              onValueChange={handleReminderToggle}
              trackColor={{ false: colors.divider, true: colors.primaryLight }}
              thumbColor={settings.dailyReminderEnabled ? colors.accent : colors.surfaceElevated}
            />
          </View>

          {settings.dailyReminderEnabled && (
            <View style={styles.timeSelector}>
              <Text style={styles.timeLabel}>提醒时间：</Text>
              <View style={styles.timePresets}>
                {timePresets.map((preset) => (
                  <TouchableOpacity
                    key={preset.time}
                    style={[
                      styles.timeChip,
                      settings.dailyReminderTime === preset.time && styles.timeChipActive,
                    ]}
                    onPress={() => handleTimePreset(preset.time)}
                  >
                    <Text
                      style={[
                        styles.timeChipText,
                        settings.dailyReminderTime === preset.time && styles.timeChipTextActive,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </Card>

        {/* Pass Threshold */}
        <Text style={styles.sectionLabel}>达标阈值</Text>
        <Card elevated style={styles.settingCard}>
          <View style={styles.thresholdHeader}>
            <View>
              <Text style={styles.settingTitle}>复述达标线</Text>
              <Text style={styles.settingDesc}>达到此分数视为复述合格</Text>
            </View>
            <Text style={styles.thresholdValue}>{settings.passThreshold} 分</Text>
          </View>
          <Slider
            value={settings.passThreshold}
            onValueChange={handleThresholdChange}
            minimumValue={TRAINING.minThreshold}
            maximumValue={TRAINING.maxThreshold}
            step={TRAINING.thresholdStep}
            valueSuffix=" 分"
          />
          <View style={styles.thresholdRange}>
            <Text style={styles.thresholdRangeText}>60</Text>
            <Text style={styles.thresholdRangeText}>100</Text>
          </View>
        </Card>

        {/* Categories */}
        <Text style={styles.sectionLabel}>知识分类管理</Text>
        <Card elevated style={styles.settingCard}>
          {categories.map((cat) => (
            <View key={cat.id} style={styles.categoryItem}>
              <View style={styles.categoryInfo}>
                <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                <Text style={styles.categoryName}>{cat.name}</Text>
              </View>
              <TouchableOpacity
                onPress={() => openEditCategory(cat)}
                style={styles.editBtn}
              >
                <Text style={styles.editBtnText}>编辑</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Add Category Button */}
          <TouchableOpacity
            style={styles.addCategoryBtn}
            onPress={() => {
              setEditingCat(null);
              setNewCatName('');
              setNewCatColor(CATEGORY_COLORS[0]);
              setShowAddCategory(true);
            }}
          >
            <Text style={styles.addCategoryBtnText}>+ 添加分类</Text>
          </TouchableOpacity>
        </Card>

        {/* App Info */}
        <Text style={styles.sectionLabel}>关于</Text>
        <Card elevated style={styles.settingCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>应用名称</Text>
            <Text style={styles.infoValue}>知网 Knowledge-Mesh</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>版本</Text>
            <Text style={styles.infoValue}>v1.0.0</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>框架</Text>
            <Text style={styles.infoValue}>Expo SDK 57 + React Native 0.86</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>AI 引擎</Text>
            <Text style={styles.infoValue}>Claude API (Anthropic)</Text>
          </View>
        </Card>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Add/Edit Category Modal */}
      <Modal
        visible={showAddCategory || !!editingCat}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setShowAddCategory(false);
          setEditingCat(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              setShowAddCategory(false);
              setEditingCat(null);
            }}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingCat ? '编辑分类' : '添加分类'}
            </Text>

            <Text style={styles.modalLabel}>分类名称</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="输入分类名称..."
              placeholderTextColor={colors.text.tertiary}
              value={newCatName}
              onChangeText={setNewCatName}
            />

            <Text style={styles.modalLabel}>颜色</Text>
            <View style={styles.colorGrid}>
              {CATEGORY_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorItem,
                    { backgroundColor: color },
                    newCatColor === color && styles.colorItemSelected,
                  ]}
                  onPress={() => setNewCatColor(color)}
                />
              ))}
            </View>

            <View style={styles.modalActions}>
              <Button
                variant="ghost"
                onPress={() => {
                  setShowAddCategory(false);
                  setEditingCat(null);
                }}
              >
                取消
              </Button>
              <Button
                onPress={editingCat ? handleEditCategory : handleAddCategory}
                disabled={!newCatName.trim()}
              >
                {editingCat ? '保存' : '添加'}
              </Button>
            </View>
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
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: tokens.borderWidth.hairline,
    borderBottomColor: '#D4CDC0',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 4,
  },
  // Setting card
  settingCard: {
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 17,
  },
  // Time selector
  timeSelector: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: tokens.borderWidth.hairline,
    borderTopColor: '#D4CDC0',
  },
  timeLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  timePresets: {
    flexDirection: 'row',
    gap: 8,
  },
  timeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    borderWidth: tokens.borderWidth.hairline,
    borderColor: '#D4CDC0',
  },
  timeChipActive: {
    backgroundColor: colors.primary,
  },
  timeChipText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  timeChipTextActive: {
    color: colors.text.inverse,
    fontWeight: '600',
  },
  // Threshold
  thresholdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  thresholdValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  thresholdRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  thresholdRangeText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  // Categories
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: tokens.borderWidth.hairline,
    borderBottomColor: '#D4CDC0',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryName: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 3,
    backgroundColor: colors.primaryLight,
    borderWidth: tokens.borderWidth.hairline,
    borderColor: '#D4CDC0',
  },
  editBtnText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  addCategoryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: tokens.borderWidth.hairline,
    borderColor: '#D4CDC0',
    borderRadius: 8,
    marginTop: 8,
  },
  addCategoryBtnText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  // Info
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  infoValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  infoDivider: {
    height: tokens.borderWidth.hairline,
    backgroundColor: '#D4CDC0',
  },
  bottomSpacer: {
    height: 40,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(36,34,32,0.4)',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: tokens.borderWidth.hairline,
    borderColor: '#D4CDC0',
    padding: 12,
    fontSize: 15,
    color: colors.text.primary,
    marginBottom: 16,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  colorItem: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorItemSelected: {
    borderColor: colors.text.primary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
});
