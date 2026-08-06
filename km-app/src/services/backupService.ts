/**
 * 数据备份服务 — 导出/导入全部本地数据
 * Uses expo-file-system new class-based API (SDK 57)
 */
import { File, Paths } from 'expo-file-system';
import * as knowledgeRepo from '../db/repositories/knowledgeRepo';
import * as draftRepo from '../db/repositories/draftRepo';
import * as expressionRepo from '../db/repositories/expressionRepo';
import * as settingsRepo from '../db/repositories/settingsRepo';

export interface BackupData {
  version: 1;
  exportedAt: string;
  knowledgeItems: any[];
  categories: any[];
  drafts: any[];
  trainingRecords: any[];
  settings: Record<string, string>;
}

/** 导出全部数据为 JSON 字符串 */
export async function exportAllData(): Promise<string> {
  const [knowledgeItems, categories, drafts, trainingRecords, settings] = await Promise.all([
    knowledgeRepo.getAllKnowledgeItems(),
    knowledgeRepo.getCategories(),
    draftRepo.getAllDrafts(),
    expressionRepo.getAllTrainingRecords(),
    settingsRepo.getSettings(),
  ]);

  const backup: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    knowledgeItems,
    categories,
    drafts,
    trainingRecords,
    settings,
  };

  return JSON.stringify(backup, null, 2);
}

/** 导出备份 → 写入临时文件 → 系统分享（用户可选择保存到下载/云盘等） */
export async function shareBackup(): Promise<void> {
  const json = await exportAllData();
  const fileName = `知网备份_${new Date().toISOString().slice(0, 10)}.json`;

  const file = new File(Paths.cache, fileName);
  await file.write(json);

  try {
    // Lazy-import Sharing — native module loaded on demand
    const Sharing = await import('expo-sharing');
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: '知网数据备份',
      UTI: 'public.json',
    });
  } catch {
    // Fallback: if native module not available (dev client not rebuilt),
    // the file is still written to cache — tell user to rebuild
    throw new Error(
      '导出功能需要原生模块支持。请用 npx expo run:android 重新构建应用后重试。\n\n' +
      '备份文件已生成于: ' + file.uri,
    );
  }
}

/** 从 JSON 字符串导入数据 */
export async function importData(json: string): Promise<{ imported: number; skipped: number }> {
  let backup: BackupData;
  try {
    backup = JSON.parse(json);
  } catch {
    throw new Error('文件格式无效，无法解析 JSON');
  }

  if (!backup.version || !backup.knowledgeItems) {
    throw new Error('不是有效的知网备份文件');
  }

  let imported = 0;
  let skipped = 0;

  // Import categories first (knowledge items depend on them)
  if (backup.categories?.length) {
    const existing = await knowledgeRepo.getCategories();
    const existingNames = new Set(existing.map((c: any) => c.name));
    for (const cat of backup.categories) {
      if (existingNames.has(cat.name)) { skipped++; continue; }
      await knowledgeRepo.insertCategory(cat);
      imported++;
    }
  }

  // Import knowledge items
  if (backup.knowledgeItems?.length) {
    const existing = await knowledgeRepo.getAllKnowledgeItems();
    const existingIds = new Set(existing.map((i: any) => i.id));
    for (const item of backup.knowledgeItems) {
      if (existingIds.has(item.id)) { skipped++; continue; }
      await knowledgeRepo.insertKnowledgeItem(item);
      imported++;
    }
  }

  // Import drafts
  if (backup.drafts?.length) {
    const existing = await draftRepo.getAllDrafts();
    const existingIds = new Set(existing.map((d: any) => d.id));
    for (const draft of backup.drafts) {
      if (existingIds.has(draft.id)) { skipped++; continue; }
      await draftRepo.insertDraft(draft);
      imported++;
    }
  }

  // Import training records
  if (backup.trainingRecords?.length) {
    const existing = await expressionRepo.getAllTrainingRecords();
    const existingIds = new Set(existing.map((r: any) => r.id));
    for (const record of backup.trainingRecords) {
      if (existingIds.has(record.id)) { skipped++; continue; }
      await expressionRepo.insertTrainingRecord(record);
      imported++;
    }
  }

  // Import settings (only import non-existing keys)
  if (backup.settings) {
    const existing = await settingsRepo.getSettings();
    for (const [key, value] of Object.entries(backup.settings)) {
      if (existing[key] === undefined && value !== undefined) {
        await settingsRepo.setSetting(key, String(value));
      }
    }
  }

  return { imported, skipped };
}

/** 打开文件选择器 → 读取 JSON → 导入 */
export async function pickAndImport(): Promise<{ imported: number; skipped: number }> {
  const result = await File.pickFileAsync({
    mimeTypes: ['application/json'],
  });

  if (result.canceled || !result.result) {
    throw new Error('未选择文件');
  }

  const file = result.result as File;
  const content = await file.text();
  return importData(content);
}
