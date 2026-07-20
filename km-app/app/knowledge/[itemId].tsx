import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily } from '../../src/theme';
import { useKnowledgeStore } from '../../src/stores';
import { useExpressionStore } from '../../src/stores';
import { Badge } from '../../src/components/ui/Badge';

type EditableSection = 'title' | 'summary' | 'input' | 'parseResult' | null;

export default function KnowledgeDetailPage() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = useKnowledgeStore((s) => s.items);
  const categories = useKnowledgeStore((s) => s.categories);
  const updateItem = useKnowledgeStore((s) => s.updateItem);
  const deleteItem = useKnowledgeStore((s) => s.deleteItem);
  const createRecord = useExpressionStore((s) => s.createRecord);
  const item = items.find((i) => i.id === itemId);

  const [editingSection, setEditingSection] = useState<EditableSection>(null);
  const [editText, setEditText] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editConfidence, setEditConfidence] = useState('');
  const [editVerifyLogic, setEditVerifyLogic] = useState('');
  const [editRefLinks, setEditRefLinks] = useState('');
  const [editMatchScore, setEditMatchScore] = useState('');
  const [editSourceQuote, setEditSourceQuote] = useState('');

  if (!item) {
    return (
      <SafeAreaView style={ST.root} edges={['top', 'bottom']}>
        <View style={ST.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={ST.backText}>← 返回</Text>
          </TouchableOpacity>
          <Text style={ST.headerTitle}>知识条目</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={ST.empty}><Text style={ST.emptyText}>条目未找到</Text></View>
      </SafeAreaView>
    );
  }

  const isDraft = item.status === 'draft';
  const category = categories.find((c) => c.id === item.categoryId);
  const verification = item.aiVerificationResult;

  const startEdit = (section: EditableSection) => {
    if (section === 'title') setEditText(item.title);
    else if (section === 'summary') setEditText(item.aiSummary || '');
    else if (section === 'input') setEditText(item.content || '');
    else if (section === 'parseResult') {
      setEditCategory(category?.name || item.categoryId || '');
      setEditConfidence(item.aiClassificationScore != null ? String(item.aiClassificationScore) : '');
      setEditVerifyLogic(verification?.verificationLogic || '');
      setEditRefLinks((verification?.referenceLinks || []).join('\n'));
      setEditMatchScore(verification?.matchScore != null ? String(verification.matchScore) : '');
      setEditSourceQuote(verification?.sourceQuote || '');
    }
    setEditingSection(section);
  };

  const cancelEdit = () => { setEditingSection(null); setEditText(''); };

  const saveEdit = async () => {
    if (!editingSection) return;
    try {
      if (editingSection === 'title') await updateItem(item.id, { title: editText });
      else if (editingSection === 'summary') await updateItem(item.id, { aiSummary: editText });
      else if (editingSection === 'input') await updateItem(item.id, { content: editText });
      else if (editingSection === 'parseResult') {
        const v = verification || { matchScore: 0, discrepancies: [], sourceQuote: '', verificationLogic: '', referenceLinks: [] };
        await updateItem(item.id, {
          categoryId: editCategory,
          aiClassificationScore: editConfidence ? Number(editConfidence) : undefined,
          aiVerificationResult: {
            ...v, verificationLogic: editVerifyLogic,
            referenceLinks: editRefLinks.split('\n').filter((l) => l.trim()),
            matchScore: editMatchScore ? Number(editMatchScore) : 0,
            sourceQuote: editSourceQuote,
          },
        });
      }
      setEditingSection(null); setEditText('');
    } catch { Alert.alert('保存失败', '请重试'); }
  };

  const handleConfirm = async () => {
    try {
      await updateItem(item.id, { status: 'confirmed' });
      await new Promise((r) => setTimeout(r, 100));
      await createRecord(item.id);
      Alert.alert('已确认', '知识条目已确认入库', [{ text: '好的', onPress: () => router.back() }]);
    } catch { Alert.alert('错误', '操作失败'); }
  };

  const handleDelete = () => {
    Alert.alert('确认删除', '不可撤销', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => { deleteItem(item.id); router.back(); } },
    ]);
  };

  return (
    <SafeAreaView style={ST.root} edges={['top', 'bottom']}>
      <View style={ST.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={ST.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={ST.headerTitle} numberOfLines={1}>知识条目详情</Text>
        <View style={ST.headerRight}>
          <Badge label={isDraft ? '未确认' : '已入库'} size="sm" color={isDraft ? colors.warning : colors.success} />
        </View>
      </View>

      <ScrollView style={ST.scroll} contentContainerStyle={ST.inner} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* ── Title ────────────────────────────────────────────────── */}
        <View style={ST.section}>
          <View style={ST.secHead}>
            <Text style={ST.secLabel}>知识标题</Text>
            {editingSection !== 'title' && (
              <TouchableOpacity onPress={() => startEdit('title')}><Text style={ST.editLink}>编辑</Text></TouchableOpacity>
            )}
            {editingSection === 'title' && (
              <TouchableOpacity onPress={cancelEdit}><Text style={ST.cancelLink}>取消</Text></TouchableOpacity>
            )}
          </View>
          {editingSection === 'title' ? (
            <>
              <TextInput style={ST.editInput} value={editText} onChangeText={setEditText} autoFocus />
              <View style={ST.saveRow}>
                <TouchableOpacity style={ST.saveBtn} onPress={saveEdit}><Text style={ST.saveBtnText}>确认</Text></TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={ST.itemTitle}>{item.title}</Text>
          )}
        </View>

        {/* ── AI Summary ───────────────────────────────────────────── */}
        <View style={ST.section}>
          <View style={ST.secHead}>
            <Text style={ST.secLabel}>AI 总结</Text>
            {editingSection !== 'summary' && (
              <TouchableOpacity onPress={() => startEdit('summary')}><Text style={ST.editLink}>编辑</Text></TouchableOpacity>
            )}
            {editingSection === 'summary' && (
              <TouchableOpacity onPress={cancelEdit}><Text style={ST.cancelLink}>取消</Text></TouchableOpacity>
            )}
          </View>
          {editingSection === 'summary' ? (
            <>
              <TextInput style={ST.editInput} value={editText} onChangeText={setEditText} multiline textAlignVertical="top" autoFocus />
              <View style={ST.saveRow}>
                <TouchableOpacity style={ST.saveBtn} onPress={saveEdit}><Text style={ST.saveBtnText}>确认</Text></TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={ST.body}>{item.aiSummary || '暂无总结'}</Text>
          )}
        </View>

        {/* ── Original Input ───────────────────────────────────────── */}
        <View style={ST.section}>
          <View style={ST.secHead}>
            <Text style={ST.secLabel}>原始输入</Text>
            {editingSection !== 'input' && (
              <TouchableOpacity onPress={() => startEdit('input')}><Text style={ST.editLink}>编辑</Text></TouchableOpacity>
            )}
            {editingSection === 'input' && (
              <TouchableOpacity onPress={cancelEdit}><Text style={ST.cancelLink}>取消</Text></TouchableOpacity>
            )}
          </View>
          {editingSection === 'input' ? (
            <>
              <TextInput style={ST.editInput} value={editText} onChangeText={setEditText} multiline textAlignVertical="top" autoFocus />
              <View style={ST.saveRow}>
                <TouchableOpacity style={ST.saveBtn} onPress={saveEdit}><Text style={ST.saveBtnText}>确认</Text></TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {item.sourceURL && (
                <Text style={ST.srcURL} selectable>{item.sourceURL}</Text>
              )}
              <Text style={ST.body}>{item.content || '暂无内容'}</Text>
            </>
          )}
        </View>

        {/* ── AI Parse Result ──────────────────────────────────────── */}
        <View style={ST.section}>
          <View style={ST.secHead}>
            <Text style={ST.secLabel}>AI 解析结果</Text>
            {editingSection !== 'parseResult' && (
              <TouchableOpacity onPress={() => startEdit('parseResult')}><Text style={ST.editLink}>编辑</Text></TouchableOpacity>
            )}
            {editingSection === 'parseResult' && (
              <TouchableOpacity onPress={cancelEdit}><Text style={ST.cancelLink}>取消</Text></TouchableOpacity>
            )}
          </View>
          {editingSection === 'parseResult' ? (
            <>
              <Text style={ST.fieldLabel}>分类</Text>
              <TextInput style={ST.editSm} value={editCategory} onChangeText={setEditCategory} />
              <Text style={ST.fieldLabel}>置信度 (%)</Text>
              <TextInput style={ST.editSm} value={editConfidence} onChangeText={setEditConfidence} keyboardType="numeric" />
              <Text style={ST.fieldLabel}>验真思路</Text>
              <TextInput style={ST.editInput} value={editVerifyLogic} onChangeText={setEditVerifyLogic} multiline textAlignVertical="top" />
              <Text style={ST.fieldLabel}>参考 URL（每行一个）</Text>
              <TextInput style={ST.editInput} value={editRefLinks} onChangeText={setEditRefLinks} multiline textAlignVertical="top" />
              <Text style={ST.fieldLabel}>匹配度 (%)</Text>
              <TextInput style={ST.editSm} value={editMatchScore} onChangeText={setEditMatchScore} keyboardType="numeric" />
              <Text style={ST.fieldLabel}>原文引用</Text>
              <TextInput style={ST.editInput} value={editSourceQuote} onChangeText={setEditSourceQuote} multiline textAlignVertical="top" />
              <View style={ST.saveRow}>
                <TouchableOpacity style={ST.saveBtn} onPress={saveEdit}><Text style={ST.saveBtnText}>确认</Text></TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={ST.fieldRow}>
                <Text style={ST.fieldKey}>分类</Text>
                <Text style={ST.fieldV}>{category?.name || item.categoryId || '未分类'}</Text>
              </View>
              {item.aiClassificationScore != null && (
                <View style={ST.fieldRow}>
                  <Text style={ST.fieldKey}>置信度</Text>
                  <Text style={ST.fieldV}>{item.aiClassificationScore}%</Text>
                </View>
              )}
              {verification && (
                <View style={ST.sub}>
                  <Text style={ST.subLabel}>验真结果</Text>
                  {verification.verificationLogic ? (
                    <View style={ST.subF}><Text style={ST.subFL}>验真思路</Text><Text style={ST.body}>{verification.verificationLogic}</Text></View>
                  ) : null}
                  {verification.referenceLinks && verification.referenceLinks.length > 0 && (
                    <View style={ST.subF}>
                      <Text style={ST.subFL}>参考 URL</Text>
                      {verification.referenceLinks.map((link, i) => (
                        <Text key={i} style={ST.refLink} selectable>{i + 1}. {link}</Text>
                      ))}
                    </View>
                  )}
                  {verification.matchScore != null && (
                    <View style={ST.fieldRow}><Text style={ST.fieldKey}>匹配度</Text><Text style={ST.fieldV}>{verification.matchScore}%</Text></View>
                  )}
                  {verification.sourceQuote ? (
                    <View style={ST.subF}><Text style={ST.subFL}>原文引用</Text><Text style={ST.body}>{verification.sourceQuote}</Text></View>
                  ) : null}
                </View>
              )}
              {!verification && !item.aiClassificationScore && !category && (
                <Text style={ST.hint}>暂无 AI 解析数据</Text>
              )}
            </>
          )}
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* Bottom bar */}
      <View style={[ST.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        {isDraft && (
          <TouchableOpacity style={ST.bottomConfirm} onPress={handleConfirm}>
            <Text style={ST.bottomConfirmText}>确认入库</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={ST.bottomDelete} onPress={handleDelete}>
          <Text style={ST.bottomDeleteText}>删除</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const ST = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.divider,
  },
  backText: { fontSize: 15, color: colors.text.secondary, letterSpacing: 1 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text.primary, letterSpacing: 1, textAlign: 'center' },
  headerRight: { minWidth: 60, alignItems: 'flex-end' },

  scroll: { flex: 1 },
  inner: { padding: 18, gap: 14 },

  section: {
    backgroundColor: colors.surface, padding: 16,
    borderLeftWidth: 2, borderLeftColor: colors.text.primary,
  },
  secHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  secLabel: { fontSize: 12, fontWeight: '600', color: colors.text.primary, letterSpacing: 2, flex: 1, fontFamily },
  editLink: { fontSize: 11, color: colors.text.secondary, letterSpacing: 2 },
  cancelLink: { fontSize: 11, color: colors.text.tertiary, letterSpacing: 2 },

  itemTitle: { fontSize: 18, fontWeight: '600', color: colors.text.primary, fontFamily, lineHeight: 26 },
  body: { fontSize: 14, color: colors.text.secondary, lineHeight: 24 },
  srcURL: { fontSize: 13, color: colors.primary, lineHeight: 22, marginBottom: 8 },

  editInput: {
    backgroundColor: colors.background, padding: 12, fontSize: 14, color: colors.text.primary,
    minHeight: 60, textAlignVertical: 'top', lineHeight: 22, marginBottom: 8,
    borderBottomWidth: 0.5, borderBottomColor: colors.divider,
  },
  editSm: {
    backgroundColor: colors.background, padding: 10, fontSize: 14, color: colors.text.primary,
    marginBottom: 10, borderBottomWidth: 0.5, borderBottomColor: colors.divider,
  },
  fieldLabel: { fontSize: 12, color: colors.text.tertiary, letterSpacing: 1, marginBottom: 4, marginTop: 4 },
  saveRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  saveBtn: { backgroundColor: colors.text.primary, paddingVertical: 8, paddingHorizontal: 18 },
  saveBtnText: { fontSize: 12, color: colors.text.inverse, letterSpacing: 2, fontWeight: '500' },

  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 10 },
  fieldKey: { width: 60, fontSize: 12, color: colors.text.tertiary, letterSpacing: 1 },
  fieldV: { flex: 1, fontSize: 13, color: colors.text.primary },

  sub: { marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: colors.divider },
  subLabel: { fontSize: 12, color: colors.text.secondary, letterSpacing: 2, marginBottom: 8 },
  subF: { marginBottom: 10 },
  subFL: { fontSize: 11, color: colors.text.tertiary, letterSpacing: 1, marginBottom: 4 },
  refLink: { fontSize: 13, color: colors.primary, lineHeight: 22, marginBottom: 2 },
  hint: { fontSize: 12, color: colors.text.tertiary, letterSpacing: 1, fontStyle: 'italic' },

  bottomBar: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 12,
    backgroundColor: colors.surface, borderTopWidth: 0.5, borderTopColor: colors.divider,
  },
  bottomConfirm: { flex: 1, backgroundColor: colors.text.primary, paddingVertical: 13, alignItems: 'center' },
  bottomConfirmText: { fontSize: 14, color: colors.text.inverse, letterSpacing: 3, fontWeight: '500' },
  bottomDelete: {
    flex: 1, backgroundColor: 'transparent', paddingVertical: 13, alignItems: 'center',
    borderWidth: 0.5, borderColor: colors.divider,
  },
  bottomDeleteText: { fontSize: 13, color: colors.danger, letterSpacing: 2 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: colors.text.tertiary, letterSpacing: 1, fontFamily },
});
