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
  EXPORT_CHARACTER_PACK: 'taskmate:export-character-pack',
  SAVE_CLOUD_CHARACTER_PACK: 'taskmate:save-cloud-character-pack',
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
  exportCharacterPack: (characterName) =>
    ipcRenderer.invoke(IPC.EXPORT_CHARACTER_PACK, characterName),
  saveCloudCharacterPack: (characterPack) =>
    ipcRenderer.invoke(IPC.SAVE_CLOUD_CHARACTER_PACK, characterPack),
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
  getBehaviorState: () => ipcRenderer.invoke(IPC.GET_BEHAVIOR_STATE),
  recordInteraction: (type, details) =>
    ipcRenderer.invoke(IPC.RECORD_INTERACTION, type, details || {}),
  setFocusTask: (taskId) => ipcRenderer.invoke(IPC.SET_FOCUS_TASK, taskId),
  clearFocusTask: () => ipcRenderer.invoke(IPC.CLEAR_FOCUS_TASK),
  resetLifeState: () => ipcRenderer.invoke(IPC.RESET_LIFE_STATE),
  getProjectState: () => ipcRenderer.invoke(IPC.GET_PROJECT_STATE),
  createProjectCategory: (categoryInput) =>
    ipcRenderer.invoke(IPC.CREATE_PROJECT_CATEGORY, categoryInput),
  updateProjectCategory: (categoryId, categoryInput) =>
    ipcRenderer.invoke(IPC.UPDATE_PROJECT_CATEGORY, categoryId, categoryInput),
  deleteProjectCategory: (categoryId) =>
    ipcRenderer.invoke(IPC.DELETE_PROJECT_CATEGORY, categoryId),
  createProject: (projectInput) => ipcRenderer.invoke(IPC.CREATE_PROJECT, projectInput),
  updateProject: (projectId, projectInput) =>
    ipcRenderer.invoke(IPC.UPDATE_PROJECT, projectId, projectInput),
  deleteProject: (projectId, deleteMode) =>
    ipcRenderer.invoke(IPC.DELETE_PROJECT, projectId, deleteMode),
  createProjectMilestone: (milestoneInput) =>
    ipcRenderer.invoke(IPC.CREATE_PROJECT_MILESTONE, milestoneInput),
  updateProjectMilestone: (milestoneId, milestoneInput) =>
    ipcRenderer.invoke(IPC.UPDATE_PROJECT_MILESTONE, milestoneId, milestoneInput),
  deleteProjectMilestone: (milestoneId) =>
    ipcRenderer.invoke(IPC.DELETE_PROJECT_MILESTONE, milestoneId),
  createProjectTask: (taskInput) =>
    ipcRenderer.invoke(IPC.CREATE_PROJECT_TASK, taskInput),
  updateProjectTask: (taskId, taskInput) =>
    ipcRenderer.invoke(IPC.UPDATE_PROJECT_TASK, taskId, taskInput),
  deleteProjectTask: (taskId) => ipcRenderer.invoke(IPC.DELETE_PROJECT_TASK, taskId),
  completeProjectTask: (taskId, completed = true) =>
    ipcRenderer.invoke(IPC.COMPLETE_PROJECT_TASK, taskId, completed),
  addProjectTaskToToday: (taskId, scheduledDate) =>
    ipcRenderer.invoke(IPC.ADD_PROJECT_TASK_TO_TODAY, taskId, scheduledDate),
  onTasksUpdated: (callback) => subscribe(IPC.TASKS_UPDATED, callback),
  onProjectsUpdated: (callback) => subscribe(IPC.PROJECTS_UPDATED, callback),
  onSettingsUpdated: (callback) => subscribe(IPC.SETTINGS_UPDATED, callback),
  onBehaviorUpdated: (callback) => subscribe(IPC.BEHAVIOR_UPDATED, callback),
  onNotification: (callback) => subscribe(IPC.NOTIFICATION, callback),
  onNotificationCleared: (callback) => subscribe(IPC.NOTIFICATION_CLEARED, callback),
  onShowTaskList: (callback) => subscribe(IPC.SHOW_TASK_LIST, callback)
});
