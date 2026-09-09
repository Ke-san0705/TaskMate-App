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
  const task = normalizeStoredTask({
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
  return {
    ...task,
    source: row.source || 'manual',
    projectTaskId: row.project_task_id || null,
    projectId: row.project_id || null,
    projectName: row.project_name || ''
  };
}

function taskToValues(task, input = {}) {
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
    task.completedAt,
    input.source === 'project' ? 'project' : 'manual',
    typeof input.projectTaskId === 'string' ? input.projectTaskId : null,
    typeof input.projectId === 'string' ? input.projectId : null,
    typeof input.projectName === 'string' ? input.projectName : ''
  ];
}

function withTaskLinks(task, input = {}) {
  return {
    ...task,
    source: input.source === 'project' ? 'project' : input.source || 'manual',
    projectTaskId: typeof input.projectTaskId === 'string' ? input.projectTaskId : null,
    projectId: typeof input.projectId === 'string' ? input.projectId : null,
    projectName: typeof input.projectName === 'string' ? input.projectName : ''
  };
}

function hasOwn(input, field) {
  return Object.prototype.hasOwnProperty.call(input || {}, field);
}

async function listTasks() {
  const db = await getDatabase();
  const rows = await getAll(
    db,
    `SELECT id, title, description, date, time, genre, priority, completed,
            created_at, updated_at, completed_at,
            source, project_task_id, project_id, project_name
       FROM tasks
      ORDER BY completed ASC, date ASC, time ASC, title ASC`
  );
  const tasks = [];
  for (const row of rows) {
    try {
      tasks.push(rowToTask(row));
    } catch (error) {
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
            created_at, updated_at, completed_at,
            source, project_task_id, project_id, project_name
       FROM tasks
      WHERE id = ?`,
    [taskId]
  );
  return row ? rowToTask(row) : null;
}

async function createTask(input, now = new Date()) {
  const db = await getDatabase();
  const task = normalizeTaskInput(input, { now, idFactory: createTaskId });
  await run(
    db,
    `INSERT INTO tasks
      (id, title, description, date, time, genre, priority, completed,
       created_at, updated_at, completed_at,
       source, project_task_id, project_id, project_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    taskToValues(task, input)
  );
  log('Tasks', 'task created', { taskId: task.id });
  return withTaskLinks(task, input);
}

async function updateTask(taskId, input, now = new Date()) {
  const db = await getDatabase();
  const current = await getTask(taskId);
  if (!current) {
    throw new Error('編集するタスクが見つかりません。');
  }
  const task = normalizeTaskInput({ ...current, ...input, id: taskId }, { current, now });
  const source = hasOwn(input, 'source') ? input.source : current.source;
  const projectTaskId = hasOwn(input, 'projectTaskId') ? input.projectTaskId : current.projectTaskId;
  const projectId = hasOwn(input, 'projectId') ? input.projectId : current.projectId;
  const projectName = hasOwn(input, 'projectName') ? input.projectName : current.projectName;
  await run(
    db,
    `UPDATE tasks
        SET title = ?, description = ?, date = ?, time = ?, genre = ?,
            priority = ?, completed = ?, updated_at = ?, completed_at = ?,
            source = ?, project_task_id = ?, project_id = ?, project_name = ?
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
      source === 'project' ? 'project' : 'manual',
      typeof projectTaskId === 'string' ? projectTaskId : null,
      typeof projectId === 'string' ? projectId : null,
      typeof projectName === 'string' ? projectName : '',
      task.id
    ]
  );
  log('Tasks', 'task updated', { taskId });
  return withTaskLinks(task, {
    source,
    projectTaskId,
    projectId,
    projectName
  });
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
  await run(db, 'DELETE FROM tasks WHERE id = ?', [taskId]);
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
