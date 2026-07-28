import * as SQLite from 'expo-sqlite';
import { DB_NAME, CREATE_TABLES_SQL } from './schema';

let db: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  // Return cached instance immediately if already initialized
  if (db) return db;

  // Use a promise-based mutex to prevent concurrent openDatabaseAsync calls.
  // Without this, multiple store load() calls in the same tick all see `db === null`
  // and each tries to open the database, causing a NullPointerException on Android.
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const database = await SQLite.openDatabaseAsync(DB_NAME);
      await database.execAsync(CREATE_TABLES_SQL);
      db = database;
      return db;
    })();
  }
  return dbInitPromise;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
    dbInitPromise = null;
  }
}

export { CREATE_TABLES_SQL };
