import { create } from 'zustand';
import type { UserSettings, KnowledgeCategory } from '../types';
import * as settingsRepo from '../db/repositories/settingsRepo';
import * as knowledgeRepo from '../db/repositories/knowledgeRepo';
import { TRAINING } from '../utils/constants';

interface SettingsState {
  settings: UserSettings;
  loading: boolean;

  load: () => Promise<void>;
  updateReminder: (enabled: boolean, time: string) => Promise<void>;
  updateThreshold: (threshold: number) => Promise<void>;
  loadCategories: () => Promise<void>;
  addCategory: (name: string, color: string) => Promise<KnowledgeCategory>;
  updateCategory: (id: string, name: string, color: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {
    dailyReminderEnabled: false,
    dailyReminderTime: '09:00',
    passThreshold: TRAINING.defaultPassThreshold,
    categories: [],
  },
  loading: false,

  load: async () => {
    set({ loading: true });
    const [rawSettings, categories] = await Promise.all([
      settingsRepo.getSettings(),
      knowledgeRepo.getCategories(),
    ]);

    set({
      settings: {
        dailyReminderEnabled: rawSettings['daily_reminder_enabled'] === 'true',
        dailyReminderTime: rawSettings['daily_reminder_time'] || '09:00',
        passThreshold: parseInt(rawSettings['pass_threshold'] || String(TRAINING.defaultPassThreshold), 10),
        categories,
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
}));
