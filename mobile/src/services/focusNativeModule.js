const { NativeModules, Platform } = require('react-native');

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

async function setFocusMonitorState({ active, taskTitle = '', blockedApps = [] }) {
  if (!isAvailable() || typeof native.setFocusMonitorState !== 'function') {
    return false;
  }
  await native.setFocusMonitorState(
    Boolean(active),
    taskTitle,
    blockedApps.map((app) => app.packageName).filter(Boolean),
    blockedApps.map((app) => app.appName).filter(Boolean)
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
  listInstalledApps,
  openAccessibilitySettings,
  setFocusMonitorState,
  updateWidget
};
