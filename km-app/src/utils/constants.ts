export const PRIORITY_WEIGHTS = {
  urgency: 0.4,
  difficulty: 0.3,
  staleness: 0.3,
};

export const SM2_DEFAULTS = {
  initialEaseFactor: 2.5,
  easeFactorAdjustment: 0.15,
  minEaseFactor: 1.3,
  initialInterval: 1,
  maxInterval: 365,
};

export const TRAINING = {
  defaultPassThreshold: 90,
  minThreshold: 60,
  maxThreshold: 100,
  thresholdStep: 5,
};

export const CATEGORY = {
  maxVisibleTabs: 3,
  defaultColor: '#4A90D9',
};

export const AI = {
  maxContentLength: 2000,
  apiRateLimitMs: 3000,
};

export const STORAGE = {
  contentPreviewLength: 150,
};
