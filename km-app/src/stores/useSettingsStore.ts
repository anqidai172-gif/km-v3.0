import { create } from 'zustand';
import type { UserSettings, KnowledgeCategory } from '../types';
import * as settingsRepo from '../db/repositories/settingsRepo';
import * as knowledgeRepo from '../db/repositories/knowledgeRepo';
import { TRAINING } from '../utils/constants';
import { configureAIClient } from '../services/ai';
import { setAIConfig } from '../services/ai/aiConfigStore';

function detectProvider(baseURL: string): 'anthropic' | 'openai' {
  if (/anthropic/i.test(baseURL)) return 'anthropic';
  return 'openai'; // OpenAI-compatible for deepseek, qwen, dashscope, etc.
}

interface SettingsState {
  settings: UserSettings;
  loading: boolean;

  load: () => Promise<void>;
  updateReminder: (enabled: boolean, time: string) => Promise<void>;
  updateThreshold: (threshold: number) => Promise<void>;
  updateAIConfig: (baseURL: string, model: string, apiKey: string) => Promise<void>;
  updateVideoServerURL: (url: string) => Promise<void>;
  updateASRConfig: (config: {
    provider?: string;
    whisperModel?: string;
    tencentSecretId?: string;
    tencentSecretKey?: string;
    aliyunAppKey?: string;
    aliyunAccessToken?: string;
    xunfeiAppId?: string;
    xunfeiApiKey?: string;
  }) => Promise<void>;
  loadCategories: () => Promise<void>;
  addCategory: (name: string, color: string) => Promise<KnowledgeCategory>;
  updateCategory: (id: string, name: string, color: string) => Promise<void>;
  saveUserTags: (tags: string[]) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    dailyReminderEnabled: false,
    dailyReminderTime: '09:00',
    passThreshold: TRAINING.defaultPassThreshold,
    categories: [],
    aiBaseURL: 'https://api.anthropic.com',
    aiModel: 'claude-sonnet-4-6',
    aiApiKey: '',
    videoServerURL: '', // 自动发现，不再手动配置
    asrProvider: 'local_whisper',
    asrWhisperModel: 'tiny',
    asrTencentSecretId: '',
    asrTencentSecretKey: '',
    asrAliyunAppKey: '',
    asrAliyunAccessToken: '',
    asrXunfeiAppId: '',
    asrXunfeiApiKey: '',
  },
  loading: false,

  load: async () => {
    set({ loading: true });
    const [rawSettings, categories] = await Promise.all([
      settingsRepo.getSettings(),
      knowledgeRepo.getCategories(),
    ]);

    const aiBaseURL = rawSettings['ai_base_url'] || 'https://api.anthropic.com';
    const aiModel = rawSettings['ai_model'] || 'claude-sonnet-4-6';
    const aiApiKey = rawSettings['ai_api_key'] || '';

    // Sync AI client with loaded settings — without this, every generateFeedback call falls back to mock
    configureAIClient({
      provider: detectProvider(aiBaseURL),
      baseURL: aiBaseURL,
      model: aiModel,
      apiKey: aiApiKey,
    });
    // Also set in the dependency-free config store (read directly by callAI)
    setAIConfig(aiApiKey, aiBaseURL, aiModel);

    set({
      settings: {
        dailyReminderEnabled: rawSettings['daily_reminder_enabled'] === 'true',
        dailyReminderTime: rawSettings['daily_reminder_time'] || '09:00',
        passThreshold: parseInt(rawSettings['pass_threshold'] || String(TRAINING.defaultPassThreshold), 10),
        categories,
        aiBaseURL,
        aiModel,
        aiApiKey,
        // 自动发现的 server 地址缓存（上次成功连接的 IP，下次优先复用）
        videoServerURL: rawSettings['video_server_url'] || '',
        asrProvider: rawSettings['asr_provider'] || 'local_whisper',
        asrWhisperModel: rawSettings['asr_whisper_model'] || 'tiny',
        asrTencentSecretId: rawSettings['asr_tencent_secret_id'] || '',
        asrTencentSecretKey: rawSettings['asr_tencent_secret_key'] || '',
        asrAliyunAppKey: rawSettings['asr_aliyun_app_key'] || '',
        asrAliyunAccessToken: rawSettings['asr_aliyun_access_token'] || '',
        asrXunfeiAppId: rawSettings['asr_xunfei_app_id'] || '',
        asrXunfeiApiKey: rawSettings['asr_xunfei_api_key'] || '',
      },
      loading: false,
    });
  },

  updateReminder: async (enabled, time) => {
    await Promise.all([
      settingsRepo.setSetting('daily_reminder_enabled', String(enabled)),
      settingsRepo.setSetting('daily_reminder_time', time),
    ]);
    set((s) => ({
      settings: {
        ...s.settings,
        dailyReminderEnabled: enabled,
        dailyReminderTime: time,
      },
    }));
  },

  updateThreshold: async (threshold) => {
    await settingsRepo.setSetting('pass_threshold', String(threshold));
    set((s) => ({
      settings: { ...s.settings, passThreshold: threshold },
    }));
  },

  updateAIConfig: async (baseURL, model, apiKey) => {
    await Promise.all([
      settingsRepo.setSetting('ai_base_url', baseURL),
      settingsRepo.setSetting('ai_model', model),
      settingsRepo.setSetting('ai_api_key', apiKey),
    ]);
    // Sync AI client immediately so feedback generation works without restart
    configureAIClient({
      provider: detectProvider(baseURL),
      baseURL,
      model,
      apiKey,
    });
    setAIConfig(apiKey, baseURL, model);
    set((s) => ({
      settings: { ...s.settings, aiBaseURL: baseURL, aiModel: model, aiApiKey: apiKey },
    }));
  },

  updateVideoServerURL: async (url) => {
    await settingsRepo.setSetting('video_server_url', url);
    set((s) => ({
      settings: { ...s.settings, videoServerURL: url },
    }));
  },

  updateASRConfig: async (config: {
    provider?: string;
    whisperModel?: string;
    tencentSecretId?: string;
    tencentSecretKey?: string;
    aliyunAppKey?: string;
    aliyunAccessToken?: string;
    xunfeiAppId?: string;
    xunfeiApiKey?: string;
  }) => {
    const updates: Promise<void>[] = [];
    if (config.provider !== undefined) updates.push(settingsRepo.setSetting('asr_provider', config.provider));
    if (config.whisperModel !== undefined) updates.push(settingsRepo.setSetting('asr_whisper_model', config.whisperModel));
    if (config.tencentSecretId !== undefined) updates.push(settingsRepo.setSetting('asr_tencent_secret_id', config.tencentSecretId.trim()));
    if (config.tencentSecretKey !== undefined) updates.push(settingsRepo.setSetting('asr_tencent_secret_key', config.tencentSecretKey.trim()));
    if (config.aliyunAppKey !== undefined) updates.push(settingsRepo.setSetting('asr_aliyun_app_key', config.aliyunAppKey));
    if (config.aliyunAccessToken !== undefined) updates.push(settingsRepo.setSetting('asr_aliyun_access_token', config.aliyunAccessToken));
    if (config.xunfeiAppId !== undefined) updates.push(settingsRepo.setSetting('asr_xunfei_app_id', config.xunfeiAppId));
    if (config.xunfeiApiKey !== undefined) updates.push(settingsRepo.setSetting('asr_xunfei_api_key', config.xunfeiApiKey));
    await Promise.all(updates);
    set((s) => ({
      settings: { ...s.settings, ...config },
    }));
  },

  loadCategories: async () => {
    const categories = await knowledgeRepo.getCategories();
    set((s) => ({
      settings: { ...s.settings, categories },
    }));
  },

  addCategory: async (name, color) => {
    const now = new Date().toISOString();
    const cat: KnowledgeCategory = {
      id: `cat_${Date.now()}`,
      name,
      color,
      sortOrder: get().settings.categories.length,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    await knowledgeRepo.insertCategory(cat);
    set((s) => ({
      settings: {
        ...s.settings,
        categories: [...s.settings.categories, cat],
      },
    }));
    return cat;
  },

  updateCategory: async (id, name, color) => {
    const cat = get().settings.categories.find((c) => c.id === id);
    if (!cat) return;
    const updated = {
      ...cat,
      name,
      color,
      updatedAt: new Date().toISOString(),
    };
    await knowledgeRepo.updateCategory(updated);
    set((s) => ({
      settings: {
        ...s.settings,
        categories: s.settings.categories.map((c) => (c.id === id ? updated : c)),
      },
    }));
  },

  saveUserTags: async (tags) => {
    await settingsRepo.setSetting('user_tags', JSON.stringify(tags));
  },
}));
