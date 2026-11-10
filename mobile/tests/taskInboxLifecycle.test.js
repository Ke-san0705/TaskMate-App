const test = require('node:test');
const assert = require('node:assert/strict');
const { createMutationBarrier, clearLocalInboxSession, canFetchInbox } = require('../src/services/taskInboxLifecycle');
const { createNotificationLifecycle } = require('../src/services/notificationLifecycle');
const { reconcileScheduledNotifications } = require('../src/services/notificationReconciler');
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }

test('遅いログインが成功しても全削除後に資格情報やタスクを復活させない', async () => {
  const barrier = createMutationBarrier();
  const response = deferred(); let credentials = null, enabled = false, tasks = ['old'];
  const login = barrier.run(async (isCurrent) => {
    await response.promise;
    credentials = 'persisted-by-auth';
    if (isCurrent()) { enabled = true; tasks.push('new'); }
  });
  await new Promise((resolve) => setImmediate(resolve));
  const reset = barrier.reset(async () => {
    credentials = null; enabled = false;
    await new Promise((resolve) => setImmediate(resolve));
    tasks = [];
  });
  await barrier.run(async () => { tasks.push('new login during reset'); });
  response.resolve();
  await Promise.all([login, reset]);
  assert.equal(credentials, null); assert.equal(enabled, false); assert.deepEqual(tasks, []);
});

test('ローカルセッションが消えた場合はオフラインでもローカル削除を続ける', async () => {
  let saved = 'session';
  const auth = { signOut: async () => { saved = null; return { error: new Error('offline server revocation') }; } };
  await clearLocalInboxSession(auth, { getItem: async () => saved }, 'auth');
  assert.equal(saved, null);
});

test('資格情報が残る本当のストレージ失敗は成功扱いにしない', async () => {
  const auth = { signOut: async () => ({ error: new Error('storage failed') }) };
  await assert.rejects(clearLocalInboxSession(auth, { getItem: async () => 'still saved' }, 'auth'), /ログイン状態/);
});

test('自動取得がオフでも本人の手動取得は許可し、削除中は許可しない', () => {
  const state = { configured: true, ready: true, userId: 'A', enabled: false, resetting: false };
  assert.equal(canFetchInbox(state, false), true);
  assert.equal(canFetchInbox(state, true), false);
  assert.equal(canFetchInbox({ ...state, resetting: true }, false), false);
});

test('遅い通知登録を先に完了させてから取消し、削除後に通知を残さない', async () => {
  const scheduled = new Set(); const entered = deferred(), release = deferred();
  const lifecycle = createNotificationLifecycle({
    reconcile: () => reconcileScheduledNotifications({ tasks: [{ id: 'muse-1', title: '削除対象', date: '2026-11-12', time: '17:00' }], settings: { notificationOffsets: [0] }, existingSchedules: [], now: new Date(2026, 10, 10),
      adapter: { cancel: async () => {}, schedule: async () => { entered.resolve(); await release.promise; scheduled.add('reminder'); return 'reminder'; } } }),
    cancelAll: async () => { scheduled.clear(); }
  });
  const pending = lifecycle.reconcile(); await entered.promise;
  const deletion = lifecycle.cancelAll(); release.resolve();
  await Promise.all([pending, deletion]);
  assert.equal(scheduled.size, 0);
});
