import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import Svg, { Rect } from 'react-native-svg';
import { colors, tokens, fontFamily } from '../../src/theme';
import { pageContentPadding } from '../../src/theme/layout';
import { PageHeader } from '../../src/components/ui/PageHeader';
import {
  ChevronLeftIcon, ChevronDownIcon, TrashIcon, PencilIcon, RefreshIcon,
  CheckIcon, MicIcon,
} from '../../src/components/ui/ExpressionIcons';
import { useKnowledgeStore, useExpressionStore, useSettingsStore } from '../../src/stores';

export default function KnowledgeDetailPage() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const router = useRouter();
  const items = useKnowledgeStore((s) => s.items);
  const categories = useKnowledgeStore((s) => s.categories);
  const updateItem = useKnowledgeStore((s) => s.updateItem);
  const deleteItem = useKnowledgeStore((s) => s.deleteItem);
  const addCategory = useKnowledgeStore((s) => s.addCategory);
  const createRecord = useExpressionStore((s) => s.createRecord);
  const records = useExpressionStore((s) => s.records);
  const saveUserTags = useSettingsStore((s) => s.saveUserTags);
  const item = items.find((i) => i.id === itemId);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editNewTag, setEditNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [showFullInput, setShowFullInput] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [editCatIds, setEditCatIds] = useState<string[]>([]);
  const [editSubCatName, setEditSubCatName] = useState('');
  const [isEditingSubCat, setIsEditingSubCat] = useState(false);
  const [isAddingParent, setIsAddingParent] = useState(false);
  const [newParentName, setNewParentName] = useState('');

  const parentCats = useMemo(() => categories.filter((c) => !c.parentId), [categories]);

  if (!item) {
    return (
      <SafeAreaView style={S.root} edges={['top']}>
        <PageHeader
          title="知识详情"
          leftAction={
            <TouchableOpacity onPress={() => router.back()}>
              <View style={S.headerSideRow}>
                <ChevronLeftIcon size={16} color={colors.text.secondary} />
                <Text style={S.backText}> 返回</Text>
              </View>
            </TouchableOpacity>
          }
        />
        <View style={S.empty}><Text style={S.emptyText}>条目未找到</Text></View>
      </SafeAreaView>
    );
  }

  const category = categories.find((c) => c.id === item.categoryId);
  const subCategory = item.subCategoryId
    ? categories.find((c) => c.id === item.subCategoryId)
    : undefined;
  const tags = (item.tags || []).filter((t: string) => !t.startsWith('__pcat__'));
  // Extract extra parent categories stored as hidden tags
  const extraParentNames = (item.tags || [])
    .filter((t: string) => t.startsWith('__pcat__'))
    .map((t: string) => t.slice('__pcat__'.length));
  const allParentNames = [
    category?.name || '未分类',
    ...extraParentNames.filter((n: string) => n !== (category?.name || '')),
  ];
  // If any real parent is selected, hide "未分类"; otherwise show "未分类" alone
  const displayParentNames = allParentNames.some((n: string) => n !== '未分类')
    ? allParentNames.filter((n: string) => n !== '未分类')
    : allParentNames;

  const startEdit = () => {
    setEditTitle(item.title);
    setEditSummary(item.aiSummary || '');
    setEditContent(item.content || '');
    setEditTags([...(item.tags || []).filter((t: string) => !t.startsWith('__pcat__'))]);
    setEditNewTag('');
    // Restore all selected parent categories (primary + hidden tags)
    const hiddenCats = (item.tags || [])
      .filter((t: string) => t.startsWith('__pcat__'))
      .map((t: string) => t.slice('__pcat__'.length));
    const storedIds = [item.categoryId, ...hiddenCats
      .map((n: string) => parentCats.find(c => c.name === n)?.id)
      .filter(Boolean) as string[]];
    setEditCatIds([...new Set(storedIds)]);
    setEditSubCatName(subCategory?.name || '');
    setIsEditingSubCat(false);
    setHasChanges(false);
    setEditing(true);
  };

  const handleBack = () => {
    if (editing && hasChanges) {
      Alert.alert('放弃修改？', '是否放弃本次编辑的修改？', [
        { text: '继续编辑', style: 'cancel' },
        { text: '放弃', style: 'destructive', onPress: () => { setEditing(false); router.back(); } },
      ]);
    } else {
      setEditing(false);
      router.back();
    }
  };

  const handleSave = async () => {
    try {
      if (!editTitle.trim()) {
        Alert.alert('保存失败', '知识条目标题不能为空');
        return;
      }
      const primaryCatId = editCatIds[0] || item.categoryId;
      // Store extra parent categories as hidden tags (prefixed) — filtered out of display
      const extraCatNames = editCatIds.slice(1)
        .map(id => parentCats.find(c => c.id === id)?.name)
        .filter(Boolean) as string[];
      const allTags = [...editTags, ...extraCatNames.map(n => `__pcat__${n}`)];

      await updateItem(item.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
        aiSummary: editSummary.trim(),
        tags: allTags,
        categoryId: primaryCatId,
        subCategoryId: item.subCategoryId,
      });
      if (allTags.length > 0) {
        try { await saveUserTags(allTags); } catch {}
      }
      setEditing(false);
      setHasChanges(false);
      Alert.alert('保存成功', '知识条目已更新');
    } catch (e: any) {
      console.error('[handleSave]', e);
      Alert.alert('保存失败', e?.message || '请重试');
    }
  };

  const handleDelete = () => {
    Alert.alert('确认删除', '确定要彻底删除该知识及所有相关训练记录吗？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => { deleteItem(item.id); router.back(); } },
    ]);
  };

  const handleStartTrain = async () => {
    const existing = records.find((r) => r.knowledgeItemId === item.id);
    if (!existing) {
      try { await createRecord(item.id); } catch {}
    }
    router.push(`/expression/${item.id}`);
  };

  const addTag = () => {
    const tag = editNewTag.trim();
    if (!tag) { setIsAddingTag(false); return; }
    if (editTags.includes(tag)) { Alert.alert('提示', '该子标签已存在'); return; }
    setEditTags([...editTags, tag]);
    setEditNewTag('');
    setIsAddingTag(false);
    setHasChanges(true);
  };

  const handleStartAddTag = () => { setIsAddingTag(true); setEditNewTag(''); };
  const removeTag = (t: string) => { setEditTags(editTags.filter((tag) => tag !== t)); setHasChanges(true); };

  const confidence = item.aiClassificationScore ?? 0;

  return (
    <SafeAreaView style={S.root} edges={['top']}>
      <PageHeader
        title="知识详情"
        leftAction={
          <TouchableOpacity onPress={handleBack}>
            <View style={S.headerSideRow}>
              <ChevronLeftIcon size={16} color={colors.text.secondary} />
              <Text style={S.backText}> 返回</Text>
            </View>
          </TouchableOpacity>
        }
        rightAction={
          <TouchableOpacity onPress={handleDelete} activeOpacity={0.7}>
            <View style={S.headerSideRow}>
              <TrashIcon size={13} color={colors.danger} />
              <Text style={S.deleteBtn}> 删除</Text>
            </View>
          </TouchableOpacity>
        }
      />

      <ScrollView style={S.scroll} contentContainerStyle={S.inner} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* 1. Title */}
        <View style={S.section}>
          <View style={S.secLabelRow}>
            <PencilIcon size={12} color={colors.text.primary} />
            <Text style={S.editLabel}> 知识条目标题</Text>
          </View>
          {editing ? (
            <TextInput style={S.editInput} value={editTitle} onChangeText={(t) => { setEditTitle(t); setHasChanges(true); }} autoFocus />
          ) : (
            <Text style={S.viewTitle}>{item.title}</Text>
          )}
        </View>
        <View style={S.divider} />

        {/* 2. AI Summary */}
        <View style={S.section}>
          <View style={S.secHeadRow}>
            <View style={S.secLabelRow}>
              <PencilIcon size={12} color={colors.text.primary} />
              <Text style={S.editLabel}> AI 总结内容</Text>
            </View>
            {editing && (
              <TouchableOpacity activeOpacity={0.7}>
                <View style={S.regenerateRow}>
                  <RefreshIcon size={12} color={colors.accent} />
                  <Text style={S.regenerateBtn}> AI重新生成</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
          {editing ? (
            <TextInput style={S.editInputMulti} value={editSummary}
              onChangeText={(t) => { setEditSummary(t); setHasChanges(true); }}
              multiline textAlignVertical="top" />
          ) : (
            <>
              <Text style={S.body} numberOfLines={showFullInput ? undefined : 8}>
                {item.aiSummary || '暂无总结'}
              </Text>
              {(item.aiSummary?.length || 0) > 150 && (
                <TouchableOpacity onPress={() => setShowFullInput(p => !p)} activeOpacity={0.7}>
                  <View style={S.expandRow}>
                    {showFullInput ? (
                      <><View style={{transform:[{rotate:'180deg'}]}}><ChevronDownIcon size={12} color={colors.accent} /></View><Text style={S.expandMore}> 收起</Text></>
                    ) : (
                      <><ChevronDownIcon size={12} color={colors.accent} /><Text style={S.expandMore}> 展开更多</Text></>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
        <View style={S.divider} />

        {/* 3. Original Input */}
        <View style={S.section}>
          <View style={S.secLabelRow}>
            <PencilIcon size={12} color={colors.text.primary} />
            <Text style={S.editLabel}> 用户原始输入</Text>
          </View>
          {editing ? (
            <>
              {item.sourceURL ? (
                <TextInput style={S.editInput} value={item.sourceURL} editable={false} />
              ) : null}
              <TextInput style={[S.editInputMulti, !showFullInput && {maxHeight:120}]} value={editContent}
                onChangeText={(t) => { setEditContent(t); setHasChanges(true); }}
                onFocus={() => setShowFullInput(true)}
                multiline textAlignVertical="top"
                placeholder="输入内容…" />
              {(editContent.length > 200) && (
                <TouchableOpacity onPress={() => setShowFullInput(p => !p)} activeOpacity={0.7}>
                  <View style={S.expandRow}>
                    {showFullInput ? (
                      <><View style={{transform:[{rotate:'180deg'}]}}><ChevronDownIcon size={12} color={colors.accent} /></View><Text style={S.expandMore}> 收起</Text></>
                    ) : (
                      <><ChevronDownIcon size={12} color={colors.accent} /><Text style={S.expandMore}> 展开编辑</Text></>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              {item.sourceURL ? (
                <Text style={S.srcURL} selectable>{item.sourceURL}</Text>
              ) : null}
              <Text style={S.body} numberOfLines={showFullInput ? undefined : 8}>
                {item.content || '暂无内容'}
              </Text>
              {(item.content?.length || 0) > 150 && (
                <TouchableOpacity onPress={() => setShowFullInput(p => !p)} activeOpacity={0.7}>
                  <View style={S.expandRow}>
                    {showFullInput ? (
                      <><View style={{transform:[{rotate:'180deg'}]}}><ChevronDownIcon size={12} color={colors.accent} /></View><Text style={S.expandMore}> 收起</Text></>
                    ) : (
                      <><ChevronDownIcon size={12} color={colors.accent} /><Text style={S.expandMore}> 展开更多</Text></>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
        <View style={S.divider} />

        {/* 4. Category & Created date — in a single info card */}
        <View style={S.metaCard}>
          <View style={S.metaCardRow}>
            <Text style={S.metaLabel}>知识分类</Text>
            {editing ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flex:1}}>
                <View style={[S.tagRow, {alignItems:'center'}]}>
                  {parentCats.map((cat) => {
                    const isSelected = editCatIds.includes(cat.id);
                    return (
                      <TouchableOpacity key={cat.id}
                        style={[S.catChip, isSelected && S.catChipActive]}
                        onPress={() => {
                          setEditCatIds(prev =>
                            isSelected ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                          );
                          setHasChanges(true);
                        }}
                        activeOpacity={0.7}>
                        <Text style={[S.catChipText, isSelected && S.catChipTextActive]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {isAddingParent ? (
                    <TextInput style={S.catInput}
                      value={newParentName} onChangeText={setNewParentName}
                      onSubmitEditing={async () => {
                        const n = newParentName.trim();
                        if (n) {
                          const nc = await addCategory({
                            name: n, color: '#6B7280', sortOrder: parentCats.length, isActive: true,
                          });
                          setEditCatIds(prev => [...prev, nc.id]); setHasChanges(true);
                        }
                        setNewParentName(''); setIsAddingParent(false);
                      }}
                      onBlur={() => { setNewParentName(''); setIsAddingParent(false); }}
                      placeholder="新父分类名" placeholderTextColor={colors.text.tertiary} autoFocus />
                  ) : (
                    <TouchableOpacity onPress={() => setIsAddingParent(true)} activeOpacity={0.7}>
                      <Text style={[S.catChipText, {color:colors.accent}]}>+ 新增</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            ) : (
              <Text style={S.metaValue}>{displayParentNames.join(' | ')}</Text>
            )}
          </View>
          {/* 子标签 — editing mode */}
          {editing && (
            <View style={S.metaCardRow}>
              <Text style={[S.metaLabel, {fontSize:13, color:colors.text.tertiary}]}>子标签</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flex:1}}>
                <View style={S.tagRow}>
                  {editTags.map((tag, i) => (
                    <TouchableOpacity key={i} style={S.tagWrap} onPress={() => removeTag(tag)} activeOpacity={0.7}>
                      <View style={S.tagPencil} pointerEvents="none">
                        <Svg width="100%" height="100%" viewBox="0 0 72 24" preserveAspectRatio="none">
                          <Rect x={2} y={2} width={68} height={20}
                            stroke="#3A3530" strokeWidth={1.2} strokeDasharray="12 4 8 3 16 4"
                            strokeLinecap="round" fill="none" opacity={0.38} rx={3} ry={3} />
                          <Rect x={3} y={1} width={66} height={22}
                            stroke="#4A4440" strokeWidth={0.9} strokeDasharray="6 5 10 3 8 4"
                            strokeLinecap="round" fill="none" opacity={0.30} rx={4} ry={2} />
                        </Svg>
                      </View>
                      <Text style={S.aiTagText}>{tag} ✕</Text>
                    </TouchableOpacity>
                  ))}
                  {isAddingTag ? (
                    <TextInput
                      style={S.addTagInput} placeholder="子标签名"
                      placeholderTextColor={colors.text.tertiary}
                      value={editNewTag} onChangeText={setEditNewTag}
                      onSubmitEditing={addTag} onBlur={addTag} autoFocus />
                  ) : (
                    <TouchableOpacity style={S.addTagBtn} onPress={handleStartAddTag} activeOpacity={0.7}>
                      <Text style={S.addTagText}>+ 新增</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          )}
          {/* 子标签 — non-editing mode */}
          {!editing && tags.length > 0 && (
            <View style={[S.metaCardRow, {marginBottom: 2}]}>
              <Text style={[S.metaLabel, {fontSize:13, color:colors.text.tertiary}]}>子标签</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flex:1}}>
                <View style={S.tagRow}>
                  {tags.map((tag, i) => (
                    <View key={i} style={S.tagWrap}>
                      <View style={S.tagPencil} pointerEvents="none">
                        <Svg width="100%" height="100%" viewBox="0 0 72 24" preserveAspectRatio="none">
                          <Rect x={2} y={2} width={68} height={20}
                            stroke="#3A3530" strokeWidth={1.2} strokeDasharray="12 4 8 3 16 4"
                            strokeLinecap="round" fill="none" opacity={0.38} rx={3} ry={3} />
                          <Rect x={3} y={1} width={66} height={22}
                            stroke="#4A4440" strokeWidth={0.9} strokeDasharray="6 5 10 3 8 4"
                            strokeLinecap="round" fill="none" opacity={0.30} rx={4} ry={2} />
                        </Svg>
                      </View>
                      <Text style={S.aiTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
          <View style={S.metaDivider} />
          <View style={S.metaCardRow}>
            <Text style={S.metaLabel}>入库时间</Text>
            <Text style={S.metaValue}>{item.createdAt ? format(new Date(item.createdAt), 'yyyy-MM-dd HH:mm') : '--'}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={S.bottomBar}>
        {editing ? (
          <TouchableOpacity style={S.doneBtn} onPress={handleSave} activeOpacity={0.7}>
            <View style={S.btnInner}>
              <CheckIcon size={15} color={colors.text.inverse} />
              <Text style={S.doneBtnText}> 完成</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={S.trainBtn} onPress={handleStartTrain} activeOpacity={0.7}>
              <View style={S.btnInner}>
                <MicIcon size={14} color={colors.text.inverse} />
                <Text style={S.trainBtnText}> 开始复述</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={S.editBtn} onPress={startEdit} activeOpacity={0.7}>
              <View style={S.btnInner}>
                <PencilIcon size={14} color={colors.text.primary} />
                <Text style={S.editBtnText}> 编辑知识</Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: { flex:1, backgroundColor:colors.background },
  headerSideRow: { flexDirection:'row', alignItems:'center' },
  backText: { fontSize:14, color:colors.text.secondary, fontWeight:'500' },
  deleteBtn: { fontSize:15, color:colors.danger, fontWeight:'600' },

  scroll: { flex:1 },
  inner: { ...pageContentPadding },

  section: { gap:10 },
  secLabelRow: { flexDirection:'row', alignItems:'center' },
  editLabel: { fontSize:16, fontWeight:'600', color:colors.text.primary },
  secHeadRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  regenerateRow: { flexDirection:'row', alignItems:'center' },
  regenerateBtn: { fontSize:14, color:colors.accent, fontWeight:'600' },
  divider: { height:tokens.borderWidth.hairline, backgroundColor:colors.divider, marginVertical:14 },

  body: { fontSize:16, color:colors.text.secondary, lineHeight:25, marginLeft:16 },
  viewTitle: { fontSize:18, fontWeight:'700', color:colors.text.primary, lineHeight:26, marginLeft:16 },
  srcURL: { fontSize:14, color:colors.primary, lineHeight:22, marginBottom:6, marginLeft:16 },

  editInput: { fontSize:16, color:colors.text.primary, backgroundColor:colors.surface, paddingVertical:10, paddingRight:12, paddingLeft:16, borderRadius:tokens.radius.sm, borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider },
  editInputMulti: { fontSize:16, color:colors.text.primary, backgroundColor:colors.surface, paddingVertical:10, paddingRight:12, paddingLeft:16, borderRadius:tokens.radius.sm, borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider, minHeight:100, textAlignVertical:'top' },

  expandRow: { flexDirection:'row', alignItems:'center', justifyContent:'center', marginTop:8, gap:4 },
  expandMore: { fontSize:14, color:colors.accent, fontWeight:'500' },
  hint: { fontSize:14, color:colors.text.tertiary },

  // Tags — Badge-style pencil border
  tagRow: { flexDirection:'row', gap:6, alignItems:'center', overflow:'visible' },
  tagWrap: {
    position: 'relative',
    backgroundColor: 'rgba(245,240,230,0.5)',
    borderRadius: 3,
    paddingVertical: 3, paddingHorizontal: 8,
    margin: 3,
    overflow: 'visible',
  },
  tagPencil: { position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, zIndex: 0 },
  aiTag: { backgroundColor:colors.primaryLight, borderRadius:tokens.radius.sm, paddingVertical:4, paddingHorizontal:10, borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider },
  aiTagText: { fontSize: 11, color: colors.text.secondary, fontWeight: '500' },
  addTagBtn: { borderRadius:tokens.radius.sm, borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider, paddingVertical:4, paddingHorizontal:10, borderStyle:'dashed' },
  addTagText: { fontSize:11, color:colors.accent, fontWeight:'600' },
  addTagInput: { fontSize:14, color:colors.text.primary, borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider, borderRadius:tokens.radius.sm, paddingVertical:4, paddingHorizontal:10, minWidth:90 },

  // Verification
  verifyCard: {
    backgroundColor:colors.surface, borderRadius:tokens.radius.sm,
    borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider,
    padding:16, gap:10,
  },
  verifySectionTitle: { fontSize:14, fontWeight:'600', color:colors.text.primary },
  verifySectionHead: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  verifyAddLink: { fontSize:14, color:colors.accent, fontWeight:'600' },
  verifyDivider: { borderTopWidth:tokens.borderWidth.hairline, borderTopColor:colors.divider, borderStyle:'dashed', marginVertical:6 },
  verifyRefItem: { flexDirection:'row', alignItems:'center', gap:6 },
  verifyRefIndex: { fontSize:14, color:colors.text.tertiary, fontWeight:'500', minWidth:20 },
  verifyLinkText: { flex:1, fontSize:14, color:colors.text.secondary, lineHeight:22 },
  verifyLinkInput: { flex:1, fontSize:14, color:colors.text.primary, borderBottomWidth:tokens.borderWidth.hairline, borderBottomColor:colors.divider, paddingVertical:4 },
  verifyEmptyHint: { fontSize:14, color:colors.text.tertiary, fontStyle:'italic' },
  verifyScoreRow: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10 },
  verifyScoreLabel: { fontSize:15, fontWeight:'600', color:colors.text.primary },
  verifyScoreInput: { fontSize:28, fontWeight:'700', color:colors.text.primary, fontFamily, textAlign:'center', minWidth:50, borderBottomWidth:tokens.borderWidth.hairline, borderBottomColor:colors.divider, paddingVertical:2 },
  verifyScorePct: { fontSize:16, fontWeight:'600', color:colors.text.primary },
  verifyScoreLarge: { fontSize:28, fontWeight:'700', color:colors.text.primary, fontFamily },
  verifyBadge: { borderRadius:tokens.radius.sm, paddingVertical:4, paddingHorizontal:12, borderWidth:tokens.borderWidth.hairline },
  verifyBadgeText: { fontSize:14, fontWeight:'600' },
  verifyExplain: { fontSize:15, color:colors.text.secondary, lineHeight:24 },

  // Meta card (category + date)
  metaCard: {
    backgroundColor:colors.surface, borderRadius:tokens.radius.sm,
    borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider,
    padding:16, gap:6,
  },
  metaCardRow: { flexDirection:'row', alignItems:'center', gap:12, marginBottom: 4 },
  metaLabel: { fontSize:15, fontWeight:'600', color:colors.text.primary, minWidth:64 },
  metaValue: { fontSize:15, color:colors.text.secondary },
  metaDivider: { height:tokens.borderWidth.hairline, backgroundColor:colors.divider, marginVertical:4 },

  // Category editing
  catChip: { paddingHorizontal:10, paddingVertical:4, borderRadius:tokens.radius.sm, borderWidth:1, borderColor:colors.divider, backgroundColor:colors.background },
  catChipActive: { backgroundColor:colors.primary, borderColor:colors.primary },
  catChipText: { fontSize:13, color:colors.text.secondary, fontWeight:'500' },
  catChipTextActive: { color:colors.text.inverse },
  catInput: { flex:1, fontSize:13, color:colors.text.primary, borderBottomWidth:1, borderBottomColor:colors.accent, paddingVertical:2 },
  editLink: { fontSize:12, color:colors.accent, fontWeight:'600' },

  // Bottom bar
  bottomBar: {
    flexDirection:'row', paddingHorizontal:16, paddingVertical:12, gap:10,
    backgroundColor:colors.background,
    shadowColor:'#000', shadowOffset:{width:0,height:-2}, shadowOpacity:0.06, shadowRadius:6,
    elevation:4,
  },
  btnInner: { flexDirection:'row', alignItems:'center' },
  trainBtn: { flex:1, backgroundColor:colors.primary, borderRadius:tokens.radius.md, paddingVertical:14, alignItems:'center' },
  trainBtnText: { fontSize:16, fontWeight:'700', color:colors.text.inverse },
  editBtn: { flex:1, borderRadius:tokens.radius.md, paddingVertical:14, alignItems:'center', borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider },
  editBtnText: { fontSize:16, fontWeight:'600', color:colors.text.primary },
  doneBtn: { flex:1, backgroundColor:colors.primary, borderRadius:tokens.radius.md, paddingVertical:14, alignItems:'center' },
  doneBtnText: { fontSize:16, fontWeight:'700', color:colors.text.inverse },

  empty: { flex:1, alignItems:'center', justifyContent:'center' },
  emptyText: { fontSize:15, color:colors.text.tertiary },
});
