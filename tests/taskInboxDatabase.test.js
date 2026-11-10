const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const migration = path.join(__dirname, '../supabase/migrations/20261110_task_inbox.sql');
const a = '10000000-0000-4000-8000-000000000001';
const b = '10000000-0000-4000-8000-000000000002';
const hash = 'a'.repeat(64);
const entry = (id = 'mail-1', fingerprint = 'b'.repeat(64)) => ({ externalId: id, hash: fingerprint, task: { title: '提出', date: '2026-11-12', time: null, description: '', genre: '', priority: 'normal' } });
let db;
test.before(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    INSERT INTO auth.users VALUES ('${a}'), ('${b}');`);
  await db.exec(fs.readFileSync(migration, 'utf8'));
});
test.after(async () => { await db?.close(); });
test.beforeEach(async () => {
  await db.exec('RESET ROLE; TRUNCATE public.task_inbox_items, public.task_inbox_keys;');
  await db.query('SELECT public.task_inbox_create_key($1, $2, $3)', [a, hash, 'aaaaaa']);
});
async function ingest(items, keyHash = hash) {
  return (await db.query('SELECT public.task_inbox_ingest($1, $2::jsonb) AS result', [keyHash, JSON.stringify(items)])).rows[0].result;
}
test('同一ID再送と受領後の再送でも一件だけ保持し、変更された再送は拒否する', async () => {
  const first = await ingest([entry()]);
  await ingest([entry()]);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM task_inbox_items')).rows[0].n, 1);
  await db.query('SELECT public.task_inbox_ack($1, $2::uuid[])', [a, [first.items[0].id]]);
  assert.equal((await db.query('SELECT payload FROM task_inbox_items')).rows[0].payload, null);
  await ingest([entry()]);
  await assert.rejects(ingest([entry('mail-1', 'c'.repeat(64))]), (error) => error.code === 'PT409');
});
test('上限に達したバッチは一部登録せず、重複再送は利用枠を消費しない', async () => {
  for (let offset = 0; offset < 200; offset += 50) await ingest(Array.from({ length: 50 }, (_, i) => entry(`id-${offset + i}`)));
  await ingest([entry('id-0')]);
  await assert.rejects(ingest([entry('new-1'), entry('new-2')]), (error) => error.code === 'PT429');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM task_inbox_items')).rows[0].n, 200);
});
test('失効キーと無効キーを拒否する', async () => {
  await db.exec('UPDATE task_inbox_keys SET revoked_at=now()');
  await assert.rejects(ingest([entry()]), (error) => error.code === 'PT401');
  await assert.rejects(ingest([entry()], 'f'.repeat(64)), (error) => error.code === 'PT401');
});
test('他利用者の受領確認は本文を削除せず、RLSは他人の行を隠す', async () => {
  const result = await ingest([entry()]);
  await db.query('SELECT task_inbox_ack($1, $2::uuid[])', [b, [result.items[0].id]]);
  assert.notEqual((await db.query('SELECT payload FROM task_inbox_items')).rows[0].payload, null);
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [b]);
  await db.exec('SET ROLE authenticated');
  assert.equal((await db.query('SELECT * FROM task_inbox_items')).rows.length, 0);
  await assert.rejects(db.query('SELECT task_inbox_ingest($1, $2::jsonb)', [hash, JSON.stringify([entry()])]), /permission denied/);
  await assert.rejects(db.query('SELECT token_hash FROM task_inbox_keys'), /permission denied/);
});
