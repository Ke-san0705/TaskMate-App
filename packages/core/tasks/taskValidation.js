const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const PRIORITIES = Object.freeze(['high', 'normal', 'low']);

const TASK_LIMITS = Object.freeze({
  title: 100,
  description: 1000,
  genre: 40
});

class TaskValidationError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'TaskValidationError';
    this.issues = issues;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidLocalDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isValidLocalTime(value) {
  return value === null || (typeof value === 'string' && TIME_PATTERN.test(value));
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function collectTaskIssues(task) {
  const issues = [];
  if (!isPlainObject(task)) {
    return [{ field: 'task', message: 'タスク情報が正しくありません。' }];
  }

  const title = trimText(task.title);
  if (!title) {
    issues.push({ field: 'title', message: 'タスク名を入力してください。' });
  } else if (title.length > TASK_LIMITS.title) {
    issues.push({ field: 'title', message: `タスク名は${TASK_LIMITS.title}文字以内にしてください。` });
  }

  const description = trimText(task.description);
  if (description.length > TASK_LIMITS.description) {
    issues.push({
      field: 'description',
      message: `説明は${TASK_LIMITS.description}文字以内にしてください。`
    });
  }

  const genre = trimText(task.genre);
  if (genre.length > TASK_LIMITS.genre) {
    issues.push({ field: 'genre', message: `ジャンルは${TASK_LIMITS.genre}文字以内にしてください。` });
  }

  if (!isValidLocalDate(task.date)) {
    issues.push({ field: 'date', message: '日付はYYYY-MM-DD形式の正しい日付にしてください。' });
  }

  const time = task.time === '' || task.time === undefined ? null : task.time;
  if (!isValidLocalTime(time)) {
    issues.push({ field: 'time', message: '時刻はHH:mm形式、または空にしてください。' });
  }

  if (!PRIORITIES.includes(task.priority || 'normal')) {
    issues.push({ field: 'priority', message: '優先度が正しくありません。' });
  }

  if (task.completed !== undefined && typeof task.completed !== 'boolean') {
    issues.push({ field: 'completed', message: '完了状態が正しくありません。' });
  }

  return issues;
}

function assertValidTaskInput(task) {
  const issues = collectTaskIssues(task);
  if (issues.length > 0) {
    throw new TaskValidationError(issues[0].message, issues);
  }
}

module.exports = {
  DATE_PATTERN,
  PRIORITIES,
  TASK_LIMITS,
  TIME_PATTERN,
  TaskValidationError,
  assertValidTaskInput,
  collectTaskIssues,
  isPlainObject,
  isValidLocalDate,
  isValidLocalTime,
  trimText
};
