const path = require('path');
const { IPC } = require('./constants');

const MAIN_MIN_WIDTH = 300;
const MAIN_MIN_HEIGHT = 180;
const MAIN_MAX_WIDTH = 1400;
const MAIN_MAX_HEIGHT = 1000;

function createWindowManager({
  BrowserWindow,
  Menu,
  app,
  screen,
  preloadPath,
  onMainWindowClose
}) {
  let mainWindow = null;
  let settingsWindow = null;
  let isQuitting = false;
  let dragState = null;
  let notificationOnly = false;

  function rendererLocation(view) {
    const devServer = process.env.VITE_DEV_SERVER_URL;
    if (devServer) {
      const url = new URL(devServer);
      if (view) {
        url.searchParams.set('view', view);
      }
      return { type: 'url', value: url.toString() };
    }
    return {
      type: 'file',
      value: path.join(app.getAppPath(), 'dist', 'index.html'),
      options: view ? { query: { view } } : undefined
    };
  }

  async function loadRenderer(window, view) {
    const location = rendererLocation(view);
    if (location.type === 'url') {
      await window.loadURL(location.value);
    } else {
      await window.loadFile(location.value, location.options);
    }
  }

  function primaryWorkArea() {
    return screen.getPrimaryDisplay().workArea;
  }

  function clampPosition(x, y, width, height) {
    const area = primaryWorkArea();
    return {
      x: Math.min(Math.max(Math.round(x), area.x), area.x + area.width - width),
      y: Math.min(Math.max(Math.round(y), area.y), area.y + area.height - height)
    };
  }

  function defaultPosition(width, height) {
    const area = primaryWorkArea();
    return {
      x: area.x + 20,
      y: area.y + area.height - height - 20
    };
  }

  async function createMainWindow(settings) {
    const width = 520;
    const height = 280;
    const requested =
      Number.isFinite(settings.windowPosition.x) && Number.isFinite(settings.windowPosition.y)
        ? settings.windowPosition
        : defaultPosition(width, height);
    const position = clampPosition(requested.x, requested.y, width, height);

    mainWindow = new BrowserWindow({
      width,
      height,
      x: position.x,
      y: position.y,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      alwaysOnTop: true,
      hasShadow: false,
      skipTaskbar: true,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    mainWindow.setAlwaysOnTop(true, 'floating');

    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault();
        mainWindow.hide();
        onMainWindowClose?.();
      }
    });
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
    mainWindow.once('ready-to-show', () => {
      if (settings.isMainWindowVisible) {
        mainWindow.showInactive();
      }
    });

    await loadRenderer(mainWindow);
  }

  async function openSettingsWindow() {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.show();
      settingsWindow.focus();
      return;
    }
    settingsWindow = new BrowserWindow({
      width: 540,
      height: 720,
      minWidth: 460,
      minHeight: 600,
      title: 'TaskMate 設定',
      backgroundColor: '#f7f3ea',
      autoHideMenuBar: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    settingsWindow.on('closed', () => {
      settingsWindow = null;
    });
    await loadRenderer(settingsWindow, 'settings');
    settingsWindow.show();
  }

  function sendToMain(channel, payload) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  }

  function broadcast(channel, payload) {
    for (const window of [mainWindow, settingsWindow]) {
      if (window && !window.isDestroyed()) {
        window.webContents.send(channel, payload);
      }
    }
  }

  function showMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    notificationOnly = false;
    mainWindow.showInactive();
    mainWindow.setAlwaysOnTop(true, 'floating');
  }

  function hideMainWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
  }

  function showTaskList() {
    showMainWindow();
    sendToMain(IPC.SHOW_TASK_LIST, true);
  }

  function showNotification(notification) {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    notificationOnly = !mainWindow.isVisible();
    mainWindow.showInactive();
    mainWindow.setAlwaysOnTop(true, 'floating');
    sendToMain(IPC.NOTIFICATION, { ...notification, notificationOnly });
  }

  function clearNotification() {
    sendToMain(IPC.NOTIFICATION_CLEARED, null);
    notificationOnly = false;
  }

  function resizeMainWindow(size) {
    if (!mainWindow || mainWindow.isDestroyed() || !size || typeof size !== 'object') {
      return;
    }
    const area = primaryWorkArea();
    const width = Math.min(
      MAIN_MAX_WIDTH,
      area.width,
      Math.max(MAIN_MIN_WIDTH, Math.round(size.width))
    );
    const height = Math.min(
      MAIN_MAX_HEIGHT,
      area.height,
      Math.max(MAIN_MIN_HEIGHT, Math.round(size.height))
    );
    const oldBounds = mainWindow.getBounds();
    mainWindow.setSize(width, height, false);
    const anchoredY = oldBounds.y + oldBounds.height - height;
    const position = clampPosition(oldBounds.x, anchoredY, width, height);
    mainWindow.setPosition(position.x, position.y, false);
  }

  function resetMainWindowPosition() {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return null;
    }
    const bounds = mainWindow.getBounds();
    const position = defaultPosition(bounds.width, bounds.height);
    mainWindow.setPosition(position.x, position.y, false);
    return position;
  }

  function setClickThrough(enabled) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIgnoreMouseEvents(enabled, enabled ? { forward: true } : undefined);
    }
  }

  function beginDrag(point) {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    const bounds = mainWindow.getBounds();
    dragState = {
      startX: point.x,
      startY: point.y,
      windowX: bounds.x,
      windowY: bounds.y
    };
    setClickThrough(false);
  }

  function moveDrag(point) {
    if (!dragState || !mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    const bounds = mainWindow.getBounds();
    const next = clampPosition(
      dragState.windowX + point.x - dragState.startX,
      dragState.windowY + point.y - dragState.startY,
      bounds.width,
      bounds.height
    );
    mainWindow.setPosition(next.x, next.y, false);
  }

  function endDrag() {
    if (!mainWindow || mainWindow.isDestroyed()) {
      dragState = null;
      return null;
    }
    dragState = null;
    const [x, y] = mainWindow.getPosition();
    return { x, y };
  }

  function showCharacterMenu(actions) {
    const menu = Menu.buildFromTemplate([
      { label: '今日のタスクを表示', click: actions.showTasks },
      { label: 'キャラクターを非表示', click: actions.hideCharacter },
      { label: '設定', click: actions.openSettings },
      { type: 'separator' },
      { label: '非表示', click: actions.hide },
      { label: '終了', click: actions.quit }
    ]);
    menu.popup({ window: mainWindow });
  }

  function isKnownSender(webContents) {
    return [mainWindow, settingsWindow].some(
      (window) => window && !window.isDestroyed() && window.webContents === webContents
    );
  }

  return {
    createMainWindow,
    openSettingsWindow,
    showMainWindow,
    hideMainWindow,
    showTaskList,
    showNotification,
    clearNotification,
    resizeMainWindow,
    resetMainWindowPosition,
    setClickThrough,
    beginDrag,
    moveDrag,
    endDrag,
    showCharacterMenu,
    sendTasksUpdated: (result) => broadcast(IPC.TASKS_UPDATED, result),
    sendSettingsUpdated: (settings) => broadcast(IPC.SETTINGS_UPDATED, settings),
    isMainWindowVisible: () => Boolean(mainWindow?.isVisible()),
    isKnownSender,
    setQuitting: (value) => {
      isQuitting = value;
    }
  };
}

module.exports = { createWindowManager };
