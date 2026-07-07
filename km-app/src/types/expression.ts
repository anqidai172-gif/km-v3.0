export type TrainingState =
  | 'pending_retell'
  | 'retold'
  | 'pending_restate'
  | 'restated';

export interface AIFeedback {
  accuracyScore: number;
  fluencyScore: number;
  overallScore: number;
  comparison: string;
  rootCause: string;
  expressionTips: string;
  optimalExpression: string;
  suggestions: string[];
  modelUsed: string;
}

export interface TrainingAttempt {
  id: string;
  timestamp: string;
  audioRecordingPath?: string;
  transcription: string;
  feedback?: AIFeedback;
  score?: number;
  satisfaction?: 'thumbs_up' | 'thumbs_down';
  satisfactionComment?: string;
  appealSubmitted: boolean;
  attemptNumber: number;
}

export interface TrainingRecord {
  id: string;
  knowledgeItemId: string;
  state: TrainingState;
  attempts: TrainingAttempt[];
  currentScore?: number;
  bestScore?: number;
  priority: number;
  nextReviewAt: string;
  createdAt: string;
  updatedAt: string;
}
