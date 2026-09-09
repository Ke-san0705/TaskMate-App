const { localDateKey } = require('@taskmate/core');
const { getAll, getDatabase, getFirst, run } = require('./database');
const taskRepository = require('./taskRepository');
const { warn } = require('../utils/logger');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const PROJECT_STATUSES = new Set(['not_started', 'in_progress', 'completed', 'paused']);
const TASK_STATUSES = new Set(['not_started', 'in_progress', 'completed']);
const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function iso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function hasOwn(input, field) {
  return Object.prototype.hasOwnProperty.call(input || {}, field);
}

function text(value, fallback = '', maxLength = 1000) {
  if (typeof value !== 'string') {
    return fallback;
  }
  const next = value.trim().slice(0, maxLength);
  return next || fallback;
}

function nullableText(value, maxLength = 1000) {
  if (value === null || value === undefined) {
    return null;
  }
  const next = text(value, '', maxLength);
  return next || null;
}

function numberInRange(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function validDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value.trim())) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function normalizeDate(value, fallback = null) {
  return validDate(value) ? value.trim() : fallback;
}

function normalizeTime(value, fallback = null) {
  return typeof value === 'string' && TIME_PATTERN.test(value.trim()) ? value.trim() : fallback;
}

function projectPriorityToTaskPriority(priority) {
  if (priority === 'high' || priority === 'urgent') {
    return 'high';
  }
  if (priority === 'low') {
    return 'low';
  }
  return 'normal';
}

function parseDependencyIds(value) {
  if (!value) {
    return [];
  }
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((item) => typeof item === 'string' && item))]
      : [];
  } catch (error) {
    warn('Projects', 'broken dependency ids recovered', error);
    return [];
  }
}

function categoryFromRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function projectFromRow(row) {
  return {
    id: row.id,
    categoryId: row.category_id || null,
    name: row.name,
    description: row.description || '',
    startDate: row.start_date || null,
    deadline: row.deadline || null,
    status: row.status || 'not_started',
    priority: row.priority || 'medium',
    progress: numberInRange(row.progress, 0, 100, 0),
    estimatedTotalMinutes: numberInRange(row.estimated_total_minutes, 0, 100000, 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function milestoneFromRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description || '',
    deadline: row.deadline || null,
    status: row.status || 'not_started',
    order: numberInRange(row.sort_order, 0, 1000, 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function projectTaskFromRow(row) {
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
    estimatedMinutes: numberInRange(row.estimated_minutes, 1, 10000, 30),
    importance: numberInRange(row.importance, 1, 5, 3),
    difficulty: numberInRange(row.difficulty, 1, 5, 3),
    progress: numberInRange(row.progress, 0, 100, 0),
    status: row.status || 'not_started',
    dependencyTaskIds: parseDependencyIds(row.dependency_task_ids),
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function calculateProjectProgress(project, projectTasks) {
  if (project.status === 'completed') {
    return 100;
  }
  const tasks = projectTasks.filter((task) => task.projectId === project.id);
  if (tasks.length === 0) {
    return numberInRange(project.progress, 0, 100, 0);
  }
  const total = tasks.reduce((sum, task) => {
    if (task.status === 'completed') {
      return sum + 100;
    }
    return sum + numberInRange(task.progress, 0, 100, 0);
  }, 0);
  return Math.round(total / tasks.length);
}

function withProjectProgress(projects, projectTasks) {
  return projects.map((project) => ({
    ...project,
    progress: calculateProjectProgress(project, projectTasks)
  }));
}

async function listCategories(db) {
  const rows = await getAll(
    db,
    `SELECT id, name, description, created_at, updated_at
       FROM project_categories
      ORDER BY name COLLATE NOCASE ASC`
  );
  return rows.map(categoryFromRow);
}

async function listProjects(db) {
  const rows = await getAll(
    db,
    `SELECT id, category_id, name, description, start_date, deadline, status, priority,
            progress, estimated_total_minutes, created_at, updated_at
       FROM projects
      ORDER BY status = 'completed' ASC,
               COALESCE(deadline, '9999-12-31') ASC,
               updated_at DESC`
  );
  return rows.map(projectFromRow);
}

async function listMilestones(db) {
  const rows = await getAll(
    db,
    `SELECT id, project_id, title, description, deadline, status, sort_order,
            created_at, updated_at
       FROM project_milestones
      ORDER BY sort_order ASC, COALESCE(deadline, '9999-12-31') ASC, title ASC`
  );
  return rows.map(milestoneFromRow);
}

async function listProjectTasks(db) {
  const rows = await getAll(
    db,
    `SELECT id, project_id, milestone_id, normal_task_id, title, description,
            start_date, deadline, time, scheduled_date, estimated_minutes,
            importance, difficulty, progress, status, dependency_task_ids,
            completed_at, created_at, updated_at
       FROM project_tasks
      ORDER BY status = 'completed' ASC,
               COALESCE(deadline, '9999-12-31') ASC,
               COALESCE(time, '23:59') ASC,
               title ASC`
  );
  return rows.map(projectTaskFromRow);
}

async function listProjectState() {
  const db = await getDatabase();
  const categories = await listCategories(db);
  const projects = await listProjects(db);
  const milestones = await listMilestones(db);
  const projectTasks = await listProjectTasks(db);
  return {
    categories,
    projects: withProjectProgress(projects, projectTasks),
    milestones,
    projectTasks,
    error: null
  };
}

async function requireProject(db, projectId) {
  const row = await getFirst(
    db,
    `SELECT id, category_id, name, description, start_date, deadline, status, priority,
            progress, estimated_total_minutes, created_at, updated_at
       FROM projects
      WHERE id = ?`,
    [projectId]
  );
  if (!row) {
    throw new Error('長期タスクが見つかりません。');
  }
  return projectFromRow(row);
}

async function requireMilestone(db, milestoneId) {
  const row = await getFirst(
    db,
    `SELECT id, project_id, title, description, deadline, status, sort_order,
            created_at, updated_at
       FROM project_milestones
      WHERE id = ?`,
    [milestoneId]
  );
  if (!row) {
    throw new Error('段階が見つかりません。');
  }
  return milestoneFromRow(row);
}

async function requireProjectTask(db, taskId) {
  const row = await getFirst(
    db,
    `SELECT id, project_id, milestone_id, normal_task_id, title, description,
            start_date, deadline, time, scheduled_date, estimated_minutes,
            importance, difficulty, progress, status, dependency_task_ids,
            completed_at, created_at, updated_at
       FROM project_tasks
      WHERE id = ?`,
    [taskId]
  );
  if (!row) {
    throw new Error('長期Todoが見つかりません。');
  }
  return projectTaskFromRow(row);
}

async function categoryExists(db, categoryId) {
  if (!categoryId) {
    return false;
  }
  const row = await getFirst(db, 'SELECT id FROM project_categories WHERE id = ?', [categoryId]);
  return Boolean(row);
}

async function milestoneBelongsToProject(db, milestoneId, projectId) {
  if (!milestoneId) {
    return false;
  }
  const row = await getFirst(
    db,
    'SELECT id FROM project_milestones WHERE id = ? AND project_id = ?',
    [milestoneId, projectId]
  );
  return Boolean(row);
}

async function normalizeCategoryId(db, categoryId) {
  const id = nullableText(categoryId, 120);
  return (await categoryExists(db, id)) ? id : null;
}

async function normalizeMilestoneId(db, milestoneId, projectId) {
  const id = nullableText(milestoneId, 120);
  return (await milestoneBelongsToProject(db, id, projectId)) ? id : null;
}

async function persistProjectProgress(db, projectId = null) {
  const projects = projectId ? [await requireProject(db, projectId)] : await listProjects(db);
  const projectTasks = await listProjectTasks(db);
  const timestamp = iso();
  for (const project of projects) {
    const progress = calculateProjectProgress(project, projectTasks);
    await run(
      db,
      'UPDATE projects SET progress = ?, updated_at = ? WHERE id = ?',
      [progress, timestamp, project.id]
    );
  }
}

async function getProjectContext(db, projectTask) {
  const project = await requireProject(db, projectTask.projectId);
  const category = project.categoryId
    ? categoryFromRow(
        await getFirst(
          db,
          'SELECT id, name, description, created_at, updated_at FROM project_categories WHERE id = ?',
          [project.categoryId]
        )
      )
    : null;
  return { project, category };
}

async function projectTaskToNormalTaskInput(db, projectTask, date, current = null) {
  const { project, category } = await getProjectContext(db, projectTask);
  return {
    id: current?.id,
    title: projectTask.title,
    description: projectTask.description,
    date: normalizeDate(date, projectTask.scheduledDate || projectTask.deadline || localDateKey(new Date())),
    time: projectTask.time || null,
    genre: category?.name || project.name || '長期タスク',
    priority: projectPriorityToTaskPriority(project.priority),
    completed: projectTask.status === 'completed',
    source: 'project',
    projectTaskId: projectTask.id,
    projectId: project.id,
    projectName: project.name
  };
}

async function updateLinkedNormalTask(projectTaskId) {
  const db = await getDatabase();
  const projectTask = await requireProjectTask(db, projectTaskId);
  if (!projectTask.normalTaskId) {
    return null;
  }
  const normalTask = await taskRepository.getTask(projectTask.normalTaskId);
  if (!normalTask) {
    await run(
      db,
      'UPDATE project_tasks SET normal_task_id = NULL, updated_at = ? WHERE id = ?',
      [iso(), projectTask.id]
    );
    return null;
  }
  const input = await projectTaskToNormalTaskInput(
    db,
    projectTask,
    projectTask.scheduledDate || normalTask.date,
    normalTask
  );
  return taskRepository.updateTask(normalTask.id, input);
}

async function updateLinkedNormalTasksForProject(projectId) {
  const db = await getDatabase();
  const rows = await getAll(
    db,
    'SELECT id FROM project_tasks WHERE project_id = ? AND normal_task_id IS NOT NULL',
    [projectId]
  );
  for (const row of rows) {
    await updateLinkedNormalTask(row.id);
  }
}

async function unlinkNormalTaskFields(db, taskId) {
  await run(
    db,
    `UPDATE tasks
        SET source = 'manual',
            project_task_id = NULL,
            project_id = NULL,
            project_name = '',
            updated_at = ?
      WHERE id = ?`,
    [iso(), taskId]
  );
}

async function createProject(input, now = new Date()) {
  const db = await getDatabase();
  const name = text(input?.name, '', 120);
  if (!name) {
    throw new Error('長期タスク名を入力してください。');
  }
  const timestamp = iso(now);
  const id = createId('project');
  const categoryId = await normalizeCategoryId(db, input?.categoryId);
  const status = PROJECT_STATUSES.has(input?.status) ? input.status : 'not_started';
  const progress = status === 'completed' ? 100 : numberInRange(input?.progress, 0, 100, 0);
  await run(
    db,
    `INSERT INTO projects
      (id, category_id, name, description, start_date, deadline, status, priority,
       progress, estimated_total_minutes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      categoryId,
      name,
      text(input?.description, '', 1000),
      normalizeDate(input?.startDate, null),
      normalizeDate(input?.deadline, null),
      status,
      PRIORITIES.has(input?.priority) ? input.priority : 'medium',
      progress,
      numberInRange(input?.estimatedTotalMinutes, 0, 100000, 0),
      timestamp,
      timestamp
    ]
  );
  return requireProject(db, id);
}

async function updateProject(projectId, input = {}, now = new Date()) {
  const db = await getDatabase();
  const current = await requireProject(db, projectId);
  const timestamp = iso(now);
  const categoryId = hasOwn(input, 'categoryId')
    ? await normalizeCategoryId(db, input.categoryId)
    : current.categoryId;
  const status = PROJECT_STATUSES.has(input.status) ? input.status : current.status;
  const progress = status === 'completed'
    ? 100
    : numberInRange(hasOwn(input, 'progress') ? input.progress : current.progress, 0, 100, 0);
  await run(
    db,
    `UPDATE projects
        SET category_id = ?, name = ?, description = ?, start_date = ?, deadline = ?,
            status = ?, priority = ?, progress = ?, estimated_total_minutes = ?, updated_at = ?
      WHERE id = ?`,
    [
      categoryId,
      hasOwn(input, 'name') ? text(input.name, current.name, 120) : current.name,
      hasOwn(input, 'description') ? text(input.description, '', 1000) : current.description,
      hasOwn(input, 'startDate') ? normalizeDate(input.startDate, null) : current.startDate,
      hasOwn(input, 'deadline') ? normalizeDate(input.deadline, null) : current.deadline,
      status,
      PRIORITIES.has(input.priority) ? input.priority : current.priority,
      progress,
      numberInRange(
        hasOwn(input, 'estimatedTotalMinutes')
          ? input.estimatedTotalMinutes
          : current.estimatedTotalMinutes,
        0,
        100000,
        0
      ),
      timestamp,
      projectId
    ]
  );
  await persistProjectProgress(db, projectId);
  await updateLinkedNormalTasksForProject(projectId);
  return requireProject(db, projectId);
}

async function deleteProject(projectId) {
  const db = await getDatabase();
  const project = await requireProject(db, projectId);
  const linkedRows = await getAll(
    db,
    'SELECT normal_task_id FROM project_tasks WHERE project_id = ? AND normal_task_id IS NOT NULL',
    [projectId]
  );
  for (const row of linkedRows) {
    await unlinkNormalTaskFields(db, row.normal_task_id);
  }
  await run(db, 'DELETE FROM project_tasks WHERE project_id = ?', [projectId]);
  await run(db, 'DELETE FROM project_milestones WHERE project_id = ?', [projectId]);
  await run(db, 'DELETE FROM projects WHERE id = ?', [projectId]);
  return project;
}

async function createMilestone(input, now = new Date()) {
  const db = await getDatabase();
  const project = await requireProject(db, input?.projectId);
  const title = text(input?.title, '', 120);
  if (!title) {
    throw new Error('段階名を入力してください。');
  }
  const timestamp = iso(now);
  const id = createId('milestone');
  await run(
    db,
    `INSERT INTO project_milestones
      (id, project_id, title, description, deadline, status, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      project.id,
      title,
      text(input?.description, '', 1000),
      normalizeDate(input?.deadline, project.deadline),
      TASK_STATUSES.has(input?.status) ? input.status : 'not_started',
      numberInRange(input?.order, 0, 1000, 0),
      timestamp,
      timestamp
    ]
  );
  return requireMilestone(db, id);
}

async function updateMilestone(milestoneId, input = {}, now = new Date()) {
  const db = await getDatabase();
  const current = await requireMilestone(db, milestoneId);
  const timestamp = iso(now);
  await run(
    db,
    `UPDATE project_milestones
        SET title = ?, description = ?, deadline = ?, status = ?, sort_order = ?, updated_at = ?
      WHERE id = ?`,
    [
      hasOwn(input, 'title') ? text(input.title, current.title, 120) : current.title,
      hasOwn(input, 'description') ? text(input.description, '', 1000) : current.description,
      hasOwn(input, 'deadline') ? normalizeDate(input.deadline, null) : current.deadline,
      TASK_STATUSES.has(input.status) ? input.status : current.status,
      numberInRange(hasOwn(input, 'order') ? input.order : current.order, 0, 1000, current.order),
      timestamp,
      milestoneId
    ]
  );
  return requireMilestone(db, milestoneId);
}

async function deleteMilestone(milestoneId) {
  const db = await getDatabase();
  const milestone = await requireMilestone(db, milestoneId);
  await run(
    db,
    'UPDATE project_tasks SET milestone_id = NULL, updated_at = ? WHERE milestone_id = ?',
    [iso(), milestoneId]
  );
  await run(db, 'DELETE FROM project_milestones WHERE id = ?', [milestoneId]);
  return milestone;
}

async function createProjectTask(input, now = new Date()) {
  const db = await getDatabase();
  const project = await requireProject(db, input?.projectId);
  const title = text(input?.title, '', 120);
  if (!title) {
    throw new Error('長期Todo名を入力してください。');
  }
  const status = TASK_STATUSES.has(input?.status) ? input.status : 'not_started';
  const timestamp = iso(now);
  const id = createId('project-task');
  await run(
    db,
    `INSERT INTO project_tasks
      (id, project_id, milestone_id, normal_task_id, title, description, start_date,
       deadline, time, scheduled_date, estimated_minutes, importance, difficulty,
       progress, status, dependency_task_ids, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      project.id,
      await normalizeMilestoneId(db, input?.milestoneId, project.id),
      title,
      text(input?.description, '', 1000),
      normalizeDate(input?.startDate, null),
      normalizeDate(input?.deadline, project.deadline),
      normalizeTime(input?.time, null),
      normalizeDate(input?.scheduledDate, null),
      numberInRange(input?.estimatedMinutes, 1, 10000, 30),
      numberInRange(input?.importance, 1, 5, 3),
      numberInRange(input?.difficulty, 1, 5, 3),
      status === 'completed' ? 100 : numberInRange(input?.progress, 0, 100, 0),
      status,
      JSON.stringify(parseDependencyIds(input?.dependencyTaskIds)),
      status === 'completed' ? timestamp : null,
      timestamp,
      timestamp
    ]
  );
  await persistProjectProgress(db, project.id);
  return requireProjectTask(db, id);
}

async function updateProjectTask(taskId, input = {}, now = new Date()) {
  const db = await getDatabase();
  const current = await requireProjectTask(db, taskId);
  const project = await requireProject(db, current.projectId);
  const status = TASK_STATUSES.has(input.status) ? input.status : current.status;
  const completedAt = status === 'completed'
    ? current.completedAt || iso(now)
    : null;
  const timestamp = iso(now);
  await run(
    db,
    `UPDATE project_tasks
        SET milestone_id = ?, title = ?, description = ?, start_date = ?, deadline = ?,
            time = ?, scheduled_date = ?, estimated_minutes = ?, importance = ?,
            difficulty = ?, progress = ?, status = ?, dependency_task_ids = ?,
            completed_at = ?, updated_at = ?
      WHERE id = ?`,
    [
      hasOwn(input, 'milestoneId')
        ? await normalizeMilestoneId(db, input.milestoneId, current.projectId)
        : current.milestoneId,
      hasOwn(input, 'title') ? text(input.title, current.title, 120) : current.title,
      hasOwn(input, 'description') ? text(input.description, '', 1000) : current.description,
      hasOwn(input, 'startDate') ? normalizeDate(input.startDate, null) : current.startDate,
      hasOwn(input, 'deadline') ? normalizeDate(input.deadline, project.deadline) : current.deadline,
      hasOwn(input, 'time') ? normalizeTime(input.time, null) : current.time,
      hasOwn(input, 'scheduledDate')
        ? normalizeDate(input.scheduledDate, null)
        : current.scheduledDate,
      numberInRange(
        hasOwn(input, 'estimatedMinutes') ? input.estimatedMinutes : current.estimatedMinutes,
        1,
        10000,
        current.estimatedMinutes
      ),
      numberInRange(hasOwn(input, 'importance') ? input.importance : current.importance, 1, 5, current.importance),
      numberInRange(hasOwn(input, 'difficulty') ? input.difficulty : current.difficulty, 1, 5, current.difficulty),
      status === 'completed'
        ? 100
        : numberInRange(hasOwn(input, 'progress') ? input.progress : current.progress, 0, 100, current.progress),
      status,
      JSON.stringify(
        hasOwn(input, 'dependencyTaskIds')
          ? parseDependencyIds(input.dependencyTaskIds)
          : current.dependencyTaskIds
      ),
      completedAt,
      timestamp,
      taskId
    ]
  );
  await persistProjectProgress(db, current.projectId);
  await updateLinkedNormalTask(taskId);
  return requireProjectTask(db, taskId);
}

async function deleteProjectTask(taskId) {
  const db = await getDatabase();
  const task = await requireProjectTask(db, taskId);
  if (task.normalTaskId) {
    await unlinkNormalTaskFields(db, task.normalTaskId);
  }
  await run(db, 'DELETE FROM project_tasks WHERE id = ?', [taskId]);
  await persistProjectProgress(db, task.projectId);
  return task;
}

async function completeProjectTask(taskId, completed, now = new Date()) {
  const task = await updateProjectTask(taskId, {
    status: completed ? 'completed' : 'in_progress',
    progress: completed ? 100 : 0
  }, now);
  if (task.normalTaskId) {
    try {
      await taskRepository.setTaskCompleted(task.normalTaskId, completed, now);
    } catch (error) {
      const db = await getDatabase();
      await run(
        db,
        'UPDATE project_tasks SET normal_task_id = NULL, updated_at = ? WHERE id = ?',
        [iso(now), task.id]
      );
    }
  }
  return task;
}

async function addProjectTaskToToday(taskId, scheduledDate = localDateKey(new Date()), now = new Date()) {
  const db = await getDatabase();
  const projectTask = await requireProjectTask(db, taskId);
  const date = normalizeDate(scheduledDate, localDateKey(new Date()));
  let normalTask = projectTask.normalTaskId
    ? await taskRepository.getTask(projectTask.normalTaskId)
    : null;
  const input = await projectTaskToNormalTaskInput(db, projectTask, date, normalTask);
  if (normalTask) {
    normalTask = await taskRepository.updateTask(normalTask.id, input, now);
  } else {
    normalTask = await taskRepository.createTask(input, now);
  }
  const nextStatus = projectTask.status === 'completed' ? 'completed' : 'in_progress';
  await run(
    db,
    `UPDATE project_tasks
        SET normal_task_id = ?, scheduled_date = ?, status = ?, updated_at = ?
      WHERE id = ?`,
    [normalTask.id, date, nextStatus, iso(now), projectTask.id]
  );
  await persistProjectProgress(db, projectTask.projectId);
  return {
    projectTask: await requireProjectTask(db, projectTask.id),
    task: normalTask
  };
}

async function setProjectTaskCompletedFromNormal(projectTaskId, completed, now = new Date()) {
  if (!projectTaskId) {
    return null;
  }
  return updateProjectTask(projectTaskId, {
    status: completed ? 'completed' : 'in_progress',
    progress: completed ? 100 : 0
  }, now);
}

async function updateProjectTaskFromNormalTask(normalTask, now = new Date()) {
  if (!normalTask?.projectTaskId) {
    return null;
  }
  return updateProjectTask(normalTask.projectTaskId, {
    title: normalTask.title,
    description: normalTask.description,
    deadline: normalTask.date,
    time: normalTask.time,
    scheduledDate: normalTask.date,
    status: normalTask.completed ? 'completed' : 'in_progress',
    progress: normalTask.completed ? 100 : 0
  }, now);
}

async function unlinkNormalTask(taskId) {
  const db = await getDatabase();
  const row = await getFirst(
    db,
    'SELECT id FROM project_tasks WHERE normal_task_id = ?',
    [taskId]
  );
  if (row?.id) {
    await run(
      db,
      'UPDATE project_tasks SET normal_task_id = NULL, updated_at = ? WHERE id = ?',
      [iso(), row.id]
    );
  }
  return row?.id || null;
}

module.exports = {
  addProjectTaskToToday,
  completeProjectTask,
  createMilestone,
  createProject,
  createProjectTask,
  deleteMilestone,
  deleteProject,
  deleteProjectTask,
  listProjectState,
  setProjectTaskCompletedFromNormal,
  unlinkNormalTask,
  updateMilestone,
  updateProject,
  updateProjectTask,
  updateProjectTaskFromNormalTask
};
