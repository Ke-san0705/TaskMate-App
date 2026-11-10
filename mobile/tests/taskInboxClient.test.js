const test = require('node:test');
const assert = require('node:assert/strict');
const { createSecureSessionStorage } = require('../src/services/secureSessionStorage');
const { createInboxTransport, createSessionGate } = require('../src/services/taskInboxTransport');

test('大きい認証セッションを安全なサイズに分割し復元・削除する', async () => {
  const values = new Map();
  const store = { getItemAsync: async (key) => values.get(key) || null,
    setItemAsync: async (key, value) => { assert.ok(Buffer.byteLength(value) <= 2000); values.set(key, value); },
    deleteItemAsync: async (key) => { values.delete(key); } };
  const session = JSON.stringify({ access_token: 'x'.repeat(6000), email: '日本語@example.com' });
  await createSecureSessionStorage(store).setItem('session', session);
  const restored = createSecureSessionStorage(store);
  assert.equal(await restored.getItem('session'), session);
  await restored.removeItem('session');
  assert.equal(await restored.getItem('session'), null);
  assert.equal(values.size, 0);
});

test('セッション保存の途中失敗でも前の有効なセッションを保持する', async () => {
  const values = new Map(); let fail = false;
  const store = { getItemAsync: async (key) => values.get(key) || null,
    setItemAsync: async (key, value) => { if (fail && key.includes('.chunk.')) throw new Error('write failed'); values.set(key, value); },
    deleteItemAsync: async (key) => { values.delete(key); } };
  const storage = createSecureSessionStorage(store);
  await storage.setItem('session', 'old-session'); fail = true;
  await assert.rejects(storage.setItem('session', 'new-session'), /write failed/);
  assert.equal(await storage.getItem('session'), 'old-session');
});

test('取得開始した利用者と現在のセッションが違う場合は通信しない', async () => {
  let calls = 0;
  const transport = createInboxTransport({ baseUrl: 'https://example.supabase.co', publishableKey: 'public', getSession: async () => ({ user: { id: 'B' }, access_token: 'jwt' }), fetchImpl: async () => { calls++; } });
  await assert.rejects(transport.request('A', 'items'), /アカウント/);
  assert.equal(calls, 0);
});

test('応答しない通信をタイムアウトしてローカル操作を再開できる', async () => {
  const transport = createInboxTransport({ baseUrl: 'https://example.supabase.co', publishableKey: 'public', timeoutMs: 5,
    getSession: async () => ({ user: { id: 'A' }, access_token: 'jwt' }),
    fetchImpl: async (_, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  await assert.rejects(transport.request('A', 'items'), /タイムアウト/);
});

test('ログアウトや全削除で世代を無効にすると処理中の取得は保存許可を失う', () => {
  const gate = createSessionGate();
  gate.update('A', true);
  const original = gate.capture();
  assert.equal(original.isCurrent('A'), true);
  gate.invalidate();
  assert.equal(original.isCurrent('A'), false);
  gate.update('B', true);
  assert.equal(original.isCurrent('A'), false);
  assert.equal(gate.capture().isCurrent('B'), true);
});

test('同じ利用者のトークン更新は進行中の取得を無効化しない', () => {
  const gate = createSessionGate(); gate.update('A', true);
  const running = gate.capture(); gate.update('A', true);
  assert.equal(running.isCurrent('A'), true);
});

test('認証更新の応答待ちにも通信時間の上限を適用する', async () => {
  const transport = createInboxTransport({ baseUrl: 'https://example.supabase.co', publishableKey: 'public', timeoutMs: 5,
    getSession: () => new Promise(() => {}) });
  const outcome = await Promise.race([transport.request('A', 'items').then(() => 'resolved', (error) => error.message), new Promise((resolve) => setTimeout(() => resolve('never completed'), 100))]);
  assert.match(outcome, /タイムアウト/);
});
