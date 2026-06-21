const crypto = require('crypto');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PROJECT_STATUSES = new Set(['not_started', 'in_progress', 'completed', 'paused']);
const TASK_STATUSES = new Set(['not_started', 'in_progress', 'completed']);
const PROJECT_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const DELETE_PROJECT_MODES = new Set(['deleteAll', 'keepTasks']);

const DEFAULT_CATEGORIES = Object.freeze([
  { name: '学習', description: '授業、試験、資格学習など' },
  { name: '研究', description: '研究テーマ、調査、発表準備など' },
  { name: '部活動', description: '練習、大会準備、チーム活動など' },
  { name: '個人開発', description: '制作、技術検証、改善タスクなど' },
  { name: 'イベント', description: '行事、発表会、交流会などの準備' },
  { name: 'その他', description: '分類に迷う長期課題' }
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function trimText(value, maxLength = 2000) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, maxLength);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

function isValidLocalDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
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

function normalizeDate(value, { nullable = false, fallback = null } = {}) {
  if (typeof value === 'string' && isValidLocalDate(value.trim())) {
    return value.trim();
  }
  if (nullable && (value === null || value === undefined || value === '')) {
    return null;
  }
  return fallback;
}

function compareDateKeys(left, right) {
  if (!isValidLocalDate(left) || !isValidLocalDate(right)) {
    return 0;
  }
  return left.localeCompare(right);
}

function assertNonEmpty(value, message) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(message);
  }
}

function assertDateRange(startDate, deadline) {
  if (startDate && deadline && compareDateKeys(startDate, deadline) > 0) {
    throw new Error('開始日は期限以前の日付にしてください。');
  }
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
  return [...new Set(safeArray(values).filter((value) => typeof value === 'string' && value))];
}

function defaultCategoryRows(now = new Date()) {
  return DEFAULT_CATEGORIES.map((category) =>
    normalizeCategoryInput(category, null, { now })
  );
}

function categoryExists(categories, categoryId) {
  return safeArray(categories).some((category) => category.id === categoryId);
}

function projectExists(projects, projectId) {
  return safeArray(projects).some((project) => project.id === projectId);
}

function milestoneExists(milestones, milestoneId, projectId = null) {
  return safeArray(milestones).some(
    (milestone) =>
      milestone.id === milestoneId &&
      (!projectId || milestone.projectId === projectId)
  );
}

function createProjectStore({
  paths,
  readJson,
  safeWriteJson,
  ensureJsonFile,
  getTasks,
  saveTasks,
  normalizeTaskInput,
  clearNotificationStateForTask
}) {
  function id(prefix) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  async function readArray(filePath, normalizer, context = {}) {
    const raw = await readJson(filePath);
    if (!Array.isArray(raw)) {
      throw new Error(`${filePath}のルートは配列にしてください。`);
    }
    return raw.map((item, index) => normalizer(item, null, { ...context, index }));
  }

  async function writeCategories(categories) {
    await safeWriteJson(paths.projectCategoriesFile, categories);
  }

  async function writeProjects(projects) {
    await safeWriteJson(paths.projectsFile, projects);
  }

  async function writeMilestones(milestones) {
    await safeWriteJson(paths.milestonesFile, milestones);
  }

  async function writeProjectTasks(projectTasks) {
    await safeWriteJson(paths.projectTasksFile, projectTasks);
  }

  async function ensureInitialFiles() {
    // 既存の通常タスクと混ざらないよう、長期プロジェクト用のJSONは別ファイルで用意します。
    // 初回だけ代表的な分野を生成し、ユーザーがすぐ分類を始められる状態にします。
    await ensureJsonFile('categories.json', defaultCategoryRows());
    await ensureJsonFile('projects.json', []);
    await ensureJsonFile('milestones.json', []);
    await ensureJsonFile('projectTasks.json', []);
  }

  async function readState() {
    const categories = await readArray(paths.projectCategoriesFile, normalizeCategoryInput);
    const projects = await readArray(paths.projectsFile, normalizeProjectInput, {
      categories
    });
    const milestones = await readArray(paths.milestonesFile, normalizeMilestoneInput, {
      projects
    });
    const projectTasks = await readArray(paths.projectTasksFile, normalizeProjectTaskInput, {
      projects,
      milestones
    });
    return recalculateProjectProgress({
      categories,
      projects,
      milestones,
      projectTasks
    });
  }

  async function getProjectStateResult() {
    try {
      const state = await readState();
      return { ...state, error: null };
    } catch (error) {
      console.error('[ProjectDataLoadError]', error);
      return {
        categories: [],
        projects: [],
        milestones: [],
        projectTasks: [],
        error: 'プロジェクトデータを読み込めませんでした。JSONファイルを確認してください。'
      };
    }
  }

  async function saveState(state, { saveCategories = false, saveMilestones = false } = {}) {
    const next = recalculateProjectProgress(state);
    if (saveCategories) {
      await writeCategories(next.categories);
    }
    await writeProjects(next.projects);
    if (saveMilestones) {
      await writeMilestones(next.milestones);
    }
    await writeProjectTasks(next.projectTasks);
    return next;
  }

  async function createCategory(input) {
    const state = await readState();
    const category = normalizeCategoryInput(input, null);
    const categories = [...state.categories, category];
    await writeCategories(categories);
    return category;
  }

  async function updateCategory(categoryId, input) {
    assertNonEmpty(categoryId, '分野IDが不正です。');
    const state = await readState();
    const index = state.categories.findIndex((category) => category.id === categoryId);
    if (index === -1) {
      throw new Error('編集対象の分野が見つかりません。');
    }
    const category = normalizeCategoryInput(input, state.categories[index]);
    const categories = [...state.categories];
    categories[index] = category;
    await writeCategories(categories);
    return category;
  }

  async function deleteCategory(categoryId) {
    assertNonEmpty(categoryId, '分野IDが不正です。');
    const state = await readState();
    const category = state.categories.find((candidate) => candidate.id === categoryId);
    if (!category) {
      throw new Error('削除対象の分野が見つかりません。');
    }
    const categories = state.categories.filter((candidate) => candidate.id !== categoryId);
    const projects = state.projects.map((project) =>
      project.categoryId === categoryId
        ? { ...project, categoryId: null, updatedAt: nowIso() }
        : project
    );
    await writeCategories(categories);
    await writeProjects(projects);
    return category;
  }

  async function createProject(input) {
    const state = await readState();
    const project = normalizeProjectInput(input, null, {
      categories: state.categories,
      strict: true
    });
    await writeProjects([...state.projects, project]);
    return project;
  }

  async function updateProject(projectId, input) {
    assertNonEmpty(projectId, 'プロジェクトIDが不正です。');
    const state = await readState();
    const index = state.projects.findIndex((project) => project.id === projectId);
    if (index === -1) {
      throw new Error('編集対象のプロジェクトが見つかりません。');
    }
    const project = normalizeProjectInput(input, state.projects[index], {
      categories: state.categories,
      strict: true
    });
    const projects = [...state.projects];
    projects[index] = project;
    await writeProjects(recalculateProjectProgress({ ...state, projects }).projects);
    await updateLinkedNormalTasksForProject(project.id, { ...state, projects });
    return project;
  }

  async function deleteProject(projectId, mode = 'deleteAll') {
    assertNonEmpty(projectId, 'プロジェクトIDが不正です。');
    if (!DELETE_PROJECT_MODES.has(mode)) {
      throw new Error('プロジェクト削除方法が不正です。');
    }
    const state = await readState();
    const project = state.projects.find((candidate) => candidate.id === projectId);
    if (!project) {
      throw new Error('削除対象のプロジェクトが見つかりません。');
    }
    const projectTaskIds = state.projectTasks
      .filter((task) => task.projectId === projectId)
      .map((task) => task.id);
    let milestones = state.milestones.filter((milestone) => milestone.projectId !== projectId);
    let projectTasks = state.projectTasks;
    if (mode === 'deleteAll') {
      projectTasks = state.projectTasks.filter((task) => task.projectId !== projectId);
      await removeLinkedNormalTasks(projectTaskIds);
    } else {
      projectTasks = state.projectTasks.map((task) =>
        task.projectId === projectId
          ? {
              ...task,
              projectId: null,
              milestoneId: null,
              dependencyTaskIds: task.dependencyTaskIds.filter(
                (dependencyId) => !projectTaskIds.includes(dependencyId)
              ),
              updatedAt: nowIso()
            }
          : task
      );
      milestones = state.milestones.filter((milestone) => milestone.projectId !== projectId);
      const orphanState = {
        ...state,
        projects: state.projects.filter((candidate) => candidate.id !== projectId),
        milestones,
        projectTasks
      };
      for (const task of projectTasks.filter(
        (candidate) => projectTaskIds.includes(candidate.id) && candidate.normalTaskId
      )) {
        await updateLinkedNormalTask(task, orphanState);
      }
    }
    await saveState(
      {
        categories: state.categories,
        projects: state.projects.filter((candidate) => candidate.id !== projectId),
        milestones,
        projectTasks
      },
      { saveMilestones: true }
    );
    return project;
  }

  async function createMilestone(input) {
    const state = await readState();
    const milestone = normalizeMilestoneInput(input, null, {
      projects: state.projects,
      strict: true
    });
    await writeMilestones([...state.milestones, milestone]);
    return milestone;
  }

  async function updateMilestone(milestoneId, input) {
    assertNonEmpty(milestoneId, 'マイルストーンIDが不正です。');
    const state = await readState();
    const index = state.milestones.findIndex((milestone) => milestone.id === milestoneId);
    if (index === -1) {
      throw new Error('編集対象のマイルストーンが見つかりません。');
    }
    const milestone = normalizeMilestoneInput(input, state.milestones[index], {
      projects: state.projects,
      strict: true
    });
    const milestones = [...state.milestones];
    milestones[index] = milestone;
    await writeMilestones(milestones);
    await updateLinkedNormalTasksForProject(milestone.projectId, { ...state, milestones });
    return milestone;
  }

  async function deleteMilestone(milestoneId) {
    assertNonEmpty(milestoneId, 'マイルストーンIDが不正です。');
    const state = await readState();
    const milestone = state.milestones.find((candidate) => candidate.id === milestoneId);
    if (!milestone) {
      throw new Error('削除対象のマイルストーンが見つかりません。');
    }
    const milestones = state.milestones.filter((candidate) => candidate.id !== milestoneId);
    const projectTasks = state.projectTasks.map((task) =>
      task.milestoneId === milestoneId
        ? { ...task, milestoneId: null, updatedAt: nowIso() }
        : task
    );
    await saveState({ ...state, milestones, projectTasks }, { saveMilestones: true });
    await updateLinkedNormalTasksForProject(milestone.projectId, {
      ...state,
      milestones,
      projectTasks
    });
    return milestone;
  }

  async function createProjectTask(input) {
    const state = await readState();
    const task = normalizeProjectTaskInput(input, null, {
      projects: state.projects,
      milestones: state.milestones,
      strict: true
    });
    await saveState({ ...state, projectTasks: [...state.projectTasks, task] });
    return task;
  }

  async function updateProjectTask(taskId, input) {
    assertNonEmpty(taskId, 'プロジェクトタスクIDが不正です。');
    const state = await readState();
    const index = state.projectTasks.findIndex((task) => task.id === taskId);
    if (index === -1) {
      throw new Error('編集対象のプロジェクトタスクが見つかりません。');
    }
    const task = normalizeProjectTaskInput(input, state.projectTasks[index], {
      projects: state.projects,
      milestones: state.milestones,
      strict: true
    });
    const projectTasks = [...state.projectTasks];
    projectTasks[index] = task;
    await saveState({ ...state, projectTasks });
    await updateLinkedNormalTask(task, { ...state, projectTasks });
    return task;
  }

  async function deleteProjectTask(taskId) {
    assertNonEmpty(taskId, 'プロジェクトタスクIDが不正です。');
    const state = await readState();
    const task = state.projectTasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      throw new Error('削除対象のプロジェクトタスクが見つかりません。');
    }
    const projectTasks = state.projectTasks
      .filter((candidate) => candidate.id !== taskId)
      .map((candidate) => ({
        ...candidate,
        dependencyTaskIds: candidate.dependencyTaskIds.filter((dependencyId) => dependencyId !== taskId)
      }));
    await saveState({ ...state, projectTasks });
    await removeLinkedNormalTasks([taskId]);
    return task;
  }

  async function completeProjectTask(taskId, completed = true) {
    const status = completed ? 'completed' : 'in_progress';
    const progress = completed ? 100 : 0;
    return updateProjectTask(taskId, { status, progress });
  }

  async function addProjectTaskToToday(taskId, scheduledDate = null) {
    assertNonEmpty(taskId, 'プロジェクトタスクIDが不正です。');
    const today = localDateKey();
    const date = normalizeDate(scheduledDate, { nullable: true }) || today;
    const state = await readState();
    const task = state.projectTasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      throw new Error('通常タスクへ表示するプロジェクトタスクが見つかりません。');
    }
    const tasks = await getTasks();
    const existingIndex = tasks.findIndex(
      (candidate) =>
        candidate.projectTaskId === task.id ||
        (task.normalTaskId && candidate.id === task.normalTaskId)
    );
    const current = existingIndex >= 0 ? tasks[existingIndex] : null;
    const normalTask = normalizeTaskInput(projectTaskToNormalTaskInput(task, state, date, current));
    const nextTasks = [...tasks];
    if (existingIndex >= 0) {
      nextTasks[existingIndex] = normalTask;
    } else {
      nextTasks.push(normalTask);
    }
    await saveTasks(nextTasks);

    const projectTasks = state.projectTasks.map((candidate) =>
      candidate.id === task.id
        ? {
            ...candidate,
            scheduledDate: date,
            normalTaskId: normalTask.id,
            updatedAt: nowIso()
          }
        : candidate
    );
    await saveState({ ...state, projectTasks });
    return { projectTask: projectTasks.find((candidate) => candidate.id === task.id), task: normalTask };
  }

  async function setProjectTaskCompletedFromNormal(projectTaskId, completed) {
    if (!projectTaskId) {
      return null;
    }
    const state = await readState();
    const task = state.projectTasks.find((candidate) => candidate.id === projectTaskId);
    if (!task) {
      return null;
    }
    const nextTask = normalizeProjectTaskInput(
      {
        ...task,
        status: completed ? 'completed' : 'in_progress',
        progress: completed ? 100 : Math.min(task.progress, 99)
      },
      task,
      {
        projects: state.projects,
        milestones: state.milestones
      }
    );
    const projectTasks = state.projectTasks.map((candidate) =>
      candidate.id === projectTaskId ? nextTask : candidate
    );
    await saveState({ ...state, projectTasks });
    return nextTask;
  }

  async function syncProjectTaskFromNormalTask(normalTask) {
    if (!normalTask?.projectTaskId) {
      return null;
    }
    const state = await readState();
    const task = state.projectTasks.find((candidate) => candidate.id === normalTask.projectTaskId);
    if (!task) {
      return null;
    }
    const nextTask = normalizeProjectTaskInput(
      {
        ...task,
        scheduledDate: normalTask.date || task.scheduledDate,
        status: normalTask.completed ? 'completed' : task.status === 'completed' ? 'in_progress' : task.status,
        progress: normalTask.completed ? 100 : task.status === 'completed' ? Math.min(task.progress, 99) : task.progress
      },
      task,
      {
        projects: state.projects,
        milestones: state.milestones
      }
    );
    const projectTasks = state.projectTasks.map((candidate) =>
      candidate.id === task.id ? nextTask : candidate
    );
    await saveState({ ...state, projectTasks });
    return nextTask;
  }

  async function unlinkNormalTask(taskId) {
    if (!taskId) {
      return null;
    }
    const state = await readState();
    const task = state.projectTasks.find((candidate) => candidate.normalTaskId === taskId);
    if (!task) {
      return null;
    }
    const projectTasks = state.projectTasks.map((candidate) =>
      candidate.id === task.id
        ? { ...candidate, normalTaskId: null, updatedAt: nowIso() }
        : candidate
    );
    await saveState({ ...state, projectTasks });
    return task;
  }

  async function updateLinkedNormalTask(projectTask, state) {
    if (!projectTask.normalTaskId) {
      return null;
    }
    const tasks = await getTasks();
    const index = tasks.findIndex((task) => task.id === projectTask.normalTaskId);
    if (index === -1) {
      return unlinkNormalTask(projectTask.normalTaskId);
    }
    const normalTask = normalizeTaskInput(
      projectTaskToNormalTaskInput(projectTask, state, projectTask.scheduledDate, tasks[index])
    );
    const nextTasks = [...tasks];
    nextTasks[index] = normalTask;
    await saveTasks(nextTasks);
    return normalTask;
  }

  async function updateLinkedNormalTasksForProject(projectId, state) {
    const linkedTasks = state.projectTasks.filter(
      (task) => task.projectId === projectId && task.normalTaskId
    );
    for (const task of linkedTasks) {
      await updateLinkedNormalTask(task, state);
    }
  }

  async function removeLinkedNormalTasks(projectTaskIds) {
    const ids = new Set(projectTaskIds);
    if (ids.size === 0) {
      return;
    }
    const tasks = await getTasks();
    const removedTaskIds = tasks
      .filter((task) => ids.has(task.projectTaskId))
      .map((task) => task.id);
    const nextTasks = tasks.filter((task) => !ids.has(task.projectTaskId));
    if (nextTasks.length !== tasks.length) {
      await saveTasks(nextTasks);
      for (const taskId of removedTaskIds) {
        await clearNotificationStateForTask(taskId);
      }
    }
  }

  return {
    ensureInitialFiles,
    getProjectStateResult,
    createCategory,
    updateCategory,
    deleteCategory,
    createProject,
    updateProject,
    deleteProject,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    createProjectTask,
    updateProjectTask,
    deleteProjectTask,
    completeProjectTask,
    addProjectTaskToToday,
    setProjectTaskCompletedFromNormal,
    syncProjectTaskFromNormalTask,
    unlinkNormalTask
  };
}

function normalizeCategoryInput(input, current = null, options = {}) {
  const source = isPlainObject(input) ? input : {};
  const previous = isPlainObject(current) ? current : {};
  const timestamp = nowIso(options.now);
  const name = trimText(source.name ?? previous.name, 80);
  assertNonEmpty(name, '分野名を入力してください。');
  return {
    id: previous.id || (typeof source.id === 'string' && source.id.trim()) || `category-${crypto.randomUUID()}`,
    name,
    description: trimText(source.description ?? previous.description, 1000),
    createdAt: previous.createdAt || source.createdAt || timestamp,
    updatedAt: timestamp
  };
}

function normalizeProjectInput(input, current = null, options = {}) {
  const source = isPlainObject(input) ? input : {};
  const previous = isPlainObject(current) ? current : {};
  const timestamp = nowIso(options.now);
  const name = trimText(source.name ?? previous.name, 120);
  assertNonEmpty(name, 'プロジェクト名を入力してください。');
  const categoryId = source.categoryId ?? previous.categoryId ?? null;
  if (options.strict && !categoryExists(options.categories || [], categoryId)) {
    throw new Error('存在する分野を選択してください。');
  }
  const startDate = normalizeDate(source.startDate ?? previous.startDate, {
    nullable: true
  });
  const deadline = normalizeDate(source.deadline ?? previous.deadline, {
    nullable: true
  });
  if (options.strict && !deadline) {
    throw new Error('プロジェクトの最終期限を入力してください。');
  }
  assertDateRange(startDate, deadline);
  const status = PROJECT_STATUSES.has(source.status)
    ? source.status
    : PROJECT_STATUSES.has(previous.status)
      ? previous.status
      : 'not_started';
  const priority = PROJECT_PRIORITIES.has(source.priority)
    ? source.priority
    : PROJECT_PRIORITIES.has(previous.priority)
      ? previous.priority
      : 'medium';
  return {
    id: previous.id || (typeof source.id === 'string' && source.id.trim()) || `project-${crypto.randomUUID()}`,
    categoryId: categoryExists(options.categories || [], categoryId) ? categoryId : null,
    name,
    description: trimText(source.description ?? previous.description, 3000),
    startDate,
    deadline,
    status,
    priority,
    progress: clampNumber(source.progress ?? previous.progress, 0, 100, 0),
    estimatedTotalMinutes: clampNumber(
      source.estimatedTotalMinutes ?? previous.estimatedTotalMinutes,
      0,
      100_000,
      0
    ),
    createdAt: previous.createdAt || source.createdAt || timestamp,
    updatedAt: timestamp
  };
}

function normalizeMilestoneInput(input, current = null, options = {}) {
  const source = isPlainObject(input) ? input : {};
  const previous = isPlainObject(current) ? current : {};
  const timestamp = nowIso(options.now);
  const projectId = source.projectId ?? previous.projectId ?? null;
  if (options.strict && !projectExists(options.projects || [], projectId)) {
    throw new Error('存在するプロジェクトを選択してください。');
  }
  const title = trimText(source.title ?? previous.title, 120);
  assertNonEmpty(title, 'マイルストーン名を入力してください。');
  const deadline = normalizeDate(source.deadline ?? previous.deadline, {
    nullable: true
  });
  if (options.strict && !deadline) {
    throw new Error('マイルストーンの期限を入力してください。');
  }
  const status = TASK_STATUSES.has(source.status)
    ? source.status
    : TASK_STATUSES.has(previous.status)
      ? previous.status
      : 'not_started';
  return {
    id: previous.id || (typeof source.id === 'string' && source.id.trim()) || `milestone-${crypto.randomUUID()}`,
    projectId: projectExists(options.projects || [], projectId) ? projectId : null,
    title,
    description: trimText(source.description ?? previous.description, 2000),
    deadline,
    status,
    order: clampNumber(source.order ?? previous.order, 0, 10_000, 0),
    createdAt: previous.createdAt || source.createdAt || timestamp,
    updatedAt: timestamp
  };
}

function normalizeProjectTaskInput(input, current = null, options = {}) {
  const source = isPlainObject(input) ? input : {};
  const previous = isPlainObject(current) ? current : {};
  const timestamp = nowIso(options.now);
  const projectId = source.projectId ?? previous.projectId ?? null;
  if (options.strict && !projectExists(options.projects || [], projectId)) {
    throw new Error('存在するプロジェクトを選択してください。');
  }
  const milestoneId = source.milestoneId ?? previous.milestoneId ?? null;
  if (
    options.strict &&
    milestoneId &&
    !milestoneExists(options.milestones || [], milestoneId, projectId)
  ) {
    throw new Error('同じプロジェクト内のマイルストーンを選択してください。');
  }
  const title = trimText(source.title ?? previous.title, 160);
  assertNonEmpty(title, 'タスク名を入力してください。');
  const startDate = normalizeDate(source.startDate ?? previous.startDate, {
    nullable: true
  });
  const deadline = normalizeDate(source.deadline ?? previous.deadline, {
    nullable: true
  });
  if (options.strict && !deadline) {
    throw new Error('タスクの期限を入力してください。');
  }
  assertDateRange(startDate, deadline);
  const scheduledDate = normalizeDate(source.scheduledDate ?? previous.scheduledDate, {
    nullable: true
  });
  const status = TASK_STATUSES.has(source.status)
    ? source.status
    : TASK_STATUSES.has(previous.status)
      ? previous.status
      : 'not_started';
  const progress =
    status === 'completed'
      ? 100
      : Math.min(99, clampNumber(source.progress ?? previous.progress, 0, 100, 0));
  const completedAt =
    status === 'completed'
      ? previous.status === 'completed' && previous.completedAt
        ? previous.completedAt
        : source.completedAt || timestamp
      : null;
  const taskId = previous.id || (typeof source.id === 'string' && source.id.trim()) || `project-task-${crypto.randomUUID()}`;
  return {
    id: taskId,
    projectId: projectExists(options.projects || [], projectId) ? projectId : null,
    milestoneId:
      milestoneId && milestoneExists(options.milestones || [], milestoneId, projectId)
        ? milestoneId
        : null,
    title,
    description: trimText(source.description ?? previous.description, 3000),
    startDate,
    deadline,
    scheduledDate,
    estimatedMinutes: clampNumber(
      source.estimatedMinutes ?? previous.estimatedMinutes,
      1,
      100_000,
      30
    ),
    importance: clampNumber(source.importance ?? previous.importance, 1, 5, 3),
    difficulty: clampNumber(source.difficulty ?? previous.difficulty, 1, 5, 3),
    progress,
    status,
    dependencyTaskIds: uniqueStrings(source.dependencyTaskIds ?? previous.dependencyTaskIds).filter(
      (dependencyId) => dependencyId !== taskId
    ),
    normalTaskId:
      typeof (source.normalTaskId ?? previous.normalTaskId) === 'string'
        ? (source.normalTaskId ?? previous.normalTaskId)
        : null,
    completedAt,
    createdAt: previous.createdAt || source.createdAt || timestamp,
    updatedAt: timestamp
  };
}

function recalculateProjectProgress(state) {
  const projectTasks = state.projectTasks || [];
  const projects = (state.projects || []).map((project) => {
    const tasks = projectTasks.filter((task) => task.projectId === project.id);
    return {
      ...project,
      progress: calculateProjectProgress(project, tasks)
    };
  });
  return {
    categories: state.categories || [],
    projects,
    milestones: state.milestones || [],
    projectTasks
  };
}

function calculateProjectProgress(project, tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return project.progress || 0;
  }
  const totalMinutes = tasks.reduce((total, task) => total + Math.max(0, task.estimatedMinutes || 0), 0);
  if (totalMinutes > 0) {
    const completedMinutes = tasks.reduce((total, task) => {
      const progress = task.status === 'completed' ? 100 : task.progress || 0;
      return total + Math.max(0, task.estimatedMinutes || 0) * (progress / 100);
    }, 0);
    return clampNumber((completedMinutes / totalMinutes) * 100, 0, 100, 0);
  }
  const completedCount = tasks.filter((task) => task.status === 'completed').length;
  return clampNumber((completedCount / tasks.length) * 100, 0, 100, 0);
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function projectTaskToNormalTaskInput(projectTask, state, date, current = null) {
  const project = state.projects.find((candidate) => candidate.id === projectTask.projectId) || null;
  const category = state.categories.find((candidate) => candidate.id === project?.categoryId) || null;
  const milestone =
    state.milestones.find((candidate) => candidate.id === projectTask.milestoneId) || null;
  const priorityMap = {
    urgent: 'high',
    high: 'high',
    medium: 'normal',
    low: 'low'
  };
  return {
    ...(current || {}),
    id: current?.id || projectTask.normalTaskId || `linked-${projectTask.id}`,
    title: projectTask.title,
    description: projectTask.description,
    date: date || projectTask.scheduledDate || localDateKey(),
    time: current?.time || null,
    genre: category?.name || project?.name || 'プロジェクト',
    priority: priorityMap[project?.priority] || 'normal',
    completed: projectTask.status === 'completed',
    source: 'project',
    projectTaskId: projectTask.id,
    projectId: project?.id || null,
    projectName: project?.name || '未分類プロジェクト',
    projectCategoryId: category?.id || null,
    projectCategoryName: category?.name || '未分類',
    projectMilestoneId: milestone?.id || null,
    projectMilestoneTitle: milestone?.title || ''
  };
}

module.exports = {
  createProjectStore,
  defaultCategoryRows,
  normalizeCategoryInput,
  normalizeMilestoneInput,
  normalizeProjectInput,
  normalizeProjectTaskInput
};
