const { createBehaviorState } = require('../behavior/characterBehaviorEngine');
const { localDateKey } = require('../behavior/taskPressureEngine');

const RECALCULATE_INTERVAL_MS = 25_000;

function createBehaviorController({ fileManager, lifeStateManager, windowManager }) {
  let timer = null;
  let stopped = true;
  let calculating = false;
  let queuedReason = null;
  let currentBehavior = null;
  let activeNotification = null;
  let lastDateKey = localDateKey();

  function behaviorSignature(behavior) {
    if (!behavior) {
      return '';
    }
    return JSON.stringify({
      mood: behavior.mood,
      action: behavior.action,
      dialogueCategory: behavior.dialogueCategory,
      dialogueVariables: behavior.dialogueVariables,
      targetTaskId: behavior.targetTaskId,
      focusTaskId: behavior.focusTaskId,
      focusTask: behavior.focusTask,
      ambientLevel: behavior.ambientLevel,
      movement: behavior.movement,
      reason: behavior.reason,
      pressure: {
        score: behavior.pressure?.score,
        level: behavior.pressure?.level,
        dominantTaskId: behavior.pressure?.dominantTaskId,
        counts: behavior.pressure?.counts
      }
    });
  }

  function sameBehavior(left, right) {
    return behaviorSignature(left) === behaviorSignature(right);
  }

  async function loadInputs() {
    const [tasksResult, settings] = await Promise.all([
      fileManager.getTasksResult(),
      fileManager.getSettings()
    ]);
    return {
      tasks: tasksResult.tasks || [],
      taskError: tasksResult.error,
      settings
    };
  }

  async function shouldRememberRelationship() {
    try {
      const settings = await fileManager.getSettings();
      return settings.relationshipMemoryEnabled !== false;
    } catch {
      return true;
    }
  }

  async function ensureFocusStillExists(tasks) {
    const lifeState = lifeStateManager.current();
    if (!lifeState.focusTaskId) {
      return lifeState;
    }
    const focusTask = tasks.find(
      (task) => task.id === lifeState.focusTaskId && task.completed !== true
    );
    if (focusTask) {
      return lifeState;
    }
    console.info('[TaskMate:Behavior] focus task cleared because target is gone');
    return lifeStateManager.clearFocus();
  }

  async function rememberDisplayedAction(behavior) {
    if (!behavior || behavior.action === 'idle') {
      return;
    }
    if (behavior.reason === 'level-cooldown' || behavior.reason === 'quiet-hours') {
      return;
    }
    await lifeStateManager.rememberAction(behavior.action, behavior.dialogueCategory);
    if (behavior.movement) {
      await lifeStateManager.rememberAction(`move:${behavior.action}`, null);
    }
  }

  async function recalculate(reason = 'manual', event = null) {
    if (stopped) {
      return currentBehavior;
    }
    if (calculating) {
      queuedReason = reason;
      return currentBehavior;
    }
    calculating = true;
    try {
      const now = new Date();
      const today = localDateKey(now);
      if (today !== lastDateKey) {
        lastDateKey = today;
        await lifeStateManager.record('settings-change', { source: 'date-change' }, now);
      }

      const { tasks, taskError, settings } = await loadInputs();
      const lifeState = await ensureFocusStillExists(tasks);
      const behavior = createBehaviorState({
        tasks,
        settings,
        lifeState,
        now,
        notification: activeNotification,
        event,
        isMainVisible: windowManager.isMainWindowVisible()
      });

      if (taskError) {
        behavior.dialogueCategory = 'loadError';
        behavior.dialogueVariables = {};
        behavior.reason = 'task-load-error';
      }

      const changed = !sameBehavior(currentBehavior, behavior);
      if (changed) {
        currentBehavior = behavior;
        windowManager.sendBehaviorUpdated(behavior);
        console.info('[TaskMate:Behavior] pressure recalculated', {
          reason,
          score: behavior.pressure.score,
          level: behavior.pressure.level,
          action: behavior.action
        });
      }

      if (
        changed &&
        behavior.movement &&
        settings.autonomousMovement !== false &&
        settings.behaviorEnabled !== false &&
        !activeNotification
      ) {
        windowManager.moveAutonomously(behavior.movement);
      }

      if (changed) {
        await rememberDisplayedAction(behavior);
      }
      return behavior;
    } catch (error) {
      console.error('[TaskMate:Behavior] recalculation failed', error);
      return currentBehavior;
    } finally {
      calculating = false;
      if (queuedReason) {
        const nextReason = queuedReason;
        queuedReason = null;
        recalculate(nextReason).catch((error) => {
          console.error('[TaskMate:Behavior] queued recalculation failed', error);
        });
      }
    }
  }

  async function start(launchEvent = null) {
    stopped = false;
    stopTimer();
    await recalculate('startup', launchEvent ? { type: 'reconnect', ...launchEvent } : null);
    timer = setInterval(() => {
      recalculate('interval').catch((error) => {
        console.error('[TaskMate:Behavior] interval failed', error);
      });
    }, RECALCULATE_INTERVAL_MS);
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function stop() {
    stopped = true;
    stopTimer();
  }

  async function notifyTaskMutation(reason) {
    return recalculate(reason);
  }

  async function recordTaskCompleted(task, tasks) {
    const now = new Date();
    const rememberRelationship = await shouldRememberRelationship();
    let state = lifeStateManager.current();
    if (rememberRelationship) {
      state = await lifeStateManager.completeTask(task, now);
    }
    if (state.focusTaskId === task.id) {
      state = await lifeStateManager.clearFocus(now);
    }

    const today = localDateKey(now);
    const remainingVisible = tasks.filter(
      (candidate) => !candidate.completed && candidate.date <= today
    );
    const alreadyCelebrated = rememberRelationship && state.celebratedDates.includes(today);
    if (remainingVisible.length === 0 && !alreadyCelebrated) {
      if (rememberRelationship) {
        await lifeStateManager.markTodayCelebrated(now);
      }
      return recalculate('task-complete', { type: 'all-complete', task });
    }
    return recalculate('task-complete', { type: 'task-complete', task });
  }

  async function recordInteraction(type, details = {}) {
    if (
      !(await shouldRememberRelationship()) &&
      !['focus-start', 'focus-clear', 'settings-change'].includes(type)
    ) {
      return;
    }
    await lifeStateManager.record(type, details);
    if (type === 'task-list-open' || type === 'settings-change') {
      await recalculate(type);
    }
  }

  async function setFocusTask(taskId) {
    const { tasks } = await loadInputs();
    const task = tasks.find((candidate) => candidate.id === taskId && !candidate.completed);
    if (!task) {
      throw new Error('今やるタスクが見つかりません。');
    }
    await lifeStateManager.setFocus(taskId);
    return recalculate('focus-start');
  }

  async function clearFocusTask() {
    await lifeStateManager.clearFocus();
    return recalculate('focus-clear');
  }

  async function resetLifeState() {
    await lifeStateManager.reset();
    return recalculate('life-state-reset');
  }

  async function setNotification(notification) {
    activeNotification = notification || null;
    return recalculate(activeNotification ? 'notification-active' : 'notification-cleared');
  }

  return {
    start,
    stop,
    recalculate,
    notifyTaskMutation,
    recordTaskCompleted,
    recordInteraction,
    setFocusTask,
    clearFocusTask,
    resetLifeState,
    setNotification,
    getCurrentBehavior: () => currentBehavior
  };
}

module.exports = { createBehaviorController };
