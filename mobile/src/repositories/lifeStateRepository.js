const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const {
  clearFocusTask,
  createDefaultLifeState,
  markCelebrated,
  normalizeLifeState,
  recordInteraction,
  recordTaskCompletion,
  registerLaunch,
  setFocusTask
} = require('@taskmate/core');
const { STORAGE_KEYS } = require('../constants/defaults');
const { warn } = require('../utils/logger');

let lifeQueue = Promise.resolve();

async function readLifeState(now = new Date()) {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.lifeState);
    if (!raw) {
      return createDefaultLifeState(now);
    }
    return normalizeLifeState(JSON.parse(raw), now);
  } catch (error) {
    warn('LifeState', 'broken life-state recovered', error);
    const fallback = createDefaultLifeState(now);
    await AsyncStorage.setItem(STORAGE_KEYS.lifeState, JSON.stringify(fallback));
    return fallback;
  }
}

function writeLifeState(next, now = new Date()) {
  lifeQueue = lifeQueue
    .catch(() => {})
    .then(async () => {
      const normalized = normalizeLifeState(next, now);
      await AsyncStorage.setItem(STORAGE_KEYS.lifeState, JSON.stringify(normalized));
      return normalized;
    });
  return lifeQueue;
}

async function registerLaunchState(now = new Date()) {
  const current = await readLifeState(now);
  const result = registerLaunch(current, now);
  result.state = await writeLifeState(result.state, now);
  return result;
}

async function recordLifeInteraction(type, details = {}, now = new Date()) {
  const current = await readLifeState(now);
  return writeLifeState(recordInteraction(current, type, now, details), now);
}

async function recordLifeCompletion(task, now = new Date()) {
  const current = await readLifeState(now);
  return writeLifeState(recordTaskCompletion(current, task, now), now);
}

async function setLifeFocusTask(taskId, now = new Date()) {
  const current = await readLifeState(now);
  return writeLifeState(setFocusTask(current, taskId, now), now);
}

async function clearLifeFocusTask(now = new Date()) {
  const current = await readLifeState(now);
  return writeLifeState(clearFocusTask(current, now), now);
}

async function markLifeCelebrated(dateKey, now = new Date()) {
  const current = await readLifeState(now);
  return writeLifeState(markCelebrated(current, dateKey, now), now);
}

async function resetLifeState(now = new Date()) {
  return writeLifeState(createDefaultLifeState(now), now);
}

module.exports = {
  clearLifeFocusTask,
  markLifeCelebrated,
  readLifeState,
  recordLifeCompletion,
  recordLifeInteraction,
  registerLaunchState,
  resetLifeState,
  setLifeFocusTask,
  writeLifeState
};
