const { ALLOWED_INTERACTIONS } = require('./behaviorConstants');
const { compareDateKeys, localDateKey } = require('./taskPressureEngine');

const LIFE_STATE_VERSION = 1;
const MAX_ACTIVE_DATES = 370;
const MAX_INTERACTIONS = 80;
const MAX_RECENT_ACTIONS = 10;
const MAX_RECENT_DIALOGUES = 8;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const RELATIONSHIP_STAGE_ORDER = Object.freeze([
  'new',
  'familiar',
  'steady',
  'companion'
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isoNow(now) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function uniqueDates(values) {
  const dates = Array.isArray(values)
    ? values.filter((value) => typeof value === 'string' && DATE_PATTERN.test(value))
    : [];
  return [...new Set(dates)].sort().slice(-MAX_ACTIVE_DATES);
}

function numeric(value, fallback = 0) {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function validIso(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : value;
}

function stageRank(stage) {
  const index = RELATIONSHIP_STAGE_ORDER.indexOf(stage);
  return index === -1 ? 0 : index;
}

function deriveRelationshipStage(state) {
  const activeDays = numeric(state.activeDays);
  const completed = numeric(state.completedTaskCount);
  if (activeDays >= 14 || completed >= 60) {
    return 'companion';
  }
  if (activeDays >= 7 || completed >= 25) {
    return 'steady';
  }
  if (activeDays >= 3 || completed >= 8) {
    return 'familiar';
  }
  return 'new';
}

function keepHighestStage(current, derived) {
  return stageRank(current) > stageRank(derived) ? current : derived;
}

function createDefaultLifeState(now = new Date()) {
  const today = localDateKey(now);
  const timestamp = isoNow(now);
  return {
    version: LIFE_STATE_VERSION,
    createdAt: timestamp,
    firstLaunchAt: timestamp,
    lastLaunchAt: null,
    lastActiveDate: null,
    activeDates: [],
    activeDays: 0,
    visitCount: 0,
    completedTaskCount: 0,
    completedToday: 0,
    todayCompletionDate: today,
    celebratedDates: [],
    lastReconnectDate: null,
    lastCompletedAt: null,
    focusTaskId: null,
    relationshipStage: 'new',
    interactions: [],
    behavior: {
      lastActionAt: null,
      lastActionId: null,
      lastDialogueAt: null,
      recentActions: [],
      recentDialogueCategories: []
    }
  };
}

function normalizeBehavior(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    lastActionAt: validIso(source.lastActionAt, null),
    lastActionId:
      typeof source.lastActionId === 'string' ? source.lastActionId.slice(0, 80) : null,
    lastDialogueAt: validIso(source.lastDialogueAt, null),
    recentActions: Array.isArray(source.recentActions)
      ? source.recentActions
          .filter((item) => item && typeof item.id === 'string')
          .map((item) => ({
            id: item.id.slice(0, 80),
            at: validIso(item.at, null)
          }))
          .filter((item) => item.at)
          .slice(-MAX_RECENT_ACTIONS)
      : [],
    recentDialogueCategories: Array.isArray(source.recentDialogueCategories)
      ? source.recentDialogueCategories
          .filter((item) => typeof item === 'string')
          .map((item) => item.slice(0, 80))
          .slice(-MAX_RECENT_DIALOGUES)
      : []
  };
}

function normalizeLifeState(value, now = new Date()) {
  const fallback = createDefaultLifeState(now);
  const source = value && typeof value === 'object' ? value : {};
  const activeDates = uniqueDates(source.activeDates);
  const todayCompletionDate =
    typeof source.todayCompletionDate === 'string' &&
    DATE_PATTERN.test(source.todayCompletionDate)
      ? source.todayCompletionDate
      : localDateKey(now);

  const normalized = {
    ...fallback,
    ...clone(source),
    version: LIFE_STATE_VERSION,
    createdAt: validIso(source.createdAt, fallback.createdAt),
    firstLaunchAt: validIso(source.firstLaunchAt, fallback.firstLaunchAt),
    lastLaunchAt: validIso(source.lastLaunchAt, null),
    lastActiveDate:
      typeof source.lastActiveDate === 'string' && DATE_PATTERN.test(source.lastActiveDate)
        ? source.lastActiveDate
        : null,
    activeDates,
    activeDays: Math.max(numeric(source.activeDays), activeDates.length),
    visitCount: numeric(source.visitCount),
    completedTaskCount: numeric(source.completedTaskCount),
    completedToday:
      todayCompletionDate === localDateKey(now) ? numeric(source.completedToday) : 0,
    todayCompletionDate,
    celebratedDates: uniqueDates(source.celebratedDates),
    lastReconnectDate:
      typeof source.lastReconnectDate === 'string' &&
      DATE_PATTERN.test(source.lastReconnectDate)
        ? source.lastReconnectDate
        : null,
    lastCompletedAt: validIso(source.lastCompletedAt, null),
    focusTaskId:
      typeof source.focusTaskId === 'string' && source.focusTaskId.length <= 200
        ? source.focusTaskId
        : null,
    relationshipStage: RELATIONSHIP_STAGE_ORDER.includes(source.relationshipStage)
      ? source.relationshipStage
      : 'new',
    interactions: Array.isArray(source.interactions)
      ? source.interactions
          .filter((item) => item && ALLOWED_INTERACTIONS.includes(item.type))
          .map((item) => ({
            type: item.type,
            at: validIso(item.at, isoNow(now)),
            taskId:
              typeof item.taskId === 'string' && item.taskId.length <= 200
                ? item.taskId
                : null
          }))
          .slice(-MAX_INTERACTIONS)
      : [],
    behavior: normalizeBehavior(source.behavior)
  };

  normalized.relationshipStage = keepHighestStage(
    normalized.relationshipStage,
    deriveRelationshipStage(normalized)
  );
  return normalized;
}

function ensureToday(state, now = new Date()) {
  const today = localDateKey(now);
  const next = normalizeLifeState(state, now);
  if (next.todayCompletionDate !== today) {
    // 日付が変わったら「今日完了した件数」だけをリセットします。
    // 累計完了数や関係段階は努力の記録なので減らしません。
    next.todayCompletionDate = today;
    next.completedToday = 0;
  }
  if (!next.activeDates.includes(today)) {
    next.activeDates = [...next.activeDates, today].slice(-MAX_ACTIVE_DATES);
    next.activeDays = next.activeDates.length;
  }
  next.lastActiveDate = today;
  next.relationshipStage = keepHighestStage(
    next.relationshipStage,
    deriveRelationshipStage(next)
  );
  return next;
}

function registerLaunch(state, now = new Date()) {
  const today = localDateKey(now);
  const next = ensureToday(state, now);
  const previousActiveDate = state?.lastActiveDate || null;
  const gapDays = previousActiveDate ? compareDateKeys(today, previousActiveDate) : null;
  let reconnectEvent = null;

  // 再訪演出は同じ日に何度も出すと押しつけがましいため、lastReconnectDateで一日一回にします。
  if (next.visitCount === 0) {
    reconnectEvent = 'firstMeeting';
  } else if (gapDays >= 7 && next.lastReconnectDate !== today) {
    reconnectEvent = 'returnLong';
  } else if (gapDays >= 2 && next.lastReconnectDate !== today) {
    reconnectEvent = 'returnShort';
  }

  next.visitCount += 1;
  next.lastLaunchAt = isoNow(now);
  if (reconnectEvent) {
    next.lastReconnectDate = today;
  }

  return { state: next, reconnectEvent, gapDays };
}

function recordInteraction(state, type, now = new Date(), details = {}) {
  if (!ALLOWED_INTERACTIONS.includes(type)) {
    return normalizeLifeState(state, now);
  }
  const next = ensureToday(state, now);
  next.interactions = [
    ...next.interactions,
    {
      type,
      at: isoNow(now),
      taskId:
        typeof details.taskId === 'string' && details.taskId.length <= 200
          ? details.taskId
          : null
    }
  ].slice(-MAX_INTERACTIONS);
  return next;
}

function recordTaskCompletion(state, task, now = new Date()) {
  const next = recordInteraction(state, 'task-complete', now, {
    taskId: task?.id || null
  });
  const today = localDateKey(now);
  if (next.todayCompletionDate !== today) {
    next.todayCompletionDate = today;
    next.completedToday = 0;
  }
  next.completedTaskCount += 1;
  next.completedToday += 1;
  next.lastCompletedAt = isoNow(now);
  next.relationshipStage = keepHighestStage(
    next.relationshipStage,
    deriveRelationshipStage(next)
  );
  return next;
}

function markCelebrated(state, dateKey = localDateKey(), now = new Date()) {
  const next = normalizeLifeState(state, now);
  if (!next.celebratedDates.includes(dateKey)) {
    next.celebratedDates = [...next.celebratedDates, dateKey].slice(-MAX_ACTIVE_DATES);
  }
  return next;
}

function setFocusTask(state, taskId, now = new Date()) {
  const next = recordInteraction(state, 'focus-start', now, { taskId });
  next.focusTaskId = taskId;
  return next;
}

function clearFocusTask(state, now = new Date()) {
  const next = recordInteraction(state, 'focus-clear', now, {
    taskId: state?.focusTaskId || null
  });
  next.focusTaskId = null;
  return next;
}

function rememberSelectedAction(state, actionId, dialogueCategory, now = new Date()) {
  const next = normalizeLifeState(state, now);
  const timestamp = isoNow(now);
  if (typeof actionId === 'string' && actionId) {
    next.behavior.lastActionAt = timestamp;
    next.behavior.lastActionId = actionId;
    next.behavior.recentActions = [
      ...next.behavior.recentActions,
      { id: actionId, at: timestamp }
    ].slice(-MAX_RECENT_ACTIONS);
  }
  if (typeof dialogueCategory === 'string' && dialogueCategory) {
    next.behavior.lastDialogueAt = timestamp;
    next.behavior.recentDialogueCategories = [
      ...next.behavior.recentDialogueCategories,
      dialogueCategory
    ].slice(-MAX_RECENT_DIALOGUES);
  }
  return next;
}

module.exports = {
  createDefaultLifeState,
  deriveRelationshipStage,
  markCelebrated,
  normalizeLifeState,
  recordInteraction,
  recordTaskCompletion,
  registerLaunch,
  rememberSelectedAction,
  clearFocusTask,
  setFocusTask
};
