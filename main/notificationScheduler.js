const crypto = require('crypto');

const CHECK_INTERVAL_MS = 20_000;
const STATE_RETENTION_DAYS = 45;

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function taskDateTime(task) {
  const [year, month, day] = task.date.split('-').map(Number);
  const [hour, minute] = task.time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function notificationType(minutes) {
  return minutes === 0 ? 'atTime' : `before-${minutes}-minutes`;
}

function notificationOffsets(settings) {
  if (Array.isArray(settings.notificationOffsets) && settings.notificationOffsets.length > 0) {
    return settings.notificationOffsets;
  }
  return [settings.notificationMinutesBefore, 0].filter(Number.isFinite);
}

function createNotificationScheduler({ fileManager, onNotification, onQueueEmpty }) {
  let timer = null;
  let checking = false;
  let queue = [];
  let active = null;
  let restoreHiddenAfterQueue = false;
  const pendingSignatures = new Set();

  function signature(task, type) {
    return `${task.id}|${task.date}|${task.time}|${type}`;
  }

  function showNext() {
    if (active || queue.length === 0) {
      if (!active && queue.length === 0) {
        onQueueEmpty();
      }
      return;
    }
    active = queue.shift();
    onNotification(active);
  }

  function enqueue(task, type, minutes) {
    const notificationSignature = signature(task, type);
    if (pendingSignatures.has(notificationSignature)) {
      return;
    }
    pendingSignatures.add(notificationSignature);
    queue.push({
      id: crypto.randomUUID(),
      signature: notificationSignature,
      taskId: task.id,
      title: task.title,
      date: task.date,
      time: task.time,
      genre: task.genre,
      type,
      minutes
    });
  }

  function cleanupState(state, now) {
    const oldest = new Date(now);
    oldest.setDate(oldest.getDate() - STATE_RETENTION_DAYS);
    for (const key of Object.keys(state)) {
      const dateText = key.split('|')[1];
      if (dateText && new Date(`${dateText}T00:00:00`) < oldest) {
        delete state[key];
      }
    }
  }

  async function checkNow() {
    if (checking) {
      return;
    }
    checking = true;
    try {
      const [tasksResult, settings, state] = await Promise.all([
        fileManager.getTasksResult(),
        fileManager.getSettings(),
        fileManager.getNotificationState()
      ]);
      if (tasksResult.error) {
        return;
      }

      const now = new Date();
      const today = localDateKey(now);
      const due = [];
      for (const task of tasksResult.tasks) {
        if (task.completed || !task.time || task.date !== today) {
          continue;
        }
        const startsAt = taskDateTime(task);
        for (const minutes of notificationOffsets(settings)) {
          const type = notificationType(minutes);
          const scheduledAt = new Date(startsAt.getTime() - minutes * 60_000);
          const notificationSignature = signature(task, type);
          const isDue =
            minutes === 0
              ? now >= startsAt
              : now >= scheduledAt && now < startsAt;

          if (isDue && !state[notificationSignature]) {
            due.push({ task, type, minutes, at: scheduledAt });
          }
        }
      }

      due
        .sort((a, b) => a.at - b.at || a.task.title.localeCompare(b.task.title, 'ja'))
        .forEach(({ task, type, minutes }) => enqueue(task, type, minutes));
      cleanupState(state, now);
      await fileManager.saveNotificationState(state);
      showNext();
    } finally {
      checking = false;
    }
  }

  async function acknowledge(notificationId) {
    if (!active || active.id !== notificationId) {
      throw new Error('確認対象の通知が見つかりません。');
    }
    const state = await fileManager.getNotificationState();
    state[active.signature] = {
      acknowledgedAt: new Date().toISOString()
    };
    await fileManager.saveNotificationState(state);
    pendingSignatures.delete(active.signature);
    active = null;
    showNext();
    return { active: active || queue[0] || null };
  }

  function start() {
    stop();
    checkNow().catch((error) => console.error('通知確認に失敗しました。', error));
    timer = setInterval(() => {
      checkNow().catch((error) => console.error('通知確認に失敗しました。', error));
    }, CHECK_INTERVAL_MS);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    start,
    stop,
    checkNow,
    acknowledge,
    getActive: () => active,
    setRestoreHiddenAfterQueue: (value) => {
      if (active || queue.length > 0) {
        restoreHiddenAfterQueue = restoreHiddenAfterQueue || value;
      } else {
        restoreHiddenAfterQueue = value;
      }
    },
    shouldRestoreHiddenAfterQueue: () => {
      const value = restoreHiddenAfterQueue;
      restoreHiddenAfterQueue = false;
      return value;
    }
  };
}

module.exports = { createNotificationScheduler };
