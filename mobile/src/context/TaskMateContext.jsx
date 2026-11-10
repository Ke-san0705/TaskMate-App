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
const projectRepository = require('../repositories/projectRepository');
const streakRepository = require('../repositories/streakRepository');
const lifeStateRepository = require('../repositories/lifeStateRepository');
const characterRepository = require('../repositories/characterRepository');
const notificationService = require('../services/notificationService');
const focusNativeModule = require('../services/focusNativeModule');
const { STORAGE_KEYS } = require('../constants/defaults');
const {
  hasAcceptedAccessibilityDisclosure
} = require('../constants/focusDisclosure');
const {
  evaluateUnlockMode,
  normalizeUnlockModeSettings,
  validateUnlockModeSettings
} = require('../utils/unlockMode');
const { log, warn } = require('../utils/logger');
const { messageFromError } = require('../utils/validation');
const { useTaskInbox } = require('../hooks/useTaskInbox');

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

function widgetCharacterImageUri(character) {
  const source = character?.images?.wait;
  return source && typeof source.uri === 'string' ? source.uri : '';
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
  const [projectState, setProjectState] = React.useState({
    categories: [],
    projects: [],
    milestones: [],
    projectTasks: [],
    error: null
  });
  const [characters, setCharacters] = React.useState([]);
  const [selectedCharacter, setSelectedCharacter] = React.useState(null);
  const [streak, setStreak] = React.useState(() => streakRepository.emptyStreak());
  const settingsRef = React.useRef(null);
  const localResetRef = React.useRef(false);
  const refreshEpochRef = React.useRef(0);
  const selectedCharacterRef = React.useRef(null);
  const [undoItem, setUndoItem] = React.useState(null);
  const [clock, setClock] = React.useState(new Date());
  const [notificationTaskId, setNotificationTaskId] = React.useState(null);
  const [installedApps, setInstalledApps] = React.useState([]);
  const [focusPermissions, setFocusPermissions] = React.useState({
    accessibility: false,
    usageAccess: false
  });
  const [unlockStatus, setUnlockStatus] = React.useState({
    enabled: false,
    state: 'disabled',
    usageAccessGranted: false,
    totalUsageMillis: 0,
    requiredMillis: 30 * 60 * 1000,
    remainingMillis: 30 * 60 * 1000,
    progressRatio: 0
  });
  const lastDialogueRef = React.useRef('');
  const [dialogue, setDialogue] = React.useState('今やることを一つ決めよう。');

  const taskGroups = React.useMemo(() => groupTasksForMobile(tasks, clock), [tasks, clock]);
  const focusTask = React.useMemo(
    () => findActiveTask(tasks, focusState),
    [focusState, tasks]
  );
  const progress = React.useMemo(() => todayProgress(tasks), [tasks]);

  const applySettings = React.useCallback((nextSettings) => {
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    return nextSettings;
  }, []);

  const refreshFocusPermissions = React.useCallback(async () => {
    const [accessibility, usageAccess] = await Promise.all([
      focusNativeModule.isAccessibilityServiceEnabled(),
      focusNativeModule.isUsageAccessEnabled()
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

  const refreshUnlockStatus = React.useCallback(async (nextUnlockMode = null) => {
    const mode = normalizeUnlockModeSettings(nextUnlockMode || settingsRef.current?.unlockMode);
    try {
      const status = await focusNativeModule.getUnlockModeStatus();
      setUnlockStatus(status);
      return status;
    } catch (statusError) {
      const fallback = evaluateUnlockMode({
        ...mode,
        totalUsageMillis: 0,
        usageAccessGranted: false
      });
      setUnlockStatus({
        ...fallback,
        enabled: mode.enabled
      });
      warn('UnlockMode', 'status refresh failed', statusError);
      return fallback;
    }
  }, []);

  const syncWidgetPresentation = React.useCallback(async (nextStreak, characterOverride = null) => {
    let character = characterOverride || selectedCharacterRef.current;
    if (!character) {
      try {
        character = await characterRepository.getSelectedCharacter();
      } catch (characterError) {
        warn('Widget', 'selected character fallback failed', characterError);
      }
    }
    try {
      await focusNativeModule.setWidgetPresentation({
        characterId: character?.id || '',
        characterImageUri: widgetCharacterImageUri(character),
        motivationMessage: nextStreak?.motivationMessage || '',
        motivationDate: nextStreak?.dateKey || ''
      });
    } catch (widgetError) {
      warn('Widget', 'presentation sync failed', widgetError);
    }
  }, []);

  const syncNativeFocus = React.useCallback(async (nextFocusState, nextSettings) => {
    const activeSession = nextFocusState?.activeSession;
    const enabled =
      nextSettings?.focusRestrictionEnabled !== false &&
      hasAcceptedAccessibilityDisclosure(nextSettings);
    await focusNativeModule.setFocusMonitorState({
      active: Boolean(enabled && activeSession),
      taskTitle: activeSession?.taskTitle || '',
      startedAt: activeSession?.startedAt || '',
      blockedApps: activeSession?.blockedApps || []
    });
    await focusNativeModule.setUnlockMonitorState({
      unlockMode: nextSettings?.unlockMode
    });
    await refreshUnlockStatus(nextSettings?.unlockMode);
    await focusNativeModule.updateWidget();
  }, [refreshUnlockStatus]);

  const refreshProjectState = React.useCallback(async () => {
    try {
      const state = await projectRepository.listProjectState();
      setProjectState(state);
      return state;
    } catch (projectError) {
      const message = messageFromError(projectError, '長期タスクを読み込めませんでした。');
      setProjectState({
        categories: [],
        projects: [],
        milestones: [],
        projectTasks: [],
        error: message
      });
      warn('Projects', 'refresh failed', projectError);
      return {
        categories: [],
        projects: [],
        milestones: [],
        projectTasks: [],
        error: message
      };
    }
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
    selectedCharacterRef.current = currentCharacter;
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
    if (localResetRef.current && !options.allowDuringReset) return null;
    const refreshEpoch = refreshEpochRef.current;
    const now = new Date();
    const [loadedTasks, loadedSettings] = await Promise.all([
      taskRepository.listTasks(),
      settingsRepository.readSettings()
    ]);

    const loadedStreak = await streakRepository.rebuildDailyActivity(now);

    if (options.migrateLegacyFocus) {
      await migrateLegacyFocusTask(loadedTasks);
    }

    const loadedFocusState = await focusRepository.readFocusState(loadedTasks);
    if (refreshEpoch !== refreshEpochRef.current || (localResetRef.current && !options.allowDuringReset)) return null;
    setTasks(loadedTasks);
    applySettings(loadedSettings);
    setFocusState(loadedFocusState);
    setStreak(loadedStreak);
    setClock(now);

    if (options.reconcileNotifications !== false) {
      await notificationService
        .reconcileNotifications(loadedTasks, loadedSettings, now)
        .catch((notificationError) =>
          warn('Notifications', 'background reconcile failed', notificationError)
        );
    }
    await syncNativeFocus(loadedFocusState, loadedSettings);
    await syncWidgetPresentation(loadedStreak);
    return { loadedTasks, loadedSettings, loadedFocusState, loadedStreak };
  }, [applySettings, migrateLegacyFocusTask, syncNativeFocus, syncWidgetPresentation]);

  const taskInbox = useTaskInbox({ ready: !loading, onImported: refreshTasksAndFocus });

  React.useEffect(() => {
    if (loading || !streak?.dateKey || streak.dateKey === localDateKey(clock)) {
      return;
    }
    refreshTasksAndFocus({ reconcileNotifications: false }).catch((dateError) => {
      setError(messageFromError(dateError));
    });
  }, [clock, loading, refreshTasksAndFocus, streak?.dateKey]);

  const initialize = React.useCallback(async (options = {}) => {
    setLoading(true);
    setError('');
    try {
      await getDatabase();
      await notificationService.configureNotifications();
      await Promise.all([loadCharacters(), refreshFocusPermissions()]);
      const result = await refreshTasksAndFocus({ migrateLegacyFocus: true, allowDuringReset: options.allowDuringReset });
      if (!result) return;
      await refreshProjectState();
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
  }, [
    loadCharacters,
    refreshFocusPermissions,
    refreshProjectState,
    refreshTasksAndFocus
  ]);

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
        refreshProjectState();
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
  }, [
    initialize,
    refreshFocusPermissions,
    refreshProjectState,
    refreshTasksAndFocus
  ]);

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
      if (task.projectTaskId) {
        await projectRepository.updateProjectTaskFromNormalTask(task);
      }
      await refreshTasksAndFocus();
      await refreshProjectState();
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
      await focusRepository.clearTaskReferences(taskId);
      await refreshTasksAndFocus();
      await refreshProjectState();
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
        await projectRepository.setProjectTaskCompletedFromNormal(task.projectTaskId, true);
      }
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
      await refreshProjectState();
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
        await projectRepository.setProjectTaskCompletedFromNormal(task.projectTaskId, false);
      }
      setUndoItem(null);
      await refreshTasksAndFocus();
      await refreshProjectState();
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
      applySettings(nextSettings);
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
    applySettings(nextSettings);
    await refreshTasksAndFocus({ reconcileNotifications: false });
    return nextApps;
  }

  async function updateSettings(partial) {
    const next = await settingsRepository.updateSettings(partial);
    applySettings(next);
    await refreshTasksAndFocus();
    return next;
  }

  async function updateUnlockModeSettings(partial) {
    const currentSettings = settingsRef.current || settings || await settingsRepository.readSettings();
    const currentMode = normalizeUnlockModeSettings(currentSettings.unlockMode);
    const nextModeInput = {
      ...currentMode,
      ...(partial || {})
    };
    const validation = validateUnlockModeSettings(nextModeInput);
    if (!validation.valid) {
      const validationError = new Error(validation.errors[0]);
      setError(validationError.message);
      throw validationError;
    }
    const nextSettings = await settingsRepository.updateSettings({
      unlockMode: validation.value
    });
    applySettings(nextSettings);
    await syncNativeFocus(focusState, nextSettings);
    const latest = await refreshTasksAndFocus({ reconcileNotifications: false });
    return {
      settings: latest.loadedSettings,
      unlockMode: latest.loadedSettings.unlockMode
    };
  }

  async function runProjectAction(action) {
    try {
      const result = await action();
      await refreshProjectState();
      await refreshTasksAndFocus();
      return result;
    } catch (actionError) {
      setError(messageFromError(actionError));
      throw actionError;
    }
  }

  function createProject(input) {
    return runProjectAction(() => projectRepository.createProject(input));
  }

  function updateProject(projectId, input) {
    return runProjectAction(() => projectRepository.updateProject(projectId, input));
  }

  function deleteProject(projectId) {
    return runProjectAction(() => projectRepository.deleteProject(projectId));
  }

  function createProjectMilestone(input) {
    return runProjectAction(() => projectRepository.createMilestone(input));
  }

  function updateProjectMilestone(milestoneId, input) {
    return runProjectAction(() => projectRepository.updateMilestone(milestoneId, input));
  }

  function deleteProjectMilestone(milestoneId) {
    return runProjectAction(() => projectRepository.deleteMilestone(milestoneId));
  }

  function createProjectTask(input) {
    return runProjectAction(() => projectRepository.createProjectTask(input));
  }

  function updateProjectTask(taskId, input) {
    return runProjectAction(() => projectRepository.updateProjectTask(taskId, input));
  }

  function deleteProjectTask(taskId) {
    return runProjectAction(() => projectRepository.deleteProjectTask(taskId));
  }

  function completeProjectTask(taskId, completed) {
    return runProjectAction(() => projectRepository.completeProjectTask(taskId, completed));
  }

  function addProjectTaskToToday(taskId) {
    return runProjectAction(() => projectRepository.addProjectTaskToToday(taskId));
  }

  async function requestNotifications() {
    const granted = await notificationService.requestNotificationPermission();
    await refreshTasksAndFocus();
    return granted;
  }

  async function selectCharacter(characterId) {
    const character = await characterRepository.selectCharacter(characterId);
    await updateSettings({ selectedCharacterId: characterId });
    const loaded = await loadCharacters();
    await syncWidgetPresentation(streak, loaded.currentCharacter || character);
    return character;
  }

  async function createCustomCharacter(input) {
    const character = await characterRepository.createCustomCharacter(input);
    const loaded = await loadCharacters();
    await syncWidgetPresentation(streak, loaded.currentCharacter);
    return character;
  }

  async function updateCustomCharacterImage(characterId, stateName, sourceUri) {
    const character = await characterRepository.updateCustomCharacterImage(
      characterId,
      stateName,
      sourceUri
    );
    const loaded = await loadCharacters();
    await syncWidgetPresentation(streak, loaded.currentCharacter);
    return character;
  }

  async function updateCustomCharacterDialogues(characterId, dialogues) {
    const character = await characterRepository.updateCustomCharacterDialogues(
      characterId,
      dialogues
    );
    const loaded = await loadCharacters();
    await syncWidgetPresentation(streak, loaded.currentCharacter);
    return character;
  }

  async function updateCustomCharacterProfile(characterId, profile) {
    const character = await characterRepository.updateCustomCharacterProfile(
      characterId,
      profile
    );
    const loaded = await loadCharacters();
    await syncWidgetPresentation(streak, loaded.currentCharacter);
    return character;
  }

  async function deleteCustomCharacter(characterId) {
    const character = await characterRepository.deleteCustomCharacter(characterId);
    const loaded = await loadCharacters();
    await syncWidgetPresentation(streak, loaded.currentCharacter);
    return character;
  }

  async function deleteAllLocalData() {
    if (localResetRef.current) return;
    localResetRef.current = true;
    refreshEpochRef.current++;
    try {
      await taskInbox.resetLocal(async () => {
        await notificationService.cancelAllKnownNotifications();
        await focusNativeModule.setFocusMonitorState({ active: false });
        await focusNativeModule.setUnlockMonitorState({ unlockMode: { enabled: false } });
        await clearDatabaseForReset();
        await AsyncStorage.multiRemove([
          STORAGE_KEYS.settings,
          STORAGE_KEYS.lifeState,
          STORAGE_KEYS.characters,
          STORAGE_KEYS.selectedCharacter
        ]);
        settingsRef.current = null;
        selectedCharacterRef.current = null;
        setUndoItem(null);
        await initialize({ allowDuringReset: true });
      });
    } finally {
      localResetRef.current = false;
    }
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
    createProject,
    createProjectMilestone,
    createProjectTask,
    createTask,
    deleteAllLocalData,
    deleteCustomCharacter,
    deleteProject,
    deleteProjectMilestone,
    deleteProjectTask,
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
    projectState,
    refreshFocusPermissions,
    refreshProjectState,
    refreshUnlockStatus,
    requestNotifications,
    selectCharacter,
    selectedCharacter,
    setError,
    setFocusTask,
    settings,
    startFocusSession,
    streak,
    taskGroups,
    taskInbox,
    tasks,
    undoCompleteTask,
    undoItem,
    addProjectTaskToToday,
    completeProjectTask,
    unlockStatus,
    updateBlockedApps,
    updateCustomCharacterDialogues,
    updateCustomCharacterImage,
    updateCustomCharacterProfile,
    updateProject,
    updateProjectMilestone,
    updateProjectTask,
    updateUnlockModeSettings,
    updateSettings,
    updateTask
  };

  return <TaskMateContext.Provider value={value}>{children}</TaskMateContext.Provider>;
}

module.exports = {
  TaskMateProvider,
  useTaskMate
};
