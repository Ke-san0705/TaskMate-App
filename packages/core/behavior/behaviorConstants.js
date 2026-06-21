const TASK_STATES = Object.freeze({
  FUTURE: 'future',
  CALM: 'calm',
  WARNING: 'warning',
  URGENT: 'urgent',
  OVERDUE: 'overdue'
});

const LIFE_PRESSURE_LEVELS = Object.freeze({
  CALM: 'calm',
  ATTENTIVE: 'attentive',
  RESTLESS: 'restless',
  ANXIOUS: 'anxious',
  OVERLOADED: 'overloaded'
});

const TEMPORARY_MOODS = Object.freeze({
  CLICKED: 'clicked',
  NOTIFYING: 'notifying',
  RELIEVED: 'relieved',
  CELEBRATING: 'celebrating',
  RECONNECTING: 'reconnecting',
  FOCUSING: 'focusing'
});

const CHARACTER_MOOD_PRIORITY = Object.freeze([
  TEMPORARY_MOODS.NOTIFYING,
  TEMPORARY_MOODS.CELEBRATING,
  TEMPORARY_MOODS.RELIEVED,
  TEMPORARY_MOODS.RECONNECTING,
  TEMPORARY_MOODS.FOCUSING,
  TEMPORARY_MOODS.CLICKED,
  LIFE_PRESSURE_LEVELS.OVERLOADED,
  LIFE_PRESSURE_LEVELS.ANXIOUS,
  LIFE_PRESSURE_LEVELS.RESTLESS,
  LIFE_PRESSURE_LEVELS.ATTENTIVE,
  LIFE_PRESSURE_LEVELS.CALM
]);

const DEFAULT_BEHAVIOR_SETTINGS = Object.freeze({
  behaviorEnabled: true,
  ambientEffects: true,
  autonomousMovement: true,
  completionReactions: true,
  relationshipMemoryEnabled: true,
  behaviorIntensity: 'normal',
  reduceMotion: false,
  quietHours: {
    enabled: true,
    start: '22:00',
    end: '07:00'
  }
});

const BEHAVIOR_INTENSITIES = Object.freeze(['low', 'normal', 'high']);

const ALLOWED_INTERACTIONS = Object.freeze([
  'character-click',
  'task-list-open',
  'task-complete',
  'task-create',
  'task-update',
  'task-delete',
  'focus-start',
  'focus-clear',
  'settings-change'
]);

module.exports = {
  ALLOWED_INTERACTIONS,
  BEHAVIOR_INTENSITIES,
  CHARACTER_MOOD_PRIORITY,
  DEFAULT_BEHAVIOR_SETTINGS,
  LIFE_PRESSURE_LEVELS,
  TASK_STATES,
  TEMPORARY_MOODS
};
