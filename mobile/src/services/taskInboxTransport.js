function createSessionGate() {
  let generation = 0, userId = null, enabled = false;
  return {
    update(nextUser, nextEnabled) { if (userId === nextUser && enabled === nextEnabled) return; generation++; userId = nextUser; enabled = nextEnabled; },
    invalidate() { generation++; enabled = false; },
    capture() { const version = generation; return { isCurrent: (id) => enabled && generation === version && userId === id }; }
  };
}
function createInboxTransport({ baseUrl, publishableKey, getSession, fetchImpl = fetch, timeoutMs = 15000 }) {
  async function request(userId, path, method = 'GET', body) {
    const controller = new AbortController();
    let timedOut = false;
    let rejectDeadline;
    const deadline = new Promise((_, reject) => { rejectDeadline = reject; });
    const withinDeadline = (operation) => Promise.race([operation, deadline]);
    const timer = setTimeout(() => { timedOut = true; controller.abort(); rejectDeadline(new Error('timeout')); }, timeoutMs);
    try {
      const session = await withinDeadline(getSession());
      if (!session?.access_token || session.user?.id !== userId) throw new Error('連携アカウントに再ログインしてください。');
      const response = await withinDeadline(fetchImpl(`${baseUrl.replace(/\/$/, '')}/functions/v1/task-inbox/${path}`, {
        method, signal: controller.signal,
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: publishableKey, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      }));
      const data = await withinDeadline(response.json());
      if (!response.ok) {
        const error = new Error(response.status === 401 ? '連携アカウントに再ログインしてください。' : response.status === 429 ? '連携の利用上限に達しました。時間を置いて再試行してください。' : '受信箱に接続できません。接続設定とサーバーの状態を確認してください。');
        error.status = response.status; throw error;
      }
      return data;
    } catch (error) {
      if (timedOut) throw new Error('受信箱への接続がタイムアウトしました。次回起動時に再試行します。');
      throw error;
    } finally { clearTimeout(timer); }
  }
  return { request };
}
module.exports = { createInboxTransport, createSessionGate };
