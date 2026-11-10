const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { createInboxSync } = require('../src/services/taskInboxSync');
const { createInboxRepository, INBOX_SCHEMA } = require('../src/repositories/taskInboxRepository');
const item = (id = '00000000-0000-4000-8000-000000000001') => ({ id, source: 'muse', externalId: id, task: { title: '提出', date: '2026-11-12', priority: 'normal' } });

function repository() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE tasks(id TEXT PRIMARY KEY,title TEXT,description TEXT,date TEXT,time TEXT,genre TEXT,priority TEXT,completed INTEGER,created_at TEXT,updated_at TEXT,completed_at TEXT,source TEXT); ${INBOX_SCHEMA}`);
  const db = {
    getFirstAsync: async (sql, params) => sqlite.prepare(sql).get(...params),
    runAsync: async (sql, params) => sqlite.prepare(sql).run(...params),
    withExclusiveTransactionAsync: async (callback) => {
      sqlite.exec('BEGIN');
      try { const value = await callback(db); sqlite.exec('COMMIT'); return value; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    }
  };
  return { sqlite, repo: createInboxRepository(async () => db) };
}

test('受領確認が失敗しても保存済みタスクを再作成せず、手動削除後も再作成しない', async () => {
  const { sqlite, repo } = repository();
  let failAck = true;
  const sync = createInboxSync({ fetchPage: async () => ({ items: [item()], nextCursor: null }), importItem: repo.importInboxItem,
    acknowledge: async () => { if (failAck) throw new Error('offline'); }, isCurrent: () => true, onImported: async () => {} });
  await assert.rejects(sync('user-A'), /offline/);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM tasks').get().n, 1);
  sqlite.exec('DELETE FROM tasks');
  failAck = false;
  assert.equal((await sync('user-A')).created, 0);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM tasks').get().n, 0);
  sqlite.close();
});

test('タスク保存に失敗したら取り込み記録も残さず次回回復する', async () => {
  const { sqlite, repo } = repository();
  sqlite.exec("CREATE TRIGGER deny_task BEFORE INSERT ON tasks BEGIN SELECT RAISE(ABORT,'disk unavailable'); END");
  await assert.rejects(repo.importInboxItem('user-A', item(), () => true), /disk unavailable/);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM external_task_receipts').get().n, 0);
  sqlite.exec('DROP TRIGGER deny_task');
  assert.equal((await repo.importInboxItem('user-A', item(), () => true)).created, true);
  sqlite.close();
});

test('利用者切り替え後の応答は保存も受領確認もしない', async () => {
  let current = true, imported = 0, acknowledged = 0;
  const sync = createInboxSync({ fetchPage: async () => { current = false; return { items: [item()] }; },
    importItem: async () => { imported++; return { created: true }; }, acknowledge: async () => { acknowledged++; }, isCurrent: () => current, onImported: async () => {} });
  await sync('user-A');
  assert.equal(imported, 0);
  assert.equal(acknowledged, 0);
});

test('不正な項目を飛ばして次ページの正常な項目まで取り込む', async () => {
  const { sqlite, repo } = repository();
  const acknowledged = [];
  const sync = createInboxSync({ fetchPage: async (_, cursor) => cursor ? { items: [item()], nextCursor: null } : { items: [{ ...item('bad'), task: { title: '日付不明' } }], nextCursor: 'next' },
    importItem: repo.importInboxItem, acknowledge: async (_, ids) => acknowledged.push(...ids), isCurrent: () => true, onImported: async () => {} });
  const result = await sync('user-A');
  assert.deepEqual({ created: result.created, rejected: result.rejected }, { created: 1, rejected: 1 });
  assert.deepEqual(acknowledged, [item().id]);
  sqlite.close();
});

test('同じ利用者への並行取得は一つにまとめる', async () => {
  let calls = 0;
  const sync = createInboxSync({ fetchPage: async () => { calls++; await new Promise((resolve) => setImmediate(resolve)); return { items: [] }; },
    importItem: async () => ({}), acknowledge: async () => {}, isCurrent: () => true, onImported: async () => {} });
  await Promise.all([sync('user-A'), sync('user-A')]);
  assert.equal(calls, 1);
});

test('説明や時刻の不正な型を黙って捨てず、受領確認せずに次の正常タスクを処理する', async () => {
  const { sqlite, repo } = repository(); const acknowledged = [];
  const invalid = { ...item('00000000-0000-4000-8000-000000000002'), task: { ...item().task, time: 1700, description: { text: '元の情報' } } };
  const sync = createInboxSync({ fetchPage: async () => ({ items: [invalid, item()] }), importItem: repo.importInboxItem,
    acknowledge: async (_, ids) => acknowledged.push(...ids), isCurrent: () => true, onImported: async () => {} });
  const result = await sync('user-A');
  assert.equal(result.created, 1); assert.equal(result.rejected, 1);
  assert.deepEqual(acknowledged, [item().id]);
  sqlite.close();
});
