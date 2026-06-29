const React = require('react');
const { AppState } = require('react-native');
const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const {
  chooseDialogue,
  createBehaviorState,
  fillDialogue,
  groupTasksForMobile,
  localDateKey
} = require('@taskmate/core');
const { clearDatabaseForReset, getDatabase } = require('../repositories/database');
const taskRepository = require('../repositories/taskRepository');
const projectRepository = require('../repositories/projectRepository');
const settingsRepository = require('../repositories/settingsRepository');
const lifeStateRepository = require('../repositories/lifeStateRepository');
const characterRepository = require('../repositories/characterRepository');
const accountSync = require('../services/characterCloudSync');
const taskCloudSync = require('../services/taskCloudSync');
const googleCalendarSync = require('../services/googleCalendarSync');
const notificationService = require('../services/notificationService');
const { STORAGE_KEYS } = require('../constants/defaults');
const { log, warn } = require('../utils/logger');
const { messageFromError } = require('../utils/validation');

const TaskMateContext = React.createContext(null);

function incompleteTodayOrEarlier(tasks) {
  const today = localDateKey(new Date());
  return tasks.filter((task) => !task.completed && task.date <= today);
}

function useTaskMate() {
  const value = React.useContext(TaskMateContext);
  if (!value) {
    throw new Error('useTaskMate must be used inside TaskMateProvider');
  }
  return value;
}

function TaskMateProvider({ children }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [tasks, setTasks] = React.useState([]);
  const [projectState, setProjectState] = React.useState({
    categories: [],
    projects: [],
    milestones: [],
    projectTasks: [],
    summaries: []
  });
  const [settings, setSettings] = React.useState(null);
  const [lifeState, setLifeState] = React.useState(null);
  const [characters, setCharacters] = React.useState([]);
  const [selectedCharacter, setSelectedCharacter] = React.useState(null);
  const [temporaryEvent, setTemporaryEvent] = React.useState(null);
  const [undoItem, setUndoItem] = React.useState(null);
  const [clock, setClock] = React.useState(new Date());
  const [notificationTaskId, setNotificationTaskId] = React.useState(null);
  const [accountSession, setAccountSession] = React.useState(null);
  const [cloudCharacters, setCloudCharacters] = React.useState([]);
  const [googleCalendar, setGoogleCalendar] = React.useState(null);
  const lastDialogueRef = React.useRef('');
  const [dialogue, setDialogue] = React.useState('今日も一つずつ見よう。');

  const taskGroups = React.useMemo(() => groupTasksForMobile(tasks, clock), [tasks, clock]);

  const behavior = React.useMemo(() => {
    if (!settings || !lifeState) {
      return null;
    }
    return createBehaviorState({
      tasks,
      settings,
      lifeState,
      now: clock,
      event: temporaryEvent,
      reducedMotion: settings.reduceMotion
    });
  }, [clock, lifeState, settings, tasks, temporaryEvent]);

  React.useEffect(() => {
    if (!behavior || !selectedCharacter) {
      return;
    }
    const category = behavior.dialogueCategory || (tasks.length === 0 ? 'noTasks' : 'calm');
    const selected = chooseDialogue(
      selectedCharacter.dialogues,
      category,
      lastDialogueRef.current,
      Math.random
    );
    const next = fillDialogue(selected, behavior.dialogueVariables || {});
    lastDialogueRef.current = next;
    setDialogue(next);
  }, [
    behavior?.action,
    behavior?.dialogueCategory,
    behavior?.generatedAt,
    selectedCharacter,
    tasks.length
  ]);

  React.useEffect(() => {
    if (!temporaryEvent) {
      return undefined;
    }
    const timer = setTimeout(() => setTemporaryEvent(null), 4200);
    return () => clearTimeout(timer);
  }, [temporaryEvent]);

  const loadCharacters = React.useCallback(async () => {
    const [loadedCharacters, currentCharacter] = await Promise.all([
      characterRepository.listCharacters(),
      characterRepository.getSelectedCharacter()
    ]);
    setCharacters(loadedCharacters);
    setSelectedCharacter(currentCharacter);
    return { loadedCharacters, currentCharacter };
  }, []);

  const refreshAccount = React.useCallback(async () => {
    if (!accountSync.isSupabaseConfigured) {
      setAccountSession(null);
      setCloudCharacters([]);
      return null;
    }
    const session = await accountSync.getAccountSession();
    setAccountSession(session);
    return session;
  }, []);

  const refreshCloudCharacters = React.useCallback(async () => {
    if (!accountSync.isSupabaseConfigured || !accountSession) {
      setCloudCharacters([]);
      return [];
    }
    const next = await accountSync.listCloudCharacterPacks();
    setCloudCharacters(next);
    return next;
  }, [accountSession]);

  const refreshGoogleCalendar = React.useCallback(async () => {
    const next = await googleCalendarSync.readStatus();
    setGoogleCalendar(next);
    return next;
  }, []);

  const refreshProjects = React.useCallback(async (loadedSettings = null) => {
    const effectiveSettings = loadedSettings || (await settingsRepository.readSettings());
    const next = await projectRepository.listProjectState(
      effectiveSettings?.projectSettings || {}
    );
    setProjectState(next);
    return next;
  }, []);

  const refreshTasksAndLife = React.useCallback(async (options = {}) => {
    const now = new Date();
    const loadedTasks = await taskRepository.listTasks();
    let currentLife = await lifeStateRepository.readLifeState(now);

    // focusTaskは再起動後も残しますが、完了・削除済みなら自動解除します。
    // 存在しないタスクをホームに出し続けると、ユーザーが操作できないカードになるためです。
    if (
      currentLife.focusTaskId &&
      !loadedTasks.some((task) => task.id === currentLife.focusTaskId && !task.completed)
    ) {
      currentLife = await lifeStateRepository.clearLifeFocusTask(now);
    }

    const loadedSettings = await settingsRepository.readSettings();
    setTasks(loadedTasks);
    setLifeState(currentLife);
    setSettings(loadedSettings);
    setClock(now);

    if (options.reconcileNotifications !== false) {
      notificationService
        .reconcileNotifications(loadedTasks, loadedSettings, now)
        .catch((notificationError) =>
          warn('Notifications', 'background reconcile failed', notificationError)
        );
    }
    return { loadedTasks, currentLife, loadedSettings };
  }, []);

  const initialize = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await getDatabase();
      await notificationService.configureNotifications();
      const now = new Date();
      const launch = await lifeStateRepository.registerLaunchState(now);
      await loadCharacters();
      await refreshGoogleCalendar();
      const result = await refreshTasksAndLife();
      await refreshProjects(result.loadedSettings);
      setLifeState(launch.state);
      if (launch.reconnectEvent) {
        setTemporaryEvent({
          type: 'reconnect',
          reconnectEvent: launch.reconnectEvent,
          gapDays: launch.gapDays || 0,
          id: `reconnect-${Date.now()}`
        });
      }
      await notificationService.reconcileNotifications(
        result.loadedTasks,
        result.loadedSettings,
        now
      );
      log('Behavior', 'pressure recalculated');
    } catch (initialError) {
      setError(messageFromError(initialError, 'アプリの初期化に失敗しました。'));
      warn('App', 'initialization failed', initialError);
    } finally {
      setLoading(false);
    }
  }, [loadCharacters, refreshGoogleCalendar, refreshProjects, refreshTasksAndLife]);

  React.useEffect(() => {
    let mounted = true;
    initialize();
    refreshAccount().catch((accountError) => {
      if (mounted) {
        setError(messageFromError(accountError));
      }
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && mounted) {
        refreshTasksAndLife().catch((activeError) => {
          setError(messageFromError(activeError));
        });
        refreshAccount().catch((accountError) => {
          setError(messageFromError(accountError));
        });
        refreshGoogleCalendar().catch((calendarError) => {
          setError(messageFromError(calendarError));
        });
        refreshProjects().catch((projectError) => {
          setError(messageFromError(projectError));
        });
      }
    });
    const notificationSubscription = notificationService.addNotificationResponseListener(
      (response) => {
        const taskId = response?.notification?.request?.content?.data?.taskId;
        if (typeof taskId === 'string') {
          setNotificationTaskId(taskId);
        }
      }
    );
    return () => {
      mounted = false;
      appStateSubscription.remove();
      notificationSubscription.remove();
    };
  }, [initialize, refreshAccount, refreshGoogleCalendar, refreshProjects, refreshTasksAndLife]);

  React.useEffect(() => {
    if (!accountSync.isSupabaseConfigured) {
      return undefined;
    }
    return accountSync.onAccountStateChange((session) => {
      setAccountSession(session);
    });
  }, []);

  React.useEffect(() => {
    refreshCloudCharacters().catch((syncError) => {
      setError(messageFromError(syncError));
    });
  }, [refreshCloudCharacters]);

  async function createTask(input) {
    try {
      const task = await taskRepository.createTask(input);
      await lifeStateRepository.recordLifeInteraction('task-create', { taskId: task.id });
      await refreshTasksAndLife();
      await refreshProjects();
      return task;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function updateTask(taskId, input) {
    try {
      const task = await taskRepository.updateTask(taskId, input);
      if (task.projectTaskId) {
        await projectRepository.syncProjectTaskFromNormalTask(task);
      }
      await lifeStateRepository.recordLifeInteraction('task-update', { taskId });
      await refreshTasksAndLife();
      await refreshProjects();
      return task;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function deleteTask(taskId) {
    try {
      const task = await taskRepository.deleteTask(taskId);
      if (task.projectTaskId) {
        await projectRepository.unlinkNormalTask(task.id);
      }
      await lifeStateRepository.recordLifeInteraction('task-delete', { taskId });
      if (lifeState?.focusTaskId === taskId) {
        await lifeStateRepository.clearLifeFocusTask();
      }
      await refreshTasksAndLife();
      await refreshProjects();
      return task;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function completeTask(taskId) {
    try {
      const beforeTasks = await taskRepository.listTasks();
      const task = await taskRepository.setTaskCompleted(taskId, true);
      if (task.projectTaskId) {
        await projectRepository.syncProjectTaskFromNormalTask(task);
      }
      let nextLife = lifeState;
      if (settings?.relationshipMemoryEnabled !== false) {
        nextLife = await lifeStateRepository.recordLifeCompletion(task);
      }
      if (nextLife?.focusTaskId === taskId) {
        nextLife = await lifeStateRepository.clearLifeFocusTask();
      }

      const remaining = incompleteTodayOrEarlier(
        beforeTasks.map((candidate) =>
          candidate.id === taskId ? { ...candidate, completed: true } : candidate
        )
      );
      const today = localDateKey(new Date());
      const alreadyCelebrated = nextLife?.celebratedDates?.includes(today);
      if (remaining.length === 0 && !alreadyCelebrated) {
        nextLife = await lifeStateRepository.markLifeCelebrated(today);
        setTemporaryEvent({ type: 'all-complete', task, id: `celebrate-${Date.now()}` });
      } else {
        setTemporaryEvent({ type: 'task-complete', task, id: `relieved-${Date.now()}` });
      }

      setLifeState(nextLife);
      setUndoItem({ task, expiresAt: Date.now() + 5000 });
      await refreshTasksAndLife();
      await refreshProjects();
      return task;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function undoCompleteTask(taskId) {
    try {
      const task = await taskRepository.setTaskCompleted(taskId, false);
      if (task.projectTaskId) {
        await projectRepository.syncProjectTaskFromNormalTask(task);
      }
      setUndoItem(null);
      await refreshTasksAndLife();
      await refreshProjects();
      return task;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function setFocusTask(taskId) {
    const nextLife = await lifeStateRepository.setLifeFocusTask(taskId);
    setLifeState(nextLife);
    setClock(new Date());
    await refreshTasksAndLife({ reconcileNotifications: false });
  }

  async function clearFocusTask() {
    const nextLife = await lifeStateRepository.clearLifeFocusTask();
    setLifeState(nextLife);
    setClock(new Date());
  }

  async function updateSettings(partial) {
    const next = await settingsRepository.updateSettings(partial);
    setSettings(next);
    await lifeStateRepository.recordLifeInteraction('settings-change');
    await refreshTasksAndLife();
    await refreshProjects(next);
    return next;
  }

  async function createProjectCategory(input) {
    try {
      const category = await projectRepository.createCategory(input);
      await refreshProjects();
      return category;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function updateProjectCategory(categoryId, input) {
    try {
      const category = await projectRepository.updateCategory(categoryId, input);
      await refreshProjects();
      return category;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function deleteProjectCategory(categoryId) {
    try {
      const category = await projectRepository.deleteCategory(categoryId);
      await refreshProjects();
      return category;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function createProject(input) {
    try {
      const project = await projectRepository.createProject(input);
      await lifeStateRepository.recordLifeInteraction('project-create', { projectId: project.id });
      await refreshProjects();
      return project;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function updateProject(projectId, input) {
    try {
      const project = await projectRepository.updateProject(projectId, input);
      await refreshProjects();
      return project;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function deleteProject(projectId, mode = 'deleteAll') {
    try {
      const project = await projectRepository.deleteProject(projectId, mode);
      await refreshTasksAndLife();
      await refreshProjects();
      return project;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function createProjectMilestone(input) {
    try {
      const milestone = await projectRepository.createMilestone(input);
      await refreshProjects();
      return milestone;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function createProjectTask(input) {
    try {
      const task = await projectRepository.createProjectTask(input);
      await refreshProjects();
      return task;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function updateProjectMilestone(milestoneId, input) {
    try {
      const milestone = await projectRepository.updateMilestone(milestoneId, input);
      await refreshProjects();
      return milestone;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function deleteProjectMilestone(milestoneId) {
    try {
      const milestone = await projectRepository.deleteMilestone(milestoneId);
      await refreshProjects();
      return milestone;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function deleteProjectTask(taskId) {
    try {
      const task = await projectRepository.deleteProjectTask(taskId);
      await refreshTasksAndLife();
      await refreshProjects();
      return task;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function updateProjectTask(taskId, input) {
    try {
      const task = await projectRepository.updateProjectTask(taskId, input);
      await refreshTasksAndLife();
      await refreshProjects();
      return task;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function completeProjectTask(taskId, completed = true) {
    try {
      const task = await projectRepository.completeProjectTask(taskId, completed);
      await refreshProjects();
      return task;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function addProjectTaskToToday(taskId) {
    try {
      const linked = await projectRepository.addProjectTaskToToday(taskId);
      await refreshTasksAndLife();
      await refreshProjects();
      return linked;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function requestNotifications() {
    const granted = await notificationService.requestNotificationPermission();
    await refreshTasksAndLife();
    return granted;
  }

  async function selectCharacter(characterId) {
    const character = await characterRepository.selectCharacter(characterId);
    await updateSettings({ selectedCharacterId: characterId });
    await loadCharacters();
    return character;
  }

  async function createCustomCharacter(input) {
    const character = await characterRepository.createCustomCharacter(input);
    await loadCharacters();
    return character;
  }

  async function updateCustomCharacterImage(characterId, stateName, sourceUri) {
    const character = await characterRepository.updateCustomCharacterImage(
      characterId,
      stateName,
      sourceUri
    );
    await loadCharacters();
    return character;
  }

  async function updateCustomCharacterDialogues(characterId, dialogues) {
    const character = await characterRepository.updateCustomCharacterDialogues(
      characterId,
      dialogues
    );
    await loadCharacters();
    return character;
  }

  async function updateCustomCharacterProfile(characterId, profile) {
    const character = await characterRepository.updateCustomCharacterProfile(
      characterId,
      profile
    );
    await loadCharacters();
    return character;
  }

  async function deleteCustomCharacter(characterId) {
    const character = await characterRepository.deleteCustomCharacter(characterId);
    await loadCharacters();
    return character;
  }

  async function signInAccount(email, password) {
    try {
      const session = await accountSync.signInWithEmail(email, password);
      setAccountSession(session);
      return session;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function signUpAccount(email, password) {
    try {
      const session = await accountSync.signUpWithEmail(email, password);
      setAccountSession(session);
      return session;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function connectGoogleCalendar() {
    try {
      const next = await googleCalendarSync.signInWithGoogleCalendar();
      setGoogleCalendar(next);
      const synced = await googleCalendarSync.syncToday();
      setGoogleCalendar(synced);
      await refreshAccount();
      return synced;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function syncGoogleCalendar() {
    try {
      const next = await googleCalendarSync.syncToday();
      setGoogleCalendar(next);
      return next;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function updateGoogleCalendarSettings(partial) {
    try {
      const next = await googleCalendarSync.updateSettings(partial);
      setGoogleCalendar(next);
      return next;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function disconnectGoogleCalendar() {
    try {
      const next = await googleCalendarSync.disconnect();
      setGoogleCalendar(next);
      return next;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function createTaskFromGoogleEvent(eventKey) {
    try {
      const current = googleCalendar || (await googleCalendarSync.readStatus());
      const event = current.events.find((candidate) => candidate.key === eventKey);
      if (!event) {
        throw new Error('Googleカレンダーの予定が見つかりません。');
      }
      const task = await taskRepository.createTask({
        title: event.title,
        description: `Googleカレンダー: ${event.calendarSummary || ''}`.trim(),
        date: event.date,
        time: event.time || '',
        genre: 'Googleカレンダー',
        priority: 'normal'
      });
      await googleCalendarSync.markEventTask(eventKey, task.id);
      await lifeStateRepository.recordLifeInteraction('task-create', { taskId: task.id });
      await refreshTasksAndLife();
      await refreshProjects();
      await refreshGoogleCalendar();
      return task;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function signOutAccount() {
    try {
      await accountSync.signOut();
      setAccountSession(null);
      setCloudCharacters([]);
      const nextCalendar = await googleCalendarSync.disconnect();
      setGoogleCalendar(nextCalendar);
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function deleteAccount() {
    try {
      await accountSync.deleteAccount();
      setAccountSession(null);
      setCloudCharacters([]);
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function syncTaskData() {
    try {
      const result = await taskCloudSync.syncTaskData();
      await refreshTasksAndLife();
      await refreshProjects();
      return result;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function uploadSelectedCharacterToCloud() {
    try {
      const next = await accountSync.uploadCharacterPack(selectedCharacter);
      setCloudCharacters(next);
      return next;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function importCloudCharacter(localCharacterId) {
    try {
      const character = await accountSync.importCloudCharacter(localCharacterId);
      await loadCharacters();
      return character;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function resetLifeState() {
    const next = await lifeStateRepository.resetLifeState();
    setLifeState(next);
    setClock(new Date());
  }

  async function deleteAllLocalData() {
    await notificationService.cancelAllKnownNotifications();
    await clearDatabaseForReset();
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.settings,
      STORAGE_KEYS.lifeState,
      STORAGE_KEYS.characters,
      STORAGE_KEYS.selectedCharacter,
      STORAGE_KEYS.googleCalendar,
      'taskmate.taskSyncKnownItems.v1'
    ]);
    setUndoItem(null);
    setProjectState({
      categories: [],
      projects: [],
      milestones: [],
      projectTasks: [],
      summaries: []
    });
    await initialize();
  }

  function consumeNotificationTask() {
    setNotificationTaskId(null);
  }

  function expireUndoItem() {
    setUndoItem(null);
  }

  const value = {
    account: {
      cloudCharacters,
      configured: accountSync.isSupabaseConfigured,
      session: accountSession,
      user: accountSession?.user || null
    },
    addProjectTaskToToday,
    behavior,
    characters,
    clearFocusTask,
    completeTask,
    completeProjectTask,
    connectGoogleCalendar,
    consumeNotificationTask,
    createCustomCharacter,
    createProjectCategory,
    createProject,
    createProjectMilestone,
    createProjectTask,
    createTaskFromGoogleEvent,
    createTask,
    deleteAllLocalData,
    deleteAccount,
    deleteCustomCharacter,
    disconnectGoogleCalendar,
    deleteProject,
    deleteProjectCategory,
    deleteProjectMilestone,
    deleteProjectTask,
    deleteTask,
    dialogue,
    error,
    expireUndoItem,
    initialize,
    importCloudCharacter,
    googleCalendar,
    lifeState,
    loading,
    notificationTaskId,
    requestNotifications,
    resetLifeState,
    refreshCloudCharacters,
    refreshGoogleCalendar,
    refreshProjects,
    selectCharacter,
    selectedCharacter,
    setError,
    setFocusTask,
    settings,
    projectState,
    taskGroups,
    tasks,
    undoCompleteTask,
    undoItem,
    signInAccount,
    signOutAccount,
    signUpAccount,
    syncGoogleCalendar,
    syncTaskData,
    uploadSelectedCharacterToCloud,
    updateCustomCharacterDialogues,
    updateCustomCharacterImage,
    updateCustomCharacterProfile,
    updateGoogleCalendarSettings,
    updateSettings,
    updateProjectCategory,
    updateProject,
    updateProjectMilestone,
    updateProjectTask,
    updateTask
  };

  return <TaskMateContext.Provider value={value}>{children}</TaskMateContext.Provider>;
}

module.exports = {
  TaskMateProvider,
  useTaskMate
};
