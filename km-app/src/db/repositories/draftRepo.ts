import { getDatabase } from '../index';
import type { InputDraft, ParseResult } from '../../types';

interface DraftRow {
  id: string;
  input_type: string;
  raw_input: string;
  status: string;
  parse_result_json: string | null;
  confirmed_item_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToDraft(row: DraftRow): InputDraft {
  return {
    id: row.id,
    inputType: row.input_type as InputDraft['inputType'],
    rawInput: row.raw_input,
    status: row.status as InputDraft['status'],
    parseResult: row.parse_result_json ? JSON.parse(row.parse_result_json) as ParseResult : undefined,
    confirmedKnowledgeItemId: row.confirmed_item_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllDrafts(): Promise<InputDraft[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DraftRow>('SELECT * FROM input_drafts ORDER BY created_at DESC');
  return rows.map(rowToDraft);
}

export async function getDraftsByStatus(status: string): Promise<InputDraft[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DraftRow>(
    'SELECT * FROM input_drafts WHERE status = ? ORDER BY created_at DESC',
    [status]
  );
  return rows.map(rowToDraft);
}

export async function getDraftsByDate(dateStr: string): Promise<InputDraft[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DraftRow>(
    "SELECT * FROM input_drafts WHERE DATE(created_at) = ? ORDER BY created_at DESC",
    [dateStr]
  );
  return rows.map(rowToDraft);
}

export async function getDraftById(id: string): Promise<InputDraft | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<DraftRow>(
    'SELECT * FROM input_drafts WHERE id = ?',
    [id]
  );
  return row ? rowToDraft(row) : null;
}

export async function insertDraft(draft: InputDraft): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO input_drafts (id, input_type, raw_input, status, parse_result_json, confirmed_item_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      draft.id, draft.inputType, draft.rawInput, draft.status,
      draft.parseResult ? JSON.stringify(draft.parseResult) : null,
      draft.confirmedKnowledgeItemId ?? null,
      draft.createdAt, draft.updatedAt,
    ]
  );
}

export async function updateDraft(draft: InputDraft): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE input_drafts SET status=?, parse_result_json=?, confirmed_item_id=?, updated_at=? WHERE id=?`,
    [
      draft.status,
      draft.parseResult ? JSON.stringify(draft.parseResult) : null,
      draft.confirmedKnowledgeItemId ?? null,
      draft.updatedAt, draft.id,
    ]
  );
}

export async function deleteDraft(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM input_drafts WHERE id = ?', [id]);
}

/** 批量删除指定状态的草稿（如清理调试产生的待入库记录） */
export async function deleteDraftsByStatus(status: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync('DELETE FROM input_drafts WHERE status = ?', [status]);
  return result.changes ?? 0;
}
