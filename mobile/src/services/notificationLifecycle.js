function createNotificationLifecycle({ reconcile, cancelAll }) {
  let tail = Promise.resolve();
  function enqueue(operation) {
    const pending = tail.then(operation);
    tail = pending.catch(() => {});
    return pending;
  }
  return {
    reconcile: (...args) => enqueue(() => reconcile(...args)),
    cancelAll: () => enqueue(cancelAll)
  };
}
module.exports = { createNotificationLifecycle };
