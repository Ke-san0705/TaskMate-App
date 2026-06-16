const { IPC } = require('./constants');

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
  windowManager,
  scheduler,
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

  handle(IPC.GET_TASKS, () => fileManager.getTasksResult());
  handle(IPC.ADD_TASK, async (_event, taskInput) => {
    if (!isPlainObject(taskInput)) {
      throw new Error('タスク情報が不正です。');
    }
    const result = await fileManager.addTask(taskInput);
    windowManager.sendTasksUpdated({ tasks: result.tasks, error: null });
    await scheduler.checkNow();
    return result.task;
  });
  handle(IPC.UPDATE_TASK, async (_event, taskId, taskInput) => {
    if (!validTaskId(taskId) || !isPlainObject(taskInput)) {
      throw new Error('タスク情報が不正です。');
    }
    const result = await fileManager.updateTask(taskId, taskInput);
    windowManager.sendTasksUpdated({ tasks: result.tasks, error: null });
    await scheduler.checkNow();
    return result.task;
  });
  handle(IPC.DELETE_TASK, async (_event, taskId) => {
    if (!validTaskId(taskId)) {
      throw new Error('タスクIDが不正です。');
    }
    const result = await fileManager.deleteTask(taskId);
    windowManager.sendTasksUpdated({ tasks: result.tasks, error: null });
    return result.task;
  });
  handle(IPC.COMPLETE_TASK, async (_event, taskId) => {
    if (!validTaskId(taskId)) {
      throw new Error('タスクIDが不正です。');
    }
    const result = await fileManager.setTaskCompleted(taskId, true);
    windowManager.sendTasksUpdated({ tasks: result.tasks, error: null });
    return result.task;
  });
  handle(IPC.UNDO_COMPLETE_TASK, async (_event, taskId) => {
    if (!validTaskId(taskId)) {
      throw new Error('タスクIDが不正です。');
    }
    const result = await fileManager.setTaskCompleted(taskId, false);
    windowManager.sendTasksUpdated({ tasks: result.tasks, error: null });
    return result.task;
  });
  handle(IPC.RELOAD_TASKS, async () => {
    const result = await fileManager.getTasksResult();
    windowManager.sendTasksUpdated(result);
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

  on(IPC.SET_CLICK_THROUGH, (_event, enabled) => {
    if (typeof enabled === 'boolean') {
      windowManager.setClickThrough(enabled);
    }
  });
  on(IPC.BEGIN_WINDOW_DRAG, (_event, point) => {
    if (validPoint(point)) {
      windowManager.beginDrag(point);
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
