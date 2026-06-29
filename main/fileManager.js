const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DEFAULT_SETTINGS, REQUIRED_CHARACTER_FILES } = require('./constants');
const { createPathResolver } = require('./paths');
const { createProjectStore } = require('./projectStore');
const {
  createDefaultLifeState,
  normalizeLifeState
} = require('../behavior/relationshipEngine');

const fsPromises = fs.promises;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const PRIORITIES = new Set(['high', 'normal', 'low']);
const BEHAVIOR_INTENSITIES = new Set(['low', 'normal', 'high']);
const MAX_NOTIFICATION_OFFSET_MINUTES = 24 * 60;
const MAX_NOTIFICATION_RULES = 8;
const PROJECT_SETTING_LIMITS = Object.freeze({
  dailyAvailableMinutes: [15, 24 * 60],
  weekdayAvailableMinutes: [15, 24 * 60],
  weekendAvailableMinutes: [15, 24 * 60],
  defaultSessionMinutes: [5, 240],
  dailyRecommendationLimit: [1, 20],
  deadlineWarningDays: [1, 60]
});
const CHARACTER_IMAGE_STATES = Object.freeze([
  'wait',
  'click',
  'alarm',
  'calm',
  'attentive',
  'restless',
  'anxious',
  'overloaded',
  'focusing',
  'reconnecting',
  'relieved',
  'celebrating',
  'notifying',
  'clicked'
]);
const DATA_URL_PATTERN = /^data:([^;,]+);base64,([a-zA-Z0-9+/=\r\n]+)$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function safeCharacterFolderName(value, fallback = 'cloud-character') {
  const source = typeof value === 'string' ? value.trim() : '';
  const sanitized = source
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\.+$/g, '')
    .slice(0, 80);
  return sanitized || fallback;
}

function isValidLocalDate(value) {
  if (!DATE_PATTERN.test(value)) {
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

function validateTask(task, index) {
  if (!isPlainObject(task)) {
    throw new Error(`${index + 1}件目のタスクがオブジェクトではありません。`);
  }
  if (typeof task.id !== 'string' || !task.id.trim()) {
    throw new Error(`${index + 1}件目のidが不正です。`);
  }
  if (typeof task.title !== 'string' || !task.title.trim()) {
    throw new Error(`${index + 1}件目のtitleが不正です。`);
  }
  if (typeof task.date !== 'string' || !isValidLocalDate(task.date)) {
    throw new Error(`${task.title}の日付形式が不正です。`);
  }
  if (task.time !== null && (typeof task.time !== 'string' || !TIME_PATTERN.test(task.time))) {
    throw new Error(`${task.title}の時刻形式が不正です。`);
  }
  if (!PRIORITIES.has(task.priority)) {
    throw new Error(`${task.title}のpriorityが不正です。`);
  }
  if (typeof task.completed !== 'boolean') {
    throw new Error(`${task.title}のcompletedが真偽値ではありません。`);
  }

  const timestamp = nowIso();
  const createdAt =
    typeof task.createdAt === 'string' && task.createdAt
      ? task.createdAt
      : typeof task.created_at === 'string' && task.created_at
        ? task.created_at
        : timestamp;
  const updatedAt =
    typeof task.updatedAt === 'string' && task.updatedAt
      ? task.updatedAt
      : typeof task.updated_at === 'string' && task.updated_at
        ? task.updated_at
        : createdAt;
  const completedAt =
    task.completed && typeof task.completedAt === 'string'
      ? task.completedAt
      : task.completed && typeof task.completed_at === 'string'
        ? task.completed_at
        : task.completed
          ? updatedAt
          : null;

  const normalized = {
    id: task.id.trim(),
    title: task.title.trim(),
    description: typeof task.description === 'string' ? task.description : '',
    date: task.date,
    time: task.time,
    genre: typeof task.genre === 'string' ? task.genre : '',
    priority: task.priority,
    completed: task.completed,
    createdAt,
    updatedAt,
    completedAt
  };
  if (task.source === 'project' && typeof task.projectTaskId === 'string') {
    normalized.source = 'project';
    normalized.projectTaskId = task.projectTaskId;
    normalized.projectId = typeof task.projectId === 'string' ? task.projectId : null;
    normalized.projectName =
      typeof task.projectName === 'string' ? task.projectName : '未分類プロジェクト';
    normalized.projectCategoryId =
      typeof task.projectCategoryId === 'string' ? task.projectCategoryId : null;
    normalized.projectCategoryName =
      typeof task.projectCategoryName === 'string' ? task.projectCategoryName : '未分類';
    normalized.projectMilestoneId =
      typeof task.projectMilestoneId === 'string' ? task.projectMilestoneId : null;
    normalized.projectMilestoneTitle =
      typeof task.projectMilestoneTitle === 'string' ? task.projectMilestoneTitle : '';
  }

  return normalized;
}

function validateTasks(value) {
  if (!Array.isArray(value)) {
    throw new Error('tasks.jsonのルートは配列にしてください。');
  }
  const tasks = value.map(validateTask);
  const ids = new Set();
  for (const task of tasks) {
    if (ids.has(task.id)) {
      throw new Error(`タスクID「${task.id}」が重複しています。`);
    }
    ids.add(task.id);
  }
  return tasks;
}

function normalizeTaskInput(taskInput) {
  if (!isPlainObject(taskInput)) {
    throw new Error('タスク情報がオブジェクトではありません。');
  }

  const time =
    typeof taskInput.time === 'string' && taskInput.time.trim()
      ? taskInput.time.trim()
      : null;

  const previous = isPlainObject(taskInput.current) ? taskInput.current : {};
  const timestamp = nowIso();
  const completed = typeof taskInput.completed === 'boolean' ? taskInput.completed : false;

  return validateTask(
    {
      id:
        typeof taskInput.id === 'string' && taskInput.id.trim()
          ? taskInput.id.trim()
          : `task-${crypto.randomUUID()}`,
      title: typeof taskInput.title === 'string' ? taskInput.title.trim() : '',
      description:
        typeof taskInput.description === 'string' ? taskInput.description.trim() : '',
      date: typeof taskInput.date === 'string' ? taskInput.date.trim() : '',
      time,
      genre: typeof taskInput.genre === 'string' ? taskInput.genre.trim() : '',
      priority:
        typeof taskInput.priority === 'string' ? taskInput.priority.trim() : 'normal',
      completed,
      createdAt:
        typeof taskInput.createdAt === 'string' && taskInput.createdAt
          ? taskInput.createdAt
          : typeof previous.createdAt === 'string' && previous.createdAt
            ? previous.createdAt
            : timestamp,
      updatedAt:
        taskInput.preserveUpdatedAt === true &&
        typeof taskInput.updatedAt === 'string' &&
        taskInput.updatedAt
          ? taskInput.updatedAt
          : timestamp,
      completedAt: completed
        ? typeof taskInput.completedAt === 'string' && taskInput.completedAt
          ? taskInput.completedAt
          : previous.completed === true && typeof previous.completedAt === 'string'
            ? previous.completedAt
            : timestamp
        : null,
      source: taskInput.source,
      projectTaskId: taskInput.projectTaskId,
      projectId: taskInput.projectId,
      projectName: taskInput.projectName,
      projectCategoryId: taskInput.projectCategoryId,
      projectCategoryName: taskInput.projectCategoryName,
      projectMilestoneId: taskInput.projectMilestoneId,
      projectMilestoneTitle: taskInput.projectMilestoneTitle
    },
    0
  );
}

function normalizeNotificationOffsets(source) {
  const offsets = Array.isArray(source.notificationOffsets)
    ? source.notificationOffsets
    : Number.isFinite(source.notificationMinutesBefore)
      ? [source.notificationMinutesBefore, 0]
      : DEFAULT_SETTINGS.notificationOffsets;

  const normalized = [];
  for (const offset of offsets) {
    if (!Number.isFinite(offset)) {
      continue;
    }
    const minutes = Math.min(
      MAX_NOTIFICATION_OFFSET_MINUTES,
      Math.max(0, Math.round(offset))
    );
    if (!normalized.includes(minutes)) {
      normalized.push(minutes);
    }
    if (normalized.length >= MAX_NOTIFICATION_RULES) {
      break;
    }
  }

  const result = normalized.length > 0 ? normalized : DEFAULT_SETTINGS.notificationOffsets;
  return [...result].sort((a, b) => b - a);
}

function normalizeQuietHours(source) {
  const quietHours = isPlainObject(source.quietHours) ? source.quietHours : {};
  const isValidTime = (value) => typeof value === 'string' && TIME_PATTERN.test(value);
  return {
    enabled:
      typeof quietHours.enabled === 'boolean'
        ? quietHours.enabled
        : DEFAULT_SETTINGS.quietHours.enabled,
    start: isValidTime(quietHours.start)
      ? quietHours.start
      : DEFAULT_SETTINGS.quietHours.start,
    end: isValidTime(quietHours.end) ? quietHours.end : DEFAULT_SETTINGS.quietHours.end
  };
}

function normalizeProjectSettings(source) {
  const settings = isPlainObject(source.projectSettings) ? source.projectSettings : {};
  const defaults = DEFAULT_SETTINGS.projectSettings;
  const clampSetting = (key) => {
    const [min, max] = PROJECT_SETTING_LIMITS[key];
    const value = Number(settings[key]);
    if (!Number.isFinite(value)) {
      return defaults[key];
    }
    return Math.min(max, Math.max(min, Math.round(value)));
  };
  return {
    dailyAvailableMinutes: clampSetting('dailyAvailableMinutes'),
    weekdayAvailableMinutes: clampSetting('weekdayAvailableMinutes'),
    weekendAvailableMinutes: clampSetting('weekendAvailableMinutes'),
    defaultSessionMinutes: clampSetting('defaultSessionMinutes'),
    dailyRecommendationLimit: clampSetting('dailyRecommendationLimit'),
    deadlineWarningDays: clampSetting('deadlineWarningDays'),
    overdueNotificationsEnabled:
      typeof settings.overdueNotificationsEnabled === 'boolean'
        ? settings.overdueNotificationsEnabled
        : defaults.overdueNotificationsEnabled,
    progressNotificationsEnabled:
      typeof settings.progressNotificationsEnabled === 'boolean'
        ? settings.progressNotificationsEnabled
        : defaults.progressNotificationsEnabled
  };
}

function normalizeSettings(value) {
  const source = isPlainObject(value) ? value : {};
  const position = isPlainObject(source.windowPosition) ? source.windowPosition : {};
  const scale = (candidate, fallback) =>
    Number.isFinite(candidate) ? Math.min(200, Math.max(50, Math.round(candidate / 10) * 10)) : fallback;
  const genreHistory = Array.isArray(source.genreHistory)
    ? [...new Set(source.genreHistory.filter((genre) => typeof genre === 'string').map((genre) => genre.trim()).filter(Boolean))]
    : [...DEFAULT_SETTINGS.genreHistory];

  return {
    selectedCharacter:
      typeof source.selectedCharacter === 'string' && source.selectedCharacter
        ? source.selectedCharacter
        : DEFAULT_SETTINGS.selectedCharacter,
    showCharacter:
      typeof source.showCharacter === 'boolean'
        ? source.showCharacter
        : DEFAULT_SETTINGS.showCharacter,
    characterScale: scale(source.characterScale, DEFAULT_SETTINGS.characterScale),
    bubbleScale: scale(source.bubbleScale, DEFAULT_SETTINGS.bubbleScale),
    windowPosition: {
      x: Number.isFinite(position.x) ? Math.round(position.x) : null,
      y: Number.isFinite(position.y) ? Math.round(position.y) : null
    },
    bubblePosition: 'right',
    autoStart:
      typeof source.autoStart === 'boolean' ? source.autoStart : DEFAULT_SETTINGS.autoStart,
    clickImageDuration:
      Number.isFinite(source.clickImageDuration) && source.clickImageDuration >= 500
        ? Math.round(source.clickImageDuration)
        : DEFAULT_SETTINGS.clickImageDuration,
    notificationMinutesBefore:
      Number.isFinite(source.notificationMinutesBefore) &&
      source.notificationMinutesBefore >= 1 &&
      source.notificationMinutesBefore <= 180
        ? Math.round(source.notificationMinutesBefore)
        : DEFAULT_SETTINGS.notificationMinutesBefore,
    notificationOffsets: normalizeNotificationOffsets(source),
    useNativeNotifications:
      typeof source.useNativeNotifications === 'boolean'
        ? source.useNativeNotifications
        : DEFAULT_SETTINGS.useNativeNotifications,
    isMainWindowVisible:
      typeof source.isMainWindowVisible === 'boolean'
        ? source.isMainWindowVisible
        : DEFAULT_SETTINGS.isMainWindowVisible,
    genreHistory: genreHistory.sort((a, b) => a.localeCompare(b, 'ja')),
    behaviorEnabled:
      typeof source.behaviorEnabled === 'boolean'
        ? source.behaviorEnabled
        : DEFAULT_SETTINGS.behaviorEnabled,
    ambientEffects:
      typeof source.ambientEffects === 'boolean'
        ? source.ambientEffects
        : DEFAULT_SETTINGS.ambientEffects,
    autonomousMovement:
      typeof source.autonomousMovement === 'boolean'
        ? source.autonomousMovement
        : DEFAULT_SETTINGS.autonomousMovement,
    completionReactions:
      typeof source.completionReactions === 'boolean'
        ? source.completionReactions
        : DEFAULT_SETTINGS.completionReactions,
    relationshipMemoryEnabled:
      typeof source.relationshipMemoryEnabled === 'boolean'
        ? source.relationshipMemoryEnabled
        : DEFAULT_SETTINGS.relationshipMemoryEnabled,
    behaviorIntensity: BEHAVIOR_INTENSITIES.has(source.behaviorIntensity)
      ? source.behaviorIntensity
      : DEFAULT_SETTINGS.behaviorIntensity,
    quietHours: normalizeQuietHours(source),
    projectSettings: normalizeProjectSettings(source)
  };
}

function validateDialogues(value) {
  if (!isPlainObject(value)) {
    throw new Error('dialogues.jsonのルートがオブジェクトではありません。');
  }
  const result = {};
  for (const [key, messages] of Object.entries(value)) {
    if (Array.isArray(messages)) {
      result[key] = messages.filter((message) => typeof message === 'string' && message.trim());
    }
  }
  if (!Object.values(result).some((messages) => messages.length > 0)) {
    throw new Error('dialogues.jsonに有効なセリフがありません。');
  }
  return result;
}

function createFileManager(app) {
  const paths = createPathResolver(app);
  const writeQueues = new Map();

  async function readJson(filePath) {
    const text = await fsPromises.readFile(filePath, 'utf8');
    return JSON.parse(text.replace(/^\uFEFF/, ''));
  }

  function queueWrite(filePath, operation) {
    const previous = writeQueues.get(filePath) || Promise.resolve();
    const next = previous.catch(() => {}).then(operation);
    writeQueues.set(filePath, next);
    return next.finally(() => {
      if (writeQueues.get(filePath) === next) {
        writeQueues.delete(filePath);
      }
    });
  }

  async function safeWriteJson(filePath, value) {
    return queueWrite(filePath, async () => {
      await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      const content = `${JSON.stringify(value, null, 2)}\n`;
      await fsPromises.writeFile(temporaryPath, content, 'utf8');
      try {
        await fsPromises.rename(temporaryPath, filePath);
      } catch (error) {
        if (!['EEXIST', 'EPERM'].includes(error.code)) {
          await fsPromises.rm(temporaryPath, { force: true });
          throw error;
        }
        await fsPromises.copyFile(temporaryPath, filePath);
        await fsPromises.rm(temporaryPath, { force: true });
      }
    });
  }

  async function copyBundledFileIfMissing(fileName, fallback) {
    const destination = path.join(paths.dataRoot, fileName);
    try {
      await fsPromises.access(destination);
      return;
    } catch {
      // First launch after install: create the writable userData copy without
      // overwriting existing user data from an older TaskMate installation.
      // 初回起動時だけ、同梱データまたは既定値から生成します。
    }

    const source = path.join(paths.bundledDataRoot, fileName);
    try {
      if (source !== destination) {
        await fsPromises.copyFile(source, destination);
        return;
      }
    } catch {
      // 同梱ファイルがない場合は下の既定値を利用します。
    }
    await safeWriteJson(destination, fallback);
  }

  async function saveTasks(tasks) {
    // 通常タスクとプロジェクトタスクの同期時も、既存と同じatomic write経路を必ず通します。
    // 途中でアプリが終了してもtasks.jsonが半端な状態になりにくくするためです。
    await safeWriteJson(paths.tasksFile, validateTasks(tasks));
  }

  async function ensureInitialFiles() {
    // Installer builds keep bundled defaults read-only in resources. Runtime JSON
    // lives in paths.dataRoot so updates, uninstall/reinstall, and non-admin users
    // do not depend on write access to the application install directory.
    await fsPromises.mkdir(paths.dataRoot, { recursive: true });
    await fsPromises.mkdir(paths.customCharactersRoot, { recursive: true });
    await copyBundledFileIfMissing('tasks.json', []);
    await copyBundledFileIfMissing('settings.json', clone(DEFAULT_SETTINGS));
    await copyBundledFileIfMissing('notification-state.json', {});
    await copyBundledFileIfMissing('life-state.json', createDefaultLifeState());
    await projectStore.ensureInitialFiles();
  }

  async function getTasks() {
    return validateTasks(await readJson(paths.tasksFile));
  }

  async function getTasksResult() {
    try {
      return { tasks: await getTasks(), error: null };
    } catch (error) {
      console.error('tasks.jsonの読み込みに失敗しました。', error);
      return {
        tasks: [],
        error: 'タスクをうまく読み込めませんでした。tasks.jsonを確認してください。'
      };
    }
  }

  async function setTaskCompleted(taskId, completed) {
    const tasks = await getTasks();
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      throw new Error('対象のタスクが見つかりません。');
    }
    task.completed = completed;
    await saveTasks(tasks);
    if (task.projectTaskId) {
      // 通常タスクとしてチェックされた場合も、元の長期プロジェクトタスクを同じ完了状態へ寄せます。
      // 複製ではなく参照同期にすることで、二つの画面で進捗が食い違うことを防ぎます。
      await projectStore.setProjectTaskCompletedFromNormal(task.projectTaskId, completed);
    }
    return { task, tasks };
  }

  async function addTask(taskInput) {
    const tasks = await getTasks();
    const task = normalizeTaskInput(taskInput);
    if (tasks.some((candidate) => candidate.id === task.id)) {
      task.id = `task-${crypto.randomUUID()}`;
    }
    const nextTasks = [...tasks, task];
    await saveTasks(nextTasks);
    return { task, tasks: nextTasks };
  }

  async function clearNotificationStateForTask(taskId) {
    const state = await getNotificationState();
    let changed = false;
    for (const key of Object.keys(state)) {
      if (key.startsWith(`${taskId}|`)) {
        delete state[key];
        changed = true;
      }
    }
    if (changed) {
      await saveNotificationState(state);
    }
  }

  async function updateTask(taskId, taskInput) {
    if (typeof taskId !== 'string' || !taskId.trim()) {
      throw new Error('タスクIDが不正です。');
    }
    if (!isPlainObject(taskInput)) {
      throw new Error('タスク情報が不正です。');
    }
    const tasks = await getTasks();
    const index = tasks.findIndex((candidate) => candidate.id === taskId);
    if (index === -1) {
      throw new Error('編集対象のタスクが見つかりません。');
    }
    const current = tasks[index];
    const task = normalizeTaskInput({
      ...current,
      ...taskInput,
      id: current.id,
      completed:
        typeof taskInput.completed === 'boolean' ? taskInput.completed : current.completed
    });
    const scheduleChanged =
      current.date !== task.date ||
      current.time !== task.time ||
      current.completed !== task.completed;
    const nextTasks = [...tasks];
    nextTasks[index] = task;
    await saveTasks(nextTasks);
    if (scheduleChanged) {
      await clearNotificationStateForTask(taskId);
    }
    if (task.projectTaskId) {
      await projectStore.syncProjectTaskFromNormalTask(task);
    }
    return { task, tasks: nextTasks };
  }

  async function deleteTask(taskId) {
    if (typeof taskId !== 'string' || !taskId.trim()) {
      throw new Error('タスクIDが不正です。');
    }
    const tasks = await getTasks();
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      throw new Error('削除対象のタスクが見つかりません。');
    }
    const nextTasks = tasks.filter((candidate) => candidate.id !== taskId);
    await saveTasks(nextTasks);
    await clearNotificationStateForTask(taskId);
    await projectStore.unlinkNormalTask(taskId);

    return { task, tasks: nextTasks };
  }

  async function getSettings() {
    try {
      return normalizeSettings(await readJson(paths.settingsFile));
    } catch (error) {
      console.error('settings.jsonを読み込めないため、既定値を使用します。', error);
      const defaults = clone(DEFAULT_SETTINGS);
      await safeWriteJson(paths.settingsFile, defaults);
      return defaults;
    }
  }

  async function updateSettings(partialSettings) {
    if (!isPlainObject(partialSettings)) {
      throw new Error('設定値がオブジェクトではありません。');
    }
    const current = await getSettings();
    const allowedKeys = new Set([
      'selectedCharacter',
      'showCharacter',
      'characterScale',
      'bubbleScale',
      'windowPosition',
      'autoStart',
      'clickImageDuration',
      'notificationMinutesBefore',
      'notificationOffsets',
      'useNativeNotifications',
      'isMainWindowVisible',
      'genreHistory',
      'behaviorEnabled',
      'ambientEffects',
      'autonomousMovement',
      'completionReactions',
      'relationshipMemoryEnabled',
      'behaviorIntensity',
      'quietHours',
      'projectSettings'
    ]);
    const accepted = {};
    for (const [key, value] of Object.entries(partialSettings)) {
      if (allowedKeys.has(key)) {
        accepted[key] = value;
      }
    }
    const next = normalizeSettings({ ...current, ...accepted });
    await safeWriteJson(paths.settingsFile, next);
    return next;
  }

  async function listCharacterEntries(root, builtIn) {
    try {
      const entries = await fsPromises.readdir(root, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({ name: entry.name, root, builtIn }));
    } catch (error) {
      if (builtIn) {
        console.error('Charaフォルダを読み込めませんでした。', error);
      }
      return [];
    }
  }

  async function getCharacterRegistry() {
    const [bundledEntries, customEntries] = await Promise.all([
      listCharacterEntries(paths.charactersRoot, true),
      listCharacterEntries(paths.customCharactersRoot, false)
    ]);
    const byName = new Map();
    for (const entry of [...bundledEntries, ...customEntries]) {
      if (!byName.has(entry.name)) {
        byName.set(entry.name, entry);
      }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }

  async function getCharacters() {
    const entries = await getCharacterRegistry();

    return Promise.all(
      entries.map(async (entry) => {
        const missingFiles = [];
        for (const fileName of REQUIRED_CHARACTER_FILES) {
          try {
            await fsPromises.access(path.join(entry.root, entry.name, fileName));
          } catch {
            missingFiles.push(fileName);
          }
        }
        return {
          name: entry.name,
          builtIn: entry.builtIn,
          valid: missingFiles.length === 0,
          missingFiles
        };
      })
    );
  }

  async function assertCharacterName(characterName) {
    if (
      typeof characterName !== 'string' ||
      !characterName ||
      path.basename(characterName) !== characterName
    ) {
      throw new Error('キャラクター名が不正です。');
    }
    const characters = await getCharacters();
    const character = characters.find((candidate) => candidate.name === characterName);
    if (!character) {
      throw new Error('指定したキャラクターが見つかりません。');
    }
    return character;
  }

  async function getCharacterFolder(characterName) {
    const registry = await getCharacterRegistry();
    const entry = registry.find((candidate) => candidate.name === characterName);
    if (!entry) {
      throw new Error('指定したキャラクターが見つかりません。');
    }
    return path.join(entry.root, entry.name);
  }

  async function imageAsDataUrl(filePath) {
    try {
      const image = await fsPromises.readFile(filePath);
      return `data:image/png;base64,${image.toString('base64')}`;
    } catch {
      return null;
    }
  }

  async function getCharacterData(characterName) {
    const character = await assertCharacterName(characterName);
    const folder = await getCharacterFolder(characterName);
    let dialogues = {};
    let error = null;
    try {
      dialogues = validateDialogues(await readJson(path.join(folder, 'dialogues.json')));
    } catch (dialogueError) {
      console.error(`${characterName}のセリフを読み込めませんでした。`, dialogueError);
      error = 'キャラクターのセリフを読み込めませんでした。';
    }

    const images = {
      wait: await imageAsDataUrl(path.join(folder, 'wait.png')),
      click: await imageAsDataUrl(path.join(folder, 'click.png')),
      alarm: await imageAsDataUrl(path.join(folder, 'alarm.png'))
    };
    if (Object.values(images).some((image) => !image)) {
      error = error || 'キャラクター画像の一部が見つかりません。';
    }

    // ver1.1.0の状態画像は任意です。キャラクターパック側に追加画像がなければ、
    // 既存ver1.0.0のwait/click/alarm画像へ安全にフォールバックします。
    const optionalImageFallbacks = {
      calm: images.wait,
      attentive: images.wait,
      restless: images.wait,
      anxious: images.alarm || images.wait,
      overloaded: images.alarm || images.wait,
      focusing: images.wait,
      reconnecting: images.wait,
      relieved: images.click || images.wait,
      celebrating: images.click || images.wait,
      notifying: images.alarm || images.wait,
      clicked: images.click || images.wait
    };
    for (const [stateName, fallbackImage] of Object.entries(optionalImageFallbacks)) {
      images[stateName] =
        (await imageAsDataUrl(path.join(folder, `${stateName}.png`))) || fallbackImage;
    }

    return {
      name: characterName,
      builtIn: character.builtIn,
      valid: character.valid,
      missingFiles: character.missingFiles,
      images,
      dialogues,
      error
    };
  }

  async function selectCharacter(characterName) {
    const character = await assertCharacterName(characterName);
    if (!character.valid) {
      throw new Error(`不足ファイル: ${character.missingFiles.join(', ')}`);
    }
    const characterData = await getCharacterData(characterName);
    if (characterData.error) {
      throw new Error(characterData.error);
    }
    return updateSettings({ selectedCharacter: characterName });
  }

  async function exportCharacterPack(characterName) {
    const character = await assertCharacterName(characterName);
    const data = await getCharacterData(characterName);
    if (data.error) {
      throw new Error(data.error);
    }
    return {
      id: character.name,
      name: character.name,
      description: '',
      builtIn: character.builtIn,
      images: data.images,
      dialogues: data.dialogues
    };
  }

  function decodeDataUrl(dataUrl) {
    if (typeof dataUrl !== 'string') {
      return null;
    }
    const match = DATA_URL_PATTERN.exec(dataUrl.trim());
    if (!match) {
      return null;
    }
    return {
      mimeType: match[1].toLowerCase(),
      buffer: Buffer.from(match[2].replace(/\s/g, ''), 'base64')
    };
  }

  async function writeImageDataUrl(folder, stateName, dataUrl) {
    const decoded = decodeDataUrl(dataUrl);
    if (!decoded || !decoded.mimeType.startsWith('image/')) {
      throw new Error(`${stateName}の画像データが不正です。`);
    }
    await fsPromises.writeFile(path.join(folder, `${stateName}.png`), decoded.buffer);
  }

  async function bundledCharacterNameExists(characterName) {
    try {
      const stats = await fsPromises.stat(path.join(paths.charactersRoot, characterName));
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async function saveCloudCharacterPack(characterPack) {
    const remoteId = safeCharacterFolderName(
      characterPack.localCharacterId || characterPack.local_character_id || characterPack.id,
      safeCharacterFolderName(characterPack.name)
    );
    const targetName = (await bundledCharacterNameExists(remoteId))
      ? safeCharacterFolderName(`cloud-${remoteId}`)
      : remoteId;
    const folder = path.join(paths.customCharactersRoot, targetName);
    const images = isPlainObject(characterPack.images) ? characterPack.images : {};
    const fallbackImage = images.wait || images.click || images.alarm;
    const dialoguesSource = isPlainObject(characterPack.dialogues)
      ? characterPack.dialogues
      : { calm: ['こんにちは。'] };

    await fsPromises.mkdir(folder, { recursive: true });
    await safeWriteJson(path.join(folder, 'dialogues.json'), validateDialogues(dialoguesSource));

    for (const stateName of ['wait', 'click', 'alarm']) {
      const image = images[stateName] || fallbackImage;
      if (!image) {
        throw new Error(`${stateName}.pngに使える画像がありません。`);
      }
      await writeImageDataUrl(folder, stateName, image);
    }
    for (const stateName of CHARACTER_IMAGE_STATES) {
      if (['wait', 'click', 'alarm'].includes(stateName) || !images[stateName]) {
        continue;
      }
      await writeImageDataUrl(folder, stateName, images[stateName]);
    }

    return getCharacterData(targetName);
  }

  async function getNotificationState() {
    try {
      const state = await readJson(paths.notificationStateFile);
      return isPlainObject(state) ? state : {};
    } catch (error) {
      console.error('通知状態を読み込めないため、空の状態を使用します。', error);
      return {};
    }
  }

  async function saveNotificationState(state) {
    await safeWriteJson(paths.notificationStateFile, state);
  }

  async function getLifeState() {
    try {
      return normalizeLifeState(await readJson(paths.lifeStateFile));
    } catch (error) {
      console.error('life-state.jsonを読み込めないため、既定値へ復旧します。', error);
      const state = createDefaultLifeState();
      await safeWriteJson(paths.lifeStateFile, state);
      return state;
    }
  }

  async function saveLifeState(state) {
    // life-stateは行動履歴を含むため、保存前に必ず正規化します。
    // 壊れた値や想定外のinteraction名をそのまま永続化しないことで、
    // 次回起動時のクラッシュと不自然な再訪演出を防ぎます。
    await safeWriteJson(paths.lifeStateFile, normalizeLifeState(state));
  }

  async function resetLifeState() {
    const state = createDefaultLifeState();
    await safeWriteJson(paths.lifeStateFile, state);
    return state;
  }

  const projectStore = createProjectStore({
    paths,
    readJson,
    safeWriteJson,
    ensureJsonFile: copyBundledFileIfMissing,
    getTasks,
    saveTasks,
    normalizeTaskInput,
    clearNotificationStateForTask
  });

  return {
    paths,
    ensureInitialFiles,
    getTasks,
    getTasksResult,
    addTask,
    updateTask,
    deleteTask,
    setTaskCompleted,
    getSettings,
    updateSettings,
    getCharacters,
    getCharacterData,
    selectCharacter,
    exportCharacterPack,
    saveCloudCharacterPack,
    getNotificationState,
    saveNotificationState,
    getLifeState,
    saveLifeState,
    resetLifeState,
    getProjectStateResult: projectStore.getProjectStateResult,
    createProjectCategory: projectStore.createCategory,
    updateProjectCategory: projectStore.updateCategory,
    deleteProjectCategory: projectStore.deleteCategory,
    createProject: projectStore.createProject,
    updateProject: projectStore.updateProject,
    deleteProject: projectStore.deleteProject,
    createProjectMilestone: projectStore.createMilestone,
    updateProjectMilestone: projectStore.updateMilestone,
    deleteProjectMilestone: projectStore.deleteMilestone,
    createProjectTask: projectStore.createProjectTask,
    updateProjectTask: projectStore.updateProjectTask,
    deleteProjectTask: projectStore.deleteProjectTask,
    completeProjectTask: projectStore.completeProjectTask,
    addProjectTaskToToday: projectStore.addProjectTaskToToday
  };
}

module.exports = {
  createFileManager,
  normalizeSettings,
  normalizeTaskInput,
  validateTasks
};
