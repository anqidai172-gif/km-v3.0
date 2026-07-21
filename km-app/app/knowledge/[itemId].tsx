import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { colors, tokens, fontFamily } from '../../src/theme';
import {
  ChevronLeftIcon, TrashIcon, PencilIcon, RefreshIcon,
  ChevronDownIcon, CalendarIcon, CheckIcon, MicIcon,
} from '../../src/components/ui/ExpressionIcons';
import { useKnowledgeStore, useExpressionStore } from '../../src/stores';

export default function KnowledgeDetailPage() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const router = useRouter();
  const items = useKnowledgeStore((s) => s.items);
  const categories = useKnowledgeStore((s) => s.categories);
  const updateItem = useKnowledgeStore((s) => s.updateItem);
  const deleteItem = useKnowledgeStore((s) => s.deleteItem);
  const createRecord = useExpressionStore((s) => s.createRecord);
  const item = items.find((i) => i.id === itemId);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editNewTag, setEditNewTag] = useState('');
  const [showFullInput, setShowFullInput] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  if (!item) {
    return (
      <SafeAreaView style={S.root} edges={['top']}>
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <View style={S.headerSideRow}>
              <ChevronLeftIcon size={16} color={colors.text.secondary} />
              <Text style={S.backText}> 返回列表</Text>
            </View>
          </TouchableOpacity>
          <Text style={S.headerTitle}>知识详情</Text>
          <View style={{width:60}} />
        </View>
        <View style={S.empty}><Text style={S.emptyText}>条目未找到</Text></View>
      </SafeAreaView>
    );
  }

  const category = categories.find((c) => c.id === item.categoryId);
  const verification = item.aiVerificationResult;
  const tags = item.tags || [];

  const startEdit = () => {
    setEditTitle(item.title);
    setEditSummary(item.aiSummary || '');
    setEditTags([...tags]);
    setEditNewTag('');
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
      await updateItem(item.id, {
        title: editTitle,
        aiSummary: editSummary,
        tags: editTags,
      });
      setEditing(false);
      setHasChanges(false);
      Alert.alert('✅ 保存成功', '知识条目已更新');
    } catch { Alert.alert('保存失败', '请重试'); }
  };

  const handleDelete = () => {
    Alert.alert('确认删除', '确定要彻底删除该知识及所有相关训练记录吗？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => { deleteItem(item.id); router.back(); } },
    ]);
  };

  const handleStartTrain = async () => {
    try {
      await createRecord(item.id);
    } catch {}
    router.push(`/expression/${item.id}`);
  };

  const addTag = () => {
    if (editNewTag.trim() && !editTags.includes(editNewTag.trim())) {
      setEditTags([...editTags, editNewTag.trim()]);
      setEditNewTag('');
      setHasChanges(true);
    }
  };
  const removeTag = (t: string) => {
    setEditTags(editTags.filter((tag) => tag !== t));
    setHasChanges(true);
  };

  const confidence = item.aiClassificationScore ?? verification?.matchScore ?? 0;
  const confidenceLabel = confidence >= 80 ? '真实度高' : confidence >= 50 ? '中等可信' : '待验证';

  return (
    <SafeAreaView style={S.root} edges={['top']}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={handleBack}>
          <View style={S.headerSideRow}>
            <ChevronLeftIcon size={16} color={colors.text.secondary} />
            <Text style={S.backText}> 返回列表</Text>
          </View>
        </TouchableOpacity>
        <Text style={S.headerTitle}>知识详情</Text>
        <TouchableOpacity onPress={handleDelete} activeOpacity={0.7}>
          <View style={S.headerSideRow}>
            <TrashIcon size={13} color={colors.danger} />
            <Text style={S.deleteBtn}> 删除</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView style={S.scroll} contentContainerStyle={S.inner} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* 1. Title */}
        <View style={S.section}>
          <View style={S.secLabelRow}>
            <PencilIcon size={12} color={colors.text.primary} />
            <Text style={S.secLabel}> 1. 知识条目标题</Text>
          </View>
          {editing ? (
            <TextInput style={S.editInput} value={editTitle} onChangeText={(t) => { setEditTitle(t); setHasChanges(true); }} autoFocus />
          ) : (
            <Text style={S.itemTitle}>{item.title}</Text>
          )}
        </View>
        <View style={S.divider} />

        {/* 2. AI Summary */}
        <View style={S.section}>
          <View style={S.secHeadRow}>
            <View style={S.secLabelRow}>
              <PencilIcon size={12} color={colors.text.primary} />
              <Text style={S.secLabel}> 2. AI 总结内容</Text>
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
            <Text style={S.body}>{item.aiSummary || '暂无总结'}</Text>
          )}
        </View>
        <View style={S.divider} />

        {/* 3. Original Input */}
        <View style={S.section}>
          <View style={S.secLabelRow}>
            <PencilIcon size={12} color={colors.text.primary} />
            <Text style={S.secLabel}> 3. 用户原始输入</Text>
          </View>
          <ScrollView style={{maxHeight: showFullInput ? undefined : 100}} nestedScrollEnabled>
            {item.sourceURL && (
              <Text style={S.srcURL} selectable>{item.sourceURL}</Text>
            )}
            <Text style={S.body}>{item.content || '暂无内容'}</Text>
          </ScrollView>
          {(item.content?.length || 0) > 150 && !showFullInput && (
            <TouchableOpacity onPress={() => setShowFullInput(true)} activeOpacity={0.7}>
              <View style={S.expandRow}>
                <ChevronDownIcon size={12} color={colors.accent} />
                <Text style={S.expandMore}> 展开更多</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
        <View style={S.divider} />

        {/* 4. Category / Tags */}
        <View style={S.section}>
          <View style={S.secLabelRow}>
            <PencilIcon size={12} color={colors.text.primary} />
            <Text style={S.secLabel}> 4. 知识分类</Text>
          </View>
          <View style={S.tagRow}>
            {editing ? (
              <>
                {editTags.map((tag, i) => (
                  <TouchableOpacity key={i} style={S.tag} onPress={() => removeTag(tag)} activeOpacity={0.7}>
                    <Text style={S.tagText}>{tag} ✕</Text>
                  </TouchableOpacity>
                ))}
                <View style={S.addTagRow}>
                  <TextInput style={S.addTagInput} placeholder="+ 新增标签" placeholderTextColor={colors.text.tertiary}
                    value={editNewTag} onChangeText={setEditNewTag} onSubmitEditing={addTag} />
                  <TouchableOpacity onPress={addTag} activeOpacity={0.7}>
                    <Text style={S.addTagBtn}>添加</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              tags.map((tag, i) => (
                <View key={i} style={S.tag}><Text style={S.tagText}>{tag}</Text></View>
              ))
            )}
            {!editing && tags.length === 0 && (
              <Text style={S.hint}>暂无分类标签</Text>
            )}
          </View>
        </View>
        <View style={S.divider} />

        {/* 5. Verification */}
        <View style={S.section}>
          <View style={S.secLabelRow}>
            <PencilIcon size={12} color={colors.text.primary} />
            <Text style={S.secLabel}> 5. 验真结果与评估</Text>
          </View>
          {verification?.referenceLinks && verification.referenceLinks.length > 0 && (
            <Text style={S.verifyText}>
              * 验证链接：{verification.referenceLinks.map((l, i) => `[${i+1}] ${l}`).join('  ')}
            </Text>
          )}
          <View style={[S.verifyBadge, confidence >= 80 ? {borderColor:colors.success,backgroundColor:colors.success+'15'} : confidence >= 50 ? {borderColor:colors.warning,backgroundColor:colors.warning+'15'} : {borderColor:colors.danger,backgroundColor:colors.danger+'15'}]}>
            <Text style={[S.verifyBadgeText, confidence >= 80 ? {color:colors.success} : confidence >= 50 ? {color:colors.warning} : {color:colors.danger}]}>
              {confidenceLabel} ({confidence}%)
            </Text>
          </View>
          <Text style={[S.verifyResult, confidence >= 80 ? {color:colors.success} : confidence >= 50 ? {color:colors.warning} : {color:colors.danger}]}>
            {verification?.verificationLogic || (confidence >= 80 ? '核心概念在学术界有明确理论支持。' : '')}
          </Text>
        </View>

        {/* Created date */}
        <View style={S.metaRow}>
          <CalendarIcon size={12} color={colors.text.tertiary} />
          <Text style={S.metaText}> 入库时间：{item.createdAt ? format(new Date(item.createdAt), 'yyyy-MM-dd') : '--'}</Text>
        </View>

        <View style={{height:24}} />
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
  header: {
    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    paddingHorizontal:12, paddingVertical:10,
    backgroundColor:colors.surface,
    borderBottomWidth:tokens.borderWidth.hairline, borderBottomColor:'#D4CDC0',
  },
  headerSideRow: { flexDirection:'row', alignItems:'center' },
  backText: { fontSize:14, color:colors.text.secondary },
  headerTitle: { fontSize:17, fontWeight:'700', color:colors.text.primary },
  deleteBtn: { fontSize:13, color:colors.danger, fontWeight:'600' },

  scroll: { flex:1 },
  inner: { padding:18 },

  section: { gap:8 },
  secLabelRow: { flexDirection:'row', alignItems:'center' },
  secLabel: { fontSize:13, fontWeight:'600', color:colors.text.primary },
  secHeadRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  regenerateRow: { flexDirection:'row', alignItems:'center' },
  regenerateBtn: { fontSize:12, color:colors.accent, fontWeight:'600' },
  divider: { height:tokens.borderWidth.hairline, backgroundColor:'#D4CDC0', marginVertical:16 },

  itemTitle: { fontSize:18, fontWeight:'700', color:colors.text.primary, fontFamily, lineHeight:26 },
  body: { fontSize:14, color:colors.text.secondary, lineHeight:23 },
  srcURL: { fontSize:13, color:colors.primary, lineHeight:22, marginBottom:8 },

  editInput: { fontSize:15, color:colors.text.primary, backgroundColor:colors.surface, padding:12, borderRadius:tokens.radius.sm, borderWidth:tokens.borderWidth.hairline, borderColor:'#D4CDC0' },
  editInputMulti: { fontSize:14, color:colors.text.primary, backgroundColor:colors.surface, padding:12, borderRadius:tokens.radius.sm, borderWidth:tokens.borderWidth.hairline, borderColor:'#D4CDC0', minHeight:100, textAlignVertical:'top', lineHeight:21 },

  expandRow: { flexDirection:'row', alignItems:'center', justifyContent:'center', marginTop:8 },
  expandMore: { fontSize:12, color:colors.accent, fontWeight:'600' },
  hint: { fontSize:12, color:colors.text.tertiary },

  tagRow: { flexDirection:'row', flexWrap:'wrap', gap:6 },
  tag: { backgroundColor:colors.primaryLight, borderRadius:3, paddingVertical:4, paddingHorizontal:10, borderWidth:tokens.borderWidth.hairline, borderColor:'#D4CDC0' },
  tagText: { fontSize:12, color:colors.text.primary, fontWeight:'500' },
  addTagRow: { flexDirection:'row', alignItems:'center', gap:4 },
  addTagInput: { fontSize:12, color:colors.text.primary, borderWidth:tokens.borderWidth.hairline, borderColor:'#D4CDC0', borderRadius:tokens.radius.full, paddingVertical:4, paddingHorizontal:10, minWidth:80 },
  addTagBtn: { fontSize:12, color:colors.accent, fontWeight:'600' },

  verifyText: { fontSize:12, color:colors.text.secondary, lineHeight:18 },
  verifyBadge: { alignSelf:'flex-start', borderRadius:tokens.radius.sm, paddingVertical:3, paddingHorizontal:8, borderWidth:tokens.borderWidth.hairline },
  verifyBadgeText: { fontSize:12, fontWeight:'600' },
  verifyResult: { fontSize:13, marginTop:6, lineHeight:19 },

  metaRow: { marginTop:20, flexDirection:'row', alignItems:'center', justifyContent:'center' },
  metaText: { fontSize:12, color:colors.text.tertiary },

  bottomBar: {
    flexDirection:'row', paddingHorizontal:16, paddingVertical:12, gap:10,
    backgroundColor:colors.surface, borderTopWidth:tokens.borderWidth.hairline, borderTopColor:'#D4CDC0',
  },
  btnInner: { flexDirection:'row', alignItems:'center' },
  trainBtn: { flex:1, backgroundColor:colors.primary, borderRadius:tokens.radius.md, paddingVertical:14, alignItems:'center' },
  trainBtnText: { fontSize:15, fontWeight:'700', color:colors.text.inverse },
  editBtn: { flex:1, borderRadius:tokens.radius.md, paddingVertical:14, alignItems:'center', borderWidth:tokens.borderWidth.hairline, borderColor:'#D4CDC0' },
  editBtnText: { fontSize:15, fontWeight:'600', color:colors.text.primary },

  doneBtn: { flex:1, backgroundColor:colors.primary, borderRadius:tokens.radius.md, paddingVertical:14, alignItems:'center' },
  doneBtnText: { fontSize:15, fontWeight:'700', color:colors.text.inverse },

  empty: { flex:1, alignItems:'center', justifyContent:'center' },
  emptyText: { fontSize:14, color:colors.text.tertiary },
});
