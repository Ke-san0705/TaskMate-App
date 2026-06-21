const SQLite = require('expo-sqlite');
const { DATABASE_NAME } = require('../constants/defaults');
const { log, warn } = require('../utils/logger');

let databasePromise = null;

async function run(db, sql, params = []) {
  return params.length > 0 ? db.runAsync(sql, params) : db.runAsync(sql);
}

async function getFirst(db, sql, params = []) {
  return params.length > 0 ? db.getFirstAsync(sql, params) : db.getFirstAsync(sql);
}

async function getAll(db, sql, params = []) {
  return params.length > 0 ? db.getAllAsync(sql, params) : db.getAllAsync(sql);
}

async function applySchemaV1(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      time TEXT,
      genre TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'normal',
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_date_time ON tasks(date, time);
    CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);

    CREATE TABLE IF NOT EXISTS notification_schedules (
      signature TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      notification_id TEXT NOT NULL,
      type TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      scheduled_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notification_schedules_task_id
      ON notification_schedules(task_id);
  `);
  await run(db, 'INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)', [
    'schemaVersion',
    '1'
  ]);
  log('Migration', 'schema v1 applied');
}

async function initializeDatabase() {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL;');

  // migrationは起動時に一度だけ通します。画面が先にCRUDしないよう、
  // AppProviderはこのPromise完了後に各リポジトリを使います。
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS schema_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    const row = await getFirst(db, 'SELECT value FROM schema_meta WHERE key = ?', [
      'schemaVersion'
    ]);
    const version = Number(row?.value || 0);
    if (version < 1) {
      await applySchemaV1(db);
    }
  });

  log('Database', 'initialized');
  return db;
}

function getDatabase() {
  if (!databasePromise) {
    databasePromise = initializeDatabase().catch((error) => {
      databasePromise = null;
      warn('Database', 'initialization failed', error);
      throw error;
    });
  }
  return databasePromise;
}

async function clearDatabaseForReset() {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM notification_schedules; DELETE FROM tasks;');
  });
}

module.exports = {
  clearDatabaseForReset,
  getAll,
  getDatabase,
  getFirst,
  run
};
