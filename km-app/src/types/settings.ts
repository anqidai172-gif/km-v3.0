import type { KnowledgeCategory } from './knowledge';

export interface UserSettings {
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  passThreshold: number;
  categories: KnowledgeCategory[];
}

export interface AIClientConfig {
  provider: 'anthropic' | 'openai';
  apiKey: string;
  model: string;
  baseURL?: string;
}

export interface ParsingRequest {
  inputType: 'url' | 'text';
  content: string;
  targetCategories: { id: string; name: string }[];
}

export interface ScoringRequest {
  originalContent: string;
  userTranscription: string;
  previousFeedback?: string;
  appealReason?: string;
}
