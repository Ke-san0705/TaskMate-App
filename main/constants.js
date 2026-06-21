const IPC = Object.freeze({
  GET_TASKS: 'taskmate:get-tasks',
  ADD_TASK: 'taskmate:add-task',
  UPDATE_TASK: 'taskmate:update-task',
  DELETE_TASK: 'taskmate:delete-task',
  COMPLETE_TASK: 'taskmate:complete-task',
  UNDO_COMPLETE_TASK: 'taskmate:undo-complete-task',
  RELOAD_TASKS: 'taskmate:reload-tasks',
  GET_SETTINGS: 'taskmate:get-settings',
  UPDATE_SETTINGS: 'taskmate:update-settings',
  RESET_WINDOW_POSITION: 'taskmate:reset-window-position',
  GET_CHARACTERS: 'taskmate:get-characters',
  GET_CHARACTER_DATA: 'taskmate:get-character-data',
  SELECT_CHARACTER: 'taskmate:select-character',
  SET_CLICK_THROUGH: 'taskmate:set-click-through',
  BEGIN_WINDOW_DRAG: 'taskmate:begin-window-drag',
  MOVE_WINDOW_DRAG: 'taskmate:move-window-drag',
  END_WINDOW_DRAG: 'taskmate:end-window-drag',
  RESIZE_MAIN_WINDOW: 'taskmate:resize-main-window',
  OPEN_SETTINGS: 'taskmate:open-settings',
  HIDE_MAIN_WINDOW: 'taskmate:hide-main-window',
  SHOW_MAIN_WINDOW: 'taskmate:show-main-window',
  SHOW_CHARACTER_MENU: 'taskmate:show-character-menu',
  ACKNOWLEDGE_NOTIFICATION: 'taskmate:acknowledge-notification',
  GET_ACTIVE_NOTIFICATION: 'taskmate:get-active-notification',
  GET_BEHAVIOR_STATE: 'taskmate:get-behavior-state',
  RECORD_INTERACTION: 'taskmate:record-interaction',
  SET_FOCUS_TASK: 'taskmate:set-focus-task',
  CLEAR_FOCUS_TASK: 'taskmate:clear-focus-task',
  RESET_LIFE_STATE: 'taskmate:reset-life-state',
  GET_PROJECT_STATE: 'taskmate:get-project-state',
  CREATE_PROJECT_CATEGORY: 'taskmate:create-project-category',
  UPDATE_PROJECT_CATEGORY: 'taskmate:update-project-category',
  DELETE_PROJECT_CATEGORY: 'taskmate:delete-project-category',
  CREATE_PROJECT: 'taskmate:create-project',
  UPDATE_PROJECT: 'taskmate:update-project',
  DELETE_PROJECT: 'taskmate:delete-project',
  CREATE_PROJECT_MILESTONE: 'taskmate:create-project-milestone',
  UPDATE_PROJECT_MILESTONE: 'taskmate:update-project-milestone',
  DELETE_PROJECT_MILESTONE: 'taskmate:delete-project-milestone',
  CREATE_PROJECT_TASK: 'taskmate:create-project-task',
  UPDATE_PROJECT_TASK: 'taskmate:update-project-task',
  DELETE_PROJECT_TASK: 'taskmate:delete-project-task',
  COMPLETE_PROJECT_TASK: 'taskmate:complete-project-task',
  ADD_PROJECT_TASK_TO_TODAY: 'taskmate:add-project-task-to-today',
  TASKS_UPDATED: 'taskmate:tasks-updated',
  PROJECTS_UPDATED: 'taskmate:projects-updated',
  SETTINGS_UPDATED: 'taskmate:settings-updated',
  BEHAVIOR_UPDATED: 'taskmate:behavior-updated',
  NOTIFICATION: 'taskmate:notification',
  NOTIFICATION_CLEARED: 'taskmate:notification-cleared',
  SHOW_TASK_LIST: 'taskmate:show-task-list'
});

const DEFAULT_SETTINGS = Object.freeze({
  selectedCharacter: 'Chara1',
  showCharacter: true,
  characterScale: 100,
  bubbleScale: 100,
  windowPosition: {
    x: null,
    y: null
  },
  bubblePosition: 'right',
  autoStart: true,
  clickImageDuration: 2000,
  notificationMinutesBefore: 30,
  notificationOffsets: [30, 0],
  useNativeNotifications: true,
  isMainWindowVisible: true,
  genreHistory: [],
  behaviorEnabled: true,
  ambientEffects: true,
  autonomousMovement: true,
  completionReactions: true,
  relationshipMemoryEnabled: true,
  behaviorIntensity: 'normal',
  quietHours: {
    enabled: true,
    start: '22:00',
    end: '07:00'
  },
  projectSettings: {
    dailyAvailableMinutes: 120,
    weekdayAvailableMinutes: 120,
    weekendAvailableMinutes: 240,
    defaultSessionMinutes: 45,
    dailyRecommendationLimit: 5,
    deadlineWarningDays: 7,
    overdueNotificationsEnabled: true,
    progressNotificationsEnabled: true
  }
});

const REQUIRED_CHARACTER_FILES = Object.freeze([
  'wait.png',
  'click.png',
  'alarm.png',
  'dialogues.json'
]);

module.exports = {
  DEFAULT_SETTINGS,
  IPC,
  REQUIRED_CHARACTER_FILES
};
