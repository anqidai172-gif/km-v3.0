import { PRIORITY_WEIGHTS, SM2_DEFAULTS } from './constants';

export function calculatePriority(
  daysSinceLastReview: number,
  averageScore: number | undefined,
  daysUntilNextReview: number,
): number {
  const urgency = Math.exp(-daysUntilNextReview / 7);
  const difficulty = averageScore ? 1 - averageScore / 100 : 0.5;
  const staleness = Math.min(daysSinceLastReview / 30, 1);

  return (
    PRIORITY_WEIGHTS.urgency * urgency +
    PRIORITY_WEIGHTS.difficulty * difficulty +
    PRIORITY_WEIGHTS.staleness * staleness
  );
}

export function calculateNextInterval(
  currentInterval: number,
  easeFactor: number,
  score: number,
): { interval: number; easeFactor: number } {
  let newEaseFactor = easeFactor;

  if (score >= 85) {
    newEaseFactor += SM2_DEFAULTS.easeFactorAdjustment;
  } else if (score >= 70) {
    newEaseFactor += SM2_DEFAULTS.easeFactorAdjustment * 0.5;
  } else if (score < 60) {
    newEaseFactor -= SM2_DEFAULTS.easeFactorAdjustment;
  }

  newEaseFactor = Math.max(SM2_DEFAULTS.minEaseFactor, newEaseFactor);

  let interval: number;
  if (score >= 85) {
    interval = currentInterval * newEaseFactor;
  } else if (score >= 70) {
    interval = currentInterval * newEaseFactor * 0.8;
  } else if (score >= 60) {
    interval = currentInterval;
  } else {
    interval = 1;
  }

  return {
    interval: Math.min(Math.round(interval), SM2_DEFAULTS.maxInterval),
    easeFactor: newEaseFactor,
  };
}
