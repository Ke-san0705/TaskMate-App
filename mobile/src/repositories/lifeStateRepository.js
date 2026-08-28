const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const { STORAGE_KEYS } = require('../constants/defaults');
const { warn } = require('../utils/logger');

async function readLegacyFocusTaskId() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.lifeState);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return typeof parsed?.focusTaskId === 'string' && parsed.focusTaskId
      ? parsed.focusTaskId
      : null;
  } catch (error) {
    warn('LifeState', 'legacy focus migration skipped', error);
    return null;
  }
}

async function clearLegacyLifeState() {
  await AsyncStorage.removeItem(STORAGE_KEYS.lifeState);
}

module.exports = {
  clearLegacyLifeState,
  readLegacyFocusTaskId
};
