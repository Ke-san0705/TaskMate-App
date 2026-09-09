const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const { DEFAULT_SETTINGS, STORAGE_KEYS } = require('../constants/defaults');
const { warn } = require('../utils/logger');
const { normalizeUnlockModeSettings } = require('../utils/unlockMode');

let settingsQueue = Promise.resolve();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const offsets = Array.isArray(source.notificationOffsets)
    ? source.notificationOffsets
    : [source.notificationMinutesBefore, 0];
  const notificationOffsets = offsets
    .filter((offset) => Number.isFinite(offset))
    .map((offset) => Math.max(0, Math.min(24 * 60, Math.round(offset))))
    .filter((offset, index, array) => array.indexOf(offset) === index)
    .sort((a, b) => b - a);

  return {
    ...clone(DEFAULT_SETTINGS),
    ...source,
    schemaVersion: 1,
    notificationsEnabled:
      typeof source.notificationsEnabled === 'boolean'
        ? source.notificationsEnabled
        : DEFAULT_SETTINGS.notificationsEnabled,
    notificationMinutesBefore: Number.isFinite(source.notificationMinutesBefore)
      ? Math.max(0, Math.min(24 * 60, Math.round(source.notificationMinutesBefore)))
      : DEFAULT_SETTINGS.notificationMinutesBefore,
    notificationOffsets:
      notificationOffsets.length > 0 ? notificationOffsets : DEFAULT_SETTINGS.notificationOffsets,
    focusRestrictionEnabled:
      typeof source.focusRestrictionEnabled === 'boolean'
        ? source.focusRestrictionEnabled
        : DEFAULT_SETTINGS.focusRestrictionEnabled,
    focusAccessibilityDisclosureAcceptedAt:
      typeof source.focusAccessibilityDisclosureAcceptedAt === 'string' &&
      source.focusAccessibilityDisclosureAcceptedAt
        ? source.focusAccessibilityDisclosureAcceptedAt
        : DEFAULT_SETTINGS.focusAccessibilityDisclosureAcceptedAt,
    defaultBlockedApps: Array.isArray(source.defaultBlockedApps)
      ? source.defaultBlockedApps
          .map((app) => ({
            packageName: typeof app?.packageName === 'string' ? app.packageName : '',
            appName: typeof app?.appName === 'string' ? app.appName : ''
          }))
          .filter((app) => app.packageName && app.appName)
      : DEFAULT_SETTINGS.defaultBlockedApps,
    unlockMode: normalizeUnlockModeSettings(source.unlockMode),
    quietHours: {
      ...DEFAULT_SETTINGS.quietHours,
      ...(source.quietHours && typeof source.quietHours === 'object' ? source.quietHours : {})
    },
    reduceMotion:
      typeof source.reduceMotion === 'boolean'
        ? source.reduceMotion
        : DEFAULT_SETTINGS.reduceMotion,
    use24HourClock:
      typeof source.use24HourClock === 'boolean'
        ? source.use24HourClock
        : DEFAULT_SETTINGS.use24HourClock,
    selectedCharacterId:
      typeof source.selectedCharacterId === 'string' && source.selectedCharacterId
        ? source.selectedCharacterId
        : DEFAULT_SETTINGS.selectedCharacterId
  };
}

async function readSettings() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) {
      return clone(DEFAULT_SETTINGS);
    }
    return normalizeSettings(JSON.parse(raw));
  } catch (error) {
    warn('Settings', 'broken settings recovered', error);
    await AsyncStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(DEFAULT_SETTINGS));
    return clone(DEFAULT_SETTINGS);
  }
}

function writeSettings(next) {
  settingsQueue = settingsQueue
    .catch(() => {})
    .then(async () => {
      const normalized = normalizeSettings(next);
      await AsyncStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(normalized));
      return normalized;
    });
  return settingsQueue;
}

async function updateSettings(partial) {
  const current = await readSettings();
  return writeSettings({ ...current, ...(partial || {}) });
}

async function resetSettings() {
  return writeSettings(DEFAULT_SETTINGS);
}

module.exports = {
  normalizeSettings,
  readSettings,
  resetSettings,
  updateSettings,
  writeSettings
};
