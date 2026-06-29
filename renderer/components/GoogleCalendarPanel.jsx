import { useEffect, useMemo, useState } from 'react';
import {
  getAccountSession,
  isGoogleAccountSession,
  isSupabaseConfigured,
  onAccountStateChange,
  signInWithGoogleCalendar
} from '../services/characterCloudSync';

function formatSyncTime(value) {
  if (!value) {
    return '未同期';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '未同期';
  }
  return date.toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function selectedCount(status) {
  return status?.calendars?.filter((calendar) => calendar.selected).length || 0;
}

export default function GoogleCalendarPanel() {
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [accountSession, setAccountSession] = useState(null);

  useEffect(() => {
    let mounted = true;
    window.taskMate
      .getGoogleCalendarStatus()
      .then((next) => {
        if (mounted) {
          setStatus(next);
        }
      })
      .catch((loadError) => {
        if (mounted) {
          setError(loadError.message);
        }
      });
    const unsubscribe = window.taskMate.onGoogleCalendarUpdated((next) => {
      if (mounted) {
        setStatus(next);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined;
    }
    let mounted = true;
    getAccountSession()
      .then((session) => {
        if (mounted) {
          setAccountSession(session);
        }
      })
      .catch(() => null);
    const unsubscribe = onAccountStateChange((session) => {
      if (mounted) {
        setAccountSession(session);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const sortedCalendars = useMemo(() => {
    const calendars = status?.calendars || [];
    return [...calendars].sort((a, b) => {
      if (a.primary !== b.primary) {
        return a.primary ? -1 : 1;
      }
      return a.summary.localeCompare(b.summary, 'ja');
    });
  }, [status?.calendars]);

  async function run(actionName, action, successMessage) {
    setBusy(actionName);
    setError('');
    setMessage('');
    try {
      const next = await action();
      setStatus(next.status || next);
      setMessage(successMessage);
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy('');
    }
  }

  async function updateSettings(partial) {
    await run(
      'settings',
      () => window.taskMate.updateGoogleCalendarSettings(partial),
      'Googleカレンダー設定を保存しました。'
    );
  }

  async function authorizeGoogleAccountCalendar() {
    await run(
      'google-account',
      async () => {
        const session = await signInWithGoogleCalendar();
        setAccountSession(session);
        return window.taskMate.getGoogleCalendarStatus();
      },
      'Googleアカウントのカレンダー権限を許可しました。'
    );
  }

  async function toggleCalendar(calendarId, checked) {
    const current = new Set(status.settings.selectedCalendarIds || []);
    if (checked) {
      current.add(calendarId);
    } else {
      current.delete(calendarId);
    }
    await updateSettings({ selectedCalendarIds: [...current] });
  }

  if (!status) {
    return <section className="settings-card">Googleカレンダー設定を読み込み中...</section>;
  }

  const googleAccount = isGoogleAccountSession(accountSession);
  const canUseGoogleAccountFlow = isSupabaseConfigured && (!accountSession || googleAccount);
  const hasEmailPasswordSession = Boolean(accountSession) && !googleAccount;
  const syncError = status.sync?.errorMessage || status.sync?.error;

  return (
    <div className="google-calendar-panel">
      {(message || error || syncError) && (
        <div className={`settings-message${error || syncError ? ' settings-message--error' : ''}`}>
          {error || syncError || message}
        </div>
      )}

      <section className="settings-card settings-card--compact">
        <div>
          <span className="settings-card__label">GOOGLE CALENDAR</span>
          <h2>{status.connected ? '接続済み' : '未接続'}</h2>
          <p>
            {status.connected
              ? `${status.authSource === 'supabase-google' ? 'TaskMateのGoogleアカウント連携' : '直接Googleカレンダー接続'} / 最終同期: ${formatSyncTime(status.sync?.lastSyncedAt)}`
              : googleAccount
                ? 'Googleアカウントでログイン済みです。カレンダー権限だけ許可できます。'
                : canUseGoogleAccountFlow
                  ? 'Googleで登録/ログインするとカレンダー権限も許可できます。'
                : status.config.configured
                  ? `同期中のカレンダー: ${selectedCount(status)} / 最終同期: ${formatSyncTime(status.sync?.lastSyncedAt)}`
                  : 'Google OAuthクライアントIDが未設定です。'}
          </p>
        </div>
        <div className="calendar-action-row">
          {canUseGoogleAccountFlow && (
            <button
              type="button"
              className="primary-button"
              disabled={Boolean(busy)}
              onClick={authorizeGoogleAccountCalendar}
            >
              {busy === 'google-account'
                ? '許可中...'
                : status.connected
                  ? 'カレンダー権限を再許可'
                  : googleAccount
                    ? 'カレンダー権限を許可'
                    : 'Googleで登録/ログイン'}
            </button>
          )}
          {status.connected && (
            <button
              type="button"
              className="secondary-button"
              disabled={Boolean(busy)}
              onClick={() =>
                run('sync', () => window.taskMate.syncGoogleCalendar(), 'Googleカレンダーを同期しました。')
              }
            >
              {busy === 'sync' ? '同期中...' : '同期'}
            </button>
          )}
          {status.connected ? (
            <button
              type="button"
              className="danger-button"
              disabled={Boolean(busy)}
              onClick={() => {
                if (window.confirm('Googleカレンダー連携を解除しますか？')) {
                  run(
                    'disconnect',
                    () => window.taskMate.disconnectGoogleCalendar(),
                    'Googleカレンダー連携を解除しました。'
                  );
                }
              }}
            >
              解除
            </button>
          ) : status.config.configured && !googleAccount ? (
            <button
              type="button"
              className="primary-button"
              disabled={Boolean(busy)}
              onClick={() =>
                run(
                  'connect',
                  () => window.taskMate.connectGoogleCalendar(),
                  'Googleカレンダーへ接続しました。'
                )
              }
            >
              {busy === 'connect' ? '接続中...' : '接続'}
            </button>
          ) : null}
        </div>
      </section>

      {!status.config.configured && !googleAccount && !isSupabaseConfigured && (
        <section className="settings-card">
          <div className="settings-card__heading">
            <div>
              <span>OAUTH CLIENT</span>
              <h2>接続準備</h2>
            </div>
          </div>
          <p>
            `.env`に`GOOGLE_OAUTH_CLIENT_ID=`を追加し、Google CloudでDesktop appのOAuth
            Clientを作成してください。
          </p>
        </section>
      )}

      {!status.connected && hasEmailPasswordSession && !status.config.configured && (
        <section className="settings-card">
          <div className="settings-card__heading">
            <div>
              <span>GOOGLE ACCOUNT</span>
              <h2>Googleログインで利用できます</h2>
            </div>
          </div>
          <p>
            メール/パスワードのTaskMateアカウントでは、カレンダーだけ別途Google OAuth接続が必要です。
            Googleアカウントでログインすると、`.env`なしでカレンダー権限を許可できます。
          </p>
        </section>
      )}

      {status.connected && (
        <>
          <section className="settings-card settings-card--compact">
            <div>
              <span className="settings-card__label">HOME</span>
              <h2>今日の予定をホームに表示</h2>
              <p>接続したGoogleカレンダーの今日の予定を、TaskMateのメイン画面に控えめに表示します。</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={status.settings.showTodayOnHome !== false}
                onChange={(event) =>
                  updateSettings({ showTodayOnHome: event.target.checked })
                }
              />
              <span />
            </label>
          </section>

          <section className="settings-card settings-card--compact">
            <div>
              <span className="settings-card__label">PRIVACY</span>
              <h2>非公開予定のタイトルを隠す</h2>
              <p>Google側で非公開の予定は、TaskMateでは「Googleカレンダーの予定」と表示します。</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={status.settings.hidePrivateDetails !== false}
                onChange={(event) =>
                  updateSettings({ hidePrivateDetails: event.target.checked })
                }
              />
              <span />
            </label>
          </section>

          <section className="settings-card">
            <div className="settings-card__heading">
              <div>
                <span>CALENDARS</span>
                <h2>同期するカレンダー</h2>
              </div>
              <strong>{selectedCount(status)}</strong>
            </div>
            <div className="calendar-list">
              {sortedCalendars.map((calendar) => (
                <label key={calendar.id} className="calendar-choice">
                  <input
                    type="checkbox"
                    checked={calendar.selected}
                    disabled={
                      Boolean(busy) || (calendar.selected && selectedCount(status) <= 1)
                    }
                    onChange={(event) =>
                      toggleCalendar(calendar.id, event.target.checked)
                    }
                  />
                  <span
                    className="calendar-choice__swatch"
                    style={{ backgroundColor: calendar.backgroundColor || '#a45b25' }}
                    aria-hidden="true"
                  />
                  <span className="calendar-choice__text">
                    <strong>{calendar.summary || calendar.id}</strong>
                    <small>
                      {calendar.primary ? 'メイン' : calendar.accessRole || 'calendar'}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            {status.sync?.calendarErrors?.length > 0 && (
              <div className="calendar-errors">
                {status.sync.calendarErrors.map((item) => (
                  <p key={item.calendarId}>
                    {item.calendarSummary || item.calendarId}: {item.message}
                  </p>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
