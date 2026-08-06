import * as SQLite from 'expo-sqlite';
import { DB_NAME, CREATE_TABLES_SQL, SCHEMA_VERSION, MIGRATE_V1_TO_V2 } from './schema';

let db: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  // Check current schema version
  let currentVersion = 0;
  try {
    const row = await database.getFirstAsync<{ user_version: number }>(
      'PRAGMA user_version'
    );
    currentVersion = row?.user_version ?? 0;
  } catch {
    // PRAGMA might fail on fresh DB — assume v0
  }

  if (currentVersion < 2) {
    console.log(`[DB] Migrating from v${currentVersion} → v2...`);
    try {
      await database.execAsync(MIGRATE_V1_TO_V2);
      console.log('[DB] Migration to v2 complete');
    } catch (e: any) {
      // If migration fails (e.g. columns already exist from CREATE_TABLES_SQL),
      // just set the version — the schema is already correct
      if (e?.message?.includes('duplicate column')) {
        console.log('[DB] Columns already exist, skipping migration');
      } else {
        console.warn('[DB] Migration error:', e?.message);
      }
      await database.execAsync('PRAGMA user_version = 2');
    }
  }
}

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
      await runMigrations(database);
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
