const { DEFAULT_BEHAVIOR_SETTINGS, LIFE_PRESSURE_LEVELS } = require('./behaviorConstants');

const MINUTE_MS = 60 * 1000;

const LEVEL_COOLDOWN_MS = Object.freeze({
  [LIFE_PRESSURE_LEVELS.CALM]: 10 * MINUTE_MS,
  [LIFE_PRESSURE_LEVELS.ATTENTIVE]: 5 * MINUTE_MS,
  [LIFE_PRESSURE_LEVELS.RESTLESS]: 3 * MINUTE_MS,
  [LIFE_PRESSURE_LEVELS.ANXIOUS]: 3 * MINUTE_MS,
  [LIFE_PRESSURE_LEVELS.OVERLOADED]: 5 * MINUTE_MS
});

const SAME_ACTION_COOLDOWN_MS = 10 * MINUTE_MS;
const MOVEMENT_COOLDOWN_MS = 5 * MINUTE_MS;

const AMBIENT_LEVEL_BY_PRESSURE = Object.freeze({
  [LIFE_PRESSURE_LEVELS.CALM]: 0,
  [LIFE_PRESSURE_LEVELS.ATTENTIVE]: 1,
  [LIFE_PRESSURE_LEVELS.RESTLESS]: 2,
  [LIFE_PRESSURE_LEVELS.ANXIOUS]: 3,
  [LIFE_PRESSURE_LEVELS.OVERLOADED]: 2
});

const ACTIONS_BY_LEVEL = Object.freeze({
  [LIFE_PRESSURE_LEVELS.CALM]: [
    { id: 'idle', weight: 5, dialogueCategory: null },
    { id: 'soft-breathe', weight: 3, dialogueCategory: null },
    { id: 'look-around', weight: 2, dialogueCategory: 'calm' },
    { id: 'small-talk', weight: 1, dialogueCategory: 'smallTalk' },
    { id: 'stay-near-user-position', weight: 4, dialogueCategory: null }
  ],
  [LIFE_PRESSURE_LEVELS.ATTENTIVE]: [
    { id: 'look-at-task', weight: 3, dialogueCategory: 'attentive' },
    { id: 'suggest-one-task', weight: 4, dialogueCategory: 'suggestOneTask' },
    { id: 'small-nudge', weight: 2, dialogueCategory: 'attentive', movement: 'tiny' },
    { id: 'show-next-task-briefly', weight: 3, dialogueCategory: 'showNextTask' }
  ],
  [LIFE_PRESSURE_LEVELS.RESTLESS]: [
    { id: 'pace-nearby', weight: 2, dialogueCategory: 'restless', movement: 'short' },
    { id: 'peek-task-card', weight: 3, dialogueCategory: 'restless' },
    { id: 'warn-softly', weight: 4, dialogueCategory: 'warningSoft' },
    { id: 'move-to-near-edge', weight: 1, dialogueCategory: null, movement: 'edge' }
  ],
  [LIFE_PRESSURE_LEVELS.ANXIOUS]: [
    { id: 'hold-dominant-task', weight: 4, dialogueCategory: 'anxious' },
    { id: 'show-one-choice', weight: 5, dialogueCategory: 'showOneChoice' },
    { id: 'move-to-visible-edge', weight: 1, dialogueCategory: null, movement: 'edge' },
    { id: 'ask-to-select-focus-task', weight: 3, dialogueCategory: 'askFocusTask' },
    { id: 'reduce-motion-after-message', weight: 2, dialogueCategory: 'anxious' }
  ],
  [LIFE_PRESSURE_LEVELS.OVERLOADED]: [
    { id: 'stop-wandering', weight: 4, dialogueCategory: null },
    { id: 'show-one-choice', weight: 5, dialogueCategory: 'showOneChoice' },
    { id: 'offer-task-list', weight: 2, dialogueCategory: 'offerTaskList' },
    { id: 'suggest-small-start', weight: 4, dialogueCategory: 'suggestSmallStart' },
    { id: 'stay-quiet-after-guidance', weight: 3, dialogueCategory: 'overloaded' }
  ]
});

function normalizeSettings(settings = {}) {
  return {
    ...DEFAULT_BEHAVIOR_SETTINGS,
    ...settings,
    quietHours: {
      ...DEFAULT_BEHAVIOR_SETTINGS.quietHours,
      ...(settings.quietHours || {})
    }
  };
}

function minutesFromTime(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return null;
  }
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function isWithinQuietHours(settings, now = new Date()) {
  const quietHours = normalizeSettings(settings).quietHours;
  if (!quietHours.enabled) {
    return false;
  }
  const start = minutesFromTime(quietHours.start);
  const end = minutesFromTime(quietHours.end);
  if (start === null || end === null || start === end) {
    return false;
  }
  const current = now.getHours() * 60 + now.getMinutes();
  if (start < end) {
    return current >= start && current < end;
  }
  return current >= start || current < end;
}

function elapsedSince(value, now) {
  if (!value) {
    return Infinity;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return Infinity;
  }
  return now.getTime() - date.getTime();
}

function recentlyUsedAction(lifeState, actionId, now) {
  const recentActions = lifeState?.behavior?.recentActions || [];
  return recentActions.some(
    (item) =>
      item.id === actionId && elapsedSince(item.at, now) < SAME_ACTION_COOLDOWN_MS
  );
}

function movementRecentlyUsed(lifeState, now) {
  const recentActions = lifeState?.behavior?.recentActions || [];
  return recentActions.some(
    (item) =>
      typeof item.id === 'string' &&
      item.id.startsWith('move:') &&
      elapsedSince(item.at, now) < MOVEMENT_COOLDOWN_MS
  );
}

function chooseWeighted(candidates, random) {
  if (candidates.length === 0) {
    return null;
  }
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  let point = random() * total;
  for (const candidate of candidates) {
    point -= candidate.weight;
    if (point <= 0) {
      return candidate;
    }
  }
  return candidates[candidates.length - 1];
}

function movementFor(kind, settings, random) {
  if (!kind) {
    return null;
  }
  const intensity = normalizeSettings(settings).behaviorIntensity;
  const scale = intensity === 'high' ? 1.25 : intensity === 'low' ? 0.5 : 1;
  const sign = random() < 0.5 ? -1 : 1;
  if (kind === 'tiny') {
    return { type: 'nudge', dx: Math.round(8 * scale * sign), dy: 0 };
  }
  if (kind === 'short') {
    return { type: 'nudge', dx: Math.round(18 * scale * sign), dy: 0 };
  }
  if (kind === 'edge') {
    return { type: 'nudge', dx: Math.round(28 * scale * sign), dy: 0 };
  }
  return null;
}

function idleResult(level, reason, pressure) {
  return {
    mood: level,
    action: 'idle',
    dialogueCategory: null,
    movement: null,
    ambientLevel: AMBIENT_LEVEL_BY_PRESSURE[level] || 0,
    reason,
    targetTaskId: pressure?.dominantTaskId || null
  };
}

function selectAction({
  pressure,
  settings,
  lifeState,
  now = new Date(),
  random = Math.random,
  isHidden = false,
  reducedMotion = false
} = {}) {
  const normalizedSettings = normalizeSettings(settings);
  const level = pressure?.level || LIFE_PRESSURE_LEVELS.CALM;

  if (normalizedSettings.behaviorEnabled === false) {
    return idleResult(LIFE_PRESSURE_LEVELS.CALM, 'behavior-disabled', pressure);
  }
  if (isHidden) {
    return idleResult(level, 'main-window-hidden', pressure);
  }
  if (isWithinQuietHours(normalizedSettings, now)) {
    return idleResult(level, 'quiet-hours', pressure);
  }

  const levelCooldown = LEVEL_COOLDOWN_MS[level] || LEVEL_COOLDOWN_MS.calm;
  if (elapsedSince(lifeState?.behavior?.lastActionAt, now) < levelCooldown) {
    return idleResult(level, 'level-cooldown', pressure);
  }

  let candidates = [...(ACTIONS_BY_LEVEL[level] || ACTIONS_BY_LEVEL.calm)];
  const lastActionId = lifeState?.behavior?.lastActionId;
  if (candidates.length > 1 && lastActionId) {
    candidates = candidates.filter((candidate) => candidate.id !== lastActionId);
  }
  candidates = candidates.filter((candidate) => !recentlyUsedAction(lifeState, candidate.id, now));

  const movementDisabled =
    normalizedSettings.autonomousMovement === false ||
    normalizedSettings.behaviorIntensity === 'low' ||
    reducedMotion ||
    movementRecentlyUsed(lifeState, now);
  if (movementDisabled) {
    candidates = candidates.map((candidate) =>
      candidate.movement ? { ...candidate, movement: null } : candidate
    );
  }

  if (candidates.length === 0) {
    return idleResult(level, 'no-candidate', pressure);
  }

  const selected = chooseWeighted(candidates, random);
  const movement = movementFor(selected.movement, normalizedSettings, random);

  // 移動も行動履歴へ載せるため、controller側ではmovement付きの行動をmove:*として保存します。
  // これにより、短時間のsetPosition連打や落ち着かない横移動を避けられます。
  return {
    mood: level,
    action: selected.id,
    dialogueCategory: selected.dialogueCategory,
    movement,
    ambientLevel: AMBIENT_LEVEL_BY_PRESSURE[level] || 0,
    reason: pressure?.dominantReason || 'pressure-level',
    targetTaskId: pressure?.dominantTaskId || null
  };
}

module.exports = {
  isWithinQuietHours,
  selectAction
};
