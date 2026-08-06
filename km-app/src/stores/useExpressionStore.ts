import { create } from 'zustand';
import type { TrainingRecord, TrainingAttempt, TrainingState, AIFeedback } from '../types';
import * as expressionRepo from '../db/repositories/expressionRepo';
import { generateId } from '../utils/id';
import { getTodayStr, getNowStr } from '../utils/date';
import { calculatePriority, calculateNextInterval } from '../utils/priority';
import { SM2_DEFAULTS } from '../utils/constants';

interface ExpressionState {
  records: TrainingRecord[];
  loading: boolean;

  loadAll: () => Promise<void>;
  loadTodayBoard: () => Promise<void>;

  createRecord: (knowledgeItemId: string) => Promise<TrainingRecord>;
  submitAttempt: (recordId: string, transcription: string) => Promise<TrainingAttempt>;
  receiveFeedback: (recordId: string, attemptId: string, feedback: AIFeedback, score: number, passThreshold: number) => Promise<void>;
  submitAppeal: (recordId: string, attemptId: string) => Promise<void>;
  submitSatisfaction: (recordId: string, attemptId: string, satisfaction: 'thumbs_up' | 'thumbs_down', comment?: string) => Promise<void>;
  finishSession: (recordId: string) => Promise<void>;
  deferRecord: (recordId: string, days?: number) => Promise<void>;
  removeRecordsByKnowledgeId: (knowledgeItemId: string) => void;

  getRecordByKnowledgeId: (knowledgeItemId: string) => TrainingRecord | undefined;
  getTodayBoard: () => TrainingRecord[];
  getArchiveByDate: () => { date: string; records: TrainingRecord[] }[];
  getRecordsForDate: (dateStr: string) => TrainingRecord[];
}

export const useExpressionStore = create<ExpressionState>((set, get) => ({
  records: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    const records = await expressionRepo.getAllTrainingRecords();

    // Auto-create training records for confirmed items that don't have one yet
    try {
      const { useKnowledgeStore } = require('./useKnowledgeStore');
      const knowledgeState = useKnowledgeStore.getState();
      const confirmedItems = knowledgeState.items.filter((i: any) => i.status === 'confirmed');
      const recordItemIds = new Set(records.map((r: TrainingRecord) => r.knowledgeItemId));
      const missing = confirmedItems.filter((it: any) => !recordItemIds.has(it.id));

      if (missing.length > 0) {
        const now = getNowStr();
        for (const item of missing) {
          const record: TrainingRecord = {
            id: generateId(),
            knowledgeItemId: item.id,
            state: 'pending_retell',
            attempts: [],
            priority: 1.0,
            nextReviewAt: item.createdAt || now,
            createdAt: item.createdAt || now,
            updatedAt: now,
          };
          await expressionRepo.insertTrainingRecord(record);
          records.push(record);
        }
      }
    } catch {}

    set({ records, loading: false });
  },

  loadTodayBoard: async () => {
    set({ loading: true });
    const todayStr = getTodayStr();
    const records = await expressionRepo.getTodayTrainingRecords(todayStr);
    set({ records, loading: false });
  },

  createRecord: async (knowledgeItemId) => {
    // Guard: never create duplicates — one record per knowledge item
    const existing = get().records.find((r) => r.knowledgeItemId === knowledgeItemId);
    if (existing) return existing;

    const now = getNowStr();
    const record: TrainingRecord = {
      id: generateId(),
      knowledgeItemId,
      state: 'pending_retell',
      attempts: [],
      priority: 1.0,
      nextReviewAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await expressionRepo.insertTrainingRecord(record);
    set((s) => ({ records: [record, ...s.records] }));
    return record;
  },

  submitAttempt: async (recordId, transcription) => {
    const record = get().records.find((r) => r.id === recordId);
    if (!record) throw new Error('Record not found');

    const attempt: TrainingAttempt = {
      id: generateId(),
      timestamp: getNowStr(),
      transcription,
      attemptNumber: record.attempts.length + 1,
      appealSubmitted: false,
    };

    const updatedAttempts = [...record.attempts, attempt];
    const updatedRecord = {
      ...record,
      attempts: updatedAttempts,
      updatedAt: getNowStr(),
    };

    await expressionRepo.updateTrainingRecord(updatedRecord);
    set((s) => ({
      records: s.records.map((r) => (r.id === recordId ? updatedRecord : r)),
    }));

    return attempt;
  },

  receiveFeedback: async (recordId, attemptId, feedback, score, passThreshold) => {
    const record = get().records.find((r) => r.id === recordId);
    if (!record) return;

    const attempts = record.attempts.map((a) =>
      a.id === attemptId
        ? { ...a, feedback, score }
        : a
    );

    // 不再自动改状态 — 由 finishSession 手动触发
    const bestScore = record.bestScore
      ? Math.max(record.bestScore, score)
      : score;

    const { interval } = calculateNextInterval(
      SM2_DEFAULTS.initialInterval,
      SM2_DEFAULTS.initialEaseFactor,
      score
    );

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    const priority = calculatePriority(0, score, interval);

    const updatedRecord = {
      ...record,
      currentScore: score,
      bestScore,
      priority,
      nextReviewAt: nextReviewDate.toISOString(),
      attempts,
      updatedAt: getNowStr(),
    };

    await expressionRepo.updateTrainingRecord(updatedRecord);
    set((s) => ({
      records: s.records.map((r) => (r.id === recordId ? updatedRecord : r)),
    }));
  },

  submitAppeal: async (recordId, attemptId) => {
    const record = get().records.find((r) => r.id === recordId);
    if (!record) return;

    const attempts = record.attempts.map((a) =>
      a.id === attemptId ? { ...a, appealSubmitted: true } : a
    );

    const updatedRecord = { ...record, attempts, updatedAt: getNowStr() };
    await expressionRepo.updateTrainingRecord(updatedRecord);
    set((s) => ({
      records: s.records.map((r) => (r.id === recordId ? updatedRecord : r)),
    }));
  },

  submitSatisfaction: async (recordId, attemptId, satisfaction, comment) => {
    const record = get().records.find((r) => r.id === recordId);
    if (!record) return;

    const attempts = record.attempts.map((a) =>
      a.id === attemptId ? { ...a, satisfaction, satisfactionComment: comment } : a
    );

    const updatedRecord = { ...record, attempts, updatedAt: getNowStr() };
    await expressionRepo.updateTrainingRecord(updatedRecord);
    set((s) => ({
      records: s.records.map((r) => (r.id === recordId ? updatedRecord : r)),
    }));
  },

  finishSession: async (recordId) => {
    const record = get().records.find((r) => r.id === recordId);
    if (!record) return;

    let newState: TrainingState = record.state;
    if (record.state === 'pending_retell') {
      newState = 'retold';
    } else if (record.state === 'pending_restate') {
      newState = 'restated';
    }

    const updatedRecord = { ...record, state: newState, updatedAt: getNowStr() };
    await expressionRepo.updateTrainingRecord(updatedRecord);
    set((s) => ({
      records: s.records.map((r) => (r.id === recordId ? updatedRecord : r)),
    }));
  },

  deferRecord: async (recordId, days = 1) => {
    const record = get().records.find((r) => r.id === recordId);
    if (!record) return;

    const nextDate = new Date(record.nextReviewAt);
    nextDate.setDate(nextDate.getDate() + days);

    const updatedRecord = {
      ...record,
      nextReviewAt: nextDate.toISOString(),
      updatedAt: getNowStr(),
    };
    await expressionRepo.updateTrainingRecord(updatedRecord);
    set((s) => ({
      records: s.records.map((r) => (r.id === recordId ? updatedRecord : r)),
    }));
  },

  removeRecordsByKnowledgeId: (knowledgeItemId) => {
    expressionRepo.deleteTrainingRecordByKnowledgeId(knowledgeItemId).catch(() => {});
    set((s) => ({
      records: s.records.filter((r) => r.knowledgeItemId !== knowledgeItemId),
    }));
  },

  getRecordByKnowledgeId: (knowledgeItemId) =>
    get().records.find((r) => r.knowledgeItemId === knowledgeItemId),

  getTodayBoard: () => {
    return [...get().records].sort((a, b) => {
      const stateOrder: Record<TrainingState, number> = {
        pending_retell: 0,
        pending_restate: 1,
        restated: 2,
        retold: 3,
      };
      const orderDiff = stateOrder[a.state] - stateOrder[b.state];
      if (orderDiff !== 0) return orderDiff;
      return b.priority - a.priority;
    });
  },

  getArchiveByDate: () => {
    const groups = new Map<string, TrainingRecord[]>();
    for (const record of get().records) {
      // We need the knowledge item's creation date. Here we group by record creation.
      const date = record.createdAt.slice(0, 10);
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date)!.push(record);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, records]) => ({ date, records }));
  },

  getRecordsForDate: (dateStr) =>
    get().records.filter((r) => r.createdAt.startsWith(dateStr)),
}));
