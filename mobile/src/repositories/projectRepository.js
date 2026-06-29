const { localDateKey } = require('@taskmate/core');
const { getAll, getDatabase, getFirst, run } = require('./database');
const taskRepository = require('./taskRepository');
const {
  calculateProjectProgress,
  summarizeProjects
} = require('../utils/projectCalculations');
const { log } = require('../utils/logger');

const PROJECT_STATUSES = ['not_started', 'in_progress', 'completed', 'paused'];
const TASK_STATUSES = ['not_started', 'in_progress', 'completed'];
const PROJECT_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function trimText(value, maxLength = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
}

function normalizeDate(value, fallback = null) {
  const text = trimText(value, 20);
  return isValidDateKey(text) ? text : fallback;
}

function normalizeTime(value, fallback = null) {
  const text = trimText(value, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === 'string' && item)
      : [];
  } catch {
    return [];
  }
}

function rowToCategory(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeCategoryInput(input, current = null, now = new Date()) {
  const timestamp = nowIso(now);
  const name = trimText(input?.name ?? current?.name, 80);
  ensureName(name, 'ジャンル名');
  return {
    id: current?.id || input?.id || makeId('category'),
    name,
    description: trimText(input?.description ?? current?.description, 1000),
    createdAt: current?.createdAt || input?.createdAt || timestamp,
    updatedAt: timestamp
  };
}

function rowToProject(row) {
  return {
    id: row.id,
    categoryId: row.category_id || null,
    name: row.name,
    description: row.description || '',
    startDate: row.start_date || null,
    deadline: row.deadline || null,
    status: row.status || 'not_started',
    priority: row.priority || 'medium',
    progress: Number(row.progress || 0),
    estimatedTotalMinutes: Number(row.estimated_total_minutes || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToMilestone(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description || '',
    deadline: row.deadline || null,
    status: row.status || 'not_started',
    order: Number(row.sort_order || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToProjectTask(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    milestoneId: row.milestone_id || null,
    normalTaskId: row.normal_task_id || null,
    title: row.title,
    description: row.description || '',
    startDate: row.start_date || null,
    deadline: row.deadline || null,
    time: row.time || null,
    scheduledDate: row.scheduled_date || null,
    estimatedMinutes: Number(row.estimated_minutes || 30),
    importance: Number(row.importance || 3),
    difficulty: Number(row.difficulty || 3),
    progress: Number(row.progress || 0),
    status: row.status || 'not_started',
    dependencyTaskIds: parseJsonArray(row.dependency_task_ids),
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function ensureName(name, label) {
  if (!name) {
    throw new Error(`${label}を入力してください。`);
  }
}

function normalizeProjectInput(input, current = null, now = new Date()) {
  const timestamp = nowIso(now);
  const name = trimText(input?.name ?? current?.name, 120);
  ensureName(name, 'プロジェクト名');
  const startDate = normalizeDate(input?.startDate ?? current?.startDate, null);
  const deadline = normalizeDate(input?.deadline ?? current?.deadline, null);
  if (!deadline) {
    throw new Error('最終期限をYYYY-MM-DDで入力してください。');
  }
  if (startDate && deadline && startDate > deadline) {
    throw new Error('開始日は最終期限以前の日付にしてください。');
  }
  const priority = PROJECT_PRIORITIES.includes(input?.priority)
    ? input.priority
    : current?.priority || 'medium';
  const status = PROJECT_STATUSES.includes(input?.status)
    ? input.status
    : current?.status || 'not_started';
  return {
    id: current?.id || input?.id || makeId('project'),
    categoryId: input?.categoryId || current?.categoryId || 'category-other',
    name,
    description: trimText(input?.description ?? current?.description, 3000),
    startDate,
    deadline,
    status,
    priority,
    progress:
      status === 'completed'
        ? 100
        : Math.min(99, clampNumber(input?.progress ?? current?.progress, 0, 100, 0)),
    estimatedTotalMinutes: clampNumber(
      input?.estimatedTotalMinutes ?? current?.estimatedTotalMinutes,
      0,
      100000,
      0
    ),
    createdAt: current?.createdAt || input?.createdAt || timestamp,
    updatedAt: timestamp
  };
}

function normalizeMilestoneInput(input, current = null, now = new Date()) {
  const timestamp = nowIso(now);
  const title = trimText(input?.title ?? current?.title, 120);
  ensureName(title, '段階名');
  const deadline = normalizeDate(input?.deadline ?? current?.deadline, null);
  if (!deadline) {
    throw new Error('段階の期限をYYYY-MM-DDで入力してください。');
  }
  const status = TASK_STATUSES.includes(input?.status)
    ? input.status
    : current?.status || 'not_started';
  return {
    id: current?.id || input?.id || makeId('milestone'),
    projectId: input?.projectId || current?.projectId,
    title,
    description: trimText(input?.description ?? current?.description, 2000),
    deadline,
    status,
    order: clampNumber(input?.order ?? current?.order, 0, 10000, 0),
    createdAt: current?.createdAt || input?.createdAt || timestamp,
    updatedAt: timestamp
  };
}

function normalizeProjectTaskInput(input, current = null, now = new Date()) {
  const timestamp = nowIso(now);
  const title = trimText(input?.title ?? current?.title, 160);
  ensureName(title, 'Todo名');
  const deadline = normalizeDate(input?.deadline ?? current?.deadline, null);
  if (!deadline) {
    throw new Error('Todoの期限をYYYY-MM-DDで入力してください。');
  }
  const startDate = normalizeDate(input?.startDate ?? current?.startDate, null);
  if (startDate && deadline && startDate > deadline) {
    throw new Error('開始日は期限以前の日付にしてください。');
  }
  const status = TASK_STATUSES.includes(input?.status)
    ? input.status
    : current?.status || 'not_started';
  const timeSource = Object.prototype.hasOwnProperty.call(input || {}, 'time')
    ? input.time
    : current?.time;
  const progress =
    status === 'completed'
      ? 100
      : Math.min(99, clampNumber(input?.progress ?? current?.progress, 0, 100, 0));
  return {
    id: current?.id || input?.id || makeId('project-task'),
    projectId: input?.projectId || current?.projectId,
    milestoneId: input?.milestoneId || current?.milestoneId || null,
    normalTaskId: input?.normalTaskId ?? current?.normalTaskId ?? null,
    title,
    description: trimText(input?.description ?? current?.description, 3000),
    startDate,
    deadline,
    time: normalizeTime(timeSource, null),
    scheduledDate: normalizeDate(input?.scheduledDate ?? current?.scheduledDate, null),
    estimatedMinutes: clampNumber(input?.estimatedMinutes ?? current?.estimatedMinutes, 1, 100000, 30),
    importance: clampNumber(input?.importance ?? current?.importance, 1, 5, 3),
    difficulty: clampNumber(input?.difficulty ?? current?.difficulty, 1, 5, 3),
    progress,
    status,
    dependencyTaskIds: Array.isArray(input?.dependencyTaskIds)
      ? input.dependencyTaskIds.filter((id) => typeof id === 'string' && id)
      : current?.dependencyTaskIds || [],
    completedAt:
      status === 'completed'
        ? current?.completedAt || input?.completedAt || timestamp
        : null,
    createdAt: current?.createdAt || input?.createdAt || timestamp,
    updatedAt: timestamp
  };
}

async function listProjectState(settings = {}) {
  const db = await getDatabase();
  const categoryRows = await getAll(db, 'SELECT * FROM project_categories ORDER BY name ASC');
  const projectRows = await getAll(
    db,
    'SELECT * FROM projects ORDER BY status ASC, deadline ASC, updated_at DESC'
  );
  const milestoneRows = await getAll(
    db,
    'SELECT * FROM project_milestones ORDER BY sort_order ASC, deadline ASC'
  );
  const taskRows = await getAll(
    db,
    'SELECT * FROM project_tasks ORDER BY status ASC, deadline ASC, updated_at DESC'
  );
  const categories = categoryRows.map(rowToCategory);
  const projectTasks = taskRows.map(rowToProjectTask);
  const projects = projectRows
    .map(rowToProject)
    .map((project) => ({
      ...project,
      progress: calculateProjectProgress(project, projectTasks)
    }));
  const milestones = milestoneRows.map(rowToMilestone);
  const summaries = summarizeProjects({
    categories,
    projects,
    milestones,
    projectTasks,
    settings
  });
  return { categories, projects, milestones, projectTasks, summaries };
}

async function saveProjectProgress(db, projectId) {
  const taskRows = await getAll(db, 'SELECT * FROM project_tasks WHERE project_id = ?', [projectId]);
  const projectRow = await getFirst(db, 'SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!projectRow) return;
  const project = rowToProject(projectRow);
  const projectTasks = taskRows.map(rowToProjectTask);
  const progress = calculateProjectProgress(project, projectTasks);
  await run(db, 'UPDATE projects SET progress = ?, updated_at = ? WHERE id = ?', [
    progress,
    nowIso(),
    projectId
  ]);
}

async function createCategory(input) {
  const db = await getDatabase();
  const category = normalizeCategoryInput(input);
  await run(
    db,
    `INSERT INTO project_categories
      (id, name, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [category.id, category.name, category.description, category.createdAt, category.updatedAt]
  );
  return category;
}

async function updateCategory(categoryId, input) {
  const db = await getDatabase();
  const row = await getFirst(db, 'SELECT * FROM project_categories WHERE id = ?', [categoryId]);
  if (!row) throw new Error('ジャンルが見つかりません。');
  const category = normalizeCategoryInput(input, rowToCategory(row));
  await run(
    db,
    'UPDATE project_categories SET name = ?, description = ?, updated_at = ? WHERE id = ?',
    [category.name, category.description, category.updatedAt, category.id]
  );
  return category;
}

async function deleteCategory(categoryId) {
  const db = await getDatabase();
  const row = await getFirst(db, 'SELECT * FROM project_categories WHERE id = ?', [categoryId]);
  if (!row) throw new Error('削除するジャンルが見つかりません。');
  const fallback = await getFirst(db, 'SELECT id FROM project_categories WHERE id != ? LIMIT 1', [
    categoryId
  ]);
  const fallbackCategoryId = fallback?.id || 'category-other';
  await run(db, 'UPDATE projects SET category_id = ?, updated_at = ? WHERE category_id = ?', [
    fallbackCategoryId,
    nowIso(),
    categoryId
  ]);
  await run(db, 'DELETE FROM project_categories WHERE id = ?', [categoryId]);
  return rowToCategory(row);
}

async function createProject(input) {
  const db = await getDatabase();
  const project = normalizeProjectInput(input);
  await run(
    db,
    `INSERT INTO projects
      (id, category_id, name, description, start_date, deadline, status, priority,
       progress, estimated_total_minutes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      project.id,
      project.categoryId,
      project.name,
      project.description,
      project.startDate,
      project.deadline,
      project.status,
      project.priority,
      project.progress,
      project.estimatedTotalMinutes,
      project.createdAt,
      project.updatedAt
    ]
  );
  log('Projects', 'project created', { projectId: project.id });
  return project;
}

async function updateProject(projectId, input) {
  const db = await getDatabase();
  const row = await getFirst(db, 'SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!row) throw new Error('プロジェクトが見つかりません。');
  const project = normalizeProjectInput(input, rowToProject(row));
  await run(
    db,
    `UPDATE projects
        SET category_id = ?, name = ?, description = ?, start_date = ?, deadline = ?,
            status = ?, priority = ?, progress = ?, estimated_total_minutes = ?, updated_at = ?
      WHERE id = ?`,
    [
      project.categoryId,
      project.name,
      project.description,
      project.startDate,
      project.deadline,
      project.status,
      project.priority,
      project.progress,
      project.estimatedTotalMinutes,
      project.updatedAt,
      project.id
    ]
  );
  return project;
}

async function deleteProject(projectId, mode = 'deleteAll') {
  const db = await getDatabase();
  const row = await getFirst(db, 'SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!row) throw new Error('削除するプロジェクトが見つかりません。');
  const project = rowToProject(row);
  const linkedRows = await getAll(
    db,
    'SELECT normal_task_id FROM project_tasks WHERE project_id = ? AND normal_task_id IS NOT NULL',
    [projectId]
  );
  for (const linked of linkedRows) {
    if (linked.normal_task_id) {
      const normalTask = await taskRepository.getTask(linked.normal_task_id);
      if (normalTask && mode === 'keepTasks') {
        await taskRepository.updateTask(linked.normal_task_id, {
          source: 'manual',
          projectTaskId: null,
          projectId: null,
          projectName: ''
        });
      } else if (normalTask) {
        await taskRepository.deleteTask(linked.normal_task_id);
      }
    }
  }
  await run(db, 'DELETE FROM project_tasks WHERE project_id = ?', [projectId]);
  await run(db, 'DELETE FROM project_milestones WHERE project_id = ?', [projectId]);
  await run(db, 'DELETE FROM projects WHERE id = ?', [projectId]);
  return project;
}

async function createMilestone(input) {
  const db = await getDatabase();
  const milestone = normalizeMilestoneInput(input);
  await run(
    db,
    `INSERT INTO project_milestones
      (id, project_id, title, description, deadline, status, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      milestone.id,
      milestone.projectId,
      milestone.title,
      milestone.description,
      milestone.deadline,
      milestone.status,
      milestone.order,
      milestone.createdAt,
      milestone.updatedAt
    ]
  );
  return milestone;
}

async function updateMilestone(milestoneId, input) {
  const db = await getDatabase();
  const row = await getFirst(db, 'SELECT * FROM project_milestones WHERE id = ?', [milestoneId]);
  if (!row) throw new Error('段階が見つかりません。');
  const milestone = normalizeMilestoneInput(input, rowToMilestone(row));
  await run(
    db,
    `UPDATE project_milestones
        SET title = ?, description = ?, deadline = ?, status = ?, sort_order = ?, updated_at = ?
      WHERE id = ?`,
    [
      milestone.title,
      milestone.description,
      milestone.deadline,
      milestone.status,
      milestone.order,
      milestone.updatedAt,
      milestone.id
    ]
  );
  return milestone;
}

async function deleteMilestone(milestoneId) {
  const db = await getDatabase();
  const row = await getFirst(db, 'SELECT * FROM project_milestones WHERE id = ?', [milestoneId]);
  if (!row) throw new Error('段階が見つかりません。');
  const milestone = rowToMilestone(row);
  await run(db, 'UPDATE project_tasks SET milestone_id = ?, updated_at = ? WHERE milestone_id = ?', [
    null,
    nowIso(),
    milestone.id
  ]);
  await run(db, 'DELETE FROM project_milestones WHERE id = ?', [milestone.id]);
  return milestone;
}

async function createProjectTask(input) {
  const db = await getDatabase();
  const task = normalizeProjectTaskInput(input);
  await run(
    db,
    `INSERT INTO project_tasks
      (id, project_id, milestone_id, normal_task_id, title, description, start_date,
       deadline, time, scheduled_date, estimated_minutes, importance, difficulty,
       progress, status, dependency_task_ids, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.id,
      task.projectId,
      task.milestoneId,
      task.normalTaskId,
      task.title,
      task.description,
      task.startDate,
      task.deadline,
      task.time,
      task.scheduledDate,
      task.estimatedMinutes,
      task.importance,
      task.difficulty,
      task.progress,
      task.status,
      JSON.stringify(task.dependencyTaskIds),
      task.completedAt,
      task.createdAt,
      task.updatedAt
    ]
  );
  await saveProjectProgress(db, task.projectId);
  return task;
}

async function deleteProjectTask(taskId) {
  const db = await getDatabase();
  const row = await getFirst(db, 'SELECT * FROM project_tasks WHERE id = ?', [taskId]);
  if (!row) throw new Error('Todoが見つかりません。');
  const task = rowToProjectTask(row);
  if (task.normalTaskId) {
    const linkedTask = await taskRepository.getTask(task.normalTaskId);
    if (linkedTask) {
      await taskRepository.deleteTask(task.normalTaskId);
    }
  }
  await run(db, 'DELETE FROM project_tasks WHERE id = ?', [task.id]);
  await saveProjectProgress(db, task.projectId);
  return task;
}

async function updateProjectTask(taskId, input) {
  const db = await getDatabase();
  const row = await getFirst(db, 'SELECT * FROM project_tasks WHERE id = ?', [taskId]);
  if (!row) throw new Error('Todoが見つかりません。');
  const task = normalizeProjectTaskInput(input, rowToProjectTask(row));
  await run(
    db,
    `UPDATE project_tasks
        SET milestone_id = ?, normal_task_id = ?, title = ?, description = ?,
            start_date = ?, deadline = ?, time = ?, scheduled_date = ?, estimated_minutes = ?,
            importance = ?, difficulty = ?, progress = ?, status = ?,
            dependency_task_ids = ?, completed_at = ?, updated_at = ?
      WHERE id = ?`,
    [
      task.milestoneId,
      task.normalTaskId,
      task.title,
      task.description,
      task.startDate,
      task.deadline,
      task.time,
      task.scheduledDate,
      task.estimatedMinutes,
      task.importance,
      task.difficulty,
      task.progress,
      task.status,
      JSON.stringify(task.dependencyTaskIds),
      task.completedAt,
      task.updatedAt,
      task.id
    ]
  );
  await saveProjectProgress(db, task.projectId);
  return task;
}

async function completeProjectTask(taskId, completed = true) {
  return updateProjectTask(taskId, {
    status: completed ? 'completed' : 'in_progress',
    progress: completed ? 100 : 0
  });
}

async function addProjectTaskToToday(taskId, scheduledDate = null) {
  const db = await getDatabase();
  const state = await listProjectState();
  const projectTask = state.projectTasks.find((task) => task.id === taskId);
  if (!projectTask) throw new Error('今日へ送るTodoが見つかりません。');
  const project = state.projects.find((candidate) => candidate.id === projectTask.projectId);
  const category = state.categories.find((candidate) => candidate.id === project?.categoryId);
  const date = normalizeDate(scheduledDate, null) || localDateKey(new Date());
  const input = {
    id: projectTask.normalTaskId || `linked-${projectTask.id}`,
    title: projectTask.title,
    description: projectTask.description,
    date,
    time: projectTask.time || null,
    genre: category?.name || 'プロジェクト',
    priority: project?.priority === 'urgent' || project?.priority === 'high' ? 'high' : 'normal',
    completed: projectTask.status === 'completed',
    source: 'project',
    projectTaskId: projectTask.id,
    projectId: project?.id || null,
    projectName: project?.name || ''
  };
  const normalTask = projectTask.normalTaskId
    ? await taskRepository.updateTask(projectTask.normalTaskId, input)
    : await taskRepository.createTask(input);
  await run(
    db,
    'UPDATE project_tasks SET normal_task_id = ?, scheduled_date = ?, updated_at = ? WHERE id = ?',
    [normalTask.id, date, nowIso(), projectTask.id]
  );
  return { projectTask: { ...projectTask, normalTaskId: normalTask.id, scheduledDate: date }, task: normalTask };
}

async function syncProjectTaskFromNormalTask(task) {
  if (!task?.projectTaskId) return null;
  return completeProjectTask(task.projectTaskId, task.completed);
}

async function unlinkNormalTask(taskId) {
  const db = await getDatabase();
  await run(
    db,
    'UPDATE project_tasks SET normal_task_id = NULL, updated_at = ? WHERE normal_task_id = ?',
    [nowIso(), taskId]
  );
}

module.exports = {
  addProjectTaskToToday,
  completeProjectTask,
  createCategory,
  createMilestone,
  createProject,
  createProjectTask,
  deleteCategory,
  deleteMilestone,
  deleteProject,
  deleteProjectTask,
  listProjectState,
  syncProjectTaskFromNormalTask,
  unlinkNormalTask,
  updateCategory,
  updateProject,
  updateMilestone,
  updateProjectTask
};
