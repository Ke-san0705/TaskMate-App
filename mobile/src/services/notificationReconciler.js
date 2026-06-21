const { localDateTimeFromTask } = require('../utils/localDate');

function notificationOffsets(settings = {}) {
  if (Array.isArray(settings.notificationOffsets) && settings.notificationOffsets.length > 0) {
    return settings.notificationOffsets;
  }
  return [settings.notificationMinutesBefore, 0].filter(Number.isFinite);
}

function notificationType(minutes) {
  return minutes === 0 ? 'atTime' : `before-${minutes}-minutes`;
}

function desiredNotificationsForTasks(tasks = [], settings = {}, now = new Date()) {
  if (settings.notificationsEnabled === false) {
    return [];
  }
  const desired = [];
  for (const task of tasks) {
    if (!task || task.completed || !task.time) {
      continue;
    }
    const dueAt = localDateTimeFromTask(task);
    if (!dueAt) {
      continue;
    }
    for (const minutes of notificationOffsets(settings)) {
      const scheduledAt = new Date(dueAt.getTime() - minutes * 60 * 1000);
      if (scheduledAt <= now) {
        // 過去時刻の通知はOSへ登録しません。編集で期限が過ぎたときに即時通知が連発するのを防ぎます。
        continue;
      }
      const type = notificationType(minutes);
      desired.push({
        signature: `${task.id}|${task.date}|${task.time}|${type}`,
        taskId: task.id,
        title: task.title,
        type,
        minutes,
        scheduledAt: scheduledAt.toISOString()
      });
    }
  }
  return desired;
}

async function reconcileScheduledNotifications({
  tasks,
  settings,
  existingSchedules,
  adapter,
  now = new Date()
}) {
  const desired = desiredNotificationsForTasks(tasks, settings, now);
  const desiredBySignature = new Map(desired.map((item) => [item.signature, item]));
  const existingBySignature = new Map(
    (existingSchedules || []).map((item) => [item.signature, item])
  );
  const kept = [];
  const canceled = [];
  const scheduled = [];
  const errors = [];

  for (const existing of existingBySignature.values()) {
    if (desiredBySignature.has(existing.signature)) {
      kept.push(existing);
      continue;
    }
    try {
      await adapter.cancel(existing.notificationId);
      canceled.push(existing);
    } catch (error) {
      errors.push({ action: 'cancel', schedule: existing, error });
    }
  }

  for (const desiredItem of desiredBySignature.values()) {
    if (existingBySignature.has(desiredItem.signature)) {
      continue;
    }
    try {
      const notificationId = await adapter.schedule(desiredItem);
      scheduled.push({ ...desiredItem, notificationId });
    } catch (error) {
      errors.push({ action: 'schedule', schedule: desiredItem, error });
    }
  }

  return {
    schedules: [...kept, ...scheduled],
    canceled,
    scheduled,
    errors
  };
}

module.exports = {
  desiredNotificationsForTasks,
  reconcileScheduledNotifications
};
