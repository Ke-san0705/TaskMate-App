// Freeze immediately on reset, drain earlier mutations (including Auth's own
// persistence), then keep new mutations out until the entire SQLite reset ends.
function createMutationBarrier(onFreeze = () => {}) {
  let tail = Promise.resolve(), generation = 0, frozen = false, resetting = null;
  return {
    get frozen() { return frozen; },
    run(operation) {
      if (frozen) return Promise.resolve();
      const version = generation;
      const current = () => !frozen && generation === version;
      const pending = tail.then(() => current() ? operation(current) : undefined);
      tail = pending.catch(() => {});
      return pending;
    },
    reset(operation) {
      if (resetting) return resetting;
      frozen = true; generation++; onFreeze();
      resetting = tail.then(operation).finally(() => { frozen = false; resetting = null; });
      tail = resetting.catch(() => {});
      return resetting;
    }
  };
}
async function clearLocalInboxSession(auth, storage, key) {
  if (!auth) return;
  // GoTrue can remove the local session and still report a server revocation
  // error offline. Only failure to erase local credentials blocks local reset.
  try { await auth.signOut({ scope: 'local' }); } catch { /* verify actual storage below */ }
  if (await storage.getItem(key) !== null || await storage.getItem(`${key}-user`) !== null) {
    throw new Error('ログイン状態を端末から削除できませんでした。もう一度お試しください。');
  }
}
function canFetchInbox(state, automatic) {
  return state.configured && state.ready && !!state.userId && !state.resetting && (!automatic || state.enabled);
}
module.exports = { createMutationBarrier, clearLocalInboxSession, canFetchInbox };
