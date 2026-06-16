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
  TASKS_UPDATED: 'taskmate:tasks-updated',
  SETTINGS_UPDATED: 'taskmate:settings-updated',
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
  genreHistory: []
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
