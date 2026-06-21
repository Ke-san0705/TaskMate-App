const { localDateKey } = require('../behavior/taskPressureEngine');
const {
  clearFocusTask,
  markCelebrated,
  normalizeLifeState,
  recordInteraction,
  recordTaskCompletion,
  registerLaunch,
  rememberSelectedAction,
  setFocusTask
} = require('../behavior/relationshipEngine');

function createLifeStateManager({ fileManager }) {
  let state = null;
  let saving = Promise.resolve();

  async function load() {
    state = await fileManager.getLifeState();
    console.info('[TaskMate:LifeState] loaded');
    return state;
  }

  function current() {
    return normalizeLifeState(state || {});
  }

  async function save(nextState) {
    state = normalizeLifeState(nextState);
    // life-stateはタスク保存より細かく更新されます。直列化キューに乗せ、
    // 書き込み競合で最後の操作履歴が欠けることを避けます。
    saving = saving
      .catch(() => {})
      .then(() => fileManager.saveLifeState(state))
      .catch((error) => {
        console.error('[TaskMate:LifeState] save failed', error);
      });
    await saving;
    return state;
  }

  async function registerApplicationLaunch(now = new Date()) {
    const result = registerLaunch(state || (await load()), now);
    await save(result.state);
    return result;
  }

  async function record(type, details = {}, now = new Date()) {
    return save(recordInteraction(current(), type, now, details));
  }

  async function completeTask(task, now = new Date()) {
    return save(recordTaskCompletion(current(), task, now));
  }

  async function setFocus(taskId, now = new Date()) {
    return save(setFocusTask(current(), taskId, now));
  }

  async function clearFocus(now = new Date()) {
    return save(clearFocusTask(current(), now));
  }

  async function markTodayCelebrated(now = new Date()) {
    return save(markCelebrated(current(), localDateKey(now)));
  }

  async function rememberAction(actionId, dialogueCategory, now = new Date()) {
    const actionKey = actionId && dialogueCategory === 'movement' ? `move:${actionId}` : actionId;
    return save(rememberSelectedAction(current(), actionKey, dialogueCategory, now));
  }

  async function reset(now = new Date()) {
    state = normalizeLifeState(await fileManager.resetLifeState(), now);
    console.info('[TaskMate:LifeState] reset');
    return state;
  }

  return {
    load,
    current,
    registerApplicationLaunch,
    record,
    completeTask,
    setFocus,
    clearFocus,
    markTodayCelebrated,
    rememberAction,
    reset
  };
}

module.exports = { createLifeStateManager };
