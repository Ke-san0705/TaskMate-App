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
  genreHistory: []
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
      return { tasks, error: null };
    } catch (error) {
      return { tasks: [], error: error.message };
    }
  }

  async function setCompleted(taskId, completed) {
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      throw new Error('対象のタスクが見つかりません。');
    }
    task.completed = completed;
    emit('tasks', { tasks: [...tasks], error: null });
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
    return { ...task };
  }

  async function deleteTask(taskId) {
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      throw new Error('削除対象のタスクが見つかりません。');
    }
    tasks = tasks.filter((candidate) => candidate.id !== taskId);
    emit('tasks', { tasks: [...tasks], error: null });
    return { ...task };
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
    onTasksUpdated: (callback) => subscribe('tasks', callback),
    onSettingsUpdated: (callback) => subscribe('settings', callback),
    onNotification: (callback) => subscribe('notification', callback),
    onNotificationCleared: (callback) => subscribe('notification-cleared', callback),
    onShowTaskList: (callback) => subscribe('show-task-list', callback)
  };
}
