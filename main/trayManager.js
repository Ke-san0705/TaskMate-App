const path = require('path');

const FALLBACK_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAVklEQVR42mNgGAWjYBSMglEwCkbBKBgFQwYGBgaG/2f4j4GB4T8DA8N/BgaG/wwMDAwM/4nRjEAFQxgYGBj+MzAw/DfQNEBTjGIAUgyjYBSMglEwCkbBKAQAAP//AwCZwA0f6iM9GAAAAABJRU5ErkJggg==';

function createTrayManager({ Tray, Menu, nativeImage, fileManager, actions }) {
  let tray = null;

  function createIcon() {
    const iconPath = path.join(fileManager.paths.assetsRoot, 'tray-icon.png');
    let icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = nativeImage.createFromDataURL(FALLBACK_ICON);
    }
    return icon.resize({ width: 16, height: 16 });
  }

  async function buildMenu() {
    const settings = await fileManager.getSettings();
    return Menu.buildFromTemplate([
      { label: 'TaskMate', enabled: false },
      { type: 'separator' },
      { label: '表示する', click: actions.show },
      { label: '非表示にする', click: actions.hide },
      { label: '今日のタスクを表示', click: actions.showTasks },
      {
        label: 'キャラクターを表示',
        type: 'checkbox',
        checked: settings.showCharacter !== false,
        click: actions.toggleCharacter
      },
      { label: 'タスクを再読み込み', click: actions.reloadTasks },
      { label: '設定', click: actions.openSettings },
      {
        label: 'Windows標準通知',
        type: 'checkbox',
        checked: settings.useNativeNotifications !== false,
        click: actions.toggleNativeNotifications
      },
      {
        label: '自動起動',
        type: 'checkbox',
        checked: settings.autoStart,
        click: actions.toggleAutoStart
      },
      { type: 'separator' },
      { label: '終了', click: actions.quit }
    ]);
  }

  async function create() {
    tray = new Tray(createIcon());
    tray.setToolTip('TaskMate');
    tray.on('click', actions.show);
    await rebuild();
  }

  async function rebuild() {
    if (!tray || tray.isDestroyed()) {
      return;
    }
    tray.setContextMenu(await buildMenu());
  }

  function destroy() {
    if (tray && !tray.isDestroyed()) {
      tray.destroy();
    }
    tray = null;
  }

  return { create, rebuild, destroy };
}

module.exports = { createTrayManager };
