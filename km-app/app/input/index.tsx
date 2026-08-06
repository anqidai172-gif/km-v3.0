import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { colors, tokens, fontFamily } from '../../src/theme';
import { pageContentPadding } from '../../src/theme/layout';
import { Badge } from '../../src/components/ui/Badge';
import { PageHeader } from '../../src/components/ui/PageHeader';
import Svg, { Rect } from 'react-native-svg';
import {
  MenuIcon, HourglassIcon, LinkIcon, PencilIcon, LightningIcon, SearchIcon,
  CalendarIcon, EmptyTrayIcon, ChevronLeftIcon, ChevronRightIcon,
  UpArrowIcon, CloseIcon, RefreshIcon, ChevronDownIcon, TrashIcon, CheckIcon,
} from '../../src/components/ui/ExpressionIcons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useInputStore, useKnowledgeStore, useExpressionStore, useSettingsStore } from '../../src/stores';
import { parseContent } from '../../src/services/ai/parsingService';
import { isPlatformVideoURL, detectProvider, extractURLFromShareText, getPlatformName } from '../../src/services/ai/videoParsingService';
import type { InputDraft, ParseResult } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.78;
const PAGE_SIZE = 8;

type InputType = 'url' | 'text';
type LibraryTab = 'all' | 'pending_retell' | 'retold';

const LIBRARY_TABS: { key: LibraryTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending_retell', label: '待复述' },
  { key: 'retold', label: '已复述' },
];

type SortMode = 'newest' | 'oldest';

// ── Page ──────────────────────────────────────────────────

export default function InputPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Stores
  const drafts = useInputStore((s) => s.drafts);
  const loading = useInputStore((s) => s.loading);
  const loadAllDrafts = useInputStore((s) => s.loadAll);
  const confirmDraft = useInputStore((s) => s.confirmDraft);
  const discardDraft = useInputStore((s) => s.discardDraft);
  const deleteDraft = useInputStore((s) => s.deleteDraft);
  const pendingModal = useInputStore((s) => s.pendingModal);
  const setPendingModal = useInputStore((s) => s.setPendingModal);
  const parsingInProgress = useInputStore((s) => s.parsingInProgress);
  const items = useKnowledgeStore((s) => s.items);
  const categories = useKnowledgeStore((s) => s.categories);
  const loadAllKnowledge = useKnowledgeStore((s) => s.loadAll);
  const addItem = useKnowledgeStore((s) => s.addItem);
  const addCategory = useKnowledgeStore((s) => s.addCategory);
  const saveUserTags = useSettingsStore((s) => s.saveUserTags);
  const videoServerURL = useSettingsStore((s) => s.settings.videoServerURL);
  const aiApiKey = useSettingsStore((s) => s.settings.aiApiKey);
  const aiBaseURL = useSettingsStore((s) => s.settings.aiBaseURL);
  const aiModel = useSettingsStore((s) => s.settings.aiModel);
  // ASR config
  const asrProvider = useSettingsStore((s) => s.settings.asrProvider);
  const asrWhisperModel = useSettingsStore((s) => s.settings.asrWhisperModel);
  const asrTencentSecretId = useSettingsStore((s) => s.settings.asrTencentSecretId);
  const asrTencentSecretKey = useSettingsStore((s) => s.settings.asrTencentSecretKey);
  const asrAliyunAppKey = useSettingsStore((s) => s.settings.asrAliyunAppKey);
  const asrAliyunAccessToken = useSettingsStore((s) => s.settings.asrAliyunAccessToken);
  const asrXunfeiAppId = useSettingsStore((s) => s.settings.asrXunfeiAppId);
  const asrXunfeiApiKey = useSettingsStore((s) => s.settings.asrXunfeiApiKey);
  const expressionRecords = useExpressionStore((s) => s.records);

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
  const scrollRef = useRef<ScrollView>(null);
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    }, 100);
  };

  // ── Modal / Sidebar state ──
  const [modalVisible, setModalVisible] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeDraft, setActiveDraft] = useState<InputDraft | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editNewTag, setEditNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [showFullInput, setShowFullInput] = useState(false);
  const [showTranscriptOnly, setShowTranscriptOnly] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSucceeded, setParseSucceeded] = useState(false); // 当前解析是否成功

  // Track mount state so async handlers don't call setState on unmounted component
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  // ── Parent category chip state (modal) ──
  const [editParentCatIds, setEditParentCatIds] = useState<string[]>([]);
  const [isAddingParentCat, setIsAddingParentCat] = useState(false);
  const [newParentCatName, setNewParentCatName] = useState('');
  const parentCats = useMemo(() => categories.filter((c) => !c.parentId), [categories]);

  // ── Sidebar multi-select ──
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  // Helper: show modal from pendingModal data
  const showPendingModal = useCallback((pm: typeof pendingModal) => {
    if (!pm || modalVisible) return;
    setActiveDraft(pm.draft);
    setParseSucceeded(pm.parseSucceeded);
    setParseError(pm.parseError);
    setShowTranscriptOnly(pm.showTranscriptOnly);
    setEditValues(pm.editValues);
    setEditTags(pm.editTags);
    const suggName = pm.editValues?.categoryName || '';
    const matched = parentCats.find((c) => c.name === suggName);
    setEditParentCatIds(matched ? [matched.id] : []);
    // Clear inputs now that parsing completed and modal is showing
    setUrlText(''); setNoteText(''); setIsParsing(false);
    setModalVisible(true);
  }, [modalVisible, parentCats]);

  // 在页面内时：pendingModal 变化 → 弹出半弹层
  useEffect(() => {
    if (pendingModal) showPendingModal(pendingModal);
  }, [pendingModal, showPendingModal]);

  // 返回页面时：检查 store 中的解析状态
  useFocusEffect(
    useCallback(() => {
      const state = useInputStore.getState();
      // If parsing is still in progress, restore input text
      if (state.parsingInProgress && state.parsingInput) {
        if (state.parsingInput.inputType === 'url') {
          setUrlText(state.parsingInput.text);
        } else {
          setNoteText(state.parsingInput.text);
        }
        setInputType(state.parsingInput.inputType);
      }
      // If result is ready, show modal
      if (state.pendingModal) {
        showPendingModal(state.pendingModal);
      }
    }, [showPendingModal])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllDrafts();
    await loadAllKnowledge();
    setRefreshing(false);
  };

  // ── Derived: library items (only confirmed, filter by training state) ──
  const itemTrainingState = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of expressionRecords) {
      if (!map[r.knowledgeItemId]) {
        map[r.knowledgeItemId] = r.state;
      }
    }
    return map;
  }, [expressionRecords]);

  const libraryItems = useMemo(() => {
    let filtered = items.filter((i) => i.status === 'confirmed');
    if (libraryTab === 'pending_retell') {
      filtered = filtered.filter((i) => itemTrainingState[i.id] === 'pending_retell' || !itemTrainingState[i.id]);
    } else if (libraryTab === 'retold') {
      filtered = filtered.filter((i) => itemTrainingState[i.id] === 'retold' || itemTrainingState[i.id] === 'pending_restate' || itemTrainingState[i.id] === 'restated');
    }
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
  }, [items, libraryTab, searchQuery, sortMode, itemTrainingState]);

  const totalPages = Math.max(1, Math.ceil(libraryItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = libraryItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [libraryTab, searchQuery]);

  // ── Helpers ──
  const pendingDrafts = useMemo(() =>
    drafts
      .filter((d) => d.status === 'pending_review')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [drafts]);

  const getDraftLabel = (d: InputDraft) => {
    return d.parseResult?.title || d.rawInput.slice(0, 20) + (d.rawInput.length > 20 ? '...' : '');
  };

  // ── Handlers: submit → store action（跨页面不中断） ──
  const submitAndParse = useInputStore((s) => s.submitAndParse);

  const handleSubmit = async () => {
    const text = (inputType === 'url' ? urlText : noteText).trim();
    if (!text) { Alert.alert('提示', '请输入内容'); return; }

    // 待入库上限检查
    if (pendingDrafts.length >= 10) {
      Alert.alert(
        '待入库已满（10/10）',
        '请先处理侧边栏中的待入库知识，确认入库或丢弃后再添加新内容。',
        [
          { text: '知道了', style: 'cancel' },
          { text: '打开待入库', onPress: () => setSidebarOpen(true) },
        ],
      );
      return;
    }

    // Fire-and-forget: store action runs independently of component lifecycle
    // Inputs are NOT cleared here — they stay visible until the modal appears
    submitAndParse({
      inputType,
      text,
      parseContent,
      isPlatformVideoURL,
      getPlatformName,
      extractURLFromShareText,
      detectProvider,
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
      settings: {
        videoServerURL: videoServerURL || undefined,
        aiApiKey: aiApiKey || undefined,
        aiBaseURL: aiBaseURL || undefined,
        aiModel: aiModel || undefined,
        asrProvider: asrProvider || undefined,
        asrWhisperModel: asrWhisperModel || undefined,
        asrTencentSecretId: asrTencentSecretId || undefined,
        asrTencentSecretKey: asrTencentSecretKey || undefined,
        asrAliyunAppKey: asrAliyunAppKey || undefined,
        asrAliyunAccessToken: asrAliyunAccessToken || undefined,
        asrXunfeiAppId: asrXunfeiAppId || undefined,
        asrXunfeiApiKey: asrXunfeiApiKey || undefined,
      },
    }).catch(() => {
      if (mountedRef.current) Alert.alert('错误', '解析失败，请重试');
    });
  };

  const handleOpenDraft = (draft: InputDraft) => {
    setActiveDraft(draft);
    const vals = {
      title: draft.parseResult?.title || '',
      summary: draft.parseResult?.sourceSummary || '',
      categoryName: draft.parseResult?.suggestedCategoryName || '',
      videoText: draft.parseResult?.videoText || '',
      pageText: draft.parseResult?.pageText || '',
      imageText: draft.parseResult?.imageText || '',
    };
    const tags = draft.parseResult?.suggestedTags || [];
    setEditValues(vals);
    setEditTags(tags);
    setEditNewTag('');
    // Initialize parent category selection
    const suggParentName = draft.parseResult?.suggestedCategoryName || '';
    const matchedParent = parentCats.find((c) => c.name === suggParentName);
    setEditParentCatIds(matchedParent ? [matchedParent.id] : []);
    setShowFullInput(false);
    setEditingField(null);
    setParseSucceeded(true);
    setParseError(null);
    setShowTranscriptOnly(false);
    setSidebarOpen(false);
    // 存全局 store——切走页面后回来仍能弹出
    setPendingModal({
      draft,
      parseSucceeded: true,
      parseError: null,
      showTranscriptOnly: false,
      editValues: vals,
      editTags: tags,
    });
    setModalVisible(true);
  };

  // ── Handlers: modal actions ──
  const handleAddTag = () => {
    const tag = editNewTag.trim();
    if (!tag) {
      setIsAddingTag(false);
      return;
    }
    if (editTags.includes(tag)) {
      Alert.alert('提示', '该标签已存在');
      return;
    }
    setEditTags([...editTags, tag]);
    setEditNewTag('');
    setIsAddingTag(false);
  };

  const handleStartAddTag = () => {
    setIsAddingTag(true);
    setEditNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    setEditTags(editTags.filter((t) => t !== tag));
  };

  const handleDiscard = () => {
    if (!activeDraft) return;
    Alert.alert('确认丢弃', '将丢弃该AI拆解结果', [
      { text: '取消', style: 'cancel' },
      { text: '丢弃', style: 'destructive', onPress: () => { discardDraft(activeDraft.id); setModalVisible(false); setPendingModal(null); } },
    ]);
  };

  const handleConfirm = async () => {
    if (!activeDraft?.parseResult) return;
    const pr = activeDraft.parseResult;
    // ── Use selected parent categories from chips ──
    const parentCatsList = categories.filter((c) => !c.parentId);
    let parentId = editParentCatIds[0] || '';
    // If none selected, try to match AI suggestion or fallback to first
    if (!parentId) {
      const aiName = (editValues.categoryName || pr.suggestedCategoryName || '').trim();
      if (aiName) {
        const matched = parentCatsList.find((c) => c.name === aiName);
        if (matched) {
          parentId = matched.id;
        } else {
          try {
            const nc = await addCategory({ name: aiName, color: '#6B7280', sortOrder: parentCatsList.length, isActive: true });
            parentId = nc.id;
          } catch {
            parentId = parentCatsList[0]?.id || 'cat_other';
          }
        }
      } else {
        parentId = parentCatsList[0]?.id || 'cat_other';
      }
    }
    // Extra parent categories stored as hidden tags
    const extraCatNames = editParentCatIds.slice(1)
      .map(id => parentCatsList.find(c => c.id === id)?.name)
      .filter(Boolean) as string[];
    const hiddenTags = extraCatNames.map(n => `__pcat__${n}`);

    // 2. Find or create child category under this parent
    const subName = (editValues.subCategoryName || pr.suggestedSubCategoryName || '').trim();
    let subId: string | undefined;
    if (subName) {
      const childCats = categories.filter((c) => c.parentId === parentId);
      const matchedChild = childCats.find((c) => c.name === subName);
      if (matchedChild) {
        subId = matchedChild.id;
      } else {
        try {
          const newChild = await addCategory({
            name: subName,
            color: '#8B7E74',
            sortOrder: childCats.length,
            isActive: true,
            parentId,
          });
          subId = newChild.id;
        } catch {
          // If auto-create fails, just leave subId undefined
        }
      }
    }
    try {
      // 使用编辑后的转录内容（如有）
      const editedVideoText = editValues.videoText || pr.videoText || '';
      const editedPageText = editValues.pageText || pr.pageText || '';
      const editedImageText = editValues.imageText || pr.imageText || '';
      const contentParts: string[] = [];
      if (editedPageText) contentParts.push(editedPageText);
      if (editedImageText) contentParts.push(`[图片内容]\n${editedImageText}`);
      if (editedVideoText) contentParts.push(`[视频转录]\n${editedVideoText}`);
      const mergedContent = contentParts.join('\n\n') || pr.content || activeDraft.rawInput;

      const allTags = [...editTags, ...hiddenTags];

      const newItem = await addItem({
        categoryId: parentId,
        subCategoryId: subId,
        title: editValues.title || pr.title,
        content: mergedContent,
        contentPreview: editValues.summary || pr.sourceSummary || '',
        sourceURL: activeDraft.inputType === 'url' ? activeDraft.rawInput : undefined,
        sourceType: activeDraft.inputType,
        tags: allTags,
        aiSummary: editValues.summary || pr.sourceSummary || '',
        aiClassificationScore: pr.confidence ?? 50,
        status: 'confirmed',
      });
      await confirmDraft(activeDraft.id, newItem.id);
      // Auto-create training record so it appears in 今日复述训练
      try { await useExpressionStore.getState().createRecord(newItem.id); } catch {}
      if (allTags.length > 0) {
        try { await saveUserTags(allTags); } catch {}
      }
      setModalVisible(false);
      setPendingModal(null);
      Alert.alert('已入库', '知识条目已保存，初始状态为待复述');
    } catch (e: any) {
      Alert.alert('错误', e?.message || '入库失败');
    }
  };

  // ── Render ──
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageHeader
        title="知识输入"
        leftAction={
          <TouchableOpacity style={styles.historyBtn} onPress={() => setSidebarOpen(true)} activeOpacity={0.7}>
            <MenuIcon size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        ref={scrollRef}
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
            <TextInput style={styles.urlInput} placeholder="https://mp.weixin.qq.com/s/example123..." placeholderTextColor={colors.text.tertiary} value={urlText} onChangeText={setUrlText} autoCapitalize="none" autoCorrect={false} numberOfLines={1} scrollEnabled />
          )}
          <TextInput style={styles.noteInput} placeholder={inputType==='url'?'补充备注：阅读笔记或关键摘录...':'在此输入文本内容...'} placeholderTextColor={colors.text.tertiary} value={noteText} onChangeText={setNoteText} multiline textAlignVertical="top" />
          <View style={styles.actionRow}>
            <TouchableOpacity onPress={() => { setUrlText(''); setNoteText(''); }} activeOpacity={0.6}>
              <Text style={styles.clearBtn}>清空</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.aiBtn, (parsingInProgress || isParsing) && styles.aiBtnDisabled]}
              onPress={handleSubmit}
              disabled={parsingInProgress || isParsing}
              activeOpacity={0.7}
            >
              <View style={styles.aiBtnInner}>
                <LightningIcon size={14} color={colors.text.inverse} />
                <Text style={styles.aiBtnText}> {(parsingInProgress || isParsing) ? 'AI 解析中...' : 'AI 拆解与分析'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ═══ Knowledge Library ═══ */}
        <View style={styles.librarySection}>
          <View style={styles.sectionDividerWrap}>
            <View style={styles.sectionDividerLine} />
            <Text style={styles.sectionDivider}> 知识库列表 </Text>
            <View style={styles.sectionDividerLine} />
          </View>
          <View style={styles.filterRow}>
            <View style={styles.searchWrap}>
              <SearchIcon size={15} color={colors.text.tertiary} />
              <TextInput style={styles.searchInput} placeholder="搜索知识标题..." placeholderTextColor={colors.text.tertiary} value={searchQuery} onChangeText={setSearchQuery} />
            </View>
            <TouchableOpacity style={styles.sortBtn} onPress={()=>setSortMode(p=>p==='newest'?'oldest':'newest')} activeOpacity={0.7}>
              <CalendarIcon size={14} color={colors.text.secondary} />
              <Text style={styles.sortBtnText}> {sortMode==='newest'?'最新':'最早'} <ChevronDownIcon size={12} color={colors.text.secondary} /></Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabScroll}>
            <View style={styles.subTabRow}>
              {LIBRARY_TABS.map(tab=>{
                const active=libraryTab===tab.key;
                const confirmedItems = items.filter(i=>i.status==='confirmed');
                let count = 0;
                if (tab.key === 'all') {
                  count = confirmedItems.length;
                } else if (tab.key === 'pending_retell') {
                  count = confirmedItems.filter(i=>itemTrainingState[i.id]==='pending_retell'||!itemTrainingState[i.id]).length;
                } else {
                  count = confirmedItems.filter(i=>itemTrainingState[i.id]==='retold'||itemTrainingState[i.id]==='pending_restate'||itemTrainingState[i.id]==='restated').length;
                }
                return (
                  <TouchableOpacity key={tab.key} style={[styles.subTab,active&&styles.subTabActive]} onPress={()=>setLibraryTab(tab.key)} activeOpacity={0.7}>
                    <Text style={[styles.subTabText,active&&styles.subTabTextActive]}>{count>0?`${tab.label}(${count})`:tab.label}</Text>
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
                <TouchableOpacity
                  key={item.id}
                  style={styles.libraryItem}
                  onPress={() => router.push(`/knowledge/${item.id}`)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.itemDate}>{item.createdAt?format(new Date(item.createdAt),'MM-dd'):'--'}</Text>
                  <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                  <Badge label={itemTrainingState[item.id] === 'pending_retell' || !itemTrainingState[item.id] ? 'pending_retell' : 'retold'} size="sm" />
                </TouchableOpacity>
              ))}
              <View style={styles.pagination}>
                <Text style={styles.pageInfo}>显示 {(safePage-1)*PAGE_SIZE+1}-{Math.min(safePage*PAGE_SIZE,libraryItems.length)} / 共 {libraryItems.length} 条</Text>
                <View style={styles.pageBtns}>
                  <TouchableOpacity style={[styles.pageBtn,safePage<=1&&styles.pageBtnDisabled]} onPress={()=>handlePageChange(Math.max(1,safePage-1))} disabled={safePage<=1} activeOpacity={0.7}>
                    <View style={styles.pageBtnInner}>
                      <ChevronLeftIcon size={12} color={safePage<=1?colors.text.tertiary:colors.text.primary} />
                      <Text style={[styles.pageBtnText, safePage<=1&&styles.pageBtnTextDisabled]}> 上一页</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.pageBtn,safePage>=totalPages&&styles.pageBtnDisabled]} onPress={()=>handlePageChange(Math.min(totalPages,safePage+1))} disabled={safePage>=totalPages} activeOpacity={0.7}>
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
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => {
        // 解析失败 → 关闭弹层时自动丢弃草稿
        if (activeDraft && !parseSucceeded) {
          deleteDraft(activeDraft.id);
        }
        setModalVisible(false);
        setParseError(null);
        setPendingModal(null);
      }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>ai拆解结果</Text>
              <TouchableOpacity onPress={() => {
                // 解析失败 → 关闭弹层时自动丢弃草稿
                if (activeDraft && !parseSucceeded) {
                  deleteDraft(activeDraft.id);
                }
                setModalVisible(false);
                setParseError(null);
                setPendingModal(null);
              }} activeOpacity={0.7}>
                <CloseIcon size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} showsVerticalScrollIndicator={false}>
              {showTranscriptOnly && parseError && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerTitle}>解析未成功</Text>
                  <Text style={styles.errorBannerText}>{parseError}</Text>
                </View>
              )}
              {/* 1. Title */}
              <TouchableOpacity style={styles.editField} onPress={()=>setEditingField(editingField==='title'?null:'title')} activeOpacity={0.8}>
                <View style={styles.editLabelInline}>
                  <PencilIcon size={12} color={colors.text.primary} />
                  <Text style={styles.editLabel}> 知识条目标题</Text>
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
                    <Text style={styles.editLabel}> AI 总结内容</Text>
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
                  <Text style={styles.editLabel}> 用户原始输入</Text>
                </View>
                {activeDraft && (
                  <Text style={styles.editValue} numberOfLines={showFullInput ? undefined : 5}>
                    {activeDraft.rawInput}
                  </Text>
                )}
              </View>

              {/* 3b. 内容介绍 (页面抓取文本，与标题/摘要同款点击编辑) */}
              {activeDraft?.parseResult?.pageText ? (
                <TouchableOpacity style={styles.editField} onPress={()=>setEditingField(editingField==='pageText'?null:'pageText')} activeOpacity={0.8}>
                  <View style={styles.transcriptDivider} />
                  <View style={styles.editLabelRow}>
                    <View style={styles.editLabelInline}>
                      <PencilIcon size={12} color={colors.text.primary} />
                      <Text style={styles.editLabel}> 内容介绍</Text>
                      <Text style={styles.editSubHint}> (可编辑 · 来自页面)</Text>
                    </View>
                    <View style={{flexDirection:'row', alignItems:'center', gap:4}}>
                      <TouchableOpacity onPress={() => {
                        Alert.alert('删除内容介绍', '将不把内容介绍计入知识库，确定删除？', [
                          { text: '取消', style: 'cancel' },
                          { text: '删除', style: 'destructive', onPress: () => setEditValues(v => ({ ...v, pageText: '' })) },
                        ]);
                      }} activeOpacity={0.7} style={{padding:6}} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                        <CloseIcon size={16} color={colors.text.tertiary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {(editValues.pageText || activeDraft.parseResult.pageText) ? (
                    editingField==='pageText' ? (
                      <TextInput style={styles.editInput} value={editValues.pageText || ''} onChangeText={t=>setEditValues(v=>({...v,pageText:t}))} multiline autoFocus />
                    ) : (
                      <Text style={styles.editValue} numberOfLines={showFullInput ? undefined : 12}>
                        {editValues.pageText || activeDraft.parseResult.pageText}
                      </Text>
                    )
                  ) : (
                    <Text style={styles.editSubHint}>已删除，不会计入知识库</Text>
                  )}
                  {editingField !== 'pageText' && ((editValues.pageText || activeDraft.parseResult.pageText || '').length > 300) && (
                    <TouchableOpacity onPress={()=>setShowFullInput(p=>!p)} activeOpacity={0.7}>
                      <View style={styles.expandRow}>
                        {showFullInput ? (
                          <><View style={{transform:[{rotate:'180deg'}]}}><ChevronDownIcon size={12} color={colors.accent} /></View><Text style={styles.expandMore}> 收起</Text></>
                        ) : (
                          <><ChevronDownIcon size={12} color={colors.accent} /><Text style={styles.expandMore}> 展开全部</Text></>
                        )}
                      </View>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ) : null}

              {/* 3c. 视频转写 */}
              {activeDraft?.parseResult?.videoText ? (
                <TouchableOpacity style={styles.editField} onPress={()=>setEditingField(editingField==='videoText'?null:'videoText')} activeOpacity={0.8}>
                  <View style={styles.transcriptDivider} />
                  <View style={styles.editLabelRow}>
                    <View style={styles.editLabelInline}>
                      <PencilIcon size={12} color={colors.text.primary} />
                      <Text style={styles.editLabel}> 视频转写</Text>
                      <Text style={styles.editSubHint}> (可编辑 · 自动生成)</Text>
                    </View>
                    <View style={{flexDirection:'row', alignItems:'center', gap:4}}>
                      <TouchableOpacity onPress={() => {
                        Alert.alert('删除视频转写', '将不把视频转写内容计入知识库，确定删除？', [
                          { text: '取消', style: 'cancel' },
                          { text: '删除', style: 'destructive', onPress: () => setEditValues(v => ({ ...v, videoText: '' })) },
                        ]);
                      }} activeOpacity={0.7} style={{padding:6}} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                        <CloseIcon size={16} color={colors.text.tertiary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {(editValues.videoText || activeDraft.parseResult.videoText) ? (
                    editingField==='videoText' ? (
                      <TextInput style={styles.editInput} value={editValues.videoText || ''} onChangeText={t=>setEditValues(v=>({...v,videoText:t}))} multiline autoFocus />
                    ) : (
                      <Text style={styles.editValue} numberOfLines={showFullInput ? undefined : 12}>
                        {editValues.videoText || activeDraft.parseResult.videoText}
                      </Text>
                    )
                  ) : (
                    <Text style={styles.editSubHint}>已删除，不会计入知识库</Text>
                  )}
                  {editingField !== 'videoText' && ((editValues.videoText || activeDraft.parseResult.videoText || '').length > 300) && (
                    <TouchableOpacity onPress={()=>setShowFullInput(p=>!p)} activeOpacity={0.7}>
                      <View style={styles.expandRow}>
                        {showFullInput ? (
                          <><View style={{transform:[{rotate:'180deg'}]}}><ChevronDownIcon size={12} color={colors.accent} /></View><Text style={styles.expandMore}> 收起</Text></>
                        ) : (
                          <><ChevronDownIcon size={12} color={colors.accent} /><Text style={styles.expandMore}> 展开全部</Text></>
                        )}
                      </View>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ) : null}

              {/* 3d. 图片内容 */}
              {(editValues.imageText || activeDraft?.parseResult?.imageText) ? (
                <TouchableOpacity style={styles.editField} onPress={()=>setEditingField(editingField==='imageText'?null:'imageText')} activeOpacity={0.8}>
                  <View style={styles.transcriptDivider} />
                  <View style={styles.editLabelRow}>
                    <View style={styles.editLabelInline}>
                      <PencilIcon size={12} color={colors.text.primary} />
                      <Text style={styles.editLabel}> 图片内容</Text>
                      <Text style={styles.editSubHint}> (可编辑 · AI 识别)</Text>
                    </View>
                    <View style={{flexDirection:'row', alignItems:'center', gap:4}}>
                      <TouchableOpacity onPress={() => {
                        Alert.alert('删除图片内容', '将不把图片内容计入知识库，确定删除？', [
                          { text: '取消', style: 'cancel' },
                          { text: '删除', style: 'destructive', onPress: () => setEditValues(v => ({ ...v, imageText: '' })) },
                        ]);
                      }} activeOpacity={0.7} style={{padding:6}} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                        <CloseIcon size={16} color={colors.text.tertiary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {editingField==='imageText' ? (
                    <TextInput style={styles.editInput} value={editValues.imageText || ''} onChangeText={t=>setEditValues(v=>({...v,imageText:t}))} multiline autoFocus />
                  ) : (
                    <Text style={styles.editValue} numberOfLines={showFullInput ? undefined : 8}>
                      {editValues.imageText || activeDraft?.parseResult?.imageText}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
              <View style={styles.transcriptDivider} />
              {/* 4. 知识分类 / Tags */}
              <View style={styles.editField}>
                <View style={styles.metaCardNew}>
                  {/* Row 1: 知识分类 — parent chips */}
                  <View style={styles.metaCardRowNew}>
                    <Text style={styles.metaLabelNew}>知识分类</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flex:1}}>
                      <View style={[styles.tagRow, {alignItems:'center'}]}>
                        {parentCats.map((cat) => {
                          const isSelected = editParentCatIds.includes(cat.id);
                          return (
                            <TouchableOpacity key={cat.id}
                              style={[styles.catChip, isSelected && styles.catChipActive]}
                              onPress={() => {
                                setEditParentCatIds(prev =>
                                  isSelected ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                                );
                              }}
                              activeOpacity={0.7}>
                              <Text style={[styles.catChipText, isSelected && styles.catChipTextActive]}>
                                {cat.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                        {isAddingParentCat ? (
                          <TextInput style={styles.catInput}
                            value={newParentCatName} onChangeText={setNewParentCatName}
                            onSubmitEditing={async () => {
                              const n = newParentCatName.trim();
                              if (n) {
                                const nc = await addCategory({
                                  name: n, color: '#6B7280', sortOrder: parentCats.length, isActive: true,
                                });
                                setEditParentCatIds(prev => [...prev, nc.id]);
                              }
                              setNewParentCatName(''); setIsAddingParentCat(false);
                            }}
                            onBlur={() => { setNewParentCatName(''); setIsAddingParentCat(false); }}
                            placeholder="新建父分类" placeholderTextColor={colors.text.tertiary} autoFocus />
                        ) : (
                          <TouchableOpacity onPress={() => setIsAddingParentCat(true)} activeOpacity={0.7}>
                            <Text style={[styles.catChipText, {color:colors.accent}]}>+ 新增</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </ScrollView>
                  </View>
                  {/* Row 2: 子标签 */}
                  <View style={styles.metaCardRowNew}>
                    <Text style={[styles.metaLabelNew, {fontSize:13, color:colors.text.tertiary}]}>子标签</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flex:1}}>
                      <View style={styles.tagRow}>
                        {editTags.map((tag,i)=>(
                          <TouchableOpacity key={i} style={styles.subTagWrap} onPress={()=>handleRemoveTag(tag)} activeOpacity={0.7}>
                            <View style={styles.subTagPencil} pointerEvents="none">
                              <Svg width="100%" height="100%" viewBox="0 0 72 24" preserveAspectRatio="none">
                                <Rect x={2} y={2} width={68} height={20}
                                  stroke="#3A3530" strokeWidth={1.2} strokeDasharray="12 4 8 3 16 4"
                                  strokeLinecap="round" fill="none" opacity={0.38} rx={3} ry={3} />
                                <Rect x={3} y={1} width={66} height={22}
                                  stroke="#4A4440" strokeWidth={0.9} strokeDasharray="6 5 10 3 8 4"
                                  strokeLinecap="round" fill="none" opacity={0.30} rx={4} ry={2} />
                              </Svg>
                            </View>
                            <Text style={styles.subTagText}>{tag} ✕</Text>
                          </TouchableOpacity>
                        ))}
                        {isAddingTag ? (
                          <TextInput
                            style={styles.addTagInput}
                            placeholder="输入标签名"
                            placeholderTextColor={colors.text.tertiary}
                            value={editNewTag}
                            onChangeText={setEditNewTag}
                            onSubmitEditing={handleAddTag}
                            onBlur={handleAddTag}
                            autoFocus
                          />
                        ) : (
                          <TouchableOpacity style={styles.addTagBtn} onPress={handleStartAddTag} activeOpacity={0.7}>
                            <Text style={styles.addTagText}>+ 新增</Text>
                          </TouchableOpacity>
                        )}
                        </View>
                    </ScrollView>
                  </View>
                </View>
              </View>

            </ScrollView>

            {/* Bottom actions — fixed outside scroll, above nav bar */}
            <View style={[styles.modalActions, { paddingBottom: (insets.bottom || 16) + 8 }]}>
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
          </View>
        </View>
      </Modal>

      {/* ═══ History Sidebar ═══ */}
      <Modal visible={sidebarOpen} animationType="none" transparent onRequestClose={() => {
        setSidebarOpen(false);
        setSelectMode(false);
        setSelectedIds(new Set());
      }}>
        <View style={styles.sidebarOverlay}>
          <Animated.View style={[styles.sidebarBackdrop,{opacity:overlayAnim}]}>
            <TouchableOpacity style={styles.backdropPress} onPress={() => {
              setSidebarOpen(false);
              setSelectMode(false);
              setSelectedIds(new Set());
            }} activeOpacity={1} />
          </Animated.View>
          <Animated.View style={[styles.sidebarPanel,{transform:[{translateX:slideAnim}]}]}>
            <View style={styles.sidebarHeader}>
              <View style={styles.sidebarTitleRow}>
                <HourglassIcon size={14} color={colors.text.primary} />
                <Text style={styles.sidebarTitle}> 待入库 ({pendingDrafts.length}/10)</Text>
              </View>
              <View style={{flexDirection:'row', alignItems:'center', gap:12}}>
                {pendingDrafts.length > 0 && (
                  <TouchableOpacity onPress={() => {
                    setSelectMode(!selectMode);
                    setSelectedIds(new Set());
                  }} activeOpacity={0.7}>
                    <Text style={{fontSize:13, color:selectMode?colors.danger:colors.accent, fontWeight:'500'}}>
                      {selectMode ? '取消' : '多选'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => {
                  setSidebarOpen(false);
                  setSelectMode(false);
                  setSelectedIds(new Set());
                }} activeOpacity={0.7}>
                  <CloseIcon size={16} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* 多选操作栏 */}
            {selectMode && selectedIds.size > 0 && (
              <View style={styles.batchBar}>
                <Text style={styles.batchBarCount}>已选 {selectedIds.size} 项</Text>
                <TouchableOpacity
                  style={styles.batchDiscardBtn}
                  onPress={() => {
                    Alert.alert(
                      '批量丢弃',
                      `确认丢弃选中的 ${selectedIds.size} 条待入库记录吗？`,
                      [
                        { text: '取消', style: 'cancel' },
                        {
                          text: '丢弃', style: 'destructive',
                          onPress: () => {
                            selectedIds.forEach(id => deleteDraft(id));
                            setSelectedIds(new Set());
                            setSelectMode(false);
                          },
                        },
                      ],
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <TrashIcon size={12} color={colors.danger} />
                  <Text style={styles.batchDiscardText}> 批量丢弃</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.sidebarHint}>* 仅支持缓存10个未确认的知识，请尽快处理</Text>
            <ScrollView style={styles.sidebarList} showsVerticalScrollIndicator={false}>
              {pendingDrafts.map(draft=>{
                const hasResult = !!draft.parseResult;
                const isSelected = selectedIds.has(draft.id);
                return (
                  <TouchableOpacity
                    key={draft.id}
                    style={[styles.draftItem, isSelected && styles.draftItemSelected]}
                    onPress={() => {
                      if (selectMode) {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (next.has(draft.id)) next.delete(draft.id);
                          else next.add(draft.id);
                          return next;
                        });
                      } else if (hasResult) {
                        handleOpenDraft(draft);
                      } else {
                        Alert.alert('处理中','AI 正在拆解中，请稍候');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    {selectMode && (
                      <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    )}
                    <Text style={styles.draftItemDate}>
                      {draft.createdAt?format(new Date(draft.createdAt),'MM-dd'):'--'}
                    </Text>
                    <Text style={styles.draftItemTitle} numberOfLines={1}>{getDraftLabel(draft)}</Text>
                    <Text style={styles.draftItemStatusPending}>
                      [待确认]
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {pendingDrafts.length===0 && (
                <Text style={styles.sidebarEmpty}>暂无未确认的知识</Text>
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

  historyBtn: { padding:4 },
  historyBtnInner: { flexDirection:'row', alignItems:'center' },
  historyBtnText: { fontSize:14, color:colors.text.secondary, fontWeight:'500' },

  scrollView: { flex:1 },
  scrollContent: { ...pageContentPadding },

  sectionHint: { fontSize:14, color:colors.text.secondary, marginBottom:8 },
  typeRow: { flexDirection:'row', gap:10, marginBottom:12 },
  typeBtn: { flex:1, paddingVertical:10, borderRadius:tokens.radius.md, borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider, backgroundColor:colors.surfaceLight, alignItems:'center' },
  typeBtnActive: { backgroundColor:colors.primary, borderColor:colors.primary },
  typeBtnInner: { flexDirection:'row', alignItems:'center' },
  typeBtnText: { fontSize:15, fontWeight:'600', color:colors.text.secondary },
  typeBtnTextActive: { color:colors.text.inverse },

  inputCard: { backgroundColor:colors.surface, borderRadius:tokens.radius.lg, borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider, padding:14, marginBottom:12 },
  urlInput: { fontSize:15, color:colors.text.primary, borderBottomWidth:tokens.borderWidth.hairline, borderBottomColor:colors.divider, paddingVertical:8, marginBottom:10, overflow:'hidden' },
  noteInput: { fontSize:15, color:colors.text.primary, minHeight:80, lineHeight:22, marginBottom:12 },
  actionRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:4 },
  clearBtn: { fontSize:14, color:colors.text.tertiary },
  aiBtn: { backgroundColor:colors.primary, borderRadius:tokens.radius.md, paddingVertical:12, alignItems:'center', paddingHorizontal:20 },
  aiBtnDisabled: { opacity:0.5 },
  aiBtnInner: { flexDirection:'row', alignItems:'center' },
  aiBtnText: { fontSize:15, fontWeight:'700', color:colors.text.inverse },

  // Library
  librarySection: { gap:8 },
  sectionDividerWrap: { flexDirection:'row', alignItems:'center', justifyContent:'center', marginBottom:6, gap:6 },
  sectionDivider: { fontSize:14, color:colors.text.tertiary, textAlign:'center' },
  sectionDividerLine: { flex:1, height:tokens.borderWidth.hairline, backgroundColor:colors.divider },
  filterRow: { flexDirection:'row', gap:8 },
  searchWrap: { flex:1, flexDirection:'row', alignItems:'center', backgroundColor:colors.surface, borderRadius:tokens.radius.md, borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider, paddingHorizontal:10, gap:7 },
  searchInput: { flex:1, fontSize:14, color:colors.text.primary, paddingVertical:8 },
  sortBtn: { flexDirection:'row', alignItems:'center', backgroundColor:colors.surface, borderRadius:tokens.radius.md, borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider, paddingVertical:8, paddingHorizontal:12 },
  sortBtnText: { fontSize:14, color:colors.text.secondary },
  subTabScroll: { marginBottom:0 },
  subTabRow: { flexDirection:'row', gap:6 },
  subTab: { paddingVertical:7, paddingHorizontal:14, borderRadius:tokens.radius.full, backgroundColor:colors.surfaceLight },
  subTabActive: { backgroundColor:colors.primary },
  subTabText: { fontSize:14, color:colors.text.secondary, fontWeight:'500' },
  subTabTextActive: { color:colors.text.inverse },
  emptyState: { alignItems:'center', paddingVertical:40, gap:10 },
  emptyText: { fontSize:15, color:colors.text.secondary },
  libraryItem: { flexDirection:'row', alignItems:'center', paddingVertical:8, paddingHorizontal:12, backgroundColor:colors.surface, borderRadius:tokens.radius.md, borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider, gap:10, marginBottom:4 },
  itemDate: { fontSize:13, color:colors.text.tertiary, fontWeight:'500', minWidth:40 },
  itemTitle: { flex:1, fontSize:15, color:colors.text.primary, fontWeight:'500' },
  pagination: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingTop:10, borderTopWidth:tokens.borderWidth.hairline, borderTopColor:colors.divider, marginTop:4 },
  pageInfo: { fontSize:13, color:colors.text.secondary },
  pageBtns: { flexDirection:'row', gap:8 },
  pageBtn: { paddingVertical:6, paddingHorizontal:14, borderRadius:tokens.radius.md, borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider, backgroundColor:colors.surface },
  pageBtnDisabled: { opacity:0.4 },
  pageBtnInner: { flexDirection:'row', alignItems:'center' },
  pageBtnText: { fontSize:13, color:colors.text.primary, fontWeight:'500' },
  pageBtnTextDisabled: { color:colors.text.tertiary },
  bottomSpacer: { height:8 },

  // ── Modal ──
  modalOverlay: { flex:1, backgroundColor:'rgba(24,22,20,0.55)', justifyContent:'flex-end' },
  modalSheet: { backgroundColor:colors.background, borderTopLeftRadius:20, borderTopRightRadius:20, maxHeight:'78%' },
  modalHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:tokens.borderWidth.hairline, borderBottomColor:colors.divider },
  modalTitleRow: { flexDirection:'row', alignItems:'center', flex:1 },
  modalTitle: { fontSize:20, fontWeight:'700', color:colors.text.primary, fontFamily },
  modalHint: { fontSize:11, color:colors.text.tertiary, width:'100%' },
  modalCloseRow: { flexDirection:'row', alignItems:'center' },
  modalClose: { fontSize:14, color:colors.danger, fontWeight:'600' },
  modalBody: { padding:16 },
  modalBodyContent: { paddingBottom: 24 },
  modalDivider: { height:tokens.borderWidth.hairline, backgroundColor:colors.divider, marginVertical:14 },

  editField: { gap:10 },
  editLabelInline: { flexDirection:'row', alignItems:'center' },
  editLabel: { fontSize:16, fontWeight:'600', color:colors.text.primary },
  editSubLabel: { fontSize:13, fontWeight:'600', color:colors.text.tertiary, marginBottom:6 },
  editSubHint: { fontSize:12, color:colors.text.tertiary, marginLeft:4 },
  transcriptBlock: { fontSize:15, color:colors.text.secondary, lineHeight:24, backgroundColor:colors.primaryLight, paddingVertical:10, paddingHorizontal:14, borderRadius:tokens.radius.sm, borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider, marginLeft:16 },
  errorBanner: { backgroundColor:colors.danger+'14', borderRadius:tokens.radius.sm, borderWidth:tokens.borderWidth.hairline, borderColor:colors.danger, padding:14, marginBottom:14 },
  errorBannerTitle: { fontSize:15, fontWeight:'700', color:colors.danger, marginBottom:6 },
  errorBannerText: { fontSize:14, color:colors.danger, lineHeight:22 },
  editLabelRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  editValue: { fontSize:16, color:colors.text.primary, lineHeight:26, backgroundColor:colors.surface, paddingVertical:12, paddingRight:12, paddingLeft:16, borderRadius:tokens.radius.sm, borderWidth:tokens.borderWidth.hairline, borderColor:'transparent' },
  editInput: { fontSize:16, color:colors.text.primary, backgroundColor:colors.surface, paddingVertical:10, paddingRight:12, paddingLeft:16, borderRadius:tokens.radius.sm, borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider, lineHeight:24 },
  regenerateRow: { flexDirection:'row', alignItems:'center' },
  regenerateBtn: { fontSize:14, color:colors.accent, fontWeight:'600' },
  originalInput: { fontSize:15, color:colors.text.secondary, lineHeight:24, paddingVertical:8, paddingHorizontal:12, backgroundColor:'#F8F6F2', borderRadius:tokens.radius.sm },
  transcriptDivider: { borderTopWidth:1, borderTopColor:'#E0DBD0', borderStyle:'dashed', marginVertical:8, marginHorizontal:4 },
  expandRow: { flexDirection:'row', alignItems:'center', justifyContent:'center', marginTop:6 },
  expandMore: { fontSize:14, color:colors.accent, fontWeight:'500' },

  tagRow: { flexDirection:'row', gap:6, alignItems:'center' },
  // Sub-tags with pencil-stroke SVG border (matching home card style)
  subTagWrap: {
    position: 'relative',
    backgroundColor: 'rgba(245,240,230,0.5)',
    borderRadius: 3,
    paddingVertical: 3, paddingHorizontal: 8,
    margin: 3,
  },
  subTagPencil: {
    position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, zIndex: 0,
  },
  subTagText: { fontSize: 11, fontWeight: '500', color: colors.text.secondary },
  aiTag: { backgroundColor:colors.primaryLight, borderRadius:tokens.radius.sm, paddingVertical:4, paddingHorizontal:10, borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider },
  aiTagText: { fontSize:14, color:colors.text.primary, fontWeight:'500' },
  addTagBtn: { borderRadius:tokens.radius.sm, borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider, paddingVertical:4, paddingHorizontal:10, borderStyle:'dashed' },
  addTagText: { fontSize:11, color:colors.accent, fontWeight:'600' },
  addTagInput: { fontSize:11, color:colors.text.primary, borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider, borderRadius:tokens.radius.sm, paddingVertical:4, paddingHorizontal:10, minWidth:90 },

  // Verification — unified card (matching knowledge detail page)
  verifyCardNew: {
    backgroundColor:colors.surface, borderRadius:tokens.radius.sm,
    borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider,
    padding:16, gap:10,
  },
  verifyScoreRowNew: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10 },
  verifyBadgeNew: { borderRadius:tokens.radius.sm, paddingVertical:4, paddingHorizontal:12, borderWidth:tokens.borderWidth.hairline, borderColor:colors.success, backgroundColor:colors.success+'18' },
  verifyBadgeTextNew: { fontSize:14, fontWeight:'600', color:colors.success },
  verifyScoreLargeNew: { fontSize:28, fontWeight:'700', color:colors.text.primary, fontFamily },
  verifyDividerNew: { borderTopWidth:tokens.borderWidth.hairline, borderTopColor:colors.divider, borderStyle:'dashed', marginVertical:6 },
  verifySectionTitleNew: { fontSize:14, fontWeight:'600', color:colors.text.primary },
  verifyRefItemNew: { flexDirection:'row', alignItems:'center', gap:6 },
  verifyRefIndexNew: { fontSize:14, color:colors.text.tertiary, fontWeight:'500', minWidth:20 },
  verifyLinkTextNew: { flex:1, fontSize:14, color:colors.text.secondary, lineHeight:22 },
  verifyExplainNew: { fontSize:15, color:colors.text.secondary, lineHeight:24 },

  // Meta card (category) — matching knowledge detail page
  metaCardNew: {
    backgroundColor:colors.surface, borderRadius:tokens.radius.sm,
    borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider,
    padding:14, gap:6,
  },
  metaCardRowNew: { flexDirection:'row', alignItems:'center', gap:12, marginBottom: 4 },
  metaLabelNew: { fontSize:15, fontWeight:'600', color:colors.text.primary, minWidth:64 },
  metaValueNew: { fontSize:15, color:colors.text.secondary },

  // Category chips (matching knowledge detail)
  catChip: { paddingHorizontal:10, paddingVertical:4, borderRadius:tokens.radius.sm, borderWidth:1, borderColor:colors.divider, backgroundColor:colors.background },
  catChipActive: { backgroundColor:colors.primary, borderColor:colors.primary },
  catChipText: { fontSize:11, color:colors.text.secondary, fontWeight:'500' },
  catChipTextActive: { color:colors.text.inverse },
  catInput: { fontSize:13, color:colors.text.primary, borderBottomWidth:1, borderBottomColor:colors.accent, paddingVertical:2, minWidth:80 },

  modalActions: {
    flexDirection:'row', gap:10,
    paddingTop:12, paddingHorizontal:16,
    backgroundColor:colors.background,
    borderTopWidth: tokens.borderWidth.hairline,
    borderTopColor: colors.divider,
  },
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
  sidebarPanel: { position:'absolute', top:0, left:0, bottom:0, width:SIDEBAR_WIDTH, backgroundColor:colors.surface, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 },
  sidebarHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:tokens.borderWidth.hairline, borderBottomColor:colors.divider },
  sidebarTitleRow: { flexDirection:'row', alignItems:'center' },
  sidebarTitle: { fontSize:16, fontWeight:'700', color:colors.text.primary },
  sidebarHint: { fontSize:12, color:colors.text.tertiary, paddingHorizontal:16, marginBottom:10, marginTop:6 },
  sidebarList: { flex:1, paddingHorizontal:12 },
  sidebarEmpty: { fontSize:14, color:colors.text.tertiary, textAlign:'center', marginTop:40 },
  draftItem: {
    flexDirection:'row', alignItems:'center',
    backgroundColor:colors.background, borderRadius:tokens.radius.md,
    borderWidth:tokens.borderWidth.hairline, borderColor:colors.divider,
    paddingVertical:10, paddingHorizontal:12, gap:8, marginBottom:6,
  },
  draftItemDate: { fontSize:13, color:colors.text.tertiary, minWidth:36 },
  draftItemTitle: { flex:1, fontSize:15, color:colors.text.primary, fontWeight:'500' },
  draftItemStatus: { fontSize:13, color:colors.text.tertiary, fontWeight:'600' },
  draftItemStatusDone: { color:colors.success },
  draftItemStatusPending: { fontSize:13, color:colors.warning, fontWeight:'600' },

  // Multi-select
  draftItemSelected: { backgroundColor:'#F0EDE8' },
  checkbox: { width:20, height:20, borderRadius:4, borderWidth:1.5, borderColor:'#C4BEB2', marginRight:8, alignItems:'center', justifyContent:'center' },
  checkboxChecked: { backgroundColor:colors.accent, borderColor:colors.accent },
  checkmark: { color:colors.text.inverse, fontSize:12, fontWeight:'700' },
  batchBar: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:14, paddingVertical:8, backgroundColor:'#FDF3F0', borderBottomWidth:1, borderBottomColor:'#F0D8D2' },
  batchBarCount: { fontSize:13, color:colors.danger, fontWeight:'600' },
  batchDiscardBtn: { flexDirection:'row', alignItems:'center', paddingHorizontal:10, paddingVertical:4, borderRadius:6, backgroundColor:'#FDE8E4' },
  batchDiscardText: { fontSize:13, color:colors.danger, fontWeight:'600' },
});
