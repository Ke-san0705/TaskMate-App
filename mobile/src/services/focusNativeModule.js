const { NativeModules, Platform } = require('react-native');
const { normalizeUnlockModeSettings } = require('../utils/unlockMode');

const native = NativeModules.TaskMateFocus || null;

const FALLBACK_BLOCKED_APPS = Object.freeze([
  { packageName: 'com.instagram.android', appName: 'Instagram' },
  { packageName: 'com.twitter.android', appName: 'X' },
  { packageName: 'com.zhiliaoapp.musically', appName: 'TikTok' },
  { packageName: 'com.google.android.youtube', appName: 'YouTube' },
  { packageName: 'com.discord', appName: 'Discord' },
  { packageName: 'com.android.chrome', appName: 'Chrome' }
]);

function isAvailable() {
  return Platform.OS === 'android' && Boolean(native);
}

function normalizeApp(app) {
  const packageName = typeof app?.packageName === 'string' ? app.packageName : '';
  const appName = typeof app?.appName === 'string' ? app.appName : packageName;
  return packageName ? { packageName, appName } : null;
}

async function listInstalledApps() {
  if (!isAvailable() || typeof native.listInstalledApps !== 'function') {
    return [...FALLBACK_BLOCKED_APPS];
  }
  const apps = await native.listInstalledApps();
  const normalized = Array.isArray(apps)
    ? apps.map(normalizeApp).filter(Boolean)
    : [];
  return normalized.length > 0 ? normalized : [...FALLBACK_BLOCKED_APPS];
}

async function isAccessibilityServiceEnabled() {
  if (!isAvailable() || typeof native.isAccessibilityServiceEnabled !== 'function') {
    return false;
  }
  return Boolean(await native.isAccessibilityServiceEnabled());
}

async function openAccessibilitySettings() {
  if (isAvailable() && typeof native.openAccessibilitySettings === 'function') {
    await native.openAccessibilitySettings();
  }
}

async function isUsageAccessEnabled() {
  if (!isAvailable() || typeof native.isUsageAccessEnabled !== 'function') {
    return false;
  }
  return Boolean(await native.isUsageAccessEnabled());
}

async function openUsageAccessSettings() {
  if (isAvailable() && typeof native.openUsageAccessSettings === 'function') {
    await native.openUsageAccessSettings();
  }
}

async function setFocusMonitorState({
  active,
  taskTitle = '',
  startedAt = '',
  blockedApps = []
}) {
  if (!isAvailable() || typeof native.setFocusMonitorState !== 'function') {
    return false;
  }
  const startedAtMillis = startedAt ? new Date(startedAt).getTime() : 0;
  await native.setFocusMonitorState(
    Boolean(active),
    taskTitle,
    Number.isFinite(startedAtMillis) ? startedAtMillis : 0,
    blockedApps.map((app) => app.packageName).filter(Boolean),
    blockedApps.map((app) => app.appName).filter(Boolean)
  );
  return true;
}

async function setUnlockMonitorState({ unlockMode }) {
  if (!isAvailable() || typeof native.setUnlockMonitorState !== 'function') {
    return false;
  }
  const mode = normalizeUnlockModeSettings(unlockMode);
  await native.setUnlockMonitorState(
    Boolean(mode.enabled),
    mode.requiredMinutes,
    mode.requirementApps.map((app) => app.packageName).filter(Boolean),
    mode.requirementApps.map((app) => app.appName).filter(Boolean),
    mode.blockedApps.map((app) => app.packageName).filter(Boolean),
    mode.blockedApps.map((app) => app.appName).filter(Boolean)
  );
  return true;
}

async function getUnlockModeStatus() {
  if (!isAvailable() || typeof native.getUnlockModeStatus !== 'function') {
    return {
      enabled: false,
      state: 'unavailable',
      usageAccessGranted: false,
      totalUsageMillis: 0,
      requiredMillis: 30 * 60 * 1000,
      remainingMillis: 30 * 60 * 1000,
      progressRatio: 0
    };
  }
  return native.getUnlockModeStatus();
}

async function setWidgetPresentation({
  characterId = '',
  characterImageUri = '',
  motivationMessage = '',
  motivationDate = ''
} = {}) {
  if (!isAvailable() || typeof native.setWidgetPresentation !== 'function') {
    return false;
  }
  await native.setWidgetPresentation(
    characterId,
    characterImageUri,
    motivationMessage,
    motivationDate
  );
  return true;
}

async function updateWidget() {
  if (isAvailable() && typeof native.updateWidget === 'function') {
    await native.updateWidget();
  }
}

module.exports = {
  FALLBACK_BLOCKED_APPS,
  isAccessibilityServiceEnabled,
  isUsageAccessEnabled,
  listInstalledApps,
  openAccessibilitySettings,
  openUsageAccessSettings,
  getUnlockModeStatus,
  setFocusMonitorState,
  setUnlockMonitorState,
  setWidgetPresentation,
  updateWidget
};
