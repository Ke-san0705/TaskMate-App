const React = require('react');
const { AppState } = require('react-native');
const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const { client, configured, transport, endpoint, sessionStorage, authStorageKey } = require('../services/taskInboxClient');
const { createSessionGate } = require('../services/taskInboxTransport');
const { createInboxSync } = require('../services/taskInboxSync');
const { importInboxItem } = require('../repositories/taskInboxRepository');
const { createMutationBarrier, clearLocalInboxSession, canFetchInbox } = require('../services/taskInboxLifecycle');
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
  const mutations = React.useRef(createMutationBarrier(() => {
    gate.invalidate(); current.current.enabled = false;
    setEnabled(false); setBusy(true); setFreshToken(''); setKeys([]);
    client?.auth.stopAutoRefresh();
  })).current;
  const mounted = React.useRef(true);
  const importedCallback = React.useRef(onImported);
  importedCallback.current = onImported;

  React.useEffect(() => {
    mounted.current = true;
    let active = true, authEvent = false;
    const subscription = client?.auth.onAuthStateChange((_, next) => {
      authEvent = true;
      if (active && !mutations.frozen) {
        const userId = next?.user.id || null;
        if (userId !== current.current.userId) { setFreshToken(''); setKeys([]); }
        gate.update(userId, !!userId); current.current.userId = userId; setSession(next);
      }
    });
    mutations.run(async (isCurrent) => {
        const [raw, result] = await Promise.all([AsyncStorage.getItem(PREFS_KEY), client ? client.auth.getSession() : Promise.resolve({ data: { session: null } })]);
        if (!active || !isCurrent()) return;
        const prefs = raw ? JSON.parse(raw) : {};
        current.current.enabled = prefs.enabled === true;
        setEnabled(current.current.enabled); setLastSyncedAt(prefs.lastSyncedAt || null);
        if (!authEvent) { current.current.userId = result.data.session?.user.id || null; setSession(result.data.session); }
        gate.update(current.current.userId, !!current.current.userId);
      }).catch(() => { if (active) setError('連携設定を読み込めません。再ログインしてください。'); })
      .finally(() => { if (active) { setInitialized(true); if (!mutations.frozen) client?.auth.startAutoRefresh(); } });
    return () => { active = false; mounted.current = false; gate.invalidate(); subscription?.data.subscription.unsubscribe(); client?.auth.stopAutoRefresh(); };
  }, [gate, mutations]);

  const sync = React.useCallback((automatic = false) => {
    if (current.current.operation) return current.current.operation;
    const userId = current.current.userId;
    if (!canFetchInbox({ configured, userId, enabled: current.current.enabled, ready, resetting: mutations.frozen }, automatic)) return Promise.resolve();
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
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ enabled: current.current.enabled, lastSyncedAt: timestamp }));
      if (!mounted.current || !captured.isCurrent(userId)) return;
      setLastSyncedAt(timestamp);
      setMessage(`${result.created}件追加しました。${result.rejected ? ` ${result.rejected}件は内容の確認が必要です。` : ''}${result.truncated ? ' 続きはもう一度取得してください。' : ''}`);
    }).catch((reason) => { if (mounted.current && captured.isCurrent(userId)) setError(reason.message || '受信箱を取得できませんでした。'); })
      .finally(() => { current.current.operation = null; if (mounted.current && !mutations.frozen) setBusy(false); });
    current.current.operation = pending;
    return pending;
  }, [gate, mutations, ready]);

  React.useEffect(() => { if (initialized) sync(true); }, [initialized, session?.user.id, enabled, sync]);
  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !mutations.frozen) { client?.auth.startAutoRefresh(); sync(true); }
      else client?.auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, [sync, mutations]);

  async function action(operation) {
    return mutations.run(async (isCurrent) => {
      setError(''); setMessage(''); setBusy(true);
      try { await operation(isCurrent); } catch (reason) { if (isCurrent()) setError(reason.message || '連携操作に失敗しました。'); }
      finally { if (mounted.current && !mutations.frozen) setBusy(false); }
    });
  }
  async function updateEnabled(value) {
    gate.update(current.current.userId, !!current.current.userId); current.current.enabled = value; setEnabled(value);
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ enabled: value, lastSyncedAt }));
  }
  async function stop() {
    gate.invalidate(); current.current.enabled = false; setEnabled(false); setFreshToken(''); setKeys([]);
    await current.current.operation;
  }
  async function logout() {
    await stop();
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ enabled: false, lastSyncedAt: null }));
    await clearLocalInboxSession(client?.auth, sessionStorage, authStorageKey);
    current.current.userId = null; gate.update(null, false); setSession(null); setLastSyncedAt(null); setMessage('ログアウトしました。取り込み済みのタスクは端末に残ります。');
  }
  async function resetLocal(clearLocalData) {
    try {
      await mutations.reset(async () => { await logout(); await AsyncStorage.removeItem(PREFS_KEY); await clearLocalData(); });
    } finally { if (mounted.current) { setBusy(false); setInitialized(true); } }
  }
  async function loadKeys(isCurrent = () => true) {
    const userId = current.current.userId;
    const response = await transport.request(userId, 'keys');
    if (isCurrent() && current.current.userId === userId) setKeys(response.keys);
  }
  return {
    configured, endpoint, enabled, busy, message, error, session, keys, freshToken, lastSyncedAt,
    sync: () => sync(false), resetLocal, hideToken: () => setFreshToken(''),
    toggle: (value) => action(() => updateEnabled(value)),
    login: (email, password) => action(async (isCurrent) => {
      const { data, error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw new Error('ログインできません。メールアドレスとパスワードを確認してください。');
      if (!isCurrent()) return;
      current.current.userId = data.user.id; setSession(data.session); await updateEnabled(true);
    }),
    logout: () => action(logout), loadKeys: () => action(loadKeys),
    createKey: () => action(async (isCurrent) => {
      const userId = current.current.userId;
      const response = await transport.request(userId, 'keys', 'POST');
      if (!isCurrent() || current.current.userId !== userId) return;
      setFreshToken(response.token); await loadKeys(isCurrent);
    }),
    revokeKey: (id) => action(async (isCurrent) => { await transport.request(current.current.userId, 'keys', 'DELETE', { id }); if (isCurrent()) { setFreshToken(''); await loadKeys(isCurrent); } }),
    clearRemote: () => action(async (isCurrent) => {
      const userId = current.current.userId; await stop();
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ enabled: false, lastSyncedAt: null }));
      if (!isCurrent()) return;
      await transport.request(userId, 'data', 'DELETE');
      if (!isCurrent()) return;
      setLastSyncedAt(null); setMessage('受信箱と連携キーを削除しました。端末のタスクは残ります。');
    })
  };
}
module.exports = { useTaskInbox };
