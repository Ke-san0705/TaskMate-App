const React = require('react');
const { AppState } = require('react-native');
const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const { client, configured, transport, endpoint } = require('../services/taskInboxClient');
const { createSessionGate } = require('../services/taskInboxTransport');
const { createInboxSync } = require('../services/taskInboxSync');
const { importInboxItem } = require('../repositories/taskInboxRepository');
const PREFS_KEY = 'taskmate:task-inbox:v1';

function useTaskInbox({ ready, onImported }) {
  const [session, setSession] = React.useState(null);
  const [enabled, setEnabled] = React.useState(false);
  const [initialized, setInitialized] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [keys, setKeys] = React.useState([]);
  const [freshToken, setFreshToken] = React.useState('');
  const [lastSyncedAt, setLastSyncedAt] = React.useState(null);
  const gate = React.useRef(createSessionGate()).current;
  const current = React.useRef({ userId: null, enabled: false, operation: null });
  const mounted = React.useRef(true);
  const importedCallback = React.useRef(onImported);
  importedCallback.current = onImported;

  React.useEffect(() => {
    mounted.current = true;
    let active = true, authEvent = false;
    const subscription = client?.auth.onAuthStateChange((_, next) => {
      authEvent = true;
      if (active) { gate.update(next?.user.id || null, current.current.enabled); current.current.userId = next?.user.id || null; setSession(next); setFreshToken(''); setKeys([]); }
    });
    Promise.all([AsyncStorage.getItem(PREFS_KEY), client ? client.auth.getSession() : Promise.resolve({ data: { session: null } })])
      .then(([raw, result]) => {
        if (!active) return;
        const prefs = raw ? JSON.parse(raw) : {};
        current.current.enabled = prefs.enabled === true;
        setEnabled(current.current.enabled); setLastSyncedAt(prefs.lastSyncedAt || null);
        if (!authEvent) { current.current.userId = result.data.session?.user.id || null; setSession(result.data.session); }
        gate.update(current.current.userId, current.current.enabled);
      }).catch(() => { if (active) setError('連携設定を読み込めません。再ログインしてください。'); })
      .finally(() => { if (active) { setInitialized(true); client?.auth.startAutoRefresh(); } });
    return () => { active = false; mounted.current = false; gate.invalidate(); subscription?.data.subscription.unsubscribe(); client?.auth.stopAutoRefresh(); };
  }, [gate]);

  const sync = React.useCallback(() => {
    if (current.current.operation) return current.current.operation;
    const userId = current.current.userId;
    if (!configured || !userId || !current.current.enabled || !ready) return Promise.resolve();
    if (Intl.DateTimeFormat().resolvedOptions().timeZone !== 'Asia/Tokyo') { setError('外部タスク連携は日本時間の端末で利用できます。'); return Promise.resolve(); }
    const captured = gate.capture();
    if (!captured.isCurrent(userId)) return Promise.resolve();
    setBusy(true); setError('');
    const execute = createInboxSync({
      fetchPage: (_, cursor) => transport.request(userId, `items${cursor ? `?after=${encodeURIComponent(cursor)}` : ''}`),
      importItem: importInboxItem,
      acknowledge: (_, ids) => transport.request(userId, 'ack', 'POST', { ids }),
      isCurrent: captured.isCurrent,
      onImported: () => importedCallback.current()
    });
    const pending = execute(userId).then(async (result) => {
      if (!mounted.current || !captured.isCurrent(userId)) return;
      const timestamp = new Date().toISOString();
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ enabled: true, lastSyncedAt: timestamp }));
      if (!mounted.current || !captured.isCurrent(userId)) return;
      setLastSyncedAt(timestamp);
      setMessage(`${result.created}件追加しました。${result.rejected ? ` ${result.rejected}件は内容の確認が必要です。` : ''}${result.truncated ? ' 続きはもう一度取得してください。' : ''}`);
    }).catch((reason) => { if (mounted.current && captured.isCurrent(userId)) setError(reason.message || '受信箱を取得できませんでした。'); })
      .finally(() => { current.current.operation = null; if (mounted.current) setBusy(false); });
    current.current.operation = pending;
    return pending;
  }, [gate, ready]);

  React.useEffect(() => { if (initialized) sync(); }, [initialized, session?.user.id, enabled, sync]);
  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') { client?.auth.startAutoRefresh(); sync(); }
      else client?.auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, [sync]);

  async function action(operation) {
    setError(''); setMessage(''); setBusy(true);
    try { await operation(); } catch (reason) { setError(reason.message || '連携操作に失敗しました。'); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function updateEnabled(value) {
    gate.update(current.current.userId, value); current.current.enabled = value; setEnabled(value);
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ enabled: value, lastSyncedAt }));
  }
  async function stop() {
    gate.invalidate(); current.current.enabled = false; setEnabled(false); setFreshToken(''); setKeys([]);
    await current.current.operation;
  }
  async function logout() {
    await stop();
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ enabled: false, lastSyncedAt: null }));
    if (client) { const { error: authError } = await client.auth.signOut({ scope: 'local' }); if (authError) throw authError; }
    current.current.userId = null; setSession(null); setLastSyncedAt(null); setMessage('ログアウトしました。取り込み済みのタスクは端末に残ります。');
  }
  async function resetLocal() { await logout(); await AsyncStorage.removeItem(PREFS_KEY); }
  async function loadKeys() {
    const userId = current.current.userId;
    const response = await transport.request(userId, 'keys');
    if (current.current.userId === userId) setKeys(response.keys);
  }
  return {
    configured, endpoint, enabled, busy, message, error, session, keys, freshToken, lastSyncedAt,
    sync, resetLocal, hideToken: () => setFreshToken(''),
    toggle: (value) => action(() => updateEnabled(value)),
    login: (email, password) => action(async () => {
      const { data, error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw new Error('ログインできません。メールアドレスとパスワードを確認してください。');
      current.current.userId = data.user.id; setSession(data.session); await updateEnabled(true);
    }),
    logout: () => action(logout), loadKeys: () => action(loadKeys),
    createKey: () => action(async () => {
      const userId = current.current.userId;
      const response = await transport.request(userId, 'keys', 'POST');
      if (current.current.userId !== userId) return;
      setFreshToken(response.token); await loadKeys();
    }),
    revokeKey: (id) => action(async () => { await transport.request(current.current.userId, 'keys', 'DELETE', { id }); setFreshToken(''); await loadKeys(); }),
    clearRemote: () => action(async () => {
      const userId = current.current.userId; await stop();
      await transport.request(userId, 'data', 'DELETE');
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ enabled: false, lastSyncedAt: null }));
      setLastSyncedAt(null); setMessage('受信箱と連携キーを削除しました。端末のタスクは残ります。');
    })
  };
}
module.exports = { useTaskInbox };
