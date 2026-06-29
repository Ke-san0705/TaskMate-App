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

async function runStatements(db, statements) {
  for (const statement of statements) {
    await run(db, statement);
  }
}

async function ensureColumn(db, tableName, columnName, definition) {
  const columns = await getAll(db, `PRAGMA table_info(${tableName})`);
  if (!columns.some((column) => column.name === columnName)) {
    await run(db, `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function applySchemaV1(db) {
  await runStatements(db, [
    `CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS tasks (
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
    )`,
    'CREATE INDEX IF NOT EXISTS idx_tasks_date_time ON tasks(date, time)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed)',
    `CREATE TABLE IF NOT EXISTS notification_schedules (
      signature TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      notification_id TEXT NOT NULL,
      type TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      scheduled_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_notification_schedules_task_id
      ON notification_schedules(task_id)`
  ]);

  await run(db, 'INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)', [
    'schemaVersion',
    '1'
  ]);
  log('Migration', 'schema v1 applied');
}

async function applySchemaV2(db) {
  await ensureColumn(db, 'tasks', 'source', "TEXT NOT NULL DEFAULT 'manual'");
  await ensureColumn(db, 'tasks', 'project_task_id', 'TEXT');
  await ensureColumn(db, 'tasks', 'project_id', 'TEXT');
  await ensureColumn(db, 'tasks', 'project_name', 'TEXT');

  await runStatements(db, [
    'CREATE INDEX IF NOT EXISTS idx_tasks_project_task_id ON tasks(project_task_id)',
    `CREATE TABLE IF NOT EXISTS project_categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      category_id TEXT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      start_date TEXT,
      deadline TEXT,
      status TEXT NOT NULL DEFAULT 'not_started',
      priority TEXT NOT NULL DEFAULT 'medium',
      progress INTEGER NOT NULL DEFAULT 0,
      estimated_total_minutes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)',
    'CREATE INDEX IF NOT EXISTS idx_projects_deadline ON projects(deadline)',
    `CREATE TABLE IF NOT EXISTS project_milestones (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      deadline TEXT,
      status TEXT NOT NULL DEFAULT 'not_started',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id ON project_milestones(project_id)',
    `CREATE TABLE IF NOT EXISTS project_tasks (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      milestone_id TEXT,
      normal_task_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      start_date TEXT,
      deadline TEXT,
      time TEXT,
      scheduled_date TEXT,
      estimated_minutes INTEGER NOT NULL DEFAULT 30,
      importance INTEGER NOT NULL DEFAULT 3,
      difficulty INTEGER NOT NULL DEFAULT 3,
      progress INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'not_started',
      dependency_task_ids TEXT NOT NULL DEFAULT '[]',
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_project_tasks_milestone_id ON project_tasks(milestone_id)',
    'CREATE INDEX IF NOT EXISTS idx_project_tasks_normal_task_id ON project_tasks(normal_task_id)',
    'CREATE INDEX IF NOT EXISTS idx_project_tasks_deadline ON project_tasks(deadline)',
    'CREATE INDEX IF NOT EXISTS idx_project_tasks_deadline_time ON project_tasks(deadline, time)'
  ]);

  const now = new Date().toISOString();
  const existing = await getFirst(db, 'SELECT id FROM project_categories LIMIT 1');
  if (!existing) {
    const categories = [
      ['category-study', '学習', '授業、試験、資格学習など'],
      ['category-research', '研究', '研究テーマ、調査、発表準備など'],
      ['category-activity', '部活・活動', '練習、大会準備、チーム活動など'],
      ['category-personal', '個人開発', '制作、検証、改善タスクなど'],
      ['category-event', 'イベント', '行事、発表会、交流会などの準備'],
      ['category-other', 'その他', '分類に迷う長期プロジェクト']
    ];
    for (const [id, name, description] of categories) {
      await run(
        db,
        `INSERT INTO project_categories
          (id, name, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, name, description, now, now]
      );
    }
  }

  await run(db, 'INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)', [
    'schemaVersion',
    '2'
  ]);
  log('Migration', 'schema v2 applied');
}

async function applySchemaV3(db) {
  await ensureColumn(db, 'project_tasks', 'time', 'TEXT');
  await run(
    db,
    'CREATE INDEX IF NOT EXISTS idx_project_tasks_deadline_time ON project_tasks(deadline, time)'
  );

  await run(db, 'INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)', [
    'schemaVersion',
    '3'
  ]);
  log('Migration', 'schema v3 applied');
}

async function initializeDatabase() {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await run(db, 'PRAGMA journal_mode = WAL');

  // Keep migrations idempotent and sequential. Expo SQLite can reject rollback
  // when multi-statement execAsync calls are nested inside transactions.
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    )`
  );

  const row = await getFirst(db, 'SELECT value FROM schema_meta WHERE key = ?', [
    'schemaVersion'
  ]);
  let version = Number(row?.value || 0);
  if (version < 1) {
    await applySchemaV1(db);
    version = 1;
  }
  if (version < 2) {
    await applySchemaV2(db);
    version = 2;
  }
  if (version < 3) {
    await applySchemaV3(db);
    version = 3;
  }

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
  await runStatements(db, [
    'DELETE FROM notification_schedules',
    'DELETE FROM project_tasks',
    'DELETE FROM project_milestones',
    'DELETE FROM projects',
    'DELETE FROM tasks'
  ]);
}

module.exports = {
  clearDatabaseForReset,
  getAll,
  getDatabase,
  getFirst,
  run,
  runStatements
};
