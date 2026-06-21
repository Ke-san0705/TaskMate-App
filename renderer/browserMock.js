const INITIAL_SETTINGS = {
  selectedCharacter: 'Chara1',
  showCharacter: true,
  characterScale: 100,
  bubbleScale: 100,
  windowPosition: { x: null, y: null },
  bubblePosition: 'right',
  autoStart: true,
  clickImageDuration: 2000,
  notificationMinutesBefore: 30,
  notificationOffsets: [30, 0],
  useNativeNotifications: true,
  isMainWindowVisible: true,
  genreHistory: [],
  behaviorEnabled: true,
  ambientEffects: true,
  autonomousMovement: true,
  completionReactions: true,
  relationshipMemoryEnabled: true,
  behaviorIntensity: 'normal',
  quietHours: {
    enabled: true,
    start: '22:00',
    end: '07:00'
  },
  projectSettings: {
    dailyAvailableMinutes: 120,
    weekdayAvailableMinutes: 120,
    weekendAvailableMinutes: 240,
    defaultSessionMinutes: 45,
    dailyRecommendationLimit: 5,
    deadlineWarningDays: 7,
    overdueNotificationsEnabled: true,
    progressNotificationsEnabled: true
  }
};

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}を読み込めませんでした。`);
  }
  return response.json();
}

export function installBrowserMock() {
  if (window.taskMate) {
    return;
  }

  let settings = { ...INITIAL_SETTINGS };
  let tasks = [];
  let categories = [
    {
      id: 'category-learning',
      name: '学習',
      description: '授業、試験、資格学習など',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'category-event',
      name: 'イベント',
      description: '行事、発表会、交流会などの準備',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  let projects = [];
  let milestones = [];
  let projectTasks = [];
  let focusTaskId = null;
  let behaviorState = createBehaviorState();
  const listeners = new Map();

  function emit(channel, payload) {
    for (const callback of listeners.get(channel) || []) {
      callback(payload);
    }
  }

  function subscribe(channel, callback) {
    const callbacks = listeners.get(channel) || new Set();
    callbacks.add(callback);
    listeners.set(channel, callbacks);
    return () => callbacks.delete(callback);
  }

  async function loadTasks() {
    try {
      tasks = await readJson('/data/tasks.json');
      emitBehavior();
      return { tasks, error: null };
    } catch (error) {
      return { tasks: [], error: error.message };
    }
  }

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function createBehaviorState(event = null) {
    const today = localDateKey();
    const activeTasks = tasks.filter((task) => !task.completed && task.date <= today);
    const focusTask = tasks.find((task) => task.id === focusTaskId && !task.completed) || null;
    const overdue = activeTasks.filter((task) => task.date < today).length;
    const level =
      overdue > 0 ? 'anxious' : activeTasks.length >= 3 ? 'restless' : activeTasks.length > 0 ? 'attentive' : 'calm';
    const mood = event?.mood || (focusTask ? 'focusing' : level);
    return {
      version: '1.1.0',
      generatedAt: new Date().toISOString(),
      mood,
      action: focusTask ? 'hold-focus-task' : 'browser-mock',
      dialogueCategory: event?.dialogueCategory || (focusTask ? 'focusing' : level),
      dialogueVariables: focusTask || activeTasks[0] || { count: activeTasks.length },
      targetTaskId: focusTask?.id || activeTasks[0]?.id || null,
      focusTaskId,
      focusTask,
      pressure: {
        score: overdue > 0 ? 72 : activeTasks.length >= 3 ? 48 : activeTasks.length > 0 ? 28 : 0,
        level,
        dominantReason: overdue > 0 ? 'overdue-task' : 'browser-mock',
        dominantTaskId: activeTasks[0]?.id || null,
        counts: { future: 0, calm: activeTasks.length, warning: 0, urgent: 0, overdue },
        taskStates: {}
      },
      ambientLevel: settings.ambientEffects === false ? 0 : Math.min(3, overdue + activeTasks.length),
      movement: null,
      reason: 'browser-mock',
      expiresAt: new Date(Date.now() + 30000).toISOString(),
      relationshipStage: 'browser'
    };
  }

  function emitBehavior(event) {
    behaviorState = createBehaviorState(event);
    emit('behavior', behaviorState);
  }

  async function setCompleted(taskId, completed) {
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      throw new Error('対象のタスクが見つかりません。');
    }
    task.completed = completed;
    emit('tasks', { tasks: [...tasks], error: null });
    if (completed && focusTaskId === taskId) {
      focusTaskId = null;
    }
    emitBehavior(completed ? { mood: 'relieved', dialogueCategory: 'relieved' } : null);
    return { ...task };
  }

  async function addTask(taskInput) {
    const task = {
      id: `task-${crypto.randomUUID()}`,
      title: taskInput.title,
      description: taskInput.description || '',
      date: taskInput.date,
      time: taskInput.time || null,
      genre: taskInput.genre || '',
      priority: taskInput.priority || 'normal',
      completed: false
    };
    tasks = [...tasks, task];
    emit('tasks', { tasks: [...tasks], error: null });
    emitBehavior();
    return { ...task };
  }

  async function updateTask(taskId, taskInput) {
    const index = tasks.findIndex((candidate) => candidate.id === taskId);
    if (index === -1) {
      throw new Error('編集対象のタスクが見つかりません。');
    }
    const current = tasks[index];
    const task = {
      ...current,
      title: taskInput.title,
      description: taskInput.description || '',
      date: taskInput.date,
      time: taskInput.time || null,
      genre: taskInput.genre || '',
      priority: taskInput.priority || 'normal'
    };
    tasks = tasks.map((candidate) => (candidate.id === taskId ? task : candidate));
    emit('tasks', { tasks: [...tasks], error: null });
    emitBehavior();
    return { ...task };
  }

  async function deleteTask(taskId) {
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      throw new Error('削除対象のタスクが見つかりません。');
    }
    tasks = tasks.filter((candidate) => candidate.id !== taskId);
    if (focusTaskId === taskId) {
      focusTaskId = null;
    }
    emit('tasks', { tasks: [...tasks], error: null });
    emitBehavior();
    return { ...task };
  }

  function projectState() {
    return {
      categories: [...categories],
      projects: [...projects],
      milestones: [...milestones],
      projectTasks: [...projectTasks],
      error: null
    };
  }

  function emitProjects() {
    emit('projects', projectState());
  }

  function makeId(prefix) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  async function createProjectCategory(input) {
    const category = {
      id: makeId('category'),
      name: input.name,
      description: input.description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    categories = [...categories, category];
    emitProjects();
    return category;
  }

  async function updateProjectCategory(categoryId, input) {
    let updated = null;
    categories = categories.map((category) => {
      if (category.id !== categoryId) {
        return category;
      }
      updated = { ...category, ...input, updatedAt: new Date().toISOString() };
      return updated;
    });
    emitProjects();
    return updated;
  }

  async function deleteProjectCategory(categoryId) {
    const category = categories.find((candidate) => candidate.id === categoryId);
    categories = categories.filter((candidate) => candidate.id !== categoryId);
    projects = projects.map((project) =>
      project.categoryId === categoryId ? { ...project, categoryId: null } : project
    );
    emitProjects();
    return category;
  }

  async function createProject(input) {
    const project = {
      id: makeId('project'),
      categoryId: input.categoryId,
      name: input.name,
      description: input.description || '',
      startDate: input.startDate || null,
      deadline: input.deadline || null,
      status: input.status || 'not_started',
      priority: input.priority || 'medium',
      progress: 0,
      estimatedTotalMinutes: Number(input.estimatedTotalMinutes || 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    projects = [...projects, project];
    emitProjects();
    emitBehavior({ dialogueCategory: 'project_created' });
    return project;
  }

  async function updateProject(projectId, input) {
    let updated = null;
    projects = projects.map((project) => {
      if (project.id !== projectId) {
        return project;
      }
      updated = { ...project, ...input, updatedAt: new Date().toISOString() };
      return updated;
    });
    emitProjects();
    return updated;
  }

  async function deleteProject(projectId) {
    const project = projects.find((candidate) => candidate.id === projectId);
    projects = projects.filter((candidate) => candidate.id !== projectId);
    milestones = milestones.filter((candidate) => candidate.projectId !== projectId);
    projectTasks = projectTasks.filter((candidate) => candidate.projectId !== projectId);
    emitProjects();
    return project;
  }

  async function createProjectMilestone(input) {
    const milestone = {
      id: makeId('milestone'),
      projectId: input.projectId,
      title: input.title,
      description: input.description || '',
      deadline: input.deadline,
      status: input.status || 'not_started',
      order: Number(input.order || 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    milestones = [...milestones, milestone];
    emitProjects();
    return milestone;
  }

  async function updateProjectMilestone(milestoneId, input) {
    let updated = null;
    milestones = milestones.map((milestone) => {
      if (milestone.id !== milestoneId) {
        return milestone;
      }
      updated = { ...milestone, ...input, updatedAt: new Date().toISOString() };
      return updated;
    });
    emitProjects();
    return updated;
  }

  async function deleteProjectMilestone(milestoneId) {
    const milestone = milestones.find((candidate) => candidate.id === milestoneId);
    milestones = milestones.filter((candidate) => candidate.id !== milestoneId);
    projectTasks = projectTasks.map((task) =>
      task.milestoneId === milestoneId ? { ...task, milestoneId: null } : task
    );
    emitProjects();
    return milestone;
  }

  async function createProjectTask(input) {
    const task = {
      id: makeId('project-task'),
      projectId: input.projectId,
      milestoneId: input.milestoneId || null,
      title: input.title,
      description: input.description || '',
      startDate: input.startDate || null,
      deadline: input.deadline,
      scheduledDate: input.scheduledDate || null,
      estimatedMinutes: Number(input.estimatedMinutes || 45),
      importance: Number(input.importance || 3),
      difficulty: Number(input.difficulty || 3),
      progress: Number(input.progress || 0),
      status: input.status || 'not_started',
      dependencyTaskIds: input.dependencyTaskIds || [],
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    projectTasks = [...projectTasks, task];
    emitProjects();
    return task;
  }

  async function updateProjectTask(taskId, input) {
    let updated = null;
    projectTasks = projectTasks.map((task) => {
      if (task.id !== taskId) {
        return task;
      }
      updated = { ...task, ...input, updatedAt: new Date().toISOString() };
      return updated;
    });
    emitProjects();
    return updated;
  }

  async function deleteProjectTask(taskId) {
    const task = projectTasks.find((candidate) => candidate.id === taskId);
    projectTasks = projectTasks.filter((candidate) => candidate.id !== taskId);
    emitProjects();
    return task;
  }

  async function completeProjectTask(taskId, completed = true) {
    return updateProjectTask(taskId, {
      status: completed ? 'completed' : 'in_progress',
      progress: completed ? 100 : 0,
      completedAt: completed ? new Date().toISOString() : null
    });
  }

  async function addProjectTaskToToday(taskId, scheduledDate) {
    const projectTask = projectTasks.find((candidate) => candidate.id === taskId);
    if (!projectTask) {
      throw new Error('プロジェクトタスクが見つかりません。');
    }
    const project = projects.find((candidate) => candidate.id === projectTask.projectId);
    const category = categories.find((candidate) => candidate.id === project?.categoryId);
    const task = {
      id: `linked-${projectTask.id}`,
      title: projectTask.title,
      description: projectTask.description || '',
      date: scheduledDate || localDateKey(),
      time: null,
      genre: category?.name || 'プロジェクト',
      priority: project?.priority === 'urgent' || project?.priority === 'high' ? 'high' : 'normal',
      completed: projectTask.status === 'completed',
      source: 'project',
      projectTaskId: projectTask.id,
      projectId: project?.id || null,
      projectName: project?.name || '未分類プロジェクト',
      projectCategoryId: category?.id || null,
      projectCategoryName: category?.name || '未分類'
    };
    tasks = [...tasks.filter((candidate) => candidate.projectTaskId !== projectTask.id), task];
    emit('tasks', { tasks: [...tasks], error: null });
    projectTasks = projectTasks.map((candidate) =>
      candidate.id === projectTask.id
        ? { ...candidate, scheduledDate: task.date, normalTaskId: task.id }
        : candidate
    );
    emitProjects();
    return { projectTask, task };
  }

  window.taskMate = {
    getTasks: loadTasks,
    addTask,
    updateTask,
    deleteTask,
    completeTask: (taskId) => setCompleted(taskId, true),
    undoCompleteTask: (taskId) => setCompleted(taskId, false),
    reloadTasks: loadTasks,
    getSettings: async () => ({ ...settings }),
    updateSettings: async (partial) => {
      settings = { ...settings, ...partial };
      emit('settings', { ...settings });
      emitBehavior();
      return { ...settings };
    },
    resetWindowPosition: async () => ({ ...settings }),
    getCharacters: async () => [
      { name: 'Chara1', valid: true, missingFiles: [] },
      { name: 'Chara2', valid: true, missingFiles: [] }
    ],
    getCharacterData: async (name) => ({
      name,
      valid: true,
      missingFiles: [],
      images: {
        wait: `/Chara/${name}/wait.png`,
        click: `/Chara/${name}/click.png`,
        alarm: `/Chara/${name}/alarm.png`
      },
      dialogues: await readJson(`/Chara/${name}/dialogues.json`),
      error: null
    }),
    selectCharacter: async (name) => {
      settings = { ...settings, selectedCharacter: name };
      emit('settings', { ...settings });
      return { ...settings };
    },
    setClickThrough: () => {},
    beginWindowDrag: () => {},
    moveWindowDrag: () => {},
    endWindowDrag: async () => null,
    resizeMainWindow: () => {},
    openSettings: () => {
      window.location.search = '?view=settings';
    },
    hideMainWindow: () => {},
    showMainWindow: () => {},
    showCharacterMenu: () => {},
    acknowledgeNotification: async () => ({ active: null }),
    getActiveNotification: async () => null,
    getBehaviorState: async () => behaviorState,
    recordInteraction: async () => ({ ok: true }),
    setFocusTask: async (taskId) => {
      focusTaskId = taskId;
      emitBehavior();
      return behaviorState;
    },
    clearFocusTask: async () => {
      focusTaskId = null;
      emitBehavior();
      return behaviorState;
    },
    resetLifeState: async () => {
      focusTaskId = null;
      emitBehavior({ mood: 'reconnecting', dialogueCategory: 'firstMeeting' });
      return behaviorState;
    },
    getProjectState: async () => projectState(),
    createProjectCategory,
    updateProjectCategory,
    deleteProjectCategory,
    createProject,
    updateProject,
    deleteProject,
    createProjectMilestone,
    updateProjectMilestone,
    deleteProjectMilestone,
    createProjectTask,
    updateProjectTask,
    deleteProjectTask,
    completeProjectTask,
    addProjectTaskToToday,
    onTasksUpdated: (callback) => subscribe('tasks', callback),
    onProjectsUpdated: (callback) => subscribe('projects', callback),
    onSettingsUpdated: (callback) => subscribe('settings', callback),
    onBehaviorUpdated: (callback) => subscribe('behavior', callback),
    onNotification: (callback) => subscribe('notification', callback),
    onNotificationCleared: (callback) => subscribe('notification-cleared', callback),
    onShowTaskList: (callback) => subscribe('show-task-list', callback)
  };
}
