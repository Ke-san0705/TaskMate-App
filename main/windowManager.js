const path = require('path');
const { IPC } = require('./constants');

const MAIN_MIN_WIDTH = 300;
const MAIN_MIN_HEIGHT = 180;
const MAIN_MAX_WIDTH = 1400;
const MAIN_MAX_HEIGHT = 1000;
const MAIN_RESIZE_EPSILON = 2;
const AUTONOMOUS_STEP_MS = 80;
const AUTONOMOUS_HOLD_MS = 2400;
const DEFAULT_VISIBLE_MARGIN = 20;

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
  let autonomousTimers = [];
  let autonomousGeneration = 0;
  let mainDragBounds = null;
  let clickThroughIgnored = false;

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

  function cursorPoint(fallback) {
    if (typeof screen.getCursorScreenPoint === 'function') {
      const point = screen.getCursorScreenPoint();
      if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) {
        return point;
      }
    }
    return fallback;
  }

  function clampNumber(value, min, max) {
    const rounded = Math.round(value);
    if (max < min) {
      return Math.round(min);
    }
    return Math.min(Math.max(rounded, min), max);
  }

  function sameBounds(left, right) {
    if (!left && !right) {
      return true;
    }
    if (!left || !right) {
      return false;
    }
    return ['x', 'y', 'width', 'height'].every(
      (key) => Math.abs(left[key] - right[key]) <= MAIN_RESIZE_EPSILON
    );
  }

  function normalizeDragBounds(value, width, height) {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const x = Math.round(value.x);
    const y = Math.round(value.y);
    const boundsWidth = Math.round(value.width);
    const boundsHeight = Math.round(value.height);
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(boundsWidth) ||
      !Number.isFinite(boundsHeight) ||
      boundsWidth <= 0 ||
      boundsHeight <= 0
    ) {
      return null;
    }

    const left = Math.min(Math.max(0, x), Math.max(0, width - 1));
    const top = Math.min(Math.max(0, y), Math.max(0, height - 1));
    const right = Math.min(width, Math.max(left + 1, x + boundsWidth));
    const bottom = Math.min(height, Math.max(top + 1, y + boundsHeight));
    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top
    };
  }

  function clampPosition(x, y, width, height, dragBounds = mainDragBounds) {
    const area = primaryWorkArea();
    if (dragBounds) {
      return {
        x: clampNumber(
          x,
          area.x - dragBounds.x,
          area.x + area.width - dragBounds.x - dragBounds.width
        ),
        y: clampNumber(
          y,
          area.y - dragBounds.y,
          area.y + area.height - dragBounds.y - dragBounds.height
        )
      };
    }
    const maxX = Math.max(area.x, area.x + area.width - width);
    const maxY = Math.max(area.y, area.y + area.height - height);
    return {
      x: clampNumber(x, area.x, maxX),
      y: clampNumber(y, area.y, maxY)
    };
  }

  function dragAnchor(bounds, dragBounds) {
    return {
      x: bounds.x + dragBounds.x,
      y: bounds.y + dragBounds.y + dragBounds.height
    };
  }

  function positionFromDragAnchor(anchor, dragBounds) {
    return {
      x: anchor.x - dragBounds.x,
      y: anchor.y - dragBounds.y - dragBounds.height
    };
  }

  function clearAutonomousTimers() {
    for (const timer of autonomousTimers) {
      clearTimeout(timer);
    }
    autonomousTimers = [];
    autonomousGeneration += 1;
  }

  function cancelAutonomousMovement(reason = 'cancelled') {
    if (autonomousTimers.length > 0) {
      console.info('[TaskMate:Window] autonomous movement cancelled', reason);
    }
    clearAutonomousTimers();
  }

  function scheduleAutonomousStep(callback, delay) {
    const timer = setTimeout(() => {
      autonomousTimers = autonomousTimers.filter((candidate) => candidate !== timer);
      callback();
    }, delay);
    autonomousTimers.push(timer);
  }

  function animatePosition(from, to, generation, onDone) {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    const steps = 4;
    for (let step = 1; step <= steps; step += 1) {
      scheduleAutonomousStep(() => {
        if (
          generation !== autonomousGeneration ||
          dragState ||
          !mainWindow ||
          mainWindow.isDestroyed()
        ) {
          return;
        }
        const progress = step / steps;
        const eased = 1 - Math.pow(1 - progress, 2);
        const nextX = Math.round(from.x + (to.x - from.x) * eased);
        const nextY = Math.round(from.y + (to.y - from.y) * eased);
        mainWindow.setPosition(nextX, nextY, false);
        if (step === steps) {
          onDone?.();
        }
      }, AUTONOMOUS_STEP_MS * step);
    }
  }

  function defaultPosition(width, height) {
    const area = primaryWorkArea();
    return {
      x: area.x + DEFAULT_VISIBLE_MARGIN,
      y: area.y + area.height - height - DEFAULT_VISIBLE_MARGIN
    };
  }

  function defaultVisiblePosition(width, height, dragBounds = mainDragBounds) {
    if (!dragBounds) {
      return defaultPosition(width, height);
    }
    const area = primaryWorkArea();
    return {
      x: area.x + DEFAULT_VISIBLE_MARGIN - dragBounds.x,
      y:
        area.y +
        area.height -
        DEFAULT_VISIBLE_MARGIN -
        dragBounds.y -
        dragBounds.height
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
      width: 1180,
      height: 820,
      minWidth: 760,
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
    setClickThrough(false);
    mainWindow.showInactive();
    mainWindow.setAlwaysOnTop(true, 'floating');
  }

  function hideMainWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) {
      setClickThrough(false);
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
    setClickThrough(false);
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
    const nextDragBounds = normalizeDragBounds(size.dragBounds, width, height);
    const sameSize =
      Math.abs(oldBounds.width - width) <= MAIN_RESIZE_EPSILON &&
      Math.abs(oldBounds.height - height) <= MAIN_RESIZE_EPSILON;
    const previousDragBounds = mainDragBounds;

    if (sameSize && sameBounds(previousDragBounds, nextDragBounds)) {
      return;
    }

    if (autonomousTimers.length > 0) {
      cancelAutonomousMovement('window-resize');
    }

    let requestedPosition = {
      x: oldBounds.x,
      y: oldBounds.y + oldBounds.height - height
    };
    if (previousDragBounds && nextDragBounds) {
      requestedPosition = positionFromDragAnchor(
        dragAnchor(oldBounds, previousDragBounds),
        nextDragBounds
      );
    }

    mainDragBounds = nextDragBounds;
    if (!sameSize) {
      mainWindow.setSize(width, height, false);
    }
    const position = clampPosition(
      requestedPosition.x,
      requestedPosition.y,
      width,
      height,
      nextDragBounds
    );
    mainWindow.setPosition(position.x, position.y, false);
  }

  function resetMainWindowPosition() {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return null;
    }
    const bounds = mainWindow.getBounds();
    const requested = defaultVisiblePosition(bounds.width, bounds.height, mainDragBounds);
    const position = clampPosition(
      requested.x,
      requested.y,
      bounds.width,
      bounds.height,
      mainDragBounds
    );
    mainWindow.setPosition(position.x, position.y, false);
    return position;
  }

  function setClickThrough(enabled) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (dragState && enabled) {
        return;
      }
      if (clickThroughIgnored === enabled) {
        return;
      }
      clickThroughIgnored = enabled;
      mainWindow.setIgnoreMouseEvents(enabled, enabled ? { forward: true } : undefined);
    }
  }

  function beginDrag(point) {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    cancelAutonomousMovement('manual-drag');
    const bounds = mainWindow.getBounds();
    const startPoint = cursorPoint(point);
    dragState = {
      startX: startPoint.x,
      startY: startPoint.y,
      windowX: bounds.x,
      windowY: bounds.y
    };
    setClickThrough(false);
  }

  function moveDrag(point) {
    if (!dragState || !mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    const cursor = cursorPoint(point);
    const bounds = mainWindow.getBounds();
    const next = clampPosition(
      dragState.windowX + cursor.x - dragState.startX,
      dragState.windowY + cursor.y - dragState.startY,
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

  function moveAutonomously(movement) {
    if (
      !mainWindow ||
      mainWindow.isDestroyed() ||
      !mainWindow.isVisible() ||
      dragState ||
      notificationOnly ||
      !movement ||
      movement.type !== 'nudge'
    ) {
      return;
    }
    const dx = Number.isFinite(movement.dx)
      ? Math.min(80, Math.max(-80, Math.round(movement.dx)))
      : 0;
    const dy = Number.isFinite(movement.dy)
      ? Math.min(60, Math.max(-60, Math.round(movement.dy)))
      : 0;
    if (dx === 0 && dy === 0) {
      return;
    }

    clearAutonomousTimers();
    const generation = autonomousGeneration;
    const bounds = mainWindow.getBounds();
    const from = { x: bounds.x, y: bounds.y };
    const target = clampPosition(bounds.x + dx, bounds.y + dy, bounds.width, bounds.height);

    // 自律移動は「現在の位置から少しだけ寄る」演出に留めます。
    // 位置は保存せず、短い保持時間のあと元のユーザー基準位置へ戻すため、
    // 手動ドラッグで決めた居場所をアプリ側が勝手に奪いません。
    animatePosition(from, target, generation, () => {
      scheduleAutonomousStep(() => {
        if (
          generation !== autonomousGeneration ||
          dragState ||
          !mainWindow ||
          mainWindow.isDestroyed()
        ) {
          return;
        }
        const current = mainWindow.getBounds();
        animatePosition(
          { x: current.x, y: current.y },
          clampPosition(from.x, from.y, current.width, current.height),
          generation
        );
      }, AUTONOMOUS_HOLD_MS);
    });
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
    moveAutonomously,
    cancelAutonomousMovement,
    showCharacterMenu,
    sendTasksUpdated: (result) => broadcast(IPC.TASKS_UPDATED, result),
    sendProjectsUpdated: (result) => broadcast(IPC.PROJECTS_UPDATED, result),
    sendSettingsUpdated: (settings) => broadcast(IPC.SETTINGS_UPDATED, settings),
    sendGoogleCalendarUpdated: (status) => broadcast(IPC.GOOGLE_CALENDAR_UPDATED, status),
    sendSupabaseOAuthCallback: (payload) => broadcast(IPC.SUPABASE_OAUTH_CALLBACK, payload),
    sendBehaviorUpdated: (behavior) => broadcast(IPC.BEHAVIOR_UPDATED, behavior),
    isMainWindowVisible: () => Boolean(mainWindow?.isVisible()),
    isKnownSender,
    setQuitting: (value) => {
      isQuitting = value;
      if (value) {
        clearAutonomousTimers();
      }
    }
  };
}

module.exports = { createWindowManager };
