import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../src/theme';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { useInputStore } from '../../src/stores';
import { useKnowledgeStore } from '../../src/stores';
import { parseContent } from '../../src/services/ai/parsingService';
import type { InputDraft, ParseResult, DraftStatus } from '../../src/types';

const DRAFT_STATUS_CONFIG: Record<DraftStatus, { label: string; color: string }> = {
  parsing: { label: '解析中', color: colors.warning },
  pending_review: { label: '待审核', color: colors.accent },
  confirmed: { label: '已确认', color: colors.success },
  discarded: { label: '已丢弃', color: colors.text.tertiary },
};

export default function InputPage() {
  // Stores
  const drafts = useInputStore((s) => s.drafts);
  const loading = useInputStore((s) => s.loading);
  const loadAll = useInputStore((s) => s.loadAll);
  const createDraft = useInputStore((s) => s.createDraft);
  const updateParseResult = useInputStore((s) => s.updateParseResult);
  const confirmDraft = useInputStore((s) => s.confirmDraft);
  const discardDraft = useInputStore((s) => s.discardDraft);
  const deleteDraft = useInputStore((s) => s.deleteDraft);
  const categories = useKnowledgeStore((s) => s.categories);
  const addItem = useKnowledgeStore((s) => s.addItem);

  // Local state
  const [inputText, setInputText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleSubmit = async () => {
    const text = inputText.trim();
    if (!text) {
      Alert.alert('提示', '请输入URL或文本内容');
      return;
    }

    const isUrl = text.startsWith('http://') || text.startsWith('https');
    setIsParsing(true);

    try {
      // Step 1: Create draft
      let draft: InputDraft;
      try {
        draft = await createDraft(isUrl ? 'url' : 'text', text);
      } catch (e: any) {
        console.error('Create draft failed:', e?.message || e);
        Alert.alert('错误', '创建草稿失败：' + (e?.message || '数据库异常，请重启应用'));
        return;
      }

      // Step 2: Parse content (AI or fallback)
      let result: ParseResult;
      try {
        result = await parseContent({
          inputType: isUrl ? 'url' : 'text',
          content: text,
          targetCategories: categories.map((c) => ({ id: c.id, name: c.name })),
        });
      } catch {
        // AI unavailable — use local mock result
        result = {
          title: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
          content: text,
          suggestedCategoryId: categories[0]?.id || 'cat_other',
          suggestedCategoryName: categories[0]?.name || '其他',
          suggestedTags: [],
          confidence: 60,
          sourceSummary: text.slice(0, 100),
          extractedKeyPoints: ['AI 服务未配置，使用本地解析'],
        };
      }

      // Step 3: Save parse result to draft
      try {
        await updateParseResult(draft.id, result);
      } catch (e: any) {
        console.error('Update parse result failed:', e?.message || e);
        // Draft exists but parse result save failed — still show success
        Alert.alert('部分成功', '草稿已创建，但解析结果保存失败。请在草稿列表中手动查看。');
        setInputText('');
        return;
      }

      setInputText('');
      Alert.alert('解析完成', '请查看草稿列表，确认或丢弃解析结果');
    } catch (error: any) {
      Alert.alert('错误', '意外错误：' + (error?.message || '请重试'));
      console.error('Submit error:', error);
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirm = async (draft: InputDraft) => {
    if (!draft.parseResult) {
      Alert.alert('提示', '该草稿尚未解析完成，无法确认');
      return;
    }
    const pr = draft.parseResult;

    // Validate category — fallback to 'cat_other' if not found
    const catId = (categories.length > 0 && categories.some(c => c.id === pr.suggestedCategoryId))
      ? pr.suggestedCategoryId
      : (categories[0]?.id || 'cat_other');

    try {
      const newItem = await addItem({
        categoryId: catId,
        title: pr.title || draft.rawInput.slice(0, 50),
        content: pr.content || draft.rawInput,
        contentPreview: (pr.content || draft.rawInput).slice(0, 150),
        sourceURL: draft.inputType === 'url' ? draft.rawInput : undefined,
        sourceType: draft.inputType,
        tags: pr.suggestedTags || [],
        aiSummary: pr.sourceSummary || '',
        aiClassificationScore: pr.confidence ?? 50,
        status: 'confirmed',
      });
      await confirmDraft(draft.id, newItem.id);
      Alert.alert('✅ 已确认', '知识条目已添加到知识库，可在首页开始训练');
    } catch (error: any) {
      console.error('Confirm failed:', error?.message || error);
      Alert.alert('确认失败', error?.message || '数据库异常，请重启应用后重试');
    }
  };

  const handleDiscard = (draftId: string) => {
    Alert.alert('确认丢弃', '丢弃后可在草稿箱中找到，不会删除', [
      { text: '取消', style: 'cancel' },
      {
        text: '丢弃',
        style: 'destructive',
        onPress: () => discardDraft(draftId),
      },
    ]);
  };

  const handleDelete = (draftId: string) => {
    Alert.alert('确认删除', '此操作不可撤销', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => deleteDraft(draftId),
      },
    ]);
  };

  const getStatusConfig = (status: DraftStatus) =>
    DRAFT_STATUS_CONFIG[status] || { label: status, color: colors.text.tertiary };

  // Sort drafts by date (newest first)
  const sortedDrafts = [...drafts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>知识输入</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* Input Card */}
        <Card elevated style={styles.inputCard}>
          <Text style={styles.inputLabel}>
            粘贴 URL 或文本内容，AI 将自动解析为知识条目
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="在此粘贴文章链接或文本内容..."
            placeholderTextColor={colors.text.tertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <Button
            onPress={handleSubmit}
            loading={isParsing}
            disabled={!inputText.trim() || isParsing}
            style={styles.submitBtn}
          >
            {isParsing ? 'AI 解析中...' : '提交解析'}
          </Button>
        </Card>

        {/* Drafts List */}
        <View style={styles.draftsSection}>
          <Text style={styles.sectionTitle}>
            草稿箱 ({sortedDrafts.length})
          </Text>

          {sortedDrafts.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>暂无草稿</Text>
              <Text style={styles.emptyDesc}>提交 URL 或文本内容，AI 解析后将在此显示</Text>
            </View>
          )}

          {sortedDrafts.map((draft) => {
            const statusCfg = getStatusConfig(draft.status);
            const isExpanded = expandedDraft === draft.id;

            return (
              <Card key={draft.id} style={styles.draftCard}>
                <TouchableOpacity
                  onPress={() => setExpandedDraft(isExpanded ? null : draft.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.draftHeader}>
                    <View style={styles.draftTitleRow}>
                      <Badge
                        label={draft.inputType === 'url' ? 'URL' : '文本'}
                        size="sm"
                        color={draft.inputType === 'url' ? colors.primary : colors.warning}
                      />
                      <Text style={styles.draftTitle} numberOfLines={1}>
                        {draft.parseResult?.title || '未解析'}
                      </Text>
                    </View>
                    <View style={styles.draftMeta}>
                      <Badge
                        label={statusCfg.label}
                        size="sm"
                        color={statusCfg.color}
                      />
                      <Text style={styles.expandIcon}>
                        {isExpanded ? '▲' : '▼'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Expanded Content */}
                {isExpanded && (
                  <View style={styles.draftBody}>
                    {/* Raw Input */}
                    <Text style={styles.draftBodyLabel}>原始输入：</Text>
                    <Text style={styles.draftBodyText} numberOfLines={4}>
                      {draft.rawInput}
                    </Text>

                    {/* Parse Result */}
                    {draft.parseResult && (
                      <>
                        <View style={styles.draftDivider} />
                        <Text style={styles.draftBodyLabel}>AI 解析结果：</Text>
                        <Text style={styles.draftBodyText}>
                          📝 标题: {draft.parseResult.title}
                        </Text>
                        <Text style={styles.draftBodyText}>
                          📂 分类: {draft.parseResult.suggestedCategoryName}
                        </Text>
                        <Text style={styles.draftBodyText}>
                          🎯 置信度: {draft.parseResult.confidence}%
                        </Text>
                        {draft.parseResult.extractedKeyPoints.length > 0 && (
                          <View style={styles.keypointsWrap}>
                            <Text style={styles.draftBodyLabel}>关键点：</Text>
                            {draft.parseResult.extractedKeyPoints.map((point, i) => (
                              <Text key={i} style={styles.keypointItem}>
                                • {point}
                              </Text>
                            ))}
                          </View>
                        )}
                      </>
                    )}

                    {/* Actions */}
                    <View style={styles.draftActions}>
                      {draft.status === 'pending_review' && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            onPress={() => handleConfirm(draft)}
                            style={styles.draftActionBtn}
                          >
                            ✅ 确认
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onPress={() => handleDiscard(draft.id)}
                            style={styles.draftActionBtn}
                          >
                            丢弃
                          </Button>
                        </>
                      )}
                      {draft.status === 'confirmed' && (
                        <Text style={styles.confirmedText}>✅ 已添加至知识库</Text>
                      )}
                      {draft.status === 'discarded' && (
                        <Text style={styles.discardedText}>已丢弃</Text>
                      )}
                      <View style={styles.draftActionSpacer} />
                      <Button
                        variant="danger"
                        size="sm"
                        onPress={() => handleDelete(draft.id)}
                      >
                        🗑 删除
                      </Button>
                    </View>
                  </View>
                )}
              </Card>
            );
          })}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  // Input card
  inputCard: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 10,
    lineHeight: 19,
  },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 120,
    marginBottom: 12,
  },
  submitBtn: {
    width: '100%',
  },
  // Drafts
  draftsSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  // Draft card
  draftCard: {
    marginBottom: 8,
  },
  draftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  draftTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  draftTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  draftMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expandIcon: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  draftBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  draftBodyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  draftBodyText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 19,
    marginBottom: 4,
  },
  draftDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 10,
  },
  keypointsWrap: {
    marginTop: 4,
  },
  keypointItem: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 20,
    marginLeft: 4,
  },
  // Actions
  draftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 8,
  },
  draftActionBtn: {
    flex: 0,
  },
  draftActionSpacer: {
    flex: 1,
  },
  confirmedText: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '600',
  },
  discardedText: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  bottomSpacer: {
    height: 20,
  },
});
