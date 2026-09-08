const {
  filterBlockableApps,
  isNeverBlockedPackage,
  mergeApps,
  packageSet
} = require('./appSelection');

const MIN_REQUIRED_MINUTES = 1;
const MAX_REQUIRED_MINUTES = 12 * 60;

const DEFAULT_UNLOCK_MODE = Object.freeze({
  enabled: false,
  requiredMinutes: 30,
  requirementApps: [],
  blockedApps: [],
  usageAccessDisclosureAcceptedAt: null
});

function clampRequiredMinutes(value, fallback = DEFAULT_UNLOCK_MODE.requiredMinutes) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) {
    return fallback;
  }
  return Math.max(MIN_REQUIRED_MINUTES, Math.min(MAX_REQUIRED_MINUTES, Math.round(minutes)));
}

function normalizeUnlockModeSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const requirementApps = mergeApps(source.requirementApps || source.conditionApps || []);
  const requirementPackages = packageSet(requirementApps);
  const blockedApps = filterBlockableApps(source.blockedApps || [])
    .filter((app) => !requirementPackages.has(app.packageName));

  return {
    ...DEFAULT_UNLOCK_MODE,
    ...source,
    enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_UNLOCK_MODE.enabled,
    requiredMinutes: clampRequiredMinutes(source.requiredMinutes),
    requirementApps,
    blockedApps,
    usageAccessDisclosureAcceptedAt:
      typeof source.usageAccessDisclosureAcceptedAt === 'string' &&
      source.usageAccessDisclosureAcceptedAt
        ? source.usageAccessDisclosureAcceptedAt
        : DEFAULT_UNLOCK_MODE.usageAccessDisclosureAcceptedAt
  };
}

function validateUnlockModeSettings(value = {}) {
  const mode = normalizeUnlockModeSettings(value);
  const errors = [];
  const rawMinutes = Number(value.requiredMinutes);
  if (
    !Number.isFinite(rawMinutes) ||
    rawMinutes < MIN_REQUIRED_MINUTES ||
    rawMinutes > MAX_REQUIRED_MINUTES
  ) {
    errors.push(`必要時間は${MIN_REQUIRED_MINUTES}〜${MAX_REQUIRED_MINUTES}分で指定してください。`);
  }
  if (mode.enabled && mode.requirementApps.length === 0) {
    errors.push('条件アプリを1件以上選んでください。');
  }
  if (mode.enabled && mode.blockedApps.length === 0) {
    errors.push('制限アプリを1件以上選んでください。');
  }
  const requirementPackages = packageSet(mode.requirementApps);
  const duplicated = mergeApps(value.blockedApps || [])
    .filter((app) => requirementPackages.has(app.packageName))
    .map((app) => app.appName || app.packageName);
  if (duplicated.length > 0) {
    errors.push(`条件アプリと制限アプリは重複できません: ${duplicated.join('、')}`);
  }
  const unsafe = mergeApps(value.blockedApps || [])
    .filter((app) => isNeverBlockedPackage(app.packageName))
    .map((app) => app.appName || app.packageName);
  if (unsafe.length > 0) {
    errors.push(`このアプリは安全のため制限できません: ${unsafe.join('、')}`);
  }
  return {
    valid: errors.length === 0,
    errors,
    value: mode
  };
}

function requiredMillis(mode) {
  return clampRequiredMinutes(mode?.requiredMinutes) * 60 * 1000;
}

function evaluateUnlockMode({
  enabled,
  requiredMinutes,
  totalUsageMillis = 0,
  usageAccessGranted = false,
  requirementApps = [],
  blockedApps = []
} = {}) {
  const normalized = normalizeUnlockModeSettings({
    enabled,
    requiredMinutes,
    requirementApps,
    blockedApps
  });
  const targetMillis = requiredMillis(normalized);
  const usageMillis = Math.max(0, Math.floor(Number(totalUsageMillis) || 0));
  if (!normalized.enabled) {
    return {
      state: 'disabled',
      shouldBlock: false,
      totalUsageMillis: usageMillis,
      requiredMillis: targetMillis,
      remainingMillis: targetMillis,
      progressRatio: 0
    };
  }
  if (!usageAccessGranted) {
    return {
      state: 'permission_required',
      shouldBlock: true,
      totalUsageMillis: usageMillis,
      requiredMillis: targetMillis,
      remainingMillis: targetMillis,
      progressRatio: 0
    };
  }
  const remainingMillis = Math.max(0, targetMillis - usageMillis);
  const unlocked = usageMillis >= targetMillis;
  return {
    state: unlocked ? 'unlocked' : 'locked',
    shouldBlock: !unlocked,
    totalUsageMillis: usageMillis,
    requiredMillis: targetMillis,
    remainingMillis,
    progressRatio: targetMillis > 0 ? Math.min(1, usageMillis / targetMillis) : 1
  };
}

function evaluateRestrictionForPackage({
  packageName,
  focusActive = false,
  focusBlockedPackages = [],
  unlockMode,
  unlockUsageMillis = 0,
  usageAccessGranted = false
} = {}) {
  if (!packageName || isNeverBlockedPackage(packageName)) {
    return { shouldBlock: false, reason: 'none' };
  }
  if (focusActive && new Set(focusBlockedPackages).has(packageName)) {
    return { shouldBlock: true, reason: 'focus' };
  }
  const unlockPackages = packageSet(unlockMode?.blockedApps || []);
  const unlockEvaluation = evaluateUnlockMode({
    ...unlockMode,
    totalUsageMillis: unlockUsageMillis,
    usageAccessGranted
  });
  if (unlockPackages.has(packageName) && unlockEvaluation.shouldBlock) {
    return { shouldBlock: true, reason: 'unlock', unlock: unlockEvaluation };
  }
  return { shouldBlock: false, reason: 'none', unlock: unlockEvaluation };
}

function minutesFromMillis(value) {
  return Math.floor(Math.max(0, Number(value) || 0) / 60000);
}

module.exports = {
  DEFAULT_UNLOCK_MODE,
  MAX_REQUIRED_MINUTES,
  MIN_REQUIRED_MINUTES,
  clampRequiredMinutes,
  evaluateRestrictionForPackage,
  evaluateUnlockMode,
  minutesFromMillis,
  normalizeUnlockModeSettings,
  requiredMillis,
  validateUnlockModeSettings
};
