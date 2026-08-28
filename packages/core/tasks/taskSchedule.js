const TASK_STATES = Object.freeze({
  FUTURE: 'future',
  TODAY: 'today',
  WARNING: 'warning',
  URGENT: 'urgent',
  OVERDUE: 'overdue'
});

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

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

function classifyTimedTask(task, now) {
  const dueAt = localDateTime(task.date, task.time);
  if (!dueAt) {
    return {
      state: TASK_STATES.TODAY,
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
  return { state: TASK_STATES.TODAY, minutesRemaining, daysOverdue: 0 };
}

function classifyAllDayTask(task, now) {
  const today = localDateKey(now);
  const dayDifference = compareDateKeys(task.date, today);
  if (!parseDateParts(task.date)) {
    return {
      state: TASK_STATES.TODAY,
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
  return { state: TASK_STATES.TODAY, minutesRemaining: null, daysOverdue: 0 };
}

function classifyTask(task, now = new Date()) {
  if (!task || typeof task !== 'object') {
    return {
      state: TASK_STATES.TODAY,
      minutesRemaining: null,
      daysOverdue: 0,
      invalidReason: 'invalid-task'
    };
  }

  return task.time === null || task.time === undefined || task.time === ''
    ? classifyAllDayTask(task, now)
    : classifyTimedTask(task, now);
}

module.exports = {
  TASK_STATES,
  classifyTask,
  compareDateKeys,
  localDateKey,
  parseDateParts,
  parseTimeParts
};
