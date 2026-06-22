const path = require('path');

function createPathResolver(app) {
  const resourceRoot = app.isPackaged ? process.resourcesPath : app.getAppPath();
  // Packaged Windows apps may be installed under Program Files, where normal users
  // cannot safely write. Keep user-edited JSON under Electron's userData directory.
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
    notificationStateFile: path.join(writableDataRoot, 'notification-state.json'),
    lifeStateFile: path.join(writableDataRoot, 'life-state.json'),
    projectCategoriesFile: path.join(writableDataRoot, 'categories.json'),
    projectsFile: path.join(writableDataRoot, 'projects.json'),
    milestonesFile: path.join(writableDataRoot, 'milestones.json'),
    projectTasksFile: path.join(writableDataRoot, 'projectTasks.json')
  };
}

module.exports = { createPathResolver };
