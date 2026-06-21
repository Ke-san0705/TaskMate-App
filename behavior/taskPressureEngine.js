const { LIFE_PRESSURE_LEVELS, TASK_STATES } = require('./behaviorConstants');

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const STATE_PRESSURE = Object.freeze({
  [TASK_STATES.FUTURE]: 8,
  [TASK_STATES.CALM]: 15,
  [TASK_STATES.WARNING]: 45,
  [TASK_STATES.URGENT]: 75,
  [TASK_STATES.OVERDUE]: 95
});

const PRIORITY_PRESSURE_OFFSET = Object.freeze({
  high: 10,
  normal: 0,
  low: -10
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateParts(dateText) {
  if (typeof dateText !== 'string' || !DATE_PATTERN.test(dateText)) {
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
  return { year, month, day };
}

function parseTimeParts(timeText) {
  if (timeText === null || timeText === undefined || timeText === '') {
    return null;
  }
  if (typeof timeText !== 'string' || !TIME_PATTERN.test(timeText)) {
    return null;
  }
  const [hour, minute] = timeText.split(':').map(Number);
  return { hour, minute };
}

function dateKeyToUtcDay(dateText) {
  const parts = parseDateParts(dateText);
  if (!parts) {
    return null;
  }
  return Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS;
}

function compareDateKeys(left, right) {
  const leftDay = dateKeyToUtcDay(left);
  const rightDay = dateKeyToUtcDay(right);
  if (!Number.isFinite(leftDay) || !Number.isFinite(rightDay)) {
    return 0;
  }
  return leftDay - rightDay;
}

function localDateTime(dateText, timeText) {
  const dateParts = parseDateParts(dateText);
  const timeParts = parseTimeParts(timeText);
  if (!dateParts || !timeParts) {
    return null;
  }
  return new Date(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
    0,
    0
  );
}

function pressureLevel(score) {
  if (score >= 85) {
    return LIFE_PRESSURE_LEVELS.OVERLOADED;
  }
  if (score >= 65) {
    return LIFE_PRESSURE_LEVELS.ANXIOUS;
  }
  if (score >= 45) {
    return LIFE_PRESSURE_LEVELS.RESTLESS;
  }
  if (score >= 25) {
    return LIFE_PRESSURE_LEVELS.ATTENTIVE;
  }
  return LIFE_PRESSURE_LEVELS.CALM;
}

function countLoadAdjustment(count) {
  if (count >= 10) {
    return 30;
  }
  if (count >= 6) {
    return 20;
  }
  if (count >= 3) {
    return 10;
  }
  return 0;
}

function reasonForTaskState(state) {
  if (state === TASK_STATES.OVERDUE) {
    return 'overdue-task';
  }
  if (state === TASK_STATES.URGENT) {
    return 'urgent-task';
  }
  if (state === TASK_STATES.WARNING) {
    return 'deadline-approaching';
  }
  if (state === TASK_STATES.FUTURE) {
    return 'future-task';
  }
  return 'calm-task';
}

function classifyTimedTask(task, now) {
  const dueAt = localDateTime(task.date, task.time);
  if (!dueAt) {
    return {
      state: TASK_STATES.CALM,
      minutesRemaining: null,
      daysOverdue: 0,
      invalidReason: 'invalid-datetime'
    };
  }

  const today = localDateKey(now);
  const minutesRemaining = Math.ceil((dueAt.getTime() - now.getTime()) / MINUTE_MS);
  const dayDifference = compareDateKeys(task.date, today);

  if (minutesRemaining < 0) {
    return {
      state: TASK_STATES.OVERDUE,
      minutesRemaining,
      daysOverdue: Math.max(0, -dayDifference)
    };
  }

  // 高優先度タスクは、実際に慌てる前に少し早く「気に留める」状態へ上げます。
  // ただし、未来の予定を大量に主画面へ押し出さないよう、通常優先度の遠い予定はfutureにします。
  if (task.priority === 'high') {
    if (minutesRemaining <= 180) {
      return { state: TASK_STATES.URGENT, minutesRemaining, daysOverdue: 0 };
    }
    if (minutesRemaining <= 24 * 60) {
      return { state: TASK_STATES.WARNING, minutesRemaining, daysOverdue: 0 };
    }
  }

  if (minutesRemaining <= 60) {
    return { state: TASK_STATES.URGENT, minutesRemaining, daysOverdue: 0 };
  }
  if (minutesRemaining <= 6 * 60) {
    return { state: TASK_STATES.WARNING, minutesRemaining, daysOverdue: 0 };
  }
  if (dayDifference > 0) {
    return { state: TASK_STATES.FUTURE, minutesRemaining, daysOverdue: 0 };
  }
  return { state: TASK_STATES.CALM, minutesRemaining, daysOverdue: 0 };
}

function classifyAllDayTask(task, now) {
  const today = localDateKey(now);
  const dayDifference = compareDateKeys(task.date, today);
  if (!parseDateParts(task.date)) {
    return {
      state: TASK_STATES.CALM,
      minutesRemaining: null,
      daysOverdue: 0,
      invalidReason: 'invalid-date'
    };
  }

  if (dayDifference < 0) {
    return {
      state: TASK_STATES.OVERDUE,
      minutesRemaining: null,
      daysOverdue: Math.max(1, -dayDifference)
    };
  }

  if (dayDifference > 0) {
    if (task.priority === 'high' && dayDifference === 1) {
      return {
        state: TASK_STATES.WARNING,
        minutesRemaining: null,
        daysOverdue: 0
      };
    }
    return {
      state: TASK_STATES.FUTURE,
      minutesRemaining: null,
      daysOverdue: 0
    };
  }

  const hour = now.getHours();
  if (hour >= 21) {
    return { state: TASK_STATES.URGENT, minutesRemaining: null, daysOverdue: 0 };
  }
  if (hour >= 17) {
    return { state: TASK_STATES.WARNING, minutesRemaining: null, daysOverdue: 0 };
  }
  return { state: TASK_STATES.CALM, minutesRemaining: null, daysOverdue: 0 };
}

function classifyTask(task, now = new Date()) {
  if (!task || typeof task !== 'object') {
    return {
      state: TASK_STATES.CALM,
      pressure: 0,
      minutesRemaining: null,
      daysOverdue: 0,
      invalidReason: 'invalid-task'
    };
  }

  const result =
    task.time === null || task.time === undefined || task.time === ''
      ? classifyAllDayTask(task, now)
      : classifyTimedTask(task, now);

  const priority = Object.hasOwn(PRIORITY_PRESSURE_OFFSET, task.priority)
    ? task.priority
    : 'normal';
  const overdueOffset =
    result.state === TASK_STATES.OVERDUE
      ? Math.min(15, Math.max(0, result.daysOverdue) * 3)
      : 0;
  const pressure = clamp(
    STATE_PRESSURE[result.state] + PRIORITY_PRESSURE_OFFSET[priority] + overdueOffset,
    0,
    110
  );

  return {
    ...result,
    pressure,
    reason: reasonForTaskState(result.state)
  };
}

function aggregateLifePressure(tasks = [], now = new Date()) {
  const activeTasks = Array.isArray(tasks)
    ? tasks.filter((task) => task && task.completed !== true)
    : [];

  const counts = {
    [TASK_STATES.FUTURE]: 0,
    [TASK_STATES.CALM]: 0,
    [TASK_STATES.WARNING]: 0,
    [TASK_STATES.URGENT]: 0,
    [TASK_STATES.OVERDUE]: 0
  };
  const taskStates = {};

  if (activeTasks.length === 0) {
    return {
      score: 0,
      level: LIFE_PRESSURE_LEVELS.CALM,
      dominantReason: 'no-active-tasks',
      dominantTaskId: null,
      counts,
      taskStates
    };
  }

  let dominantTask = null;
  const pressureValues = [];

  for (const task of activeTasks) {
    const state = classifyTask(task, now);
    counts[state.state] = (counts[state.state] || 0) + 1;
    taskStates[task.id] = state;
    pressureValues.push(state.pressure);
    if (!dominantTask || state.pressure > dominantTask.state.pressure) {
      dominantTask = { task, state };
    }
  }

  const sorted = [...pressureValues].sort((a, b) => b - a);
  const maxPressure = sorted[0] || 0;
  const topThree = sorted.slice(0, 3);
  const topAverage =
    topThree.length > 0
      ? topThree.reduce((total, value) => total + value, 0) / topThree.length
      : 0;
  const nonFutureCount = activeTasks.length - counts[TASK_STATES.FUTURE];
  const countAdjustment = countLoadAdjustment(nonFutureCount);

  // 最大圧を強く見ることで、緊急タスク1件が多くのcalmタスクに埋もれないようにします。
  const score = clamp(
    Math.round(maxPressure * 0.65 + topAverage * 0.25 + countAdjustment * 0.1),
    0,
    100
  );

  return {
    score,
    level: pressureLevel(score),
    dominantReason: dominantTask ? reasonForTaskState(dominantTask.state.state) : 'none',
    dominantTaskId: dominantTask?.task?.id || null,
    counts,
    taskStates
  };
}

module.exports = {
  aggregateLifePressure,
  classifyTask,
  compareDateKeys,
  localDateKey,
  pressureLevel
};
