const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { createGitHubLogin, GITHUB_REDIRECT_TO, ensurePKCECrypto } = require('../src/services/taskInboxOAuth');
const { createMutationBarrier } = require('../src/services/taskInboxLifecycle');
const projectUrl = 'https://example.supabase.co';
const redirect = 'taskmate://auth/callback';
const authorize = `${projectUrl}/auth/v1/authorize?provider=github&code_challenge=${'a'.repeat(43)}&code_challenge_method=s256`;
const session = { user: { id: 'user-1' }, access_token: 'private-token' };
function fixture(result = { type: 'success', url: `${redirect}?code=one-time-code` }) {
  const exchanged = [], opened = [];
  const auth = {
    signInWithOAuth: async () => ({ data: { url: authorize }, error: null }),
    exchangeCodeForSession: async (code) => { exchanged.push(code); return { data: { session }, error: null }; }
  };
  return { auth, exchanged, opened, options: { auth, projectUrl, openAuthSession: async (...args) => { opened.push(args); return result; } } };
}
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }

test('Web Cryptoがない端末ではネイティブ乱数とSHA-256をPKCEへ提供する', async () => {
  const runtime = {};
  ensurePKCECrypto(runtime, { getRandomValues: (array) => crypto.getRandomValues(array), digest: (algorithm, data) => crypto.subtle.digest(algorithm, data) });
  const random = runtime.crypto.getRandomValues(new Uint32Array(56));
  assert.equal(random.byteLength, 224);
  assert.ok(random.some((value) => value !== 0));
  const hash = await runtime.crypto.subtle.digest('SHA-256', new TextEncoder().encode('abc'));
  assert.equal(Buffer.from(hash).toString('hex'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  await assert.rejects(runtime.crypto.subtle.digest('unsupported', new Uint8Array()), /Unsupported/);
});

test('既存のWeb Cryptoは置き換えない', () => {
  const runtime = { crypto };
  ensurePKCECrypto(runtime, {});
  assert.equal(runtime.crypto, crypto);
});

test('実際のSupabase SDKが作ったPKCE verifierでGitHubのコードを交換する', async () => {
  assert.equal(GITHUB_REDIRECT_TO, redirect);
  const values = new Map(); let challenge, exchangedBody;
  const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
  const client = createClient(projectUrl, 'sb_publishable_test', {
    auth: { flowType: 'pkce', detectSessionInUrl: false, autoRefreshToken: false, storage: { getItem: async (key) => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value), removeItem: async (key) => values.delete(key) } },
    global: { fetch: async (url, init) => {
      assert.equal(new URL(url).pathname, '/auth/v1/token');
      exchangedBody = JSON.parse(init.body);
      return Response.json({ access_token: token, refresh_token: 'private-refresh', token_type: 'bearer', expires_in: 3600, user: session.user });
    } }
  });
  const login = createGitHubLogin({ auth: client.auth, projectUrl, openAuthSession: async (url, callback) => {
    const target = new URL(url);
    assert.equal(target.searchParams.get('provider'), 'github');
    assert.equal(target.searchParams.get('redirect_to'), redirect);
    assert.equal(callback, redirect);
    challenge = target.searchParams.get('code_challenge');
    return { type: 'success', url: `${redirect}?code=one-time-code` };
  } });
  const result = await login(() => true);
  assert.equal(result.user.id, 'user-1');
  assert.equal(exchangedBody.auth_code, 'one-time-code');
  assert.equal(createHash('sha256').update(exchangedBody.code_verifier).digest('base64url'), challenge);
});

test('ブラウザーのキャンセルはコードを交換しない', async () => {
  for (const type of ['cancel', 'dismiss']) {
    const f = fixture({ type });
    assert.equal(await createGitHubLogin(f.options)(() => true), null);
    assert.deepEqual(f.exchanged, []);
  }
});

test('別の戻り先・重複コード・暗黙トークン・認証拒否を受け入れない', async () => {
  for (const url of [
    'https://evil.example/auth/callback?code=secret', 'taskmate://evil/callback?code=secret',
    'taskmate://auth/callback/extra?code=secret', 'taskmate://user@auth/callback?code=secret',
    `${redirect}?code=a&code=b`, `${redirect}?code=`, `${redirect}#access_token=secret`,
    `${redirect}?error=access_denied&error_description=private-value`, `${redirect}?code=secret#access_token=secret`
  ]) {
    const f = fixture({ type: 'success', url });
    await assert.rejects(createGitHubLogin(f.options)(() => true), (error) => /GitHub/.test(error.message) && !/secret|private-value|evil/.test(error.message));
    assert.deepEqual(f.exchanged, []);
  }
});

test('設定したSupabase以外の認証URLとPKCEなしのURLを開かない', async () => {
  for (const url of ['https://example.supabase.co.evil.example/auth/v1/authorize', 'http://example.supabase.co/auth/v1/authorize', `${projectUrl}/other`, `${projectUrl}/auth/v1/authorize?provider=github`]) {
    const f = fixture(); f.auth.signInWithOAuth = async () => ({ data: { url } });
    await assert.rejects(createGitHubLogin(f.options)(() => true), /GitHub/);
    assert.deepEqual(f.opened, []);
  }
});

test('認証サービスやブラウザーのエラーに含まれる秘密を表示しない', async () => {
  for (const stage of ['start', 'browser', 'exchange']) {
    const f = fixture();
    if (stage === 'start') f.auth.signInWithOAuth = async () => ({ error: new Error('private-code') });
    if (stage === 'browser') f.options.openAuthSession = async () => { throw new Error('private-code'); };
    if (stage === 'exchange') f.auth.exchangeCodeForSession = async () => ({ error: new Error('private-code') });
    await assert.rejects(createGitHubLogin(f.options)(() => true), (error) => /GitHub/.test(error.message) && !error.message.includes('private-code'));
  }
});

test('認証開始待ちにリセットされたらブラウザーを開かない', async () => {
  const f = fixture(); let current = true;
  f.auth.signInWithOAuth = async () => { current = false; return { data: { url: authorize } }; };
  assert.equal(await createGitHubLogin(f.options)(() => current), null);
  assert.deepEqual(f.opened, []);
});

test('ブラウザー待ちにリセットされたらコードを交換しない', async () => {
  const f = fixture(); let current = true;
  f.options.openAuthSession = async () => { current = false; return { type: 'success', url: `${redirect}?code=late` }; };
  assert.equal(await createGitHubLogin(f.options)(() => current), null);
  assert.deepEqual(f.exchanged, []);
});

test('コード交換中のリセットはAuthの保存を待ってから資格情報を消す', async () => {
  const f = fixture(), entered = deferred(), release = deferred(), barrier = createMutationBarrier();
  let credentials = null, enabled = false;
  f.auth.exchangeCodeForSession = async () => { entered.resolve(); await release.promise; credentials = session; return { data: { session } }; };
  const pending = barrier.run(async (isCurrent) => { const result = await createGitHubLogin(f.options)(isCurrent); if (result && isCurrent()) enabled = true; });
  await entered.promise;
  const reset = barrier.reset(async () => { credentials = null; enabled = false; });
  release.resolve(); await Promise.all([pending, reset]);
  assert.equal(credentials, null); assert.equal(enabled, false);
});
