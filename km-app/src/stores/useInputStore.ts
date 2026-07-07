import { create } from 'zustand';
import type { InputDraft, ParseResult } from '../types';
import * as draftRepo from '../db/repositories/draftRepo';
import { generateId } from '../utils/id';
import { getNowStr } from '../utils/date';

interface InputState {
  drafts: InputDraft[];
  currentDraft: InputDraft | null;
  loading: boolean;

  loadAll: () => Promise<void>;
  createDraft: (inputType: 'url' | 'text', rawInput: string) => Promise<InputDraft>;
  updateParseResult: (draftId: string, result: ParseResult) => Promise<void>;
  confirmDraft: (draftId: string, knowledgeItemId: string) => Promise<void>;
  discardDraft: (draftId: string) => Promise<void>;
  deleteDraft: (draftId: string) => Promise<void>;
  setCurrentDraft: (draft: InputDraft | null) => void;

  getDraftsByStatus: (status: string) => InputDraft[];
  getDraftsByDate: (dateStr: string) => InputDraft[];
}

export const useInputStore = create<InputState>((set, get) => ({
  drafts: [],
  currentDraft: null,
  loading: false,

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

  setCurrentDraft: (draft) => set({ currentDraft: draft }),

  getDraftsByStatus: (status) =>
    get().drafts.filter((d) => d.status === status),

  getDraftsByDate: (dateStr) =>
    get().drafts.filter((d) => d.createdAt.startsWith(dateStr)),
}));
