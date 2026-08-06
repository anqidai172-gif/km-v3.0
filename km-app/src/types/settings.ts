import type { KnowledgeCategory } from './knowledge';

export interface UserSettings {
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  passThreshold: number;
  categories: KnowledgeCategory[];
  aiBaseURL: string;
  aiModel: string;
  aiApiKey: string;
  videoServerURL: string;
  // ASR 引擎配置
  asrProvider: string;           // 'local_whisper' | 'tencent' | 'aliyun' | 'xunfei'
  asrWhisperModel: string;      // 'tiny' | 'small' | 'medium'
  asrTencentSecretId: string;
  asrTencentSecretKey: string;
  asrAliyunAppKey: string;
  asrAliyunAccessToken: string;
  asrXunfeiAppId: string;
  asrXunfeiApiKey: string;
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
