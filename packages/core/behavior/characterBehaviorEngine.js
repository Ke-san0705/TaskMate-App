const { selectAction } = require('./actionSelector');
const { LIFE_PRESSURE_LEVELS, TEMPORARY_MOODS } = require('./behaviorConstants');
const { aggregateLifePressure, localDateKey } = require('./taskPressureEngine');

const TEMPORARY_DURATION_MS = Object.freeze({
  [TEMPORARY_MOODS.NOTIFYING]: 5 * 60 * 1000,
  [TEMPORARY_MOODS.CELEBRATING]: 3500,
  [TEMPORARY_MOODS.RELIEVED]: 3200,
  [TEMPORARY_MOODS.RECONNECTING]: 5200,
  [TEMPORARY_MOODS.FOCUSING]: 6 * 60 * 1000
});

function addMs(now, ms) {
  return new Date(now.getTime() + ms).toISOString();
}

function findTask(tasks, taskId) {
  if (!taskId || !Array.isArray(tasks)) {
    return null;
  }
  return tasks.find((task) => task.id === taskId && task.completed !== true) || null;
}

function todayIncompleteTasks(tasks, now) {
  const today = localDateKey(now);
  return Array.isArray(tasks)
    ? tasks.filter((task) => task && !task.completed && task.date <= today)
    : [];
}

function taskVariables(task, extra = {}) {
  return {
    title: task?.title || '',
    date: task?.date || '',
    time: task?.time || '今日中',
    genre: task?.genre || '',
    priority: task?.priority || 'normal',
    ...extra
  };
}

function summarizeTask(task) {
  if (!task) {
    return null;
  }
  return {
    id: task.id,
    title: task.title,
    date: task.date,
    time: task.time,
    genre: task.genre,
    priority: task.priority
  };
}

function temporaryState({
  mood,
  action,
  dialogueCategory,
  targetTask,
  focusTask = null,
  pressure,
  now,
  reason,
  ambientLevel,
  variables = {}
}) {
  return {
    version: '1.0.0',
    generatedAt: now.toISOString(),
    mood,
    action,
    dialogueCategory,
    dialogueVariables: taskVariables(targetTask, variables),
    targetTaskId: targetTask?.id || null,
    focusTaskId: focusTask?.id || null,
    focusTask: summarizeTask(focusTask),
    pressure,
    ambientLevel,
    movement: null,
    reason,
    expiresAt: addMs(now, TEMPORARY_DURATION_MS[mood] || 3000),
    relationshipStage: null
  };
}

function normalDialogueCategory(action, pressure) {
  if (
    action.reason === 'main-window-hidden' ||
    action.reason === 'quiet-hours' ||
    action.reason === 'behavior-disabled' ||
    action.reason === 'level-cooldown'
  ) {
    return null;
  }
  if (action.dialogueCategory) {
    return action.dialogueCategory;
  }
  if (pressure.score === 0) {
    return 'noTasks';
  }
  if (pressure.level === LIFE_PRESSURE_LEVELS.CALM) {
    return 'calm';
  }
  return pressure.level;
}

function createBehaviorState({
  tasks = [],
  settings = {},
  lifeState = {},
  now = new Date(),
  notification = null,
  event = null,
  isMainVisible = true,
  random = Math.random,
  reducedMotion = false
} = {}) {
  const pressure = aggregateLifePressure(tasks, now);
  const visibleTasks = todayIncompleteTasks(tasks, now);
  const dominantTask = findTask(tasks, pressure.dominantTaskId);
  const focusTask = findTask(tasks, lifeState.focusTaskId);
  const relationshipStage = lifeState.relationshipStage || 'new';

  if (notification) {
    return temporaryState({
      mood: TEMPORARY_MOODS.NOTIFYING,
      action: 'notify-deadline',
      dialogueCategory: notification.minutes > 0 ? 'deadlineNear' : 'deadlineNow',
      targetTask: findTask(tasks, notification.taskId) || notification,
      pressure,
      now,
      reason: 'notification-active',
      ambientLevel: Math.max(2, pressure.score >= 65 ? 3 : 2),
      variables: notification
    });
  }

  if (event?.type === 'all-complete' && settings.completionReactions !== false) {
    return temporaryState({
      mood: TEMPORARY_MOODS.CELEBRATING,
      action: 'celebrate-today',
      dialogueCategory: 'celebrating',
      targetTask: event.task || null,
      pressure,
      now,
      reason: 'all-visible-tasks-complete',
      ambientLevel: 0,
      variables: { count: visibleTasks.length }
    });
  }

  if (event?.type === 'task-complete' && settings.completionReactions !== false) {
    return temporaryState({
      mood: TEMPORARY_MOODS.RELIEVED,
      action: 'relieved-completion',
      dialogueCategory: 'relieved',
      targetTask: event.task || null,
      pressure,
      now,
      reason: 'task-completed',
      ambientLevel: Math.max(0, Math.min(2, Math.ceil(pressure.score / 35)))
    });
  }

  if (event?.type === 'reconnect') {
    const category =
      event.reconnectEvent === 'firstMeeting'
        ? 'firstMeeting'
        : event.reconnectEvent === 'returnLong'
          ? 'reconnectingLong'
          : 'reconnectingShort';
    return temporaryState({
      mood: TEMPORARY_MOODS.RECONNECTING,
      action: 'reconnect-greeting',
      dialogueCategory: category,
      targetTask: dominantTask,
      pressure,
      now,
      reason: event.reconnectEvent || 'reconnect',
      ambientLevel: Math.min(1, pressure.score),
      variables: { gapDays: event.gapDays || 0 }
    });
  }

  if (focusTask) {
    return temporaryState({
      mood: TEMPORARY_MOODS.FOCUSING,
      action: 'hold-focus-task',
      dialogueCategory: 'focusing',
      targetTask: focusTask,
      focusTask,
      pressure,
      now,
      reason: 'focus-task-active',
      ambientLevel: settings.ambientEffects === false ? 0 : 1
    });
  }

  const selected = selectAction({
    pressure,
    settings,
    lifeState,
    now,
    random,
    isHidden: !isMainVisible,
    reducedMotion
  });

  const targetTask = findTask(tasks, selected.targetTaskId) || dominantTask;
  return {
    version: '1.0.0',
    generatedAt: now.toISOString(),
    mood: selected.mood || pressure.level,
    action: selected.action,
    dialogueCategory: normalDialogueCategory(selected, pressure),
    dialogueVariables: taskVariables(targetTask, {
      count: visibleTasks.length,
      relationshipStage
    }),
    targetTaskId: targetTask?.id || null,
    focusTaskId: lifeState.focusTaskId || null,
    focusTask: summarizeTask(focusTask),
    pressure,
    ambientLevel: settings.ambientEffects === false ? 0 : selected.ambientLevel,
    movement: selected.movement,
    reason: selected.reason,
    expiresAt: addMs(now, 30 * 1000),
    relationshipStage
  };
}

module.exports = {
  createBehaviorState
};
