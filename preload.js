const { contextBridge, ipcRenderer } = require('electron');

// sandbox有効のpreloadではローカルモジュールをrequireできないため、
// 公開APIに必要なチャンネル名だけをここへ固定します。
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

function subscribe(channel, callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('taskMate', {
  getTasks: () => ipcRenderer.invoke(IPC.GET_TASKS),
  addTask: (taskInput) => ipcRenderer.invoke(IPC.ADD_TASK, taskInput),
  updateTask: (taskId, taskInput) => ipcRenderer.invoke(IPC.UPDATE_TASK, taskId, taskInput),
  deleteTask: (taskId) => ipcRenderer.invoke(IPC.DELETE_TASK, taskId),
  completeTask: (taskId) => ipcRenderer.invoke(IPC.COMPLETE_TASK, taskId),
  undoCompleteTask: (taskId) => ipcRenderer.invoke(IPC.UNDO_COMPLETE_TASK, taskId),
  reloadTasks: () => ipcRenderer.invoke(IPC.RELOAD_TASKS),
  getSettings: () => ipcRenderer.invoke(IPC.GET_SETTINGS),
  updateSettings: (partialSettings) => ipcRenderer.invoke(IPC.UPDATE_SETTINGS, partialSettings),
  resetWindowPosition: () => ipcRenderer.invoke(IPC.RESET_WINDOW_POSITION),
  getCharacters: () => ipcRenderer.invoke(IPC.GET_CHARACTERS),
  getCharacterData: (characterName) => ipcRenderer.invoke(IPC.GET_CHARACTER_DATA, characterName),
  selectCharacter: (characterName) => ipcRenderer.invoke(IPC.SELECT_CHARACTER, characterName),
  setClickThrough: (enabled) => ipcRenderer.send(IPC.SET_CLICK_THROUGH, enabled),
  beginWindowDrag: (point) => ipcRenderer.send(IPC.BEGIN_WINDOW_DRAG, point),
  moveWindowDrag: (point) => ipcRenderer.send(IPC.MOVE_WINDOW_DRAG, point),
  endWindowDrag: () => ipcRenderer.invoke(IPC.END_WINDOW_DRAG),
  resizeMainWindow: (size) => ipcRenderer.send(IPC.RESIZE_MAIN_WINDOW, size),
  openSettings: () => ipcRenderer.send(IPC.OPEN_SETTINGS),
  hideMainWindow: () => ipcRenderer.send(IPC.HIDE_MAIN_WINDOW),
  showMainWindow: () => ipcRenderer.send(IPC.SHOW_MAIN_WINDOW),
  showCharacterMenu: () => ipcRenderer.send(IPC.SHOW_CHARACTER_MENU),
  acknowledgeNotification: (notificationId) =>
    ipcRenderer.invoke(IPC.ACKNOWLEDGE_NOTIFICATION, notificationId),
  getActiveNotification: () => ipcRenderer.invoke(IPC.GET_ACTIVE_NOTIFICATION),
  onTasksUpdated: (callback) => subscribe(IPC.TASKS_UPDATED, callback),
  onSettingsUpdated: (callback) => subscribe(IPC.SETTINGS_UPDATED, callback),
  onNotification: (callback) => subscribe(IPC.NOTIFICATION, callback),
  onNotificationCleared: (callback) => subscribe(IPC.NOTIFICATION_CLEARED, callback),
  onShowTaskList: (callback) => subscribe(IPC.SHOW_TASK_LIST, callback)
});
