const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

const modulePromise = import('../supabase/functions/task-inbox/handler.mjs');
const token = `tm_muse_${'a'.repeat(64)}`;
const validTask = { externalId: 'mail-123', title: '資料を提出', date: '2026-11-12' };

async function fixture(overrides = {}) {
  const { createInboxHandler } = await modulePromise;
  const received = [];
  const store = {
    ingest: async (hash, items) => { received.push({ hash, items }); return { items: [{ id: 'receipt', externalId: items[0].externalId }] }; },
    listItems: async (userId) => [{ id: '00000000-0000-4000-8000-000000000001', external_id: 'mail-123', source: 'muse', payload: { title: userId, date: '2026-11-12' } }],
    acknowledge: async () => ({}), listKeys: async () => [], createKey: async () => ({}),
    revokeKey: async () => ({}), clear: async () => ({}), ...overrides
  };
  const handler = createInboxHandler({ store, validateUser: async (jwt) => jwt === 'user-session' ? { id: 'user-A' } : null,
    digest: async (text) => createHash('sha256').update(text).digest('hex'), generateToken: () => token });
  return { received, request: (path, method = 'POST', body, bearer = token) => handler(new Request(`https://test/functions/v1/task-inbox/${path}`, {
    method, headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) })
  })) };
}

test('追加APIは検証したタスクとキーのハッシュだけを保存する', async () => {
  const f = await fixture();
  const response = await f.request('tasks', 'POST', { tasks: [validTask] });
  assert.equal(response.status, 202);
  assert.equal((await response.json()).status, 'received');
  assert.equal(f.received[0].hash, createHash('sha256').update(token).digest('hex'));
  assert.deepEqual(f.received[0].items[0].task, { title: '資料を提出', description: '', date: '2026-11-12', time: null, genre: '', priority: 'normal' });
  assert.equal(JSON.stringify(f.received).includes(token), false);
});

test('日付不明やバッチ内の不正値を全体として拒否し保存しない', async () => {
  for (const invalid of [{ ...validTask, date: '' }, { ...validTask, date: '2026-02-30' }, { ...validTask, time: '24:00' }, { ...validTask, completed: true }, { ...validTask, priority: 'critical' }]) {
    const f = await fixture();
    const response = await f.request('tasks', 'POST', { tasks: [validTask, { ...invalid, externalId: 'mail-456' }] });
    assert.equal(response.status, 400);
    assert.equal(f.received.length, 0);
  }
});

test('件数と実際のボディサイズの上限を適用する', async () => {
  const f = await fixture();
  assert.equal((await f.request('tasks', 'POST', { tasks: Array.from({ length: 51 }, (_, i) => ({ ...validTask, externalId: `id-${i}` })) })).status, 400);
  assert.equal((await f.request('tasks', 'POST', ' '.repeat(65537))).status, 413);
});

test('追加キーで本人向け操作を実行できず無効セッションでも取得できない', async () => {
  const f = await fixture();
  assert.equal((await f.request('items', 'GET')).status, 401);
  assert.equal((await f.request('items', 'GET', undefined, 'invalid-session')).status, 401);
  const result = await f.request('items', 'GET', undefined, 'user-session');
  assert.equal(result.status, 200);
  assert.equal((await result.json()).items[0].task.title, 'user-A');
});

test('キー失効と競合とレート上限は区別して返す', async () => {
  for (const [code, status] of [['PT401', 401], ['PT409', 409], ['PT429', 429]]) {
    const f = await fixture({ ingest: async () => { throw { code, message: 'denied' }; } });
    assert.equal((await f.request('tasks', 'POST', { tasks: [validTask] })).status, status);
  }
});

test('本人向け操作でも不正JSON値を入力エラーとして返す', async () => {
  const f = await fixture();
  assert.equal((await f.request('ack', 'POST', 'null', 'user-session')).status, 400);
  assert.equal((await f.request('keys', 'DELETE', 'null', 'user-session')).status, 400);
});
