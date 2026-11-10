// SecureStore values have platform-dependent size limits. Commit a small manifest
// only after all chunks are durable, so refresh failures leave the old session usable.
function createSecureSessionStorage(store) {
  let queue = Promise.resolve();
  const serialize = (operation) => {
    const pending = queue.then(operation);
    queue = pending.catch(() => {});
    return pending;
  };
  async function manifest(key) {
    const raw = await store.getItemAsync(`${key}.meta`);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      return /^[a-z0-9-]+$/.test(value.generation) && Number.isInteger(value.count) && value.count > 0 && value.count <= 200 ? value : null;
    } catch { return null; }
  }
  async function clean(key, meta) {
    if (meta) for (let i = 0; i < meta.count; i++) await store.deleteItemAsync(`${key}.chunk.${meta.generation}.${i}`);
  }
  return {
    getItem: (key) => serialize(async () => {
      const meta = await manifest(key);
      if (!meta) return null;
      const chunks = [];
      for (let i = 0; i < meta.count; i++) {
        const value = await store.getItemAsync(`${key}.chunk.${meta.generation}.${i}`);
        if (value === null) return null;
        chunks.push(value);
      }
      return chunks.join('');
    }),
    setItem: (key, value) => serialize(async () => {
      const old = await manifest(key);
      const chunks = value.match(/[\s\S]{1,400}/g) || [''];
      if (chunks.length > 200) throw new Error('認証セッションが大きすぎます。');
      const meta = { generation: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, count: chunks.length };
      try {
        for (let i = 0; i < chunks.length; i++) await store.setItemAsync(`${key}.chunk.${meta.generation}.${i}`, chunks[i]);
        await store.setItemAsync(`${key}.meta`, JSON.stringify(meta));
      } catch (error) { await clean(key, meta).catch(() => {}); throw error; }
      await clean(key, old).catch(() => {});
    }),
    removeItem: (key) => serialize(async () => {
      const old = await manifest(key);
      await store.deleteItemAsync(`${key}.meta`);
      await clean(key, old);
    })
  };
}
module.exports = { createSecureSessionStorage };
