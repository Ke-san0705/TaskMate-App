function createInboxSync({ fetchPage, importItem, acknowledge, isCurrent, onImported }) {
  let inFlight = null;
  function sync(userId) {
    if (inFlight) return inFlight;
    inFlight = run(userId).finally(() => { inFlight = null; });
    return inFlight;
  }
  async function run(userId) {
    let cursor = null, created = 0, rejected = 0, truncated = false;
    try {
      for (let page = 0; page < 20 && isCurrent(userId); page++) {
        const response = await fetchPage(userId, cursor);
        if (!isCurrent(userId)) break;
        if (!Array.isArray(response?.items) || response.items.length > 50) throw new Error('受信箱の応答が正しくありません。');
        const ids = [];
        for (const item of response.items) {
          if (!isCurrent(userId)) break;
          try {
            const saved = await importItem(userId, item, () => isCurrent(userId));
            if (saved.created) created++;
            ids.push(item.id);
          } catch (error) {
            if (!isCurrent(userId)) break;
            if (error.name !== 'TaskValidationError') throw error;
            rejected++;
          }
        }
        if (!isCurrent(userId)) break;
        if (ids.length) await acknowledge(userId, ids);
        if (!response.nextCursor) break;
        if (response.nextCursor === cursor) throw new Error('受信箱のページ情報が正しくありません。');
        cursor = response.nextCursor;
        truncated = page === 19;
      }
      return { created, rejected, truncated };
    } finally {
      if (created && isCurrent(userId)) await onImported(created);
    }
  }
  return sync;
}
module.exports = { createInboxSync };
