const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateRestrictionForPackage,
  evaluateUnlockMode,
  validateUnlockModeSettings
} = require('../src/utils/unlockMode');

const minute = 60 * 1000;

const duolingo = { packageName: 'com.duolingo', appName: 'Duolingo' };
const mochitan = { packageName: 'jp.mochitan.app', appName: 'モチタン' };
const instagram = { packageName: 'com.instagram.android', appName: 'Instagram' };
const youtube = { packageName: 'com.google.android.youtube', appName: 'YouTube' };

function unlockMode(overrides = {}) {
  return {
    enabled: true,
    requiredMinutes: 30,
    requirementApps: [duolingo],
    blockedApps: [instagram],
    ...overrides
  };
}

test('必要30分、使用29分59秒ならロック中', () => {
  const result = evaluateUnlockMode({
    ...unlockMode(),
    totalUsageMillis: 30 * minute - 1000,
    usageAccessGranted: true
  });
  assert.equal(result.state, 'locked');
  assert.equal(result.shouldBlock, true);
});

test('必要30分、使用30分ならアンロック済み', () => {
  const result = evaluateUnlockMode({
    ...unlockMode(),
    totalUsageMillis: 30 * minute,
    usageAccessGranted: true
  });
  assert.equal(result.state, 'unlocked');
  assert.equal(result.shouldBlock, false);
});

test('必要30分、使用45分ならアンロック済み', () => {
  const result = evaluateUnlockMode({
    ...unlockMode(),
    totalUsageMillis: 45 * minute,
    usageAccessGranted: true
  });
  assert.equal(result.state, 'unlocked');
  assert.equal(result.remainingMillis, 0);
});

test('Duolingo 20分 + モチタン10分相当ならアンロック済み', () => {
  const result = evaluateUnlockMode({
    ...unlockMode({ requirementApps: [duolingo, mochitan] }),
    totalUsageMillis: 20 * minute + 10 * minute,
    usageAccessGranted: true
  });
  assert.equal(result.state, 'unlocked');
});

test('日付が変わった後の新しい使用時間で再判定する', () => {
  const yesterday = evaluateUnlockMode({
    ...unlockMode(),
    totalUsageMillis: 35 * minute,
    usageAccessGranted: true
  });
  const today = evaluateUnlockMode({
    ...unlockMode(),
    totalUsageMillis: 0,
    usageAccessGranted: true
  });
  assert.equal(yesterday.state, 'unlocked');
  assert.equal(today.state, 'locked');
});

test('アンロックモードOFFならブロックしない', () => {
  const decision = evaluateRestrictionForPackage({
    packageName: instagram.packageName,
    unlockMode: unlockMode({ enabled: false }),
    unlockUsageMillis: 0,
    usageAccessGranted: true
  });
  assert.equal(decision.shouldBlock, false);
});

test('集中モードON + アンロック達成済みでも集中モードでブロックする', () => {
  const decision = evaluateRestrictionForPackage({
    packageName: youtube.packageName,
    focusActive: true,
    focusBlockedPackages: [youtube.packageName],
    unlockMode: unlockMode({ blockedApps: [youtube] }),
    unlockUsageMillis: 45 * minute,
    usageAccessGranted: true
  });
  assert.deepEqual({ shouldBlock: decision.shouldBlock, reason: decision.reason }, {
    shouldBlock: true,
    reason: 'focus'
  });
});

test('集中モードOFF + アンロック未達成ならアンロックモードでブロックする', () => {
  const decision = evaluateRestrictionForPackage({
    packageName: instagram.packageName,
    focusActive: false,
    focusBlockedPackages: [],
    unlockMode: unlockMode(),
    unlockUsageMillis: 10 * minute,
    usageAccessGranted: true
  });
  assert.deepEqual({ shouldBlock: decision.shouldBlock, reason: decision.reason }, {
    shouldBlock: true,
    reason: 'unlock'
  });
});

test('両方OFFならブロックしない', () => {
  const decision = evaluateRestrictionForPackage({
    packageName: instagram.packageName,
    focusActive: false,
    focusBlockedPackages: [],
    unlockMode: unlockMode({ enabled: false }),
    unlockUsageMillis: 0,
    usageAccessGranted: true
  });
  assert.equal(decision.shouldBlock, false);
});

test('Usage Access未許可なら誤ってアンロック済みにしない', () => {
  const result = evaluateUnlockMode({
    ...unlockMode(),
    totalUsageMillis: 60 * minute,
    usageAccessGranted: false
  });
  assert.equal(result.state, 'permission_required');
  assert.equal(result.shouldBlock, true);
});

test('条件アプリと制限アプリが重複した設定は保存不可', () => {
  const result = validateUnlockModeSettings(unlockMode({
    requirementApps: [duolingo],
    blockedApps: [duolingo]
  }));
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /重複/);
});

test('TaskMate自身は制限対象にできない', () => {
  const result = validateUnlockModeSettings(unlockMode({
    blockedApps: [{ packageName: 'com.kesan0705.taskmate', appName: 'TaskMate' }]
  }));
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /安全/);
});
