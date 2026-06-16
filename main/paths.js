const path = require('path');

function createPathResolver(app) {
  const resourceRoot = app.isPackaged ? process.resourcesPath : app.getAppPath();
  const writableDataRoot = app.isPackaged
    ? path.join(app.getPath('userData'), 'data')
    : path.join(resourceRoot, 'data');

  return {
    resourceRoot,
    dataRoot: writableDataRoot,
    bundledDataRoot: path.join(resourceRoot, 'data'),
    charactersRoot: path.join(resourceRoot, 'Chara'),
    assetsRoot: path.join(resourceRoot, 'assets'),
    tasksFile: path.join(writableDataRoot, 'tasks.json'),
    settingsFile: path.join(writableDataRoot, 'settings.json'),
    notificationStateFile: path.join(writableDataRoot, 'notification-state.json')
  };
}

module.exports = { createPathResolver };
