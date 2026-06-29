const { IPC } = require('./constants');
const { ALLOWED_INTERACTIONS } = require('../behavior/behaviorConstants');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validTaskId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 200;
}

function validPoint(value) {
  return (
    isPlainObject(value) &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Math.abs(value.x) < 100_000 &&
    Math.abs(value.y) < 100_000
  );
}

function registerIpcHandlers({
  ipcMain,
  fileManager,
  googleCalendarService,
  oauthCallbackBridge,
  shell,
  windowManager,
  scheduler,
  behaviorController,
  actions,
  onSettingsChanged
}) {
  const handledChannels = [];
  const listenerChannels = [];

  function assertSender(event) {
    if (!windowManager.isKnownSender(event.sender)) {
      throw new Error('許可されていない画面からの操作です。');
    }
  }

  function handle(channel, handler) {
    ipcMain.handle(channel, async (event, ...args) => {
      assertSender(event);
      return handler(event, ...args);
    });
    handledChannels.push(channel);
  }

  function on(channel, handler) {
    const listener = (event, ...args) => {
      if (!windowManager.isKnownSender(event.sender)) {
        return;
      }
      Promise.resolve(handler(event, ...args)).catch((error) => {
        console.error(`${channel}の処理に失敗しました。`, error);
      });
    };
    ipcMain.on(channel, listener);
    listenerChannels.push([channel, listener]);
  }

  async function emitProjectsUpdated() {
    const result = await fileManager.getProjectStateResult();
    windowManager.sendProjectsUpdated(result);
    await scheduler.checkNow();
    return result;
  }

  handle(IPC.GET_TASKS, () => fileManager.getTasksResult());
  handle(IPC.ADD_TASK, async (_event, taskInput) => {
    if (!isPlainObject(taskInput)) {
      throw new Error('タスク情報が不正です。');
    }
    const result = await fileManager.addTask(taskInput);
    windowManager.sendTasksUpdated({ tasks: result.tasks, error: null });
    await behaviorController?.recordInteraction('task-create', { taskId: result.task.id });
    await behaviorController?.notifyTaskMutation('task-create');
    await scheduler.checkNow();
    return result.task;
  });
  handle(IPC.UPDATE_TASK, async (_event, taskId, taskInput) => {
    if (!validTaskId(taskId) || !isPlainObject(taskInput)) {
      throw new Error('タスク情報が不正です。');
    }
    const result = await fileManager.updateTask(taskId, taskInput);
    windowManager.sendTasksUpdated({ tasks: result.tasks, error: null });
    await behaviorController?.recordInteraction('task-update', { taskId });
    await behaviorController?.notifyTaskMutation('task-update');
    await scheduler.checkNow();
    return result.task;
  });
  handle(IPC.DELETE_TASK, async (_event, taskId) => {
    if (!validTaskId(taskId)) {
      throw new Error('タスクIDが不正です。');
    }
    const result = await fileManager.deleteTask(taskId);
    windowManager.sendTasksUpdated({ tasks: result.tasks, error: null });
    await behaviorController?.recordInteraction('task-delete', { taskId });
    await behaviorController?.notifyTaskMutation('task-delete');
    return result.task;
  });
  handle(IPC.COMPLETE_TASK, async (_event, taskId) => {
    if (!validTaskId(taskId)) {
      throw new Error('タスクIDが不正です。');
    }
    const result = await fileManager.setTaskCompleted(taskId, true);
    windowManager.sendTasksUpdated({ tasks: result.tasks, error: null });
    await behaviorController?.recordTaskCompleted(result.task, result.tasks);
    return result.task;
  });
  handle(IPC.UNDO_COMPLETE_TASK, async (_event, taskId) => {
    if (!validTaskId(taskId)) {
      throw new Error('タスクIDが不正です。');
    }
    const result = await fileManager.setTaskCompleted(taskId, false);
    windowManager.sendTasksUpdated({ tasks: result.tasks, error: null });
    await behaviorController?.notifyTaskMutation('task-complete-undo');
    return result.task;
  });
  handle(IPC.RELOAD_TASKS, async () => {
    const result = await fileManager.getTasksResult();
    windowManager.sendTasksUpdated(result);
    await behaviorController?.notifyTaskMutation('reload-tasks');
    await scheduler.checkNow();
    return result;
  });
  handle(IPC.GET_SETTINGS, () => fileManager.getSettings());
  handle(IPC.UPDATE_SETTINGS, async (_event, partialSettings) => {
    if (!isPlainObject(partialSettings)) {
      throw new Error('設定データが不正です。');
    }
    const settings = await fileManager.updateSettings(partialSettings);
    await onSettingsChanged(settings);
    return settings;
  });
  handle(IPC.RESET_WINDOW_POSITION, async () => {
    const position = windowManager.resetMainWindowPosition();
    const settings = await fileManager.updateSettings({ windowPosition: position });
    await onSettingsChanged(settings);
    return settings;
  });
  handle(IPC.GET_CHARACTERS, () => fileManager.getCharacters());
  handle(IPC.GET_CHARACTER_DATA, (_event, characterName) =>
    fileManager.getCharacterData(characterName)
  );
  handle(IPC.SELECT_CHARACTER, async (_event, characterName) => {
    const settings = await fileManager.selectCharacter(characterName);
    await onSettingsChanged(settings);
    return settings;
  });
  handle(IPC.EXPORT_CHARACTER_PACK, (_event, characterName) =>
    fileManager.exportCharacterPack(characterName)
  );
  handle(IPC.SAVE_CLOUD_CHARACTER_PACK, async (_event, characterPack) => {
    if (!isPlainObject(characterPack)) {
      throw new Error('キャラクターパックの形式が不正です。');
    }
    const result = await fileManager.saveCloudCharacterPack(characterPack);
    return result;
  });
  handle(IPC.END_WINDOW_DRAG, async () => {
    const position = windowManager.endDrag();
    if (!position) {
      return null;
    }
    const settings = await fileManager.updateSettings({ windowPosition: position });
    await onSettingsChanged(settings);
    return position;
  });
  handle(IPC.ACKNOWLEDGE_NOTIFICATION, (_event, notificationId) => {
    if (typeof notificationId !== 'string' || notificationId.length > 100) {
      throw new Error('通知IDが不正です。');
    }
    return scheduler.acknowledge(notificationId);
  });
  handle(IPC.GET_ACTIVE_NOTIFICATION, () => scheduler.getActive());
  handle(IPC.GET_BEHAVIOR_STATE, async () => {
    return behaviorController?.getCurrentBehavior() || behaviorController?.recalculate('ipc-get');
  });
  handle(IPC.RECORD_INTERACTION, async (_event, type, details = {}) => {
    if (!ALLOWED_INTERACTIONS.includes(type)) {
      throw new Error('記録できない操作種別です。');
    }
    if (details !== undefined && !isPlainObject(details)) {
      throw new Error('操作記録の内容が不正です。');
    }
    await behaviorController?.recordInteraction(type, details);
    return { ok: true };
  });
  handle(IPC.SET_FOCUS_TASK, async (_event, taskId) => {
    if (!validTaskId(taskId)) {
      throw new Error('タスクIDが不正です。');
    }
    return behaviorController?.setFocusTask(taskId);
  });
  handle(IPC.CLEAR_FOCUS_TASK, async () => behaviorController?.clearFocusTask());
  handle(IPC.RESET_LIFE_STATE, async () => behaviorController?.resetLifeState());
  handle(IPC.GET_PROJECT_STATE, () => fileManager.getProjectStateResult());
  handle(IPC.CREATE_PROJECT_CATEGORY, async (_event, categoryInput) => {
    if (!isPlainObject(categoryInput)) {
      throw new Error('分野情報が不正です。');
    }
    const category = await fileManager.createProjectCategory(categoryInput);
    await emitProjectsUpdated();
    return category;
  });
  handle(IPC.UPDATE_PROJECT_CATEGORY, async (_event, categoryId, categoryInput) => {
    if (!validTaskId(categoryId) || !isPlainObject(categoryInput)) {
      throw new Error('分野情報が不正です。');
    }
    const category = await fileManager.updateProjectCategory(categoryId, categoryInput);
    await emitProjectsUpdated();
    return category;
  });
  handle(IPC.DELETE_PROJECT_CATEGORY, async (_event, categoryId) => {
    if (!validTaskId(categoryId)) {
      throw new Error('分野IDが不正です。');
    }
    const category = await fileManager.deleteProjectCategory(categoryId);
    await emitProjectsUpdated();
    return category;
  });
  handle(IPC.CREATE_PROJECT, async (_event, projectInput) => {
    if (!isPlainObject(projectInput)) {
      throw new Error('プロジェクト情報が不正です。');
    }
    const project = await fileManager.createProject(projectInput);
    await behaviorController?.recordInteraction('project-create', { projectId: project.id });
    await behaviorController?.notifyTaskMutation('project-create');
    await emitProjectsUpdated();
    return project;
  });
  handle(IPC.UPDATE_PROJECT, async (_event, projectId, projectInput) => {
    if (!validTaskId(projectId) || !isPlainObject(projectInput)) {
      throw new Error('プロジェクト情報が不正です。');
    }
    const project = await fileManager.updateProject(projectId, projectInput);
    await behaviorController?.recordInteraction('project-update', { projectId });
    await emitProjectsUpdated();
    return project;
  });
  handle(IPC.DELETE_PROJECT, async (_event, projectId, deleteMode = 'deleteAll') => {
    if (!validTaskId(projectId)) {
      throw new Error('プロジェクトIDが不正です。');
    }
    const project = await fileManager.deleteProject(projectId, deleteMode);
    await behaviorController?.recordInteraction('project-delete', { projectId });
    await behaviorController?.notifyTaskMutation('project-delete');
    const projectState = await emitProjectsUpdated();
    windowManager.sendTasksUpdated(await fileManager.getTasksResult());
    return { project, projectState };
  });
  handle(IPC.CREATE_PROJECT_MILESTONE, async (_event, milestoneInput) => {
    if (!isPlainObject(milestoneInput)) {
      throw new Error('マイルストーン情報が不正です。');
    }
    const milestone = await fileManager.createProjectMilestone(milestoneInput);
    await emitProjectsUpdated();
    return milestone;
  });
  handle(IPC.UPDATE_PROJECT_MILESTONE, async (_event, milestoneId, milestoneInput) => {
    if (!validTaskId(milestoneId) || !isPlainObject(milestoneInput)) {
      throw new Error('マイルストーン情報が不正です。');
    }
    const milestone = await fileManager.updateProjectMilestone(milestoneId, milestoneInput);
    await emitProjectsUpdated();
    return milestone;
  });
  handle(IPC.DELETE_PROJECT_MILESTONE, async (_event, milestoneId) => {
    if (!validTaskId(milestoneId)) {
      throw new Error('マイルストーンIDが不正です。');
    }
    const milestone = await fileManager.deleteProjectMilestone(milestoneId);
    await emitProjectsUpdated();
    return milestone;
  });
  handle(IPC.CREATE_PROJECT_TASK, async (_event, taskInput) => {
    if (!isPlainObject(taskInput)) {
      throw new Error('プロジェクトタスク情報が不正です。');
    }
    const task = await fileManager.createProjectTask(taskInput);
    await behaviorController?.recordInteraction('project-task-create', { taskId: task.id });
    await behaviorController?.notifyTaskMutation('project-task-create');
    await emitProjectsUpdated();
    return task;
  });
  handle(IPC.UPDATE_PROJECT_TASK, async (_event, taskId, taskInput) => {
    if (!validTaskId(taskId) || !isPlainObject(taskInput)) {
      throw new Error('プロジェクトタスク情報が不正です。');
    }
    const task = await fileManager.updateProjectTask(taskId, taskInput);
    await behaviorController?.recordInteraction('project-task-update', { taskId });
    await emitProjectsUpdated();
    windowManager.sendTasksUpdated(await fileManager.getTasksResult());
    return task;
  });
  handle(IPC.DELETE_PROJECT_TASK, async (_event, taskId) => {
    if (!validTaskId(taskId)) {
      throw new Error('プロジェクトタスクIDが不正です。');
    }
    const task = await fileManager.deleteProjectTask(taskId);
    await behaviorController?.notifyTaskMutation('project-task-delete');
    await emitProjectsUpdated();
    windowManager.sendTasksUpdated(await fileManager.getTasksResult());
    return task;
  });
  handle(IPC.COMPLETE_PROJECT_TASK, async (_event, taskId, completed = true) => {
    if (!validTaskId(taskId)) {
      throw new Error('プロジェクトタスクIDが不正です。');
    }
    const task = await fileManager.completeProjectTask(taskId, completed !== false);
    await behaviorController?.recordInteraction('project-task-complete', { taskId });
    await behaviorController?.notifyTaskMutation('project-task-complete');
    await emitProjectsUpdated();
    windowManager.sendTasksUpdated(await fileManager.getTasksResult());
    return task;
  });
  handle(IPC.ADD_PROJECT_TASK_TO_TODAY, async (_event, taskId, scheduledDate = null) => {
    if (!validTaskId(taskId)) {
      throw new Error('プロジェクトタスクIDが不正です。');
    }
    const result = await fileManager.addProjectTaskToToday(taskId, scheduledDate);
    await behaviorController?.notifyTaskMutation('project-task-linked');
    await emitProjectsUpdated();
    windowManager.sendTasksUpdated(await fileManager.getTasksResult());
    return result;
  });
  handle(IPC.GET_GOOGLE_CALENDAR_STATUS, () => googleCalendarService.status());
  handle(IPC.CONNECT_GOOGLE_CALENDAR, () => googleCalendarService.connect());
  handle(IPC.SAVE_GOOGLE_CALENDAR_PROVIDER_AUTH, async (_event, providerAuth) => {
    if (!isPlainObject(providerAuth)) {
      throw new Error('Googleアカウントのカレンダー権限情報が正しくありません。');
    }
    return googleCalendarService.connectWithProviderAuth(providerAuth);
  });
  handle(IPC.DISCONNECT_GOOGLE_CALENDAR, () => googleCalendarService.disconnect());
  handle(IPC.SYNC_GOOGLE_CALENDAR, () => googleCalendarService.syncToday({ force: true }));
  handle(IPC.UPDATE_GOOGLE_CALENDAR_SETTINGS, async (_event, partialSettings) => {
    if (!isPlainObject(partialSettings)) {
      throw new Error('Googleカレンダー設定が正しくありません。');
    }
    return googleCalendarService.updateSettings(partialSettings);
  });
  handle(IPC.CREATE_TASK_FROM_GOOGLE_EVENT, async (_event, eventKey) => {
    if (typeof eventKey !== 'string' || eventKey.length > 500) {
      throw new Error('Googleカレンダー予定IDが正しくありません。');
    }
    const result = await googleCalendarService.createTaskFromEvent(eventKey);
    windowManager.sendTasksUpdated({ tasks: result.tasks, error: null });
    windowManager.sendGoogleCalendarUpdated(result.status);
    await behaviorController?.recordInteraction('task-create', { taskId: result.task.id });
    await behaviorController?.notifyTaskMutation('google-calendar-task-create');
    await scheduler.checkNow();
    return result;
  });
  handle(IPC.START_SUPABASE_OAUTH_CALLBACK, () =>
    oauthCallbackBridge.start({ provider: 'supabase' })
  );
  handle(IPC.CANCEL_SUPABASE_OAUTH_CALLBACK, async (_event, callbackId) => {
    if (typeof callbackId !== 'string' || callbackId.length > 200) {
      throw new Error('OAuth認証IDが正しくありません。');
    }
    oauthCallbackBridge.cancel(callbackId);
    return { ok: true };
  });
  handle(IPC.VALIDATE_SUPABASE_OAUTH_URL, async (_event, url) => {
    if (typeof url !== 'string' || !url.startsWith('https://')) {
      throw new Error('GoogleログインURLが正しくありません。');
    }
    const response = await fetch(url, { redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      return { ok: true };
    }
    const text = await response.text().catch(() => '');
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { msg: text };
    }
    const message = String(payload?.msg || payload?.message || payload?.error || '');
    const errorCode = String(payload?.error_code || payload?.code || '');
    if (
      message.includes('Unsupported provider') ||
      message.includes('provider is not enabled')
    ) {
      throw new Error(
        'SupabaseでGoogleログインがまだ有効化されていません。Authentication > Providers > GoogleでGoogleを有効にし、Google OAuth client ID / secret とRedirect URLを設定してください。'
      );
    }
    if (errorCode === 'validation_failed' && message) {
      throw new Error(`Supabase OAuth設定を確認してください: ${message}`);
    }
    throw new Error(message || 'Googleログインを開始できませんでした。SupabaseのOAuth設定を確認してください。');
  });
  handle(IPC.OPEN_EXTERNAL_URL, async (_event, url) => {
    if (typeof url !== 'string' || !/^https:\/\/|^http:\/\/127\.0\.0\.1/.test(url)) {
      throw new Error('開けないURLです。');
    }
    await shell.openExternal(url);
    return { ok: true };
  });

  on(IPC.SET_CLICK_THROUGH, (_event, enabled) => {
    if (typeof enabled === 'boolean') {
      windowManager.setClickThrough(enabled);
    }
  });
  on(IPC.BEGIN_WINDOW_DRAG, (_event, point) => {
    if (validPoint(point)) {
      windowManager.beginDrag(point);
      behaviorController?.recordInteraction('character-drag').catch((error) => {
        console.error('ドラッグ開始の記録に失敗しました。', error);
      });
    }
  });
  on(IPC.MOVE_WINDOW_DRAG, (_event, point) => {
    if (validPoint(point)) {
      windowManager.moveDrag(point);
    }
  });
  on(IPC.RESIZE_MAIN_WINDOW, (_event, size) => {
    if (
      isPlainObject(size) &&
      Number.isFinite(size.width) &&
      Number.isFinite(size.height)
    ) {
      windowManager.resizeMainWindow(size);
    }
  });
  on(IPC.OPEN_SETTINGS, actions.openSettings);
  on(IPC.HIDE_MAIN_WINDOW, actions.hide);
  on(IPC.SHOW_MAIN_WINDOW, actions.show);
  on(IPC.SHOW_CHARACTER_MENU, () => windowManager.showCharacterMenu(actions));

  return () => {
    for (const channel of handledChannels) {
      ipcMain.removeHandler(channel);
    }
    for (const [channel, listener] of listenerChannels) {
      ipcMain.removeListener(channel, listener);
    }
  };
}

module.exports = { registerIpcHandlers };
