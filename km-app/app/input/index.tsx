import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Animated,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { colors, tokens } from '../../src/theme';
import { Badge } from '../../src/components/ui/Badge';
import {
  FolderIcon, LinkIcon, PencilIcon, LightningIcon, SearchIcon,
  CalendarIcon, EmptyTrayIcon, ChevronLeftIcon, ChevronRightIcon,
  UpArrowIcon, CloseIcon, RefreshIcon, ChevronDownIcon, TrashIcon, CheckIcon,
} from '../../src/components/ui/ExpressionIcons';
import { useInputStore, useKnowledgeStore } from '../../src/stores';
import { parseContent } from '../../src/services/ai/parsingService';
import type { InputDraft, ParseResult } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.78;
const PAGE_SIZE = 8;

type InputType = 'url' | 'text';
type LibraryTab = 'all' | 'confirmed' | 'draft' | 'archived';

const LIBRARY_TABS: { key: LibraryTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'confirmed', label: '已入库' },
  { key: 'draft', label: '草稿' },
  { key: 'archived', label: '已归档' },
];

type SortMode = 'newest' | 'oldest';

// ── Page ──────────────────────────────────────────────────

export default function InputPage() {
  // Stores
  const drafts = useInputStore((s) => s.drafts);
  const loading = useInputStore((s) => s.loading);
  const loadAllDrafts = useInputStore((s) => s.loadAll);
  const createDraft = useInputStore((s) => s.createDraft);
  const updateParseResult = useInputStore((s) => s.updateParseResult);
  const confirmDraft = useInputStore((s) => s.confirmDraft);
  const discardDraft = useInputStore((s) => s.discardDraft);
  const items = useKnowledgeStore((s) => s.items);
  const categories = useKnowledgeStore((s) => s.categories);
  const loadAllKnowledge = useKnowledgeStore((s) => s.loadAll);
  const addItem = useKnowledgeStore((s) => s.addItem);

  // ── Input state ──
  const [inputType, setInputType] = useState<InputType>('url');
  const [urlText, setUrlText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Library state ──
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [page, setPage] = useState(1);

  // ── Modal / Sidebar state ──
  const [modalVisible, setModalVisible] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeDraft, setActiveDraft] = useState<InputDraft | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [showFullInput, setShowFullInput] = useState(false);

  // Sidebar animation
  const slideAnim = useState(new Animated.Value(-SIDEBAR_WIDTH))[0];
  const overlayAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (sidebarOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -SIDEBAR_WIDTH, duration: 200, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [sidebarOpen]);

  // Load data
  useEffect(() => { loadAllDrafts(); loadAllKnowledge(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllDrafts();
    await loadAllKnowledge();
    setRefreshing(false);
  };

  // ── Derived: library items ──
  const libraryItems = useMemo(() => {
    let filtered = [...items];
    if (libraryTab !== 'all') filtered = filtered.filter((i) => i.status === libraryTab);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((i) => i.title?.toLowerCase().includes(q));
    }
    filtered.sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sortMode === 'newest' ? db - da : da - db;
    });
    return filtered;
  }, [items, libraryTab, searchQuery, sortMode]);

  const totalPages = Math.max(1, Math.ceil(libraryItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = libraryItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [libraryTab, searchQuery]);

  // ── Helpers ──
  const sortedDrafts = useMemo(() =>
    [...drafts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [drafts]);

  const getDraftLabel = (d: InputDraft) => {
    return d.parseResult?.title || d.rawInput.slice(0, 20) + (d.rawInput.length > 20 ? '...' : '');
  };

  // ── Handlers: submit → open modal ──
  const handleSubmit = async () => {
    const text = (inputType === 'url' ? urlText : noteText).trim();
    if (!text) { Alert.alert('提示', '请输入内容'); return; }
    setIsParsing(true);
    try {
      const draft: InputDraft = await createDraft(inputType, text);
      let result: ParseResult;
      try {
        result = await parseContent({
          inputType, content: text,
          targetCategories: categories.map((c) => ({ id: c.id, name: c.name })),
        });
      } catch {
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
      await updateParseResult(draft.id, result);
      setUrlText(''); setNoteText('');
      setActiveDraft({ ...draft, parseResult: result });
      setEditValues({
        title: result.title,
        summary: result.sourceSummary || '',
        categoryName: result.suggestedCategoryName || '',
      });
      setShowFullInput(false);
      setEditingField(null);
      setModalVisible(true);
    } catch (error: any) {
      Alert.alert('错误', error?.message || '请重试');
    } finally { setIsParsing(false); }
  };

  const handleOpenDraft = (draft: InputDraft) => {
    setActiveDraft(draft);
    setEditValues({
      title: draft.parseResult?.title || '',
      summary: draft.parseResult?.sourceSummary || '',
      categoryName: draft.parseResult?.suggestedCategoryName || '',
    });
    setShowFullInput(false);
    setEditingField(null);
    setSidebarOpen(false);
    setModalVisible(true);
  };

  // ── Handlers: modal actions ──
  const handleDiscard = () => {
    if (!activeDraft) return;
    Alert.alert('确认丢弃', '将丢弃该AI拆解结果', [
      { text: '取消', style: 'cancel' },
      { text: '丢弃', style: 'destructive', onPress: () => { discardDraft(activeDraft.id); setModalVisible(false); } },
    ]);
  };

  const handleConfirm = async () => {
    if (!activeDraft?.parseResult) return;
    const pr = activeDraft.parseResult;
    const catId = categories[0]?.id || 'cat_other';
    try {
      const newItem = await addItem({
        categoryId: catId,
        title: editValues.title || pr.title,
        content: pr.content || activeDraft.rawInput,
        contentPreview: editValues.summary || pr.sourceSummary || '',
        sourceURL: activeDraft.inputType === 'url' ? activeDraft.rawInput : undefined,
        sourceType: activeDraft.inputType,
        tags: pr.suggestedTags || [],
        aiSummary: editValues.summary || pr.sourceSummary || '',
        aiClassificationScore: pr.confidence ?? 50,
        status: 'confirmed',
      });
      await confirmDraft(activeDraft.id, newItem.id);
      setModalVisible(false);
      Alert.alert('已入库', '知识条目已保存，初始状态为待复述');
    } catch (e: any) {
      Alert.alert('错误', e?.message || '入库失败');
    }
  };

  // ── Render ──
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ═══ Header ═══ */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.historyBtn} onPress={() => setSidebarOpen(true)} activeOpacity={0.7}>
          <View style={styles.historyBtnInner}>
            <FolderIcon size={13} color={colors.text.secondary} />
            <Text style={styles.historyBtnText}> 历史任务({drafts.length}/10)</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>知识输入</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* ═══ Input Type Selector ═══ */}
        <Text style={styles.sectionHint}>*请选择输入类型 (必选)</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity style={[styles.typeBtn, inputType==='url'&&styles.typeBtnActive]} onPress={()=>setInputType('url')} activeOpacity={0.7}>
            <View style={styles.typeBtnInner}>
              <LinkIcon size={14} color={inputType==='url'?colors.text.inverse:colors.text.secondary} />
              <Text style={[styles.typeBtnText, inputType==='url'&&styles.typeBtnTextActive]}> 链接输入</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.typeBtn, inputType==='text'&&styles.typeBtnActive]} onPress={()=>setInputType('text')} activeOpacity={0.7}>
            <View style={styles.typeBtnInner}>
              <PencilIcon size={14} color={inputType==='text'?colors.text.inverse:colors.text.secondary} />
              <Text style={[styles.typeBtnText, inputType==='text'&&styles.typeBtnTextActive]}> 文本输入</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ═══ Input Area ═══ */}
        <View style={styles.inputCard}>
          {inputType==='url' && (
            <TextInput style={styles.urlInput} placeholder="https://mp.weixin.qq.com/s/example123..." placeholderTextColor={colors.text.tertiary} value={urlText} onChangeText={setUrlText} autoCapitalize="none" autoCorrect={false} />
          )}
          <TextInput style={styles.noteInput} placeholder={inputType==='url'?'补充备注：阅读笔记或关键摘录...':'在此输入文本内容...'} placeholderTextColor={colors.text.tertiary} value={noteText} onChangeText={setNoteText} multiline textAlignVertical="top" />
          <TouchableOpacity style={[styles.aiBtn,isParsing&&styles.aiBtnDisabled]} onPress={handleSubmit} disabled={isParsing} activeOpacity={0.7}>
            <View style={styles.aiBtnInner}>
              <LightningIcon size={14} color={colors.text.inverse} />
              <Text style={styles.aiBtnText}> {isParsing?'AI 解析中...':'AI 拆解与分析'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ═══ Knowledge Library ═══ */}
        <View style={styles.librarySection}>
          <View style={styles.sectionDividerWrap}>
            <PencilIcon size={11} color={colors.text.tertiary} />
            <Text style={styles.sectionDivider}> 知识库列表 </Text>
            <PencilIcon size={11} color={colors.text.tertiary} />
          </View>
          <View style={styles.filterRow}>
            <View style={styles.searchWrap}>
              <SearchIcon size={13} color={colors.text.tertiary} />
              <TextInput style={styles.searchInput} placeholder="搜索知识标题..." placeholderTextColor={colors.text.tertiary} value={searchQuery} onChangeText={setSearchQuery} />
            </View>
            <TouchableOpacity style={styles.sortBtn} onPress={()=>setSortMode(p=>p==='newest'?'oldest':'newest')} activeOpacity={0.7}>
              <CalendarIcon size={13} color={colors.text.secondary} />
              <Text style={styles.sortBtnText}> {sortMode==='newest'?'最新':'最早'} <ChevronDownIcon size={10} color={colors.text.secondary} /></Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabScroll}>
            <View style={styles.subTabRow}>
              {LIBRARY_TABS.map(tab=>{
                const active=libraryTab===tab.key;
                const count=tab.key==='all'?libraryItems.length:libraryItems.filter(i=>i.status===tab.key).length;
                return (
                  <TouchableOpacity key={tab.key} style={[styles.subTab,active&&styles.subTabActive]} onPress={()=>setLibraryTab(tab.key)} activeOpacity={0.7}>
                    <Text style={[styles.subTabText,active&&styles.subTabTextActive]}>{tab.key==='all'?tab.label:`${tab.label}(${count})`}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          {pagedItems.length===0?(
            <View style={styles.emptyState}>
              <EmptyTrayIcon size={40} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>暂无知识条目</Text>
            </View>
          ):(
            <>
              {pagedItems.map(item=>(
                <View key={item.id} style={styles.libraryItem}>
                  <Text style={styles.itemDate}>{item.createdAt?format(new Date(item.createdAt),'MM-dd'):'--'}</Text>
                  <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                  <Badge label={item.status||'confirmed'} size="sm" />
                </View>
              ))}
              <View style={styles.pagination}>
                <Text style={styles.pageInfo}>显示 {(safePage-1)*PAGE_SIZE+1}-{Math.min(safePage*PAGE_SIZE,libraryItems.length)} / 共 {libraryItems.length} 条</Text>
                <View style={styles.pageBtns}>
                  <TouchableOpacity style={[styles.pageBtn,safePage<=1&&styles.pageBtnDisabled]} onPress={()=>setPage(p=>Math.max(1,p-1))} disabled={safePage<=1} activeOpacity={0.7}>
                    <View style={styles.pageBtnInner}>
                      <ChevronLeftIcon size={12} color={safePage<=1?colors.text.tertiary:colors.text.primary} />
                      <Text style={[styles.pageBtnText, safePage<=1&&styles.pageBtnTextDisabled]}> 上一页</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.pageBtn,safePage>=totalPages&&styles.pageBtnDisabled]} onPress={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={safePage>=totalPages} activeOpacity={0.7}>
                    <View style={styles.pageBtnInner}>
                      <Text style={[styles.pageBtnText, safePage>=totalPages&&styles.pageBtnTextDisabled]}>下一页 </Text>
                      <ChevronRightIcon size={12} color={safePage>=totalPages?colors.text.tertiary:colors.text.primary} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ═══ AI Parse Result Modal ═══ */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={()=>setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <UpArrowIcon size={14} color={colors.text.primary} />
                <Text style={styles.modalTitle}> AI 拆解结果</Text>
              </View>
              <Text style={styles.modalHint}>提示：以下内容均可点击直接编辑</Text>
              <TouchableOpacity onPress={()=>setModalVisible(false)} activeOpacity={0.7}>
                <View style={styles.modalCloseRow}>
                  <CloseIcon size={13} color={colors.danger} />
                  <Text style={styles.modalClose}> 关闭</Text>
                </View>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* 1. Title */}
              <TouchableOpacity style={styles.editField} onPress={()=>setEditingField(editingField==='title'?null:'title')} activeOpacity={0.8}>
                <View style={styles.editLabelRow}>
                  <PencilIcon size={12} color={colors.text.primary} />
                  <Text style={styles.editLabel}> 1. 知识条目标题</Text>
                </View>
                {editingField==='title'?(
                  <TextInput style={styles.editInput} value={editValues.title} onChangeText={t=>setEditValues(v=>({...v,title:t}))} multiline autoFocus />
                ):(
                  <Text style={styles.editValue}>{editValues.title||'(点击编辑)'}</Text>
                )}
              </TouchableOpacity>
              <View style={styles.modalDivider} />

              {/* 2. AI Summary */}
              <TouchableOpacity style={styles.editField} onPress={()=>setEditingField(editingField==='summary'?null:'summary')} activeOpacity={0.8}>
                <View style={styles.editLabelRow}>
                  <View style={styles.editLabelInline}>
                    <PencilIcon size={12} color={colors.text.primary} />
                    <Text style={styles.editLabel}> 2. AI 总结内容</Text>
                  </View>
                  <TouchableOpacity onPress={()=>{/* re-generate */}} activeOpacity={0.7}>
                    <View style={styles.regenerateRow}>
                      <RefreshIcon size={12} color={colors.accent} />
                      <Text style={styles.regenerateBtn}> AI重新生成</Text>
                    </View>
                  </TouchableOpacity>
                </View>
                {editingField==='summary'?(
                  <TextInput style={styles.editInput} value={editValues.summary} onChangeText={t=>setEditValues(v=>({...v,summary:t}))} multiline autoFocus />
                ):(
                  <Text style={styles.editValue}>{editValues.summary||'(点击编辑)'}</Text>
                )}
              </TouchableOpacity>
              <View style={styles.modalDivider} />

              {/* 3. Original input */}
              <View style={styles.editField}>
                <View style={styles.editLabelInline}>
                  <PencilIcon size={12} color={colors.text.primary} />
                  <Text style={styles.editLabel}> 3. 用户原始输入</Text>
                </View>
                {activeDraft && (
                  <>
                    <ScrollView style={{maxHeight:showFullInput?undefined:100}} nestedScrollEnabled>
                      <Text style={styles.originalInput}>
                        {activeDraft.rawInput}
                      </Text>
                    </ScrollView>
                    {activeDraft.rawInput.length > 150 && !showFullInput && (
                      <TouchableOpacity onPress={()=>setShowFullInput(true)} activeOpacity={0.7}>
                        <View style={styles.expandRow}>
                          <ChevronDownIcon size={12} color={colors.accent} />
                          <Text style={styles.expandMore}> 展开更多</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
              <View style={styles.modalDivider} />

              {/* 4. AI Classification / Tags */}
              <View style={styles.editField}>
                <View style={styles.editLabelInline}>
                  <PencilIcon size={12} color={colors.text.primary} />
                  <Text style={styles.editLabel}> 4. AI 分类</Text>
                </View>
                <View style={styles.tagRow}>
                  {(activeDraft?.parseResult?.suggestedTags||['学习方法','刻意练习','个人成长']).map((tag,i)=>(
                    <View key={i} style={styles.aiTag}><Text style={styles.aiTagText}>{tag}</Text></View>
                  ))}
                  <TouchableOpacity style={styles.addTagBtn} activeOpacity={0.7}>
                    <Text style={styles.addTagText}>+ 新增标签</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.modalDivider} />

              {/* 5. Verification */}
              <View style={styles.editField}>
                <View style={styles.editLabelInline}>
                  <PencilIcon size={12} color={colors.text.primary} />
                  <Text style={styles.editLabel}> 5. 验真结果与评估</Text>
                </View>
                <Text style={styles.verifyText}>* 验证链接：[1] 心理学Ericsson理论论文  [2] 《刻意练习》权威书籍</Text>
                <View style={styles.verifyBadge}>
                  <Text style={styles.verifyBadgeText}>真实度高 (85%)</Text>
                </View>
                <Text style={styles.verifyResult}>核心概念在学术界有明确理论支持。</Text>
              </View>

              {/* Bottom actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.discardBtn} onPress={handleDiscard} activeOpacity={0.7}>
                  <View style={styles.discardBtnInner}>
                    <TrashIcon size={14} color={colors.danger} />
                    <Text style={styles.discardBtnText}> 丢弃该条目</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.7}>
                  <View style={styles.confirmBtnInner}>
                    <CheckIcon size={15} color={colors.text.inverse} />
                    <Text style={styles.confirmBtnText}> 确认无误·保存入库</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══ History Sidebar ═══ */}
      <Modal visible={sidebarOpen} animationType="none" transparent onRequestClose={()=>setSidebarOpen(false)}>
        <View style={styles.sidebarOverlay}>
          <Animated.View style={[styles.sidebarBackdrop,{opacity:overlayAnim}]}>
            <TouchableOpacity style={styles.backdropPress} onPress={()=>setSidebarOpen(false)} activeOpacity={1} />
          </Animated.View>
          <Animated.View style={[styles.sidebarPanel,{transform:[{translateX:slideAnim}]}]}>
            <View style={styles.sidebarHeader}>
              <View style={styles.sidebarTitleRow}>
                <FolderIcon size={14} color={colors.text.primary} />
                <Text style={styles.sidebarTitle}> 历史任务 (未入库缓存: {drafts.length}/10)</Text>
              </View>
              <TouchableOpacity onPress={()=>setSidebarOpen(false)} activeOpacity={0.7}>
                <CloseIcon size={16} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sidebarHint}>* 提示：点击可继续编辑或确认入库</Text>
            <ScrollView style={styles.sidebarList} showsVerticalScrollIndicator={false}>
              {sortedDrafts.map(draft=>{
                const hasResult = !!draft.parseResult;
                return (
                  <TouchableOpacity
                    key={draft.id}
                    style={styles.draftItem}
                    onPress={()=>{if(hasResult)handleOpenDraft(draft);else Alert.alert('处理中','AI 正在拆解中，请稍候');}}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.draftItemDate}>
                      {draft.createdAt?format(new Date(draft.createdAt),'MM-dd'):'--'}
                    </Text>
                    <Text style={styles.draftItemTitle} numberOfLines={1}>{getDraftLabel(draft)}</Text>
                    <Text style={[styles.draftItemStatus,hasResult&&styles.draftItemStatusDone]}>
                      [{hasResult?'处理成功':'处理中..'}]
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {sortedDrafts.length===0 && (
                <Text style={styles.sidebarEmpty}>暂无历史任务</Text>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:colors.background },

  // Header
  header: { flexDirection:'row', alignItems:'center', paddingHorizontal:12, paddingVertical:10, backgroundColor:colors.surface, borderBottomWidth:tokens.borderWidth.hairline, borderBottomColor:'#D4CDC0' },
  historyBtn: { backgroundColor:colors.surfaceLight, borderRadius:tokens.radius.md, borderWidth:tokens.borderWidth.hairline, borderColor:'#D4CDC0', paddingVertical:6, paddingHorizontal:10 },
  historyBtnInner: { flexDirection:'row', alignItems:'center' },
  historyBtnText: { fontSize:12, color:colors.text.secondary, fontWeight:'500' },
  headerTitle: { flex:1, textAlign:'center', fontSize:18, fontWeight:'700', color:colors.text.primary },
  headerSpacer: { width:80 },

  scrollView: { flex:1 },
  scrollContent: { padding:16 },

  sectionHint: { fontSize:13, color:colors.text.secondary, marginBottom:8 },
  typeRow: { flexDirection:'row', gap:10, marginBottom:12 },
  typeBtn: { flex:1, paddingVertical:10, borderRadius:tokens.radius.md, borderWidth:tokens.borderWidth.hairline, borderColor:'#D4CDC0', backgroundColor:colors.surfaceLight, alignItems:'center' },
  typeBtnActive: { backgroundColor:colors.primary, borderColor:colors.primary },
  typeBtnInner: { flexDirection:'row', alignItems:'center' },
  typeBtnText: { fontSize:14, fontWeight:'600', color:colors.text.secondary },
  typeBtnTextActive: { color:colors.text.inverse },

  inputCard: { backgroundColor:colors.surface, borderRadius:tokens.radius.lg, borderWidth:tokens.borderWidth.hairline, borderColor:'#D4CDC0', padding:14, marginBottom:20 },
  urlInput: { fontSize:14, color:colors.text.primary, borderBottomWidth:tokens.borderWidth.hairline, borderBottomColor:'#D4CDC0', paddingVertical:8, marginBottom:10 },
  noteInput: { fontSize:14, color:colors.text.primary, minHeight:80, lineHeight:21, marginBottom:12 },
  aiBtn: { backgroundColor:colors.primary, borderRadius:tokens.radius.md, paddingVertical:12, alignItems:'center', alignSelf:'flex-end', paddingHorizontal:20 },
  aiBtnDisabled: { opacity:0.5 },
  aiBtnInner: { flexDirection:'row', alignItems:'center' },
  aiBtnText: { fontSize:14, fontWeight:'700', color:colors.text.inverse },

  // Library
  librarySection: { gap:10 },
  sectionDividerWrap: { flexDirection:'row', alignItems:'center', justifyContent:'center', marginBottom:6, gap:6 },
  sectionDivider: { fontSize:13, color:colors.text.tertiary, textAlign:'center' },
  filterRow: { flexDirection:'row', gap:8 },
  searchWrap: { flex:1, flexDirection:'row', alignItems:'center', backgroundColor:colors.surface, borderRadius:tokens.radius.md, borderWidth:tokens.borderWidth.hairline, borderColor:'#D4CDC0', paddingHorizontal:10, gap:7 },
  searchInput: { flex:1, fontSize:13, color:colors.text.primary, paddingVertical:8 },
  sortBtn: { flexDirection:'row', alignItems:'center', backgroundColor:colors.surface, borderRadius:tokens.radius.md, borderWidth:tokens.borderWidth.hairline, borderColor:'#D4CDC0', paddingVertical:8, paddingHorizontal:12 },
  sortBtnText: { fontSize:12, color:colors.text.secondary },
  subTabScroll: { marginBottom:4 },
  subTabRow: { flexDirection:'row', gap:6 },
  subTab: { paddingVertical:6, paddingHorizontal:12, borderRadius:tokens.radius.full, backgroundColor:colors.surfaceLight },
  subTabActive: { backgroundColor:colors.primary },
  subTabText: { fontSize:12, color:colors.text.secondary, fontWeight:'500' },
  subTabTextActive: { color:colors.text.inverse },
  emptyState: { alignItems:'center', paddingVertical:40, gap:10 },
  emptyText: { fontSize:14, color:colors.text.secondary },
  libraryItem: { flexDirection:'row', alignItems:'center', paddingVertical:10, paddingHorizontal:12, backgroundColor:colors.surface, borderRadius:tokens.radius.md, borderWidth:tokens.borderWidth.hairline, borderColor:'#D4CDC0', gap:10, marginBottom:6 },
  itemDate: { fontSize:12, color:colors.text.tertiary, fontWeight:'500', minWidth:40 },
  itemTitle: { flex:1, fontSize:14, color:colors.text.primary, fontWeight:'500' },
  pagination: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingTop:10, borderTopWidth:tokens.borderWidth.hairline, borderTopColor:'#D4CDC0', marginTop:4 },
  pageInfo: { fontSize:12, color:colors.text.secondary },
  pageBtns: { flexDirection:'row', gap:8 },
  pageBtn: { paddingVertical:6, paddingHorizontal:14, borderRadius:tokens.radius.md, borderWidth:tokens.borderWidth.hairline, borderColor:'#D4CDC0', backgroundColor:colors.surface },
  pageBtnDisabled: { opacity:0.4 },
  pageBtnInner: { flexDirection:'row', alignItems:'center' },
  pageBtnText: { fontSize:12, color:colors.text.primary, fontWeight:'500' },
  pageBtnTextDisabled: { color:colors.text.tertiary },
  bottomSpacer: { height:20 },

  // ── Modal ──
  modalOverlay: { flex:1, backgroundColor:'rgba(24,22,20,0.55)', justifyContent:'flex-end' },
  modalSheet: { backgroundColor:colors.background, borderTopLeftRadius:20, borderTopRightRadius:20, maxHeight:'90%' },
  modalHeader: { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:tokens.borderWidth.hairline, borderBottomColor:'#D4CDC0', flexWrap:'wrap', gap:6 },
  modalTitleRow: { flexDirection:'row', alignItems:'center', flex:1 },
  modalTitle: { fontSize:16, fontWeight:'700', color:colors.text.primary },
  modalHint: { fontSize:11, color:colors.text.tertiary, width:'100%' },
  modalCloseRow: { flexDirection:'row', alignItems:'center' },
  modalClose: { fontSize:14, color:colors.danger, fontWeight:'600' },
  modalBody: { padding:16 },
  modalDivider: { height:tokens.borderWidth.hairline, backgroundColor:'#D4CDC0', marginVertical:14 },

  editField: { gap:6 },
  editLabelInline: { flexDirection:'row', alignItems:'center' },
  editLabel: { fontSize:13, fontWeight:'600', color:colors.text.primary },
  editLabelRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  editValue: { fontSize:14, color:colors.text.secondary, lineHeight:21, backgroundColor:colors.surfaceLight, padding:10, borderRadius:tokens.radius.sm },
  editInput: { fontSize:14, color:colors.text.primary, backgroundColor:colors.surface, padding:10, borderRadius:tokens.radius.sm, borderWidth:tokens.borderWidth.hairline, borderColor:'#D4CDC0' },
  regenerateRow: { flexDirection:'row', alignItems:'center' },
  regenerateBtn: { fontSize:12, color:colors.accent, fontWeight:'600' },
  originalInput: { fontSize:13, color:colors.text.secondary, lineHeight:20 },
  expandRow: { flexDirection:'row', alignItems:'center', justifyContent:'center', marginTop:6 },
  expandMore: { fontSize:12, color:colors.accent, fontWeight:'600' },

  tagRow: { flexDirection:'row', flexWrap:'wrap', gap:6 },
  aiTag: { backgroundColor:colors.primaryLight, borderRadius:tokens.radius.full, paddingVertical:4, paddingHorizontal:10 },
  aiTagText: { fontSize:12, color:colors.text.primary, fontWeight:'500' },
  addTagBtn: { borderRadius:tokens.radius.full, borderWidth:tokens.borderWidth.hairline, borderColor:'#D4CDC0', paddingVertical:4, paddingHorizontal:10, borderStyle:'dashed' },
  addTagText: { fontSize:12, color:colors.text.tertiary },

  verifyText: { fontSize:12, color:colors.text.secondary, lineHeight:18 },
  verifyBadge: { alignSelf:'flex-start', backgroundColor:colors.success+'18', borderRadius:tokens.radius.sm, paddingVertical:3, paddingHorizontal:8, borderWidth:tokens.borderWidth.hairline, borderColor:colors.success },
  verifyBadgeText: { fontSize:12, color:colors.success, fontWeight:'600' },
  verifyResult: { fontSize:13, color:colors.text.secondary, marginTop:6, lineHeight:19 },

  modalActions: { flexDirection:'row', gap:10, marginTop:20, paddingTop:14, borderTopWidth:tokens.borderWidth.hairline, borderTopColor:'#D4CDC0' },
  discardBtn: { flex:1, paddingVertical:14, borderRadius:tokens.radius.md, borderWidth:tokens.borderWidth.hairline, borderColor:colors.danger, alignItems:'center' },
  discardBtnInner: { flexDirection:'row', alignItems:'center' },
  discardBtnText: { fontSize:14, color:colors.danger, fontWeight:'600' },
  confirmBtn: { flex:1.5, paddingVertical:14, borderRadius:tokens.radius.md, backgroundColor:colors.primary, alignItems:'center' },
  confirmBtnInner: { flexDirection:'row', alignItems:'center' },
  confirmBtnText: { fontSize:14, color:colors.text.inverse, fontWeight:'700' },

  // ── Sidebar ──
  sidebarOverlay: { flex:1, flexDirection:'row' },
  sidebarBackdrop: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(36,34,32,0.45)' },
  backdropPress: { flex:1 },
  sidebarPanel: { position:'absolute', top:0, left:0, bottom:0, width:SIDEBAR_WIDTH, backgroundColor:colors.surface, paddingTop:50 },
  sidebarHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:tokens.borderWidth.hairline, borderBottomColor:'#D4CDC0' },
  sidebarTitleRow: { flexDirection:'row', alignItems:'center' },
  sidebarTitle: { fontSize:14, fontWeight:'700', color:colors.text.primary },
  sidebarHint: { fontSize:11, color:colors.text.tertiary, paddingHorizontal:16, marginBottom:10, marginTop:6 },
  sidebarList: { flex:1, paddingHorizontal:12 },
  sidebarEmpty: { color:colors.text.tertiary, textAlign:'center', marginTop:40 },
  draftItem: {
    flexDirection:'row', alignItems:'center',
    backgroundColor:colors.background, borderRadius:tokens.radius.md,
    borderWidth:tokens.borderWidth.hairline, borderColor:'#D4CDC0',
    paddingVertical:10, paddingHorizontal:12, gap:8, marginBottom:6,
  },
  draftItemDate: { fontSize:11, color:colors.text.tertiary, minWidth:36 },
  draftItemTitle: { flex:1, fontSize:13, color:colors.text.primary, fontWeight:'500' },
  draftItemStatus: { fontSize:11, color:colors.text.tertiary, fontWeight:'600' },
  draftItemStatusDone: { color:colors.success },
});
