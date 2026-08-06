import { getDatabase } from '../index';
import type { KnowledgeItem, KnowledgeCategory, VerificationResult } from '../../types';

export interface KnowledgeRow {
  id: string;
  category_id: string;
  sub_category_id: string | null;
  title: string;
  content: string;
  content_preview: string;
  source_url: string | null;
  source_type: string;
  tags_json: string;
  embedding_pq_json: string | null;
  ai_summary: string | null;
  ai_classification_score: number | null;
  ai_verification_json: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

function rowToItem(row: KnowledgeRow): KnowledgeItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    subCategoryId: row.sub_category_id ?? undefined,
    title: row.title,
    content: row.content,
    contentPreview: row.content_preview,
    sourceURL: row.source_url ?? undefined,
    sourceType: row.source_type as KnowledgeItem['sourceType'],
    tags: JSON.parse(row.tags_json),
    embeddingPQ: row.embedding_pq_json ? JSON.parse(row.embedding_pq_json) : undefined,
    aiSummary: row.ai_summary ?? undefined,
    aiClassificationScore: row.ai_classification_score ?? undefined,
    aiVerificationResult: row.ai_verification_json
      ? JSON.parse(row.ai_verification_json) as VerificationResult
      : undefined,
    status: row.status as KnowledgeItem['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllKnowledgeItems(): Promise<KnowledgeItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<KnowledgeRow>(
    'SELECT * FROM knowledge_items ORDER BY created_at DESC'
  );
  return rows.map(rowToItem);
}

export async function getKnowledgeItemsByStatus(status: string): Promise<KnowledgeItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<KnowledgeRow>(
    'SELECT * FROM knowledge_items WHERE status = ? ORDER BY created_at DESC',
    [status]
  );
  return rows.map(rowToItem);
}

export async function getKnowledgeItemsByCategory(categoryId: string): Promise<KnowledgeItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<KnowledgeRow>(
    'SELECT * FROM knowledge_items WHERE category_id = ? ORDER BY created_at DESC',
    [categoryId]
  );
  return rows.map(rowToItem);
}

export async function getKnowledgeItemsByDate(dateStr: string): Promise<KnowledgeItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<KnowledgeRow>(
    "SELECT * FROM knowledge_items WHERE DATE(created_at) = ? ORDER BY created_at DESC",
    [dateStr]
  );
  return rows.map(rowToItem);
}

export async function getKnowledgeItemById(id: string): Promise<KnowledgeItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<KnowledgeRow>(
    'SELECT * FROM knowledge_items WHERE id = ?',
    [id]
  );
  return row ? rowToItem(row) : null;
}

export async function insertKnowledgeItem(item: KnowledgeItem): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO knowledge_items (id, category_id, sub_category_id, title, content, content_preview, source_url, source_type, tags_json, embedding_pq_json, ai_summary, ai_classification_score, ai_verification_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id, item.categoryId, item.subCategoryId ?? null, item.title, item.content, item.contentPreview,
      item.sourceURL ?? null, item.sourceType, JSON.stringify(item.tags),
      item.embeddingPQ ? JSON.stringify(item.embeddingPQ) : null,
      item.aiSummary ?? null, item.aiClassificationScore ?? null,
      item.aiVerificationResult ? JSON.stringify(item.aiVerificationResult) : null,
      item.status, item.createdAt, item.updatedAt,
    ]
  );
}

export async function updateKnowledgeItem(item: KnowledgeItem): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE knowledge_items SET category_id=?, sub_category_id=?, title=?, content=?, content_preview=?, source_url=?, source_type=?, tags_json=?, embedding_pq_json=?, ai_summary=?, ai_classification_score=?, ai_verification_json=?, status=?, updated_at=?
     WHERE id=?`,
    [
      item.categoryId, item.subCategoryId ?? null, item.title, item.content, item.contentPreview,
      item.sourceURL ?? null, item.sourceType, JSON.stringify(item.tags),
      item.embeddingPQ ? JSON.stringify(item.embeddingPQ) : null,
      item.aiSummary ?? null, item.aiClassificationScore ?? null,
      item.aiVerificationResult ? JSON.stringify(item.aiVerificationResult) : null,
      item.status, item.updatedAt, item.id,
    ]
  );
}

export async function deleteKnowledgeItem(id: string): Promise<void> {
  const db = await getDatabase();
  // Cascade: delete related training records and graph edges first
  await db.runAsync('DELETE FROM training_records WHERE knowledge_item_id = ?', [id]);
  await db.runAsync('DELETE FROM graph_edges WHERE source_id = ? OR target_id = ?', [id, id]);
  await db.runAsync('DELETE FROM knowledge_items WHERE id = ?', [id]);
}

export async function getKnowledgeItemDates(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ created_date: string }>(
    'SELECT DISTINCT DATE(created_at) as created_date FROM knowledge_items ORDER BY created_date DESC'
  );
  return rows.map(r => r.created_date);
}

export async function getCategories(): Promise<KnowledgeCategory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC'
  );
  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    sortOrder: r.sort_order,
    isActive: !!r.is_active,
    parentId: r.parent_id ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function insertCategory(cat: KnowledgeCategory): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO categories (id, name, color, sort_order, is_active, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [cat.id, cat.name, cat.color, cat.sortOrder, cat.isActive ? 1 : 0, cat.parentId ?? null, cat.createdAt, cat.updatedAt]
  );
}

export async function updateCategory(cat: KnowledgeCategory): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE categories SET name=?, color=?, sort_order=?, is_active=?, parent_id=?, updated_at=? WHERE id=?',
    [cat.name, cat.color, cat.sortOrder, cat.isActive ? 1 : 0, cat.parentId ?? null, cat.updatedAt, cat.id]
  );
}

export async function getParentCategories(): Promise<KnowledgeCategory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM categories WHERE parent_id IS NULL AND is_active = 1 ORDER BY sort_order ASC'
  );
  return rows.map((r: any) => ({
    id: r.id, name: r.name, color: r.color,
    sortOrder: r.sort_order, isActive: !!r.is_active,
    parentId: r.parent_id ?? undefined,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));
}

export async function getChildCategories(parentId: string): Promise<KnowledgeCategory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM categories WHERE parent_id = ? AND is_active = 1 ORDER BY sort_order ASC',
    [parentId]
  );
  return rows.map((r: any) => ({
    id: r.id, name: r.name, color: r.color,
    sortOrder: r.sort_order, isActive: !!r.is_active,
    parentId: r.parent_id ?? undefined,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM categories WHERE id=?', [id]);
}

export async function reassignCategoryItems(fromCatId: string, toCatId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE knowledge_items SET category_id=? WHERE category_id=?',
    [toCatId, fromCatId]
  );
}

export async function getConfirmedKnowledgeCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM knowledge_items WHERE status = 'confirmed'"
  );
  return row?.count ?? 0;
}

export async function getCategoryKnowledgeCounts(dateStr?: string): Promise<{ categoryId: string; count: number }[]> {
  const db = await getDatabase();
  let query = 'SELECT category_id, COUNT(*) as count FROM knowledge_items';
  const params: string[] = [];
  if (dateStr) {
    query += ' WHERE DATE(created_at) = ?';
    params.push(dateStr);
  }
  query += ' GROUP BY category_id ORDER BY count DESC';
  const rows = await db.getAllAsync<{ category_id: string; count: number }>(query, params);
  return rows.map(r => ({ categoryId: r.category_id, count: r.count }));
}
