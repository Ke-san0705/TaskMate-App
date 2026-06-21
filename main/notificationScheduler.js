const crypto = require('crypto');

const CHECK_INTERVAL_MS = 20_000;
const STATE_RETENTION_DAYS = 45;

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateKeyToDay(dateText) {
  if (typeof dateText !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return null;
  }
  const [year, month, day] = dateText.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return Date.UTC(year, month - 1, day) / (24 * 60 * 60 * 1000);
}

function daysUntil(dateText, today) {
  const target = dateKeyToDay(dateText);
  const base = dateKeyToDay(today);
  if (!Number.isFinite(target) || !Number.isFinite(base)) {
    return null;
  }
  return target - base;
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
      minutes,
      source: task.source,
      dialogueCategory: task.dialogueCategory,
      message: task.message,
      projectId: task.projectId,
      projectTaskId: task.projectTaskId
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
      const [projectState, settings, state] = await Promise.all([
        fileManager.getProjectStateResult(),
        fileManager.getSettings(),
        fileManager.getNotificationState()
      ]);

      const now = new Date();
      const today = localDateKey(now);
      // 長期タスク通知だけを扱います。通常タスク管理UIを廃止したため、
      // tasks.jsonの時刻通知はここではスケジュールしません。
      if (!projectState.error) {
        const categories = projectState.categories || [];
        const projects = projectState.projects || [];
        const projectTasks = projectState.projectTasks || [];
        const projectSettings = settings.projectSettings || {};
        const warningDays = projectSettings.deadlineWarningDays || 7;
        const dailyMinutes = projectSettings.dailyAvailableMinutes || 120;
        for (const task of projectTasks) {
          if (!task || task.status === 'completed') {
            continue;
          }
          const project = projects.find((candidate) => candidate.id === task.projectId);
          const category = categories.find((candidate) => candidate.id === project?.categoryId);
          const taskDays = daysUntil(task.deadline, today);
          const genre = [category?.name, project?.name].filter(Boolean).join(' / ');
          if (task.scheduledDate === today) {
            enqueue(
              {
                id: `project-today-${task.id}`,
                title: task.title,
                date: today,
                time: null,
                genre,
                source: 'project',
                dialogueCategory: 'daily_plan_created',
                message: '今日行う予定の長期Todoがあります。',
                projectId: project?.id || null,
                projectTaskId: task.id
              },
              'project-scheduled-today',
              0
            );
          }
          if (taskDays !== null && taskDays < 0 && projectSettings.overdueNotificationsEnabled !== false) {
            enqueue(
              {
                id: `project-overdue-${task.id}`,
                title: task.title,
                date: task.deadline,
                time: null,
                genre,
                source: 'project',
                dialogueCategory: 'project_overdue',
                message: '期限超過の長期Todoがあります。',
                projectId: project?.id || null,
                projectTaskId: task.id
              },
              'project-task-overdue',
              0
            );
          } else if (taskDays !== null && taskDays <= 3 && taskDays >= 0) {
            enqueue(
              {
                id: `project-deadline-${task.id}`,
                title: task.title,
                date: task.deadline,
                time: null,
                genre,
                source: 'project',
                dialogueCategory: 'project_warning',
                message: `期限まで残り${taskDays}日です。`,
                projectId: project?.id || null,
                projectTaskId: task.id
              },
              'project-task-deadline',
              0
            );
          }
        }

        if (projectSettings.progressNotificationsEnabled !== false) {
          for (const project of projects) {
            if (!project || project.status === 'completed' || project.status === 'paused') {
              continue;
            }
            const remainingDays = daysUntil(project.deadline, today);
            if (remainingDays === null || remainingDays < 0) {
              continue;
            }
            const remainingMinutes = projectTasks
              .filter((task) => task.projectId === project.id && task.status !== 'completed')
              .reduce((total, task) => total + Math.max(0, task.estimatedMinutes || 0), 0);
            if (remainingMinutes > Math.max(1, remainingDays + 1) * dailyMinutes) {
              enqueue(
                {
                  id: `project-risk-${project.id}`,
                  title: project.name,
                  date: today,
                  time: null,
                  genre: '長期タスク遅延リスク',
                  source: 'project',
                  dialogueCategory: 'project_warning',
                  message: '現在の予定では期限に間に合わない可能性があります。',
                  projectId: project.id,
                  projectTaskId: null
                },
                'project-delay-risk',
                0
              );
            }
          }
        }
      }
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
