import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { colors, fontFamily } from '../../src/theme';
import { Badge } from '../../src/components/ui/Badge';
import { useInputStore } from '../../src/stores/useInputStore';
import { useKnowledgeStore } from '../../src/stores/useKnowledgeStore';
import { useExpressionStore } from '../../src/stores/useExpressionStore';

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  parsing: { label: '解析中', color: colors.warning },
  pending_review: { label: '待审核', color: colors.primary },
  confirmed: { label: '已入库', color: colors.success },
  discarded: { label: '已丢弃', color: colors.text.tertiary },
};

export default function DraftDetailPage() {
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const router = useRouter();

  const drafts = useInputStore((s) => s.drafts);
  const confirmDraft = useInputStore((s) => s.confirmDraft);
  const discardDraft = useInputStore((s) => s.discardDraft);
  const deleteDraft = useInputStore((s) => s.deleteDraft);
  const addItem = useKnowledgeStore((s) => s.addItem);
  const createRecord = useExpressionStore((s) => s.createRecord);

  const draft = drafts.find((d) => d.id === draftId);

  if (!draft) {
    return (
      <SafeAreaView style={SS.root} edges={['top', 'bottom']}>
        <View style={SS.header}>
          <TouchableOpacity onPress={() => router.back()} style={SS.backBtn}>
            <Text style={SS.backText}>← 返回</Text>
          </TouchableOpacity>
          <Text style={SS.headerTitle}>草稿</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={SS.empty}>
          <Text style={SS.emptyText}>草稿未找到</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusCfg = STATUS_CFG[draft.status] || { label: draft.status, color: colors.text.tertiary };
  const pr = draft.parseResult;
  const isPending = draft.status === 'pending_review';

  const handleConfirm = async () => {
    if (!pr) return;
    try {
      const newItem = await addItem({
        categoryId: pr.suggestedCategoryId,
        title: pr.title,
        content: pr.content,
        contentPreview: pr.content.slice(0, 150),
        sourceURL: draft.inputType === 'url' ? draft.rawInput : undefined,
        sourceType: draft.inputType,
        tags: pr.suggestedTags,
        aiSummary: pr.sourceSummary,
        aiClassificationScore: pr.confidence,
        status: 'confirmed',
      });
      await confirmDraft(draft.id, newItem.id);
      try { await new Promise((r) => setTimeout(r, 100)); await createRecord(newItem.id); } catch { /* ok */ }
      Alert.alert('已确认入库', '知识条目已添加至知识库', [{ text: '返回', onPress: () => router.back() }]);
    } catch { Alert.alert('错误', '确认失败'); }
  };

  const handleDiscard = () => {
    Alert.alert('确认丢弃', '可在历史任务中找回', [
      { text: '取消', style: 'cancel' },
      { text: '丢弃', style: 'destructive', onPress: () => { discardDraft(draft.id); router.back(); } },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('确认删除', '不可撤销', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => { deleteDraft(draft.id); router.back(); } },
    ]);
  };

  const knowledgeLink =
    draft.status === 'confirmed' && draft.confirmedKnowledgeItemId
      ? `/knowledge/${draft.confirmedKnowledgeItemId}`
      : null;

  return (
    <SafeAreaView style={SS.root} edges={['top', 'bottom']}>
      <View style={SS.header}>
        <TouchableOpacity onPress={() => router.back()} style={SS.backBtn}>
          <Text style={SS.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={SS.headerTitle}>草稿详情</Text>
        <View style={SS.headerRight}>
          <Badge label={statusCfg.label} size="sm" color={statusCfg.color} />
        </View>
      </View>

      <ScrollView style={SS.scroll} contentContainerStyle={SS.inner} showsVerticalScrollIndicator={false}>
        <Text style={SS.title}>{pr?.title || '—'}</Text>

        <View style={SS.metaRow}>
          <Text style={SS.metaTag}>{draft.inputType === 'url' ? '链接输入' : '文本输入'}</Text>
          <Text style={SS.metaDate}>{format(new Date(draft.createdAt), 'yyyy/MM/dd HH:mm')}</Text>
        </View>

        {/* Original */}
        <View style={SS.section}>
          <Text style={SS.sectionLabel}>原始输入</Text>
          <Text style={SS.body}>{draft.rawInput}</Text>
        </View>

        {/* Parse result */}
        {pr && (
          <View style={SS.section}>
            <Text style={SS.sectionLabel}>AI 解析结果</Text>
            <View style={SS.field}>
              <Text style={SS.fieldL}>标题</Text>
              <Text style={SS.fieldV}>{pr.title}</Text>
            </View>
            <View style={SS.field}>
              <Text style={SS.fieldL}>分类</Text>
              <Text style={SS.fieldV}>{pr.suggestedCategoryName || '—'}</Text>
            </View>
            <View style={SS.field}>
              <Text style={SS.fieldL}>置信度</Text>
              <View style={SS.confBar}>
                <View style={[SS.confFill, { width: `${Math.min(pr.confidence, 100)}%` }]} />
              </View>
              <Text style={SS.confPct}>{pr.confidence}%</Text>
            </View>
            {pr.extractedKeyPoints && pr.extractedKeyPoints.length > 0 && (
              <View style={SS.sub}>
                <Text style={SS.subLabel}>关键点</Text>
                {pr.extractedKeyPoints.map((p, i) => (
                  <Text key={i} style={SS.keyPoint}>{i + 1}. {p}</Text>
                ))}
              </View>
            )}
            {pr.sourceSummary && (
              <View style={SS.sub}>
                <Text style={SS.subLabel}>AI 摘要</Text>
                <Text style={SS.body}>{pr.sourceSummary}</Text>
              </View>
            )}
          </View>
        )}

        {knowledgeLink && (
          <TouchableOpacity style={SS.link} onPress={() => router.push(knowledgeLink)} activeOpacity={0.6}>
            <Text style={SS.linkText}>查看知识条目 →</Text>
          </TouchableOpacity>
        )}

        <View style={SS.actions}>
          {isPending && (
            <>
              <TouchableOpacity style={SS.confirmBtn} onPress={handleConfirm} activeOpacity={0.6}>
                <Text style={SS.confirmText}>确认入库</Text>
              </TouchableOpacity>
              <TouchableOpacity style={SS.discardBtn} onPress={handleDiscard} activeOpacity={0.6}>
                <Text style={SS.discardText}>丢弃</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={SS.deleteBtn} onPress={handleDelete} activeOpacity={0.6}>
            <Text style={SS.deleteText}>永久删除</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const SS = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 0.5, borderBottomColor: colors.divider,
  },
  backBtn: { paddingVertical: 4, paddingRight: 12 },
  backText: { fontSize: 15, color: colors.text.secondary, letterSpacing: 1 },
  headerTitle: { fontSize: 16, fontWeight: '400', color: colors.text.primary, letterSpacing: 4, fontFamily: fontFamily },
  headerRight: { minWidth: 60, alignItems: 'flex-end' },

  scroll: { flex: 1 },
  inner: { padding: 20, gap: 16 },

  title: { fontSize: 20, fontWeight: '400', color: colors.text.primary, lineHeight: 28, fontFamily: fontFamily },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaTag: {
    fontSize: 11, color: colors.primary, letterSpacing: 2,
    backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 3,
  },
  metaDate: { fontSize: 11, color: colors.text.tertiary, letterSpacing: 1 },

  section: {
    backgroundColor: colors.surface, padding: 18,
    borderLeftWidth: 1.5, borderLeftColor: colors.text.primary,
  },
  sectionLabel: { fontSize: 12, fontWeight: '500', color: colors.text.primary, letterSpacing: 3, marginBottom: 12 },
  body: { fontSize: 14, color: colors.text.secondary, lineHeight: 24, fontFamily: fontFamily },

  field: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  fieldL: { width: 52, fontSize: 12, color: colors.text.tertiary, letterSpacing: 1 },
  fieldV: { flex: 1, fontSize: 14, color: colors.text.primary, fontFamily: fontFamily },
  confBar: { flex: 1, height: 4, backgroundColor: colors.divider, marginRight: 8 },
  confFill: { height: '100%', backgroundColor: colors.text.primary },
  confPct: { fontSize: 12, fontWeight: '500', color: colors.text.primary, fontFamily: fontFamily },

  sub: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: colors.divider },
  subLabel: { fontSize: 11, color: colors.text.secondary, letterSpacing: 2, marginBottom: 8 },
  keyPoint: { fontSize: 13, color: colors.text.secondary, lineHeight: 22, marginBottom: 4 },

  link: {
    backgroundColor: colors.surface, padding: 16, alignItems: 'center',
    borderBottomWidth: 0.5, borderBottomColor: colors.divider,
  },
  linkText: { fontSize: 13, color: colors.primary, letterSpacing: 2 },

  actions: { gap: 10 },
  confirmBtn: { backgroundColor: colors.text.primary, paddingVertical: 14, alignItems: 'center' },
  confirmText: { fontSize: 14, color: colors.text.inverse, letterSpacing: 4, fontWeight: '500' },
  discardBtn: {
    backgroundColor: colors.surface, paddingVertical: 14, alignItems: 'center',
    borderWidth: 0.5, borderColor: colors.divider,
  },
  discardText: { fontSize: 13, color: colors.text.secondary, letterSpacing: 2 },
  deleteBtn: { paddingVertical: 10, alignItems: 'center' },
  deleteText: { fontSize: 12, color: colors.danger, letterSpacing: 2 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: colors.text.tertiary, letterSpacing: 2, fontFamily: fontFamily },
});
