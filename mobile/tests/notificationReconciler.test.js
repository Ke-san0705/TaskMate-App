const test = require('node:test');
const assert = require('node:assert/strict');
const {
  desiredNotificationsForTasks,
  reconcileScheduledNotifications
} = require('../src/services/notificationReconciler');

function task(overrides = {}) {
  return {
    id: overrides.id || 'task-1',
    title: overrides.title || '予定',
    date: overrides.date || '2026-06-18',
    time: Object.hasOwn(overrides, 'time') ? overrides.time : '18:00',
    priority: 'normal',
    completed: Boolean(overrides.completed)
  };
}

test('time:nullは通知を作らない', () => {
  const desired = desiredNotificationsForTasks(
    [task({ time: null })],
    { notificationsEnabled: true, notificationOffsets: [30, 0] },
    new Date(2026, 5, 18, 10, 0)
  );
  assert.equal(desired.length, 0);
});

test('過去時刻を登録しない', () => {
  const desired = desiredNotificationsForTasks(
    [task({ time: '09:00' })],
    { notificationsEnabled: true, notificationOffsets: [30, 0] },
    new Date(2026, 5, 18, 10, 0)
  );
  assert.equal(desired.length, 0);
});

test('新規通知を登録する', async () => {
  const scheduled = [];
  const result = await reconcileScheduledNotifications({
    tasks: [task()],
    settings: { notificationsEnabled: true, notificationOffsets: [30, 0] },
    existingSchedules: [],
    now: new Date(2026, 5, 18, 10, 0),
    adapter: {
      cancel: async () => {},
      schedule: async (schedule) => {
        scheduled.push(schedule.signature);
        return `notification-${scheduled.length}`;
      }
    }
  });
  assert.equal(result.scheduled.length, 2);
  assert.equal(new Set(scheduled).size, 2);
});

test('編集で不要になった旧通知を解除する', async () => {
  const canceled = [];
  const result = await reconcileScheduledNotifications({
    tasks: [task({ time: '19:00' })],
    settings: { notificationsEnabled: true, notificationOffsets: [30, 0] },
    existingSchedules: [
      {
        signature: 'task-1|2026-06-18|18:00|before-30-minutes',
        taskId: 'task-1',
        notificationId: 'old',
        type: 'before-30-minutes',
        minutes: 30,
        scheduledAt: '2026-06-18T08:30:00.000Z'
      }
    ],
    now: new Date(2026, 5, 18, 10, 0),
    adapter: {
      cancel: async (id) => canceled.push(id),
      schedule: async (schedule) => `new-${schedule.signature}`
    }
  });
  assert.deepEqual(canceled, ['old']);
  assert.equal(result.scheduled.length, 2);
});

test('完了時は既存通知を解除する', async () => {
  const canceled = [];
  const result = await reconcileScheduledNotifications({
    tasks: [task({ completed: true })],
    settings: { notificationsEnabled: true, notificationOffsets: [30, 0] },
    existingSchedules: [
      {
        signature: 'task-1|2026-06-18|18:00|atTime',
        taskId: 'task-1',
        notificationId: 'old',
        type: 'atTime',
        minutes: 0,
        scheduledAt: '2026-06-18T09:00:00.000Z'
      }
    ],
    now: new Date(2026, 5, 18, 10, 0),
    adapter: {
      cancel: async (id) => canceled.push(id),
      schedule: async () => 'unused'
    }
  });
  assert.deepEqual(canceled, ['old']);
  assert.equal(result.scheduled.length, 0);
});
