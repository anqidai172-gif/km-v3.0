import { calculatePriority, calculateNextInterval } from '../../utils/priority';
import { SM2_DEFAULTS } from '../../utils/constants';
import type { TrainingRecord, TrainingState } from '../../types';
import { getTodayStr } from '../../utils/date';

export interface ScheduleResult {
  newState: TrainingState;
  nextInterval: number;
  nextReviewDate: Date;
  priority: number;
  easeFactor: number;
}

export function computeSchedule(
  score: number,
  passThreshold: number,
  currentState: TrainingState,
  daysSinceLastReview: number = 0,
  currentInterval: number = SM2_DEFAULTS.initialInterval,
  currentEaseFactor: number = SM2_DEFAULTS.initialEaseFactor,
): ScheduleResult {
  const { interval, easeFactor } = calculateNextInterval(
    currentInterval,
    currentEaseFactor,
    score,
  );

  let newState: TrainingState;

  if (score >= passThreshold) {
    if (currentState === 'pending_retell') {
      newState = 'retold';
    } else if (currentState === 'pending_restate') {
      newState = 'restated';
    } else if (currentState === 'retold') {
      newState = 'retold';
    } else {
      newState = 'restated';
    }
  } else {
    // Score below threshold — needs restudy
    if (currentState === 'pending_retell' || currentState === 'retold') {
      newState = 'pending_restate';
    } else {
      newState = 'pending_restate';
    }
  }

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  const priority = calculatePriority(daysSinceLastReview, score, interval);

  return {
    newState,
    nextInterval: interval,
    nextReviewDate,
    priority,
    easeFactor,
  };
}

export function getDueRecords(records: TrainingRecord[]): TrainingRecord[] {
  const now = new Date();
  return records.filter((r) => new Date(r.nextReviewAt) <= now);
}

export function getTodayNewRecords(records: TrainingRecord[], todayStr: string): TrainingRecord[] {
  return records.filter((r) => r.createdAt.startsWith(todayStr));
}

export function sortByPriority(records: TrainingRecord[]): TrainingRecord[] {
  return [...records].sort((a, b) => b.priority - a.priority);
}

export function getStateOrder(state: TrainingState): number {
  const order: Record<TrainingState, number> = {
    pending_retell: 0,
    pending_restate: 1,
    restated: 2,
    retold: 3,
  };
  return order[state];
}
