const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DEFAULT_SETTINGS, REQUIRED_CHARACTER_FILES } = require('./constants');
const { createPathResolver } = require('./paths');

const fsPromises = fs.promises;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const PRIORITIES = new Set(['high', 'normal', 'low']);
const MAX_NOTIFICATION_OFFSET_MINUTES = 24 * 60;
const MAX_NOTIFICATION_RULES = 8;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

  return {
    id: task.id.trim(),
    title: task.title.trim(),
    description: typeof task.description === 'string' ? task.description : '',
    date: task.date,
    time: task.time,
    genre: typeof task.genre === 'string' ? task.genre : '',
    priority: task.priority,
    completed: task.completed
  };
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
      completed:
        typeof taskInput.completed === 'boolean' ? taskInput.completed : false
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
    genreHistory: genreHistory.sort((a, b) => a.localeCompare(b, 'ja'))
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

  async function ensureInitialFiles() {
    await fsPromises.mkdir(paths.dataRoot, { recursive: true });
    await copyBundledFileIfMissing('tasks.json', []);
    await copyBundledFileIfMissing('settings.json', clone(DEFAULT_SETTINGS));
    await copyBundledFileIfMissing('notification-state.json', {});
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
    await safeWriteJson(paths.tasksFile, tasks);
    return { task, tasks };
  }

  async function addTask(taskInput) {
    const tasks = await getTasks();
    const task = normalizeTaskInput(taskInput);
    if (tasks.some((candidate) => candidate.id === task.id)) {
      task.id = `task-${crypto.randomUUID()}`;
    }
    const nextTasks = [...tasks, task];
    await safeWriteJson(paths.tasksFile, nextTasks);
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
    await safeWriteJson(paths.tasksFile, nextTasks);
    if (scheduleChanged) {
      await clearNotificationStateForTask(taskId);
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
    await safeWriteJson(paths.tasksFile, nextTasks);
    await clearNotificationStateForTask(taskId);

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
      'genreHistory'
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

  async function getCharacters() {
    let entries = [];
    try {
      entries = await fsPromises.readdir(paths.charactersRoot, { withFileTypes: true });
    } catch (error) {
      console.error('Charaフォルダを読み込めませんでした。', error);
      return [];
    }

    return Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
        .map(async (entry) => {
          const missingFiles = [];
          for (const fileName of REQUIRED_CHARACTER_FILES) {
            try {
              await fsPromises.access(path.join(paths.charactersRoot, entry.name, fileName));
            } catch {
              missingFiles.push(fileName);
            }
          }
          return {
            name: entry.name,
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
    const folder = path.join(paths.charactersRoot, characterName);
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

    return {
      name: characterName,
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
    getNotificationState,
    saveNotificationState
  };
}

module.exports = {
  createFileManager,
  normalizeSettings,
  normalizeTaskInput,
  validateTasks
};
