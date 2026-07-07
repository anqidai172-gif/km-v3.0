import { getDatabase } from '../index';
import type { TrainingRecord, TrainingAttempt, TrainingState } from '../../types';

interface TrainingRow {
  id: string;
  knowledge_item_id: string;
  state: string;
  current_score: number | null;
  best_score: number | null;
  priority: number;
  next_review_at: string;
  attempts_json: string;
  created_at: string;
  updated_at: string;
}

function rowToRecord(row: TrainingRow): TrainingRecord {
  return {
    id: row.id,
    knowledgeItemId: row.knowledge_item_id,
    state: row.state as TrainingState,
    currentScore: row.current_score ?? undefined,
    bestScore: row.best_score ?? undefined,
    priority: row.priority,
    nextReviewAt: row.next_review_at,
    attempts: JSON.parse(row.attempts_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllTrainingRecords(): Promise<TrainingRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TrainingRow>('SELECT * FROM training_records ORDER BY priority DESC');
  return rows.map(rowToRecord);
}

export async function getTrainingRecordsByState(state: TrainingState): Promise<TrainingRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TrainingRow>(
    'SELECT * FROM training_records WHERE state = ? ORDER BY priority DESC',
    [state]
  );
  return rows.map(rowToRecord);
}

export async function getTodayTrainingRecords(todayStr: string): Promise<TrainingRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TrainingRow>(
    `SELECT tr.* FROM training_records tr
     INNER JOIN knowledge_items ki ON tr.knowledge_item_id = ki.id
     WHERE (DATE(ki.created_at) = ? AND tr.state IN ('pending_retell', 'retold'))
        OR (DATE(ki.created_at) != ? AND tr.state IN ('pending_restate', 'restated'))
        OR tr.next_review_at <= datetime('now')
     ORDER BY tr.priority DESC`,
    [todayStr, todayStr]
  );
  return rows.map(rowToRecord);
}

export async function getTrainingRecordByKnowledgeId(knowledgeItemId: string): Promise<TrainingRecord | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<TrainingRow>(
    'SELECT * FROM training_records WHERE knowledge_item_id = ?',
    [knowledgeItemId]
  );
  return row ? rowToRecord(row) : null;
}

export async function getTrainingRecordById(id: string): Promise<TrainingRecord | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<TrainingRow>(
    'SELECT * FROM training_records WHERE id = ?',
    [id]
  );
  return row ? rowToRecord(row) : null;
}

export async function insertTrainingRecord(record: TrainingRecord): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO training_records (id, knowledge_item_id, state, current_score, best_score, priority, next_review_at, attempts_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id, record.knowledgeItemId, record.state,
      record.currentScore ?? null, record.bestScore ?? null,
      record.priority, record.nextReviewAt,
      JSON.stringify(record.attempts),
      record.createdAt, record.updatedAt,
    ]
  );
}

export async function updateTrainingRecord(record: TrainingRecord): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE training_records SET state=?, current_score=?, best_score=?, priority=?, next_review_at=?, attempts_json=?, updated_at=?
     WHERE id=?`,
    [
      record.state, record.currentScore ?? null, record.bestScore ?? null,
      record.priority, record.nextReviewAt,
      JSON.stringify(record.attempts),
      record.updatedAt, record.id,
    ]
  );
}

export async function getArchiveByDate(): Promise<{ date: string; records: TrainingRecord[] }[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ created_date: string }>(
    `SELECT DISTINCT DATE(ki.created_at) as created_date
     FROM training_records tr
     INNER JOIN knowledge_items ki ON tr.knowledge_item_id = ki.id
     ORDER BY created_date DESC`
  );

  const result: { date: string; records: TrainingRecord[] }[] = [];
  for (const row of rows) {
    const records = await db.getAllAsync<TrainingRow>(
      `SELECT tr.* FROM training_records tr
       INNER JOIN knowledge_items ki ON tr.knowledge_item_id = ki.id
       WHERE DATE(ki.created_at) = ?
       ORDER BY tr.priority DESC`,
      [row.created_date]
    );
    result.push({
      date: row.created_date,
      records: records.map(rowToRecord),
    });
  }
  return result;
}

export async function getTrainingRecordsForDate(dateStr: string): Promise<TrainingRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<TrainingRow>(
    `SELECT tr.* FROM training_records tr
     INNER JOIN knowledge_items ki ON tr.knowledge_item_id = ki.id
     WHERE DATE(ki.created_at) = ?
     ORDER BY tr.priority DESC`,
    [dateStr]
  );
  return rows.map(rowToRecord);
}
