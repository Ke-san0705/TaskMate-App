const {
  normalizeStoredTask,
  normalizeTaskInput,
  sortTasks
} = require('@taskmate/core');
const { getAll, getDatabase, getFirst, run } = require('./database');
const { log, warn } = require('../utils/logger');

function createTaskId() {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function rowToTask(row) {
  return normalizeStoredTask({
    id: row.id,
    title: row.title,
    description: row.description,
    date: row.date,
    time: row.time,
    genre: row.genre,
    priority: row.priority,
    completed: row.completed,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at
  });
}

function taskToValues(task) {
  return [
    task.id,
    task.title,
    task.description,
    task.date,
    task.time,
    task.genre,
    task.priority,
    task.completed ? 1 : 0,
    task.createdAt,
    task.updatedAt,
    task.completedAt
  ];
}

async function listTasks() {
  const db = await getDatabase();
  const rows = await getAll(
    db,
    `SELECT id, title, description, date, time, genre, priority, completed,
            created_at, updated_at, completed_at
       FROM tasks
      ORDER BY completed ASC, date ASC, time ASC, title ASC`
  );
  const tasks = [];
  for (const row of rows) {
    try {
      tasks.push(rowToTask(row));
    } catch (error) {
      // DB内に壊れた行があってもアプリ全体は落としません。
      // 問題行だけ除外し、開発ログで原因を追えるようにします。
      warn('Tasks', 'invalid task row skipped', error);
    }
  }
  return sortTasks(tasks);
}

async function getTask(taskId) {
  const db = await getDatabase();
  const row = await getFirst(
    db,
    `SELECT id, title, description, date, time, genre, priority, completed,
            created_at, updated_at, completed_at
       FROM tasks
      WHERE id = ?`,
    [taskId]
  );
  return row ? rowToTask(row) : null;
}

async function createTask(input, now = new Date()) {
  const db = await getDatabase();
  const task = normalizeTaskInput(input, { now, idFactory: createTaskId });
  await db.withTransactionAsync(async () => {
    await run(
      db,
      `INSERT INTO tasks
        (id, title, description, date, time, genre, priority, completed,
         created_at, updated_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      taskToValues(task)
    );
  });
  log('Tasks', 'task created', { taskId: task.id });
  return task;
}

async function updateTask(taskId, input, now = new Date()) {
  const db = await getDatabase();
  const current = await getTask(taskId);
  if (!current) {
    throw new Error('編集するタスクが見つかりません。');
  }
  const task = normalizeTaskInput({ ...current, ...input, id: taskId }, { current, now });
  await db.withTransactionAsync(async () => {
    await run(
      db,
      `UPDATE tasks
          SET title = ?, description = ?, date = ?, time = ?, genre = ?,
              priority = ?, completed = ?, updated_at = ?, completed_at = ?
        WHERE id = ?`,
      [
        task.title,
        task.description,
        task.date,
        task.time,
        task.genre,
        task.priority,
        task.completed ? 1 : 0,
        task.updatedAt,
        task.completedAt,
        task.id
      ]
    );
  });
  log('Tasks', 'task updated', { taskId });
  return task;
}

async function setTaskCompleted(taskId, completed, now = new Date()) {
  const current = await getTask(taskId);
  if (!current) {
    throw new Error('完了するタスクが見つかりません。');
  }
  return updateTask(taskId, { ...current, completed }, now);
}

async function deleteTask(taskId) {
  const db = await getDatabase();
  const current = await getTask(taskId);
  if (!current) {
    throw new Error('削除するタスクが見つかりません。');
  }
  await db.withTransactionAsync(async () => {
    await run(db, 'DELETE FROM tasks WHERE id = ?', [taskId]);
  });
  log('Tasks', 'task deleted', { taskId });
  return current;
}

module.exports = {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  setTaskCompleted,
  updateTask
};
