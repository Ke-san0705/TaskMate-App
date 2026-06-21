const path = require('path');
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  powerMonitor,
  screen,
  Tray
} = require('electron');

const { createFileManager } = require('./main/fileManager');
const { createBehaviorController } = require('./main/behaviorController');
const { registerIpcHandlers } = require('./main/ipcHandlers');
const { createLifeStateManager } = require('./main/lifeStateManager');
const { createNotificationScheduler } = require('./main/notificationScheduler');
const { createTaskWatcher } = require('./main/taskWatcher');
const { createTrayManager } = require('./main/trayManager');
const { createWindowManager } = require('./main/windowManager');

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  let isQuitting = false;
  let fileManager;
  let windowManager;
  let scheduler;
  let watcher;
  let trayManager;
  let lifeStateManager;
  let behaviorController;
  let unregisterIpc;
  let resumeHandler;
  const activeNativeNotifications = new Set();

  function nativeNotificationText(notification) {
    if (notification.source === 'project') {
      const details = [notification.genre, notification.date].filter(Boolean).join(' / ');
      return {
        title: `TaskMate: ${notification.title}`,
        body: [notification.message, details].filter(Boolean).join('\n')
      };
    }
    const timing =
      notification.minutes > 0
        ? `締切まであと${notification.minutes}分`
        : '締切時刻になりました';
    const details = [notification.time, notification.genre].filter(Boolean).join(' / ');
    return {
      title: `TaskMate: ${notification.title}`,
      body: details ? `${timing}\n${details}` : timing
    };
  }

  function nativeNotificationId(notification) {
    const source = String(notification.id || notification.signature || Date.now());
    const compact = source.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 56);
    return `tm-${compact || Date.now().toString(36)}`;
  }

  function showNativeNotification(notification, actions) {
    if (!Notification.isSupported()) {
      return;
    }
    try {
      const settingsPath = fileManager?.paths?.assetsRoot
        ? path.join(fileManager.paths.assetsRoot, 'tray-icon.png')
        : null;
      const text = nativeNotificationText(notification);
      const nativeNotification = new Notification({
        id: nativeNotificationId(notification),
        groupId: 'taskmate-tasks',
        groupTitle: 'TaskMate',
        title: text.title,
        body: text.body,
        icon: settingsPath || undefined,
        timeoutType: 'default'
      });
      activeNativeNotifications.add(nativeNotification);
      nativeNotification.on('click', () => {
        actions.showTasks().catch((error) => {
          console.error('Windows通知からTaskMateを表示できませんでした。', error);
        });
      });
      nativeNotification.on('close', () => {
        activeNativeNotifications.delete(nativeNotification);
      });
      nativeNotification.show();
    } catch (error) {
      console.error('Windows標準通知を表示できませんでした。', error);
    }
  }

  // 設定変更を各機能へ反映し、すべての画面へ通知します。
  async function applySettings(settings) {
    windowManager?.sendSettingsUpdated(settings);
    trayManager?.rebuild();

    if (process.platform === 'win32') {
      const loginSettings = {
        openAtLogin: settings.autoStart,
        path: process.execPath
      };
      if (!app.isPackaged) {
        loginSettings.args = [app.getAppPath()];
      }
      app.setLoginItemSettings(loginSettings);
    }
  }

  async function applySettingsAndRecalculate(settings) {
    await applySettings(settings);
    await behaviorController?.recordInteraction('settings-change');
    await behaviorController?.notifyTaskMutation('settings-change');
  }

  async function setMainVisibility(visible) {
    if (visible) {
      windowManager.showMainWindow();
    } else {
      windowManager.hideMainWindow();
    }
    const settings = await fileManager.updateSettings({ isMainWindowVisible: visible });
    await applySettings(settings);
  }

  async function setCharacterVisibility(visible) {
    const settings = await fileManager.updateSettings({
      showCharacter: visible,
      ...(visible ? {} : { isMainWindowVisible: true })
    });
    await applySettings(settings);
    if (!visible) {
      windowManager.showTaskList();
    }
  }

  async function startApplication() {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.taskmate.desktop');
    }

    fileManager = createFileManager(app);
    await fileManager.ensureInitialFiles();
    const settings = await fileManager.getSettings();
    lifeStateManager = createLifeStateManager({ fileManager });
    await lifeStateManager.load();
    const launchResult =
      settings.relationshipMemoryEnabled === false
        ? { reconnectEvent: null, gapDays: null }
        : await lifeStateManager.registerApplicationLaunch();

    windowManager = createWindowManager({
      BrowserWindow,
      Menu,
      app,
      screen,
      preloadPath: path.join(__dirname, 'preload.js'),
      onMainWindowClose: () => {
        if (!isQuitting) {
          setMainVisibility(false).catch((error) => {
            console.error('ウィンドウの非表示状態を保存できませんでした。', error);
          });
        }
      }
    });
    await windowManager.createMainWindow(settings);

    behaviorController = createBehaviorController({
      fileManager,
      lifeStateManager,
      windowManager
    });

    scheduler = createNotificationScheduler({
      fileManager,
      onNotification: async (notification) => {
        const wasHidden = !windowManager.isMainWindowVisible();
        scheduler.setRestoreHiddenAfterQueue(wasHidden);
        await behaviorController.setNotification(notification);
        windowManager.showNotification(notification);
        const currentSettings = await fileManager.getSettings();
        if (currentSettings.useNativeNotifications) {
          showNativeNotification(notification, actions);
        }
      },
      onQueueEmpty: () => {
        windowManager.clearNotification();
        behaviorController.setNotification(null).catch((error) => {
          console.error('通知終了後のふるまい更新に失敗しました。', error);
        });
        if (scheduler.shouldRestoreHiddenAfterQueue()) {
          windowManager.hideMainWindow();
        }
      }
    });

    const actions = {
      show: () => setMainVisibility(true),
      hide: () => setMainVisibility(false),
      showTasks: async () => {
        await setMainVisibility(true);
        windowManager.showTaskList();
      },
      reloadTasks: () => watcher?.reloadProjects(),
      openSettings: () => windowManager.openSettingsWindow(),
      toggleAutoStart: async () => {
        const current = await fileManager.getSettings();
        const next = await fileManager.updateSettings({ autoStart: !current.autoStart });
        await applySettings(next);
      },
      toggleNativeNotifications: async () => {
        const current = await fileManager.getSettings();
        const next = await fileManager.updateSettings({
          useNativeNotifications: !current.useNativeNotifications
        });
        await applySettings(next);
      },
      toggleCharacter: async () => {
        const current = await fileManager.getSettings();
        await setCharacterVisibility(current.showCharacter === false);
      },
      hideCharacter: () => setCharacterVisibility(false),
      quit: () => {
        isQuitting = true;
        app.quit();
      }
    };

    trayManager = createTrayManager({
      Tray,
      Menu,
      nativeImage,
      fileManager,
      actions
    });
    await trayManager.create();

    unregisterIpc = registerIpcHandlers({
      app,
      ipcMain,
      fileManager,
      windowManager,
      scheduler,
      behaviorController,
      actions,
      onSettingsChanged: applySettingsAndRecalculate
    });

    watcher = createTaskWatcher({
      fileManager,
      onTasksChanged: (result) => {
        windowManager.sendTasksUpdated(result);
        behaviorController.notifyTaskMutation('tasks-changed').catch((error) => {
          console.error('タスク更新後のふるまい再計算に失敗しました。', error);
        });
        scheduler.checkNow().catch((error) => {
          console.error('タスク更新後の通知確認に失敗しました。', error);
        });
      },
      onSettingsChanged: async (nextSettings) => {
        await applySettingsAndRecalculate(nextSettings);
      },
      onProjectsChanged: async (result) => {
        windowManager.sendProjectsUpdated(result);
        await behaviorController.notifyTaskMutation('projects-changed');
        await scheduler.checkNow();
      }
    });
    await watcher.start();

    await applySettings(settings);
    scheduler.start();
    await behaviorController.start(
      launchResult.reconnectEvent
        ? {
            reconnectEvent: launchResult.reconnectEvent,
            gapDays: launchResult.gapDays
          }
        : null
    );
    resumeHandler = () => {
      scheduler.checkNow();
      behaviorController.recalculate('power-resume').catch((error) => {
        console.error('スリープ復帰後のふるまい再計算に失敗しました。', error);
      });
    };
    powerMonitor.on('resume', resumeHandler);

    if (!settings.isMainWindowVisible) {
      windowManager.hideMainWindow();
    }
  }

  app.whenReady().then(startApplication).catch((error) => {
    console.error('TaskMateの起動に失敗しました。', error);
    app.quit();
  });

  app.on('second-instance', () => {
    windowManager?.showMainWindow();
  });

  app.on('activate', () => {
    windowManager?.showMainWindow();
  });

  app.on('before-quit', () => {
    isQuitting = true;
    windowManager?.setQuitting(true);
    scheduler?.stop();
    behaviorController?.stop();
    watcher?.stop();
    trayManager?.destroy();
    for (const notification of activeNativeNotifications) {
      notification.close();
    }
    activeNativeNotifications.clear();
    unregisterIpc?.();
    if (resumeHandler) {
      powerMonitor.removeListener('resume', resumeHandler);
    }
  });

  // Windowsではトレイ常駐を続けるため、全ウィンドウが閉じても終了しません。
  app.on('window-all-closed', () => {});
}
