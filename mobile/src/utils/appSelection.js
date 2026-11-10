const NEVER_BLOCKED_PACKAGE_NAMES = new Set([
  'android',
  'com.android.settings',
  'com.android.systemui',
  'com.android.phone',
  'com.android.dialer',
  'com.google.android.dialer',
  'com.google.android.apps.safetycenter',
  'com.google.android.permissioncontroller',
  'com.kesan0705.taskmate',
  'com.taskmate.mobile'
]);

const NEVER_BLOCKED_PACKAGE_PARTS = [
  '.launcher',
  '.emergency',
  '.incallui',
  '.telecom'
];

function normalizeApp(app) {
  const packageName =
    typeof app?.packageName === 'string'
      ? app.packageName.trim()
      : typeof app?.package_name === 'string'
        ? app.package_name.trim()
        : '';
  const appName =
    typeof app?.appName === 'string'
      ? app.appName.trim()
      : typeof app?.app_name === 'string'
        ? app.app_name.trim()
        : packageName;
  return packageName
    ? {
        packageName,
        appName: appName || packageName
      }
    : null;
}

function sortApps(apps) {
  return [...apps].sort((left, right) =>
    (left.appName || left.packageName).localeCompare(right.appName || right.packageName, 'ja')
  );
}

function mergeApps(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const app of list || []) {
      const normalized = normalizeApp(app);
      if (normalized) {
        map.set(normalized.packageName, normalized);
      }
    }
  }
  return sortApps([...map.values()]);
}

function isNeverBlockedPackage(packageName) {
  const normalized = String(packageName || '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (NEVER_BLOCKED_PACKAGE_NAMES.has(normalized)) {
    return true;
  }
  return NEVER_BLOCKED_PACKAGE_PARTS.some((part) => normalized.includes(part));
}

function filterBlockableApps(apps) {
  return mergeApps(apps).filter((app) => !isNeverBlockedPackage(app.packageName));
}

function packageSet(apps) {
  return new Set(mergeApps(apps).map((app) => app.packageName));
}

module.exports = {
  filterBlockableApps,
  isNeverBlockedPackage,
  mergeApps,
  normalizeApp,
  packageSet,
  sortApps
};
