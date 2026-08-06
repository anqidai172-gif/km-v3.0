import { create } from 'zustand';
import type { InputDraft, ParseResult } from '../types';
import * as draftRepo from '../db/repositories/draftRepo';
import { generateId } from '../utils/id';
import { getNowStr } from '../utils/date';

/** 解析完成后待展示的半弹层数据（跨页面存活） */
export interface PendingModal {
  draft: InputDraft;
  parseSucceeded: boolean;
  parseError: string | null;
  showTranscriptOnly: boolean;
  editValues: Record<string, string>;
  editTags: string[];
}

interface InputState {
  drafts: InputDraft[];
  currentDraft: InputDraft | null;
  loading: boolean;
  /** 解析中的任务结果——用户切走页面后回来仍可弹出 */
  pendingModal: PendingModal | null;
  /** 是否有 AI 解析正在进行中（跨页面存活） */
  parsingInProgress: boolean;
  /** 正在解析的输入内容（用于返回页面时恢复 UI） */
  parsingInput: { inputType: 'url' | 'text'; text: string } | null;

  loadAll: () => Promise<void>;
  createDraft: (inputType: 'url' | 'text', rawInput: string) => Promise<InputDraft>;
  updateParseResult: (draftId: string, result: ParseResult) => Promise<void>;
  confirmDraft: (draftId: string, knowledgeItemId: string) => Promise<void>;
  discardDraft: (draftId: string) => Promise<void>;
  deleteDraft: (draftId: string) => Promise<void>;
  clearAllPending: () => Promise<number>;
  setCurrentDraft: (draft: InputDraft | null) => void;
  setPendingModal: (data: PendingModal | null) => void;
  submitAndParse: (params: {
    inputType: 'url' | 'text';
    text: string;
    parseContent: (request: any, options?: any) => Promise<any>;
    isPlatformVideoURL: (url: string) => boolean;
    getPlatformName: (url: string) => string;
    extractURLFromShareText: (text: string) => string;
    detectProvider: (baseURL: string) => string;
    categories: { id: string; name: string }[];
    settings: {
      videoServerURL?: string;
      aiApiKey?: string;
      aiBaseURL?: string;
      aiModel?: string;
      asrProvider?: string;
      asrWhisperModel?: string;
      asrTencentSecretId?: string;
      asrTencentSecretKey?: string;
      asrAliyunAppKey?: string;
      asrAliyunAccessToken?: string;
      asrXunfeiAppId?: string;
      asrXunfeiApiKey?: string;
    };
  }) => Promise<void>;

  getDraftsByStatus: (status: string) => InputDraft[];
  getDraftsByDate: (dateStr: string) => InputDraft[];
}

export const useInputStore = create<InputState>((set, get) => ({
  drafts: [],
  currentDraft: null,
  loading: false,
  pendingModal: null,
  parsingInProgress: false,
  parsingInput: null,

  loadAll: async () => {
    set({ loading: true });
    const drafts = await draftRepo.getAllDrafts();
    set({ drafts, loading: false });
  },

  createDraft: async (inputType, rawInput) => {
    const now = getNowStr();
    const draft: InputDraft = {
      id: generateId(),
      inputType,
      rawInput,
      status: 'parsing',
      createdAt: now,
      updatedAt: now,
    };
    await draftRepo.insertDraft(draft);
    set((s) => ({ drafts: [draft, ...s.drafts], currentDraft: draft }));
    return draft;
  },

  updateParseResult: async (draftId, result) => {
    const draft = get().drafts.find((d) => d.id === draftId);
    if (!draft) return;
    const updated = {
      ...draft,
      parseResult: result,
      status: 'pending_review' as const,
      updatedAt: getNowStr(),
    };
    await draftRepo.updateDraft(updated);
    set((s) => ({
      drafts: s.drafts.map((d) => (d.id === draftId ? updated : d)),
      currentDraft: updated,
    }));
  },

  confirmDraft: async (draftId, knowledgeItemId) => {
    const draft = get().drafts.find((d) => d.id === draftId);
    if (!draft) return;
    const updated = {
      ...draft,
      status: 'confirmed' as const,
      confirmedKnowledgeItemId: knowledgeItemId,
      updatedAt: getNowStr(),
    };
    await draftRepo.updateDraft(updated);
    set((s) => ({
      drafts: s.drafts.map((d) => (d.id === draftId ? updated : d)),
      currentDraft: null,
    }));
  },

  discardDraft: async (draftId) => {
    const draft = get().drafts.find((d) => d.id === draftId);
    if (!draft) return;
    const updated = {
      ...draft,
      status: 'discarded' as const,
      updatedAt: getNowStr(),
    };
    await draftRepo.updateDraft(updated);
    set((s) => ({
      drafts: s.drafts.map((d) => (d.id === draftId ? updated : d)),
      currentDraft: null,
    }));
  },

  deleteDraft: async (draftId) => {
    await draftRepo.deleteDraft(draftId);
    set((s) => ({
      drafts: s.drafts.filter((d) => d.id !== draftId),
      currentDraft: s.currentDraft?.id === draftId ? null : s.currentDraft,
    }));
  },

  /** 清空所有待入库记录（调试后清理用） */
  clearAllPending: async () => {
    const count = await draftRepo.deleteDraftsByStatus('pending_review');
    set((s) => ({
      drafts: s.drafts.filter((d) => d.status !== 'pending_review'),
    }));
    return count;
  },

  setCurrentDraft: (draft) => set({ currentDraft: draft }),

  setPendingModal: (data) => set({ pendingModal: data }),

  /** 提交内容并解析 — store 级 action，不受组件卸载影响 */
  submitAndParse: async (params: {
    inputType: 'url' | 'text';
    text: string;
    parseContent: (request: any, options?: any) => Promise<any>;
    isPlatformVideoURL: (url: string) => boolean;
    getPlatformName: (url: string) => string;
    extractURLFromShareText: (text: string) => string;
    detectProvider: (baseURL: string) => string;
    categories: { id: string; name: string }[];
    settings: {
      videoServerURL?: string;
      aiApiKey?: string;
      aiBaseURL?: string;
      aiModel?: string;
      asrProvider?: string;
      asrWhisperModel?: string;
      asrTencentSecretId?: string;
      asrTencentSecretKey?: string;
      asrAliyunAppKey?: string;
      asrAliyunAccessToken?: string;
      asrXunfeiAppId?: string;
      asrXunfeiApiKey?: string;
    };
  }) => {
    const { inputType, text, parseContent, isPlatformVideoURL, getPlatformName, extractURLFromShareText, detectProvider, categories, settings } = params;

    // Mark parsing as in-progress, store input for UI restore (survives navigation)
    set({ parsingInProgress: true, parsingInput: { inputType, text } });

    // 1. Create draft
    const now = getNowStr();
    const draft: InputDraft = {
      id: generateId(),
      inputType,
      rawInput: text,
      status: 'parsing',
      createdAt: now,
      updatedAt: now,
    };
    await draftRepo.insertDraft(draft);
    set((s) => ({ drafts: [draft, ...s.drafts], currentDraft: draft }));

    // 2. Parse content
    let result: any;
    let succeeded = false;
    try {
      result = await parseContent(
        { inputType, content: text, targetCategories: categories },
        {
          videoServerURL: settings.videoServerURL || undefined,
          serverApiConfig: {
            apiKey: settings.aiApiKey || undefined,
            provider: detectProvider(settings.aiBaseURL || ''),
            baseURL: settings.aiBaseURL || undefined,
            model: settings.aiModel || undefined,
            asrProvider: settings.asrProvider || undefined,
            asrWhisperModel: settings.asrWhisperModel || undefined,
            asrTencentSecretId: settings.asrTencentSecretId || undefined,
            asrTencentSecretKey: settings.asrTencentSecretKey || undefined,
            asrAliyunAppKey: settings.asrAliyunAppKey || undefined,
            asrAliyunAccessToken: settings.asrAliyunAccessToken || undefined,
            asrXunfeiAppId: settings.asrXunfeiAppId || undefined,
            asrXunfeiApiKey: settings.asrXunfeiApiKey || undefined,
          },
        },
      );
      succeeded = true;
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

    // 3. Update draft with parse result
    if (succeeded) {
      const updated = { ...draft, parseResult: result, status: 'pending_review' as const, updatedAt: getNowStr() };
      await draftRepo.updateDraft(updated);
      set((s) => ({
        drafts: s.drafts.map((d) => (d.id === draft.id ? updated : d)),
        currentDraft: updated,
      }));
    }

    // 4. Build pending modal data (always stored — survives navigation)
    const isVideoURL = inputType === 'url' && isPlatformVideoURL(text);
    const parseErr = isVideoURL && !result.videoText && !result.pageText ? (
      result.serverError
        ? `未能获取链接转文字结果。\n\n服务端返回: ${result.serverError}\n\n其他可能:\n· 该链接没有可提取的内容\n· 平台不支持该链接格式\n· yt-dlp 无法访问该平台（需 VPN）`
        : '未能获取链接转文字结果。\n\n视频解析服务未连接 — 请检查「设置→视频解析服务」地址是否正确\n\n其他可能:\n· 该链接没有可提取的内容\n· 平台不支持该链接格式\n· yt-dlp 无法访问该平台（需 VPN）'
    ) : null;

    set({
      parsingInProgress: false,
      parsingInput: null,
      pendingModal: {
        draft: { ...draft, parseResult: result, status: succeeded ? 'pending_review' : 'parsing' },
        parseSucceeded: succeeded,
        parseError: parseErr,
        showTranscriptOnly: isVideoURL,
        editValues: {
          // Prefer content-derived title; only use URL as fallback for video links
          title: (() => {
            const t = (result.title || '').trim();
            if (t && isVideoURL) return t; // use server-returned title
            if (t) return t;               // use AI-returned title
            if (isVideoURL) return `[${getPlatformName(text)}] ${extractURLFromShareText(text)}`;
            return text.slice(0, 50);
          })(),
          summary: result.sourceSummary || '',
          categoryName: result.suggestedCategoryName || '',
          subCategoryName: result.suggestedSubCategoryName || '',
          videoText: result.videoText || '',
          pageText: result.pageText || '',
          imageText: result.imageText || '',
        },
        editTags: result.suggestedTags || [],
      },
    });
  },

  getDraftsByStatus: (status) =>
    get().drafts.filter((d) => d.status === status),

  getDraftsByDate: (dateStr) =>
    get().drafts.filter((d) => d.createdAt.startsWith(dateStr)),
}));
