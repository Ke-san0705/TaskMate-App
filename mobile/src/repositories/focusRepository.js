const {
  getAll,
  getDatabase,
  getFirst,
  run
} = require('./database');
const { warn } = require('../utils/logger');

const STATE_KEYS = Object.freeze({
  currentTaskId: 'currentTaskId',
  activeSessionId: 'activeSessionId'
});

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function iso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function parseJsonList(value) {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    warn('Focus', 'broken focus json recovered', error);
    return [];
  }
}

function normalizeBlockedApp(app) {
  const packageName =
    typeof app?.packageName === 'string'
      ? app.packageName.trim()
      : typeof app?.package_name === 'string'
        ? app.package_name.trim()
        : '';
  const appName =
    typeof app?.appName === 'string'
      ? app.appName.trim()
      : typeof app?.app_name === 'string'
        ? app.app_name.trim()
        : packageName;
  if (!packageName) {
    return null;
  }
  return {
    packageName,
    appName: appName || packageName
  };
}

function sessionFromRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    startedAt: row.started_at,
    endedAt: row.ended_at || null,
    status: row.status,
    completed: row.completed === 1,
    blockedApps: parseJsonList(row.blocked_apps_json).map(normalizeBlockedApp).filter(Boolean),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function blockedAppFromRow(row) {
  return {
    packageName: row.package_name,
    appName: row.app_name,
    enabled: row.enabled === 1
  };
}

async function readStateValue(db, key) {
  const row = await getFirst(db, 'SELECT value FROM focus_state WHERE key = ?', [key]);
  return row?.value || null;
}

async function writeStateValue(db, key, value) {
  if (value === null || value === undefined || value === '') {
    await run(db, 'DELETE FROM focus_state WHERE key = ?', [key]);
    return;
  }
  await run(db, 'INSERT OR REPLACE INTO focus_state (key, value) VALUES (?, ?)', [
    key,
    String(value)
  ]);
}

async function listBlockedApps() {
  const db = await getDatabase();
  const rows = await getAll(
    db,
    `SELECT package_name, app_name, enabled
       FROM blocked_apps
      ORDER BY app_name COLLATE NOCASE ASC`
  );
  return rows.map(blockedAppFromRow);
}

async function setBlockedApps(apps = [], now = new Date()) {
  const db = await getDatabase();
  const timestamp = iso(now);
  const normalized = apps.map(normalizeBlockedApp).filter(Boolean);
  await run(db, 'UPDATE blocked_apps SET enabled = 0, updated_at = ?', [timestamp]);
  for (const app of normalized) {
    await run(
      db,
      `INSERT INTO blocked_apps (package_name, app_name, enabled, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(package_name) DO UPDATE SET
         app_name = excluded.app_name,
         enabled = 1,
         updated_at = excluded.updated_at`,
      [app.packageName, app.appName, timestamp, timestamp]
    );
  }
  return listBlockedApps();
}

async function readActiveSession(db) {
  const activeSessionId = await readStateValue(db, STATE_KEYS.activeSessionId);
  if (activeSessionId) {
    const row = await getFirst(db, 'SELECT * FROM focus_sessions WHERE id = ?', [activeSessionId]);
    if (row?.status === 'active') {
      return sessionFromRow(row);
    }
  }
  const row = await getFirst(
    db,
    `SELECT *
       FROM focus_sessions
      WHERE status = 'active'
      ORDER BY started_at DESC
      LIMIT 1`
  );
  if (row) {
    await writeStateValue(db, STATE_KEYS.activeSessionId, row.id);
  }
  return sessionFromRow(row);
}

async function cancelSession(sessionId, reason = 'cancelled', now = new Date()) {
  if (!sessionId) {
    return null;
  }
  const db = await getDatabase();
  const timestamp = iso(now);
  await run(
    db,
    `UPDATE focus_sessions
        SET status = ?, ended_at = COALESCE(ended_at, ?), updated_at = ?
      WHERE id = ? AND status = 'active'`,
    [reason, timestamp, timestamp, sessionId]
  );
  const activeSessionId = await readStateValue(db, STATE_KEYS.activeSessionId);
  if (activeSessionId === sessionId) {
    await writeStateValue(db, STATE_KEYS.activeSessionId, null);
  }
  const row = await getFirst(db, 'SELECT * FROM focus_sessions WHERE id = ?', [sessionId]);
  return sessionFromRow(row);
}

async function readFocusState(tasks = []) {
  const db = await getDatabase();
  let currentTaskId = await readStateValue(db, STATE_KEYS.currentTaskId);
  let activeSession = await readActiveSession(db);
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const currentTask = currentTaskId ? taskMap.get(currentTaskId) : null;

  if (currentTaskId && (!currentTask || currentTask.completed)) {
    await writeStateValue(db, STATE_KEYS.currentTaskId, null);
    currentTaskId = null;
  }

  if (activeSession) {
    const sessionTask = taskMap.get(activeSession.taskId);
    if (tasks.length > 0 && (!sessionTask || sessionTask.completed)) {
      activeSession = await cancelSession(activeSession.id, 'task-unavailable');
      await writeStateValue(db, STATE_KEYS.activeSessionId, null);
    } else if (!currentTaskId) {
      await writeStateValue(db, STATE_KEYS.currentTaskId, activeSession.taskId);
      currentTaskId = activeSession.taskId;
    }
  }

  return {
    currentTaskId,
    activeSession: activeSession?.status === 'active' ? activeSession : null,
    blockedApps: await listBlockedApps()
  };
}

async function setCurrentTask(taskId) {
  const db = await getDatabase();
  await writeStateValue(db, STATE_KEYS.currentTaskId, taskId);
  return readFocusState();
}

async function clearCurrentTask() {
  const db = await getDatabase();
  await writeStateValue(db, STATE_KEYS.currentTaskId, null);
  return readFocusState();
}

async function startSession({ task, blockedApps = [] }, now = new Date()) {
  if (!task?.id || !task?.title) {
    throw new Error('集中するタスクが見つかりません。');
  }
  const db = await getDatabase();
  const existing = await readActiveSession(db);
  if (existing) {
    await cancelSession(existing.id, 'replaced', now);
  }
  const timestamp = iso(now);
  const session = {
    id: createId('focus'),
    taskId: task.id,
    taskTitle: task.title,
    startedAt: timestamp,
    blockedApps: blockedApps.map(normalizeBlockedApp).filter(Boolean)
  };
  await run(
    db,
    `INSERT INTO focus_sessions
      (id, task_id, task_title, started_at, status, completed, blocked_apps_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', 0, ?, ?, ?)`,
    [
      session.id,
      session.taskId,
      session.taskTitle,
      session.startedAt,
      JSON.stringify(session.blockedApps),
      timestamp,
      timestamp
    ]
  );
  await writeStateValue(db, STATE_KEYS.currentTaskId, task.id);
  await writeStateValue(db, STATE_KEYS.activeSessionId, session.id);
  await setBlockedApps(session.blockedApps, now);
  return readFocusState([task]);
}

async function finishSession(sessionId, completed = false, now = new Date()) {
  if (!sessionId) {
    return null;
  }
  const db = await getDatabase();
  const timestamp = iso(now);
  await run(
    db,
    `UPDATE focus_sessions
        SET status = ?, completed = ?, ended_at = ?, updated_at = ?
      WHERE id = ?`,
    [completed ? 'completed' : 'cancelled', completed ? 1 : 0, timestamp, timestamp, sessionId]
  );
  const activeSessionId = await readStateValue(db, STATE_KEYS.activeSessionId);
  if (activeSessionId === sessionId) {
    await writeStateValue(db, STATE_KEYS.activeSessionId, null);
  }
  if (completed) {
    await writeStateValue(db, STATE_KEYS.currentTaskId, null);
  }
  const row = await getFirst(db, 'SELECT * FROM focus_sessions WHERE id = ?', [sessionId]);
  return sessionFromRow(row);
}

async function finishActiveSession(completed = false, now = new Date()) {
  const db = await getDatabase();
  const active = await readActiveSession(db);
  if (!active) {
    return null;
  }
  return finishSession(active.id, completed, now);
}

async function clearTaskReferences(taskId) {
  const db = await getDatabase();
  const currentTaskId = await readStateValue(db, STATE_KEYS.currentTaskId);
  if (currentTaskId === taskId) {
    await writeStateValue(db, STATE_KEYS.currentTaskId, null);
  }
  const active = await readActiveSession(db);
  if (active?.taskId === taskId) {
    await cancelSession(active.id, 'task-removed');
  }
  return readFocusState();
}

async function listSessions(limit = 20) {
  const db = await getDatabase();
  const rows = await getAll(
    db,
    `SELECT *
       FROM focus_sessions
      ORDER BY started_at DESC
      LIMIT ?`,
    [Math.max(1, Math.min(100, Math.round(limit)))]
  );
  return rows.map(sessionFromRow);
}

module.exports = {
  clearCurrentTask,
  clearTaskReferences,
  finishActiveSession,
  finishSession,
  listBlockedApps,
  listSessions,
  readFocusState,
  setBlockedApps,
  setCurrentTask,
  startSession
};
