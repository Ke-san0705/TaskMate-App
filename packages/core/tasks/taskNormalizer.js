const {
  PRIORITIES,
  assertValidTaskInput,
  isPlainObject,
  trimText
} = require('./taskValidation');

function fallbackIdFactory() {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isoTimestamp(now) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function normalizeTaskInput(input, options = {}) {
  const {
    current = null,
    now = new Date(),
    idFactory = fallbackIdFactory
  } = options;
  const source = isPlainObject(input) ? input : {};
  const previous = isPlainObject(current) ? current : {};
  const timestamp = isoTimestamp(now);
  const completed =
    typeof source.completed === 'boolean'
      ? source.completed
      : typeof previous.completed === 'boolean'
        ? previous.completed
        : false;

  const task = {
    id:
      typeof previous.id === 'string' && previous.id
        ? previous.id
        : typeof source.id === 'string' && source.id.trim()
          ? source.id.trim()
          : idFactory(),
    title: trimText(source.title),
    description: trimText(source.description),
    date: trimText(source.date),
    time:
      typeof source.time === 'string' && source.time.trim()
        ? source.time.trim()
        : null,
    genre: trimText(source.genre),
    priority: PRIORITIES.includes(source.priority) ? source.priority : 'normal',
    completed,
    createdAt:
      typeof previous.createdAt === 'string' && previous.createdAt
        ? previous.createdAt
        : timestamp,
    updatedAt: timestamp,
    completedAt: completed
      ? previous.completed === true && typeof previous.completedAt === 'string'
        ? previous.completedAt
        : timestamp
      : null
  };

  // 保存前に正規化済みの値を検証します。暗黙変換で別日になるバグを避けるため、
  // Dateへ丸投げせず、YYYY-MM-DDとHH:mmを明示的に確認します。
  assertValidTaskInput(task);
  return task;
}

function normalizeStoredTask(row) {
  const source = isPlainObject(row) ? row : {};
  return normalizeTaskInput(
    {
      id: source.id,
      title: source.title,
      description: source.description,
      date: source.date,
      time: source.time,
      genre: source.genre,
      priority: source.priority,
      completed: source.completed === true || source.completed === 1
    },
    {
      current: {
        id: source.id,
        createdAt: source.createdAt || source.created_at,
        completedAt: source.completedAt || source.completed_at,
        completed: source.completed === true || source.completed === 1
      },
      now: source.updatedAt || source.updated_at || new Date()
    }
  );
}

module.exports = {
  normalizeStoredTask,
  normalizeTaskInput
};
