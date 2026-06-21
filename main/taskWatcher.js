function createTaskWatcher({ fileManager, onTasksChanged, onSettingsChanged, onProjectsChanged }) {
  let watcher = null;
  const debounceTimers = new Map();

  function debounce(key, callback) {
    clearTimeout(debounceTimers.get(key));
    debounceTimers.set(
      key,
      setTimeout(async () => {
        debounceTimers.delete(key);
        try {
          await callback();
        } catch (error) {
          console.error(`${key}の再読み込みに失敗しました。`, error);
        }
      }, 250)
    );
  }

  async function reloadTasks() {
    // 保存直後の一時的な書き込み途中を避けるため、少し待ってから読み直します。
    await new Promise((resolve) => setTimeout(resolve, 80));
    const result = await fileManager.getTasksResult();
    onTasksChanged(result);
    return result;
  }

  async function reloadSettings() {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const settings = await fileManager.getSettings();
    await onSettingsChanged(settings);
    return settings;
  }

  async function reloadProjects() {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const result = await fileManager.getProjectStateResult();
    onProjectsChanged?.(result);
    return result;
  }

  async function start() {
    // chokidar 5はES Moduleのため、CommonJSのmain processから動的に読み込みます。
    const { default: chokidar } = await import('chokidar');
    watcher = chokidar.watch(
      [
        fileManager.paths.tasksFile,
        fileManager.paths.settingsFile,
        fileManager.paths.projectCategoriesFile,
        fileManager.paths.projectsFile,
        fileManager.paths.milestonesFile,
        fileManager.paths.projectTasksFile
      ],
      {
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 150,
          pollInterval: 50
        }
      }
    );
    watcher.on('all', (_eventName, changedPath) => {
      if (changedPath === fileManager.paths.tasksFile) {
        debounce('tasks.json', reloadTasks);
      } else if (changedPath === fileManager.paths.settingsFile) {
        debounce('settings.json', reloadSettings);
      } else if (
        [
          fileManager.paths.projectCategoriesFile,
          fileManager.paths.projectsFile,
          fileManager.paths.milestonesFile,
          fileManager.paths.projectTasksFile
        ].includes(changedPath)
      ) {
        debounce('project-json', reloadProjects);
      }
    });
    watcher.on('error', (error) => {
      console.error('JSONファイル監視でエラーが発生しました。', error);
    });
  }

  function stop() {
    for (const timer of debounceTimers.values()) {
      clearTimeout(timer);
    }
    debounceTimers.clear();
    if (watcher) {
      watcher.close().catch((error) => {
        console.error('ファイル監視の終了に失敗しました。', error);
      });
      watcher = null;
    }
  }

  return {
    start,
    stop,
    reloadTasks,
    reloadProjects
  };
}

module.exports = { createTaskWatcher };
