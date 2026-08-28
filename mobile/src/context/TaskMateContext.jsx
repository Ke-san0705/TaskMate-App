const React = require('react');
const { AppState } = require('react-native');
const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const {
  chooseDialogue,
  fillDialogue,
  groupTasksForMobile,
  localDateKey
} = require('@taskmate/core');
const { clearDatabaseForReset, getDatabase } = require('../repositories/database');
const taskRepository = require('../repositories/taskRepository');
const settingsRepository = require('../repositories/settingsRepository');
const focusRepository = require('../repositories/focusRepository');
const lifeStateRepository = require('../repositories/lifeStateRepository');
const characterRepository = require('../repositories/characterRepository');
const notificationService = require('../services/notificationService');
const focusNativeModule = require('../services/focusNativeModule');
const { STORAGE_KEYS } = require('../constants/defaults');
const { log, warn } = require('../utils/logger');
const { messageFromError } = require('../utils/validation');

const TaskMateContext = React.createContext(null);

function incompleteTodayOrEarlier(tasks) {
  const today = localDateKey(new Date());
  return tasks.filter((task) => !task.completed && task.date <= today);
}

function todayProgress(tasks) {
  const today = localDateKey(new Date());
  const todayTasks = tasks.filter((task) => task.date <= today);
  const completed = todayTasks.filter((task) => task.completed).length;
  return {
    completed,
    total: todayTasks.length,
    remaining: todayTasks.length - completed
  };
}

function useTaskMate() {
  const value = React.useContext(TaskMateContext);
  if (!value) {
    throw new Error('useTaskMate must be used inside TaskMateProvider');
  }
  return value;
}

function findActiveTask(tasks, focusState) {
  const taskId = focusState?.activeSession?.taskId || focusState?.currentTaskId;
  if (!taskId) {
    return null;
  }
  return tasks.find((task) => task.id === taskId && !task.completed) || null;
}

function TaskMateProvider({ children }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [tasks, setTasks] = React.useState([]);
  const [settings, setSettings] = React.useState(null);
  const [focusState, setFocusState] = React.useState({
    currentTaskId: null,
    activeSession: null,
    blockedApps: []
  });
  const [characters, setCharacters] = React.useState([]);
  const [selectedCharacter, setSelectedCharacter] = React.useState(null);
  const [undoItem, setUndoItem] = React.useState(null);
  const [clock, setClock] = React.useState(new Date());
  const [notificationTaskId, setNotificationTaskId] = React.useState(null);
  const [installedApps, setInstalledApps] = React.useState([]);
  const [focusPermissions, setFocusPermissions] = React.useState({
    accessibility: false,
    usageAccess: false
  });
  const lastDialogueRef = React.useRef('');
  const [dialogue, setDialogue] = React.useState('今やることを一つ決めよう。');

  const taskGroups = React.useMemo(() => groupTasksForMobile(tasks, clock), [tasks, clock]);
  const focusTask = React.useMemo(
    () => findActiveTask(tasks, focusState),
    [focusState, tasks]
  );
  const progress = React.useMemo(() => todayProgress(tasks), [tasks]);

  const refreshFocusPermissions = React.useCallback(async () => {
    const [accessibility, usageAccess] = await Promise.all([
      focusNativeModule.isAccessibilityServiceEnabled(),
      focusNativeModule.isUsageAccessGranted()
    ]);
    const next = { accessibility, usageAccess };
    setFocusPermissions(next);
    return next;
  }, []);

  const loadInstalledApps = React.useCallback(async () => {
    const apps = await focusNativeModule.listInstalledApps();
    setInstalledApps(apps);
    return apps;
  }, []);

  const syncNativeFocus = React.useCallback(async (nextFocusState, nextSettings) => {
    const activeSession = nextFocusState?.activeSession;
    const enabled = nextSettings?.focusRestrictionEnabled !== false;
    await focusNativeModule.setFocusMonitorState({
      active: Boolean(enabled && activeSession),
      taskTitle: activeSession?.taskTitle || '',
      blockedApps: activeSession?.blockedApps || []
    });
    await focusNativeModule.updateWidget();
  }, []);

  React.useEffect(() => {
    const timer = setInterval(
      () => setClock(new Date()),
      focusState.activeSession ? 1000 : 60 * 1000
    );
    return () => clearInterval(timer);
  }, [focusState.activeSession]);

  React.useEffect(() => {
    if (!selectedCharacter) {
      return;
    }
    const category = focusState.activeSession
      ? 'focusActive'
      : focusState.currentTaskId
        ? 'focusReady'
        : tasks.length === 0
          ? 'noTasks'
          : 'ready';
    const selected = chooseDialogue(
      selectedCharacter.dialogues,
      category,
      lastDialogueRef.current,
      Math.random
    );
    const next = fillDialogue(selected, {
      taskTitle: focusTask?.title || focusState.activeSession?.taskTitle || '',
      title: focusTask?.title || focusState.activeSession?.taskTitle || ''
    });
    lastDialogueRef.current = next;
    setDialogue(next);
  }, [
    focusState.activeSession?.id,
    focusState.currentTaskId,
    focusTask?.title,
    selectedCharacter,
    tasks.length
  ]);

  const loadCharacters = React.useCallback(async () => {
    const [loadedCharacters, currentCharacter] = await Promise.all([
      characterRepository.listCharacters(),
      characterRepository.getSelectedCharacter()
    ]);
    setCharacters(loadedCharacters);
    setSelectedCharacter(currentCharacter);
    return { loadedCharacters, currentCharacter };
  }, []);

  const migrateLegacyFocusTask = React.useCallback(async (loadedTasks) => {
    const legacyFocusTaskId = await lifeStateRepository.readLegacyFocusTaskId();
    if (!legacyFocusTaskId) {
      return null;
    }
    const usable = loadedTasks.some((task) => task.id === legacyFocusTaskId && !task.completed);
    if (usable) {
      await focusRepository.setCurrentTask(legacyFocusTaskId);
    }
    await lifeStateRepository.clearLegacyLifeState();
    return usable ? legacyFocusTaskId : null;
  }, []);

  const refreshTasksAndFocus = React.useCallback(async (options = {}) => {
    const now = new Date();
    const [loadedTasks, loadedSettings] = await Promise.all([
      taskRepository.listTasks(),
      settingsRepository.readSettings()
    ]);

    if (options.migrateLegacyFocus) {
      await migrateLegacyFocusTask(loadedTasks);
    }

    const loadedFocusState = await focusRepository.readFocusState(loadedTasks);
    setTasks(loadedTasks);
    setSettings(loadedSettings);
    setFocusState(loadedFocusState);
    setClock(now);

    if (options.reconcileNotifications !== false) {
      notificationService
        .reconcileNotifications(loadedTasks, loadedSettings, now)
        .catch((notificationError) =>
          warn('Notifications', 'background reconcile failed', notificationError)
        );
    }
    await syncNativeFocus(loadedFocusState, loadedSettings);
    return { loadedTasks, loadedSettings, loadedFocusState };
  }, [migrateLegacyFocusTask, syncNativeFocus]);

  const initialize = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await getDatabase();
      await notificationService.configureNotifications();
      await Promise.all([loadCharacters(), loadInstalledApps(), refreshFocusPermissions()]);
      const result = await refreshTasksAndFocus({ migrateLegacyFocus: true });
      await notificationService.reconcileNotifications(
        result.loadedTasks,
        result.loadedSettings,
        new Date()
      );
      log('App', 'v2 initialized');
    } catch (initialError) {
      setError(messageFromError(initialError, 'アプリの初期化に失敗しました。'));
      warn('App', 'initialization failed', initialError);
    } finally {
      setLoading(false);
    }
  }, [loadCharacters, loadInstalledApps, refreshFocusPermissions, refreshTasksAndFocus]);

  React.useEffect(() => {
    let mounted = true;
    initialize();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && mounted) {
        refreshTasksAndFocus().catch((activeError) => {
          setError(messageFromError(activeError));
        });
        refreshFocusPermissions().catch((permissionError) => {
          setError(messageFromError(permissionError));
        });
        loadInstalledApps().catch((appsError) => {
          setError(messageFromError(appsError));
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
  }, [initialize, loadInstalledApps, refreshFocusPermissions, refreshTasksAndFocus]);

  async function createTask(input) {
    try {
      const task = await taskRepository.createTask(input);
      await refreshTasksAndFocus();
      return task;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function updateTask(taskId, input) {
    try {
      const task = await taskRepository.updateTask(taskId, input);
      await refreshTasksAndFocus();
      return task;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function deleteTask(taskId) {
    try {
      const task = await taskRepository.deleteTask(taskId);
      await focusRepository.clearTaskReferences(taskId);
      await refreshTasksAndFocus();
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
      const active = focusState.activeSession;
      if (active?.taskId === taskId) {
        await focusRepository.finishSession(active.id, true);
      } else {
        await focusRepository.clearTaskReferences(taskId);
      }

      const remaining = incompleteTodayOrEarlier(
        beforeTasks.map((candidate) =>
          candidate.id === taskId ? { ...candidate, completed: true } : candidate
        )
      );
      setDialogue(
        remaining.length === 0
          ? '今日の分、きれいに片付きました。'
          : 'おつかれさま！1つ終わったね。'
      );
      setUndoItem({ task, expiresAt: Date.now() + 5000 });
      await refreshTasksAndFocus();
      return task;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function undoCompleteTask(taskId) {
    try {
      const task = await taskRepository.setTaskCompleted(taskId, false);
      setUndoItem(null);
      await refreshTasksAndFocus();
      return task;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function setFocusTask(taskId) {
    try {
      const task = tasks.find((candidate) => candidate.id === taskId && !candidate.completed);
      if (!task) {
        throw new Error('今やるタスクが見つかりません。');
      }
      await focusRepository.setCurrentTask(taskId);
      await refreshTasksAndFocus({ reconcileNotifications: false });
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function clearFocusTask() {
    await focusRepository.clearCurrentTask();
    await refreshTasksAndFocus({ reconcileNotifications: false });
  }

  async function startFocusSession(taskId, blockedApps = []) {
    try {
      const task = tasks.find((candidate) => candidate.id === taskId && !candidate.completed);
      if (!task) {
        throw new Error('集中するタスクが見つかりません。');
      }
      const selectedApps = blockedApps.length > 0
        ? blockedApps
        : focusState.blockedApps.filter((app) => app.enabled);
      const nextFocus = await focusRepository.startSession({
        task,
        blockedApps: selectedApps
      });
      const nextSettings = await settingsRepository.updateSettings({
        defaultBlockedApps: selectedApps
      });
      setSettings(nextSettings);
      await syncNativeFocus(nextFocus, nextSettings);
      await refreshTasksAndFocus({ reconcileNotifications: false });
      return nextFocus.activeSession;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  async function finishFocusSession(completed = true) {
    const active = focusState.activeSession;
    if (!active) {
      return null;
    }
    if (completed) {
      return completeTask(active.taskId);
    }
    const session = await focusRepository.finishSession(active.id, false);
    await refreshTasksAndFocus({ reconcileNotifications: false });
    return session;
  }

  async function updateBlockedApps(apps) {
    const nextApps = await focusRepository.setBlockedApps(apps);
    const nextSettings = await settingsRepository.updateSettings({
      defaultBlockedApps: nextApps.filter((app) => app.enabled)
    });
    setSettings(nextSettings);
    await refreshTasksAndFocus({ reconcileNotifications: false });
    return nextApps;
  }

  async function updateSettings(partial) {
    const next = await settingsRepository.updateSettings(partial);
    setSettings(next);
    await refreshTasksAndFocus();
    return next;
  }

  async function requestNotifications() {
    const granted = await notificationService.requestNotificationPermission();
    await refreshTasksAndFocus();
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

  async function deleteAllLocalData() {
    await notificationService.cancelAllKnownNotifications();
    await focusNativeModule.setFocusMonitorState({ active: false });
    await clearDatabaseForReset();
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.settings,
      STORAGE_KEYS.lifeState,
      STORAGE_KEYS.characters,
      STORAGE_KEYS.selectedCharacter
    ]);
    setUndoItem(null);
    await initialize();
  }

  function consumeNotificationTask() {
    setNotificationTaskId(null);
  }

  function expireUndoItem() {
    setUndoItem(null);
  }

  const value = {
    characters,
    clearFocusTask,
    clock,
    completeTask,
    consumeNotificationTask,
    createCustomCharacter,
    createTask,
    deleteAllLocalData,
    deleteCustomCharacter,
    deleteTask,
    dialogue,
    error,
    expireUndoItem,
    finishFocusSession,
    focusPermissions,
    focusState,
    focusTask,
    installedApps,
    initialize,
    loadInstalledApps,
    loading,
    notificationTaskId,
    openAccessibilitySettings: focusNativeModule.openAccessibilitySettings,
    openUsageAccessSettings: focusNativeModule.openUsageAccessSettings,
    progress,
    refreshFocusPermissions,
    requestNotifications,
    selectCharacter,
    selectedCharacter,
    setError,
    setFocusTask,
    settings,
    startFocusSession,
    taskGroups,
    tasks,
    undoCompleteTask,
    undoItem,
    updateBlockedApps,
    updateCustomCharacterDialogues,
    updateCustomCharacterImage,
    updateCustomCharacterProfile,
    updateSettings,
    updateTask
  };

  return <TaskMateContext.Provider value={value}>{children}</TaskMateContext.Provider>;
}

module.exports = {
  TaskMateProvider,
  useTaskMate
};
