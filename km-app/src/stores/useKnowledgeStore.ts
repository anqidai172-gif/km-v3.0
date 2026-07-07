import { create } from 'zustand';
import type { KnowledgeItem, KnowledgeCategory } from '../types';
import * as knowledgeRepo from '../db/repositories/knowledgeRepo';
import { generateId } from '../utils/id';

interface KnowledgeState {
  items: KnowledgeItem[];
  categories: KnowledgeCategory[];
  loading: boolean;

  loadAll: () => Promise<void>;
  loadCategories: () => Promise<void>;

  addItem: (item: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<KnowledgeItem>;
  updateItem: (id: string, updates: Partial<KnowledgeItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  confirmItem: (id: string) => Promise<void>;

  addCategory: (cat: Omit<KnowledgeCategory, 'id' | 'createdAt' | 'updatedAt'>) => Promise<KnowledgeCategory>;
  updateCategory: (id: string, updates: Partial<KnowledgeCategory>) => Promise<void>;

  getItemById: (id: string) => KnowledgeItem | undefined;
  getItemsByCategory: (categoryId: string) => KnowledgeItem[];
  getItemsByDate: (dateStr: string) => KnowledgeItem[];
  getConfirmedItems: () => KnowledgeItem[];
  getItemDates: () => string[];
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  items: [],
  categories: [],
  loading: false,

  loadAll: async () => {
    set({ loading: true });
    const [items, categories] = await Promise.all([
      knowledgeRepo.getAllKnowledgeItems(),
      knowledgeRepo.getCategories(),
    ]);
    set({ items, categories, loading: false });
  },

  loadCategories: async () => {
    const categories = await knowledgeRepo.getCategories();
    set({ categories });
  },

  addItem: async (input) => {
    const now = new Date().toISOString();
    const item: KnowledgeItem = {
      ...input,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    await knowledgeRepo.insertKnowledgeItem(item);
    set((s) => ({ items: [item, ...s.items] }));
    return item;
  },

  updateItem: async (id, updates) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    const updated = { ...item, ...updates, updatedAt: new Date().toISOString() };
    await knowledgeRepo.updateKnowledgeItem(updated);
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? updated : i)),
    }));
  },

  deleteItem: async (id) => {
    await knowledgeRepo.deleteKnowledgeItem(id);
    set((s) => ({
      items: s.items.filter((i) => i.id !== id),
    }));
  },

  confirmItem: async (id) => {
    await get().updateItem(id, { status: 'confirmed' });
  },

  addCategory: async (input) => {
    const now = new Date().toISOString();
    const cat: KnowledgeCategory = {
      ...input,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    await knowledgeRepo.insertCategory(cat);
    set((s) => ({ categories: [...s.categories, cat] }));
    return cat;
  },

  updateCategory: async (id, updates) => {
    const cat = get().categories.find((c) => c.id === id);
    if (!cat) return;
    const updated = { ...cat, ...updates, updatedAt: new Date().toISOString() };
    await knowledgeRepo.updateCategory(updated);
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? updated : c)),
    }));
  },

  getItemById: (id) => get().items.find((i) => i.id === id),

  getItemsByCategory: (categoryId) =>
    get().items.filter((i) => i.categoryId === categoryId),

  getItemsByDate: (dateStr) =>
    get().items.filter((i) => i.createdAt.startsWith(dateStr)),

  getConfirmedItems: () =>
    get().items.filter((i) => i.status === 'confirmed'),

  getItemDates: () => {
    const dates = new Set<string>();
    get().items.forEach((i) => {
      dates.add(i.createdAt.slice(0, 10));
    });
    return Array.from(dates).sort().reverse();
  },
}));
