const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { createProjectStore } = require('../main/projectStore');
const { normalizeTaskInput, validateTasks } = require('../main/fileManager');

async function createStore() {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'taskmate-project-store-'));
  const paths = {
    dataRoot: root,
    projectCategoriesFile: path.join(root, 'categories.json'),
    projectsFile: path.join(root, 'projects.json'),
    milestonesFile: path.join(root, 'milestones.json'),
    projectTasksFile: path.join(root, 'projectTasks.json'),
    tasksFile: path.join(root, 'tasks.json')
  };
  let tasks = [];
  const store = createProjectStore({
    paths,
    readJson: async (filePath) => JSON.parse(await fs.promises.readFile(filePath, 'utf8')),
    safeWriteJson: async (filePath, value) => {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    },
    ensureJsonFile: async (fileName, fallback) => {
      const filePath = path.join(root, fileName);
      try {
        await fs.promises.access(filePath);
      } catch {
        await fs.promises.writeFile(filePath, `${JSON.stringify(fallback, null, 2)}\n`, 'utf8');
      }
    },
    getTasks: async () => tasks,
    saveTasks: async (nextTasks) => {
      tasks = validateTasks(nextTasks);
    },
    normalizeTaskInput,
    clearNotificationStateForTask: async () => {}
  });
  return {
    store,
    getTasks: () => tasks,
    cleanup: () => fs.promises.rm(root, { recursive: true, force: true })
  };
}

test('project store creates independent JSON files and links a project task to normal tasks', async () => {
  const { store, getTasks, cleanup } = await createStore();
  try {
    await store.ensureInitialFiles();
    const initial = await store.getProjectStateResult();
    assert.equal(initial.error, null);
    assert.ok(initial.categories.length >= 1);

    const category = await store.createCategory({
      name: 'イベント',
      description: '行事や発表会'
    });
    const project = await store.createProject({
      categoryId: category.id,
      name: 'サンプルイベント準備',
      description: 'イベント当日までの準備',
      startDate: '2026-06-19',
      deadline: '2026-08-08',
      priority: 'high',
      estimatedTotalMinutes: 300
    });
    const milestone = await store.createMilestone({
      projectId: project.id,
      title: '関係者確認',
      deadline: '2026-06-30',
      order: 1
    });
    const projectTask = await store.createProjectTask({
      projectId: project.id,
      milestoneId: milestone.id,
      title: '関係者へ確認する',
      deadline: '2026-06-25',
      scheduledDate: '2026-06-19',
      estimatedMinutes: 30,
      importance: 5,
      difficulty: 2
    });

    const linked = await store.addProjectTaskToToday(projectTask.id, '2026-06-19');
    assert.equal(linked.task.source, 'project');
    assert.equal(linked.task.projectTaskId, projectTask.id);
    assert.equal(getTasks().length, 1);

    await store.setProjectTaskCompletedFromNormal(projectTask.id, true);
    const completedState = await store.getProjectStateResult();
    assert.equal(completedState.projectTasks[0].status, 'completed');
    assert.equal(completedState.projects.find((candidate) => candidate.id === project.id).progress, 100);
  } finally {
    await cleanup();
  }
});

test('project store keeps completed projects at 100 percent progress', async () => {
  const { store, cleanup } = await createStore();
  try {
    await store.ensureInitialFiles();
    const initial = await store.getProjectStateResult();
    const category = initial.categories[0];
    const project = await store.createProject({
      categoryId: category.id,
      name: 'アカウント管理',
      description: 'ログインと同期の仕上げ',
      startDate: '2026-06-24',
      deadline: '2026-07-01',
      priority: 'medium',
      estimatedTotalMinutes: 0
    });

    await store.updateProject(project.id, { status: 'completed' });
    const state = await store.getProjectStateResult();
    const completedProject = state.projects.find((candidate) => candidate.id === project.id);

    assert.equal(completedProject.status, 'completed');
    assert.equal(completedProject.progress, 100);
  } finally {
    await cleanup();
  }
});
