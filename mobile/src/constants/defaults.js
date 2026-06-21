const STORAGE_KEYS = Object.freeze({
  settings: 'taskmate:settings:v1',
  lifeState: 'taskmate:life-state:v1',
  characters: 'taskmate:characters:v1',
  selectedCharacter: 'taskmate:selected-character:v1'
});

const NOTIFICATION_CHANNEL_ID = 'taskmate-deadlines';
const DATABASE_NAME = 'taskmate-mobile.db';

const DEFAULT_SETTINGS = Object.freeze({
  schemaVersion: 1,
  notificationsEnabled: true,
  notificationMinutesBefore: 30,
  notificationOffsets: [30, 0],
  behaviorEnabled: true,
  ambientEffects: true,
  completionReactions: true,
  relationshipMemoryEnabled: true,
  behaviorIntensity: 'normal',
  quietHours: {
    enabled: true,
    start: '22:00',
    end: '07:00'
  },
  reduceMotion: false,
  use24HourClock: true,
  selectedCharacterId: 'Chara1'
});

module.exports = {
  DATABASE_NAME,
  DEFAULT_SETTINGS,
  NOTIFICATION_CHANNEL_ID,
  STORAGE_KEYS
};
