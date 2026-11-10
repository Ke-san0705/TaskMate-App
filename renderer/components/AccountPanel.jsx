import { useEffect, useState } from 'react';
import {
  deleteAccount,
  downloadCharacterPack,
  getAccountSession,
  isSupabaseConfigured,
  isGoogleAccountSession,
  listCloudCharacterPacks,
  onAccountStateChange,
  signInWithGoogleCalendar,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  uploadCharacterPack
} from '../services/characterCloudSync';
import { syncTaskData } from '../services/taskCloudSync';

function accountLabel(session) {
  return session?.user?.email || session?.user?.id || 'ログイン中';
}

function selectedCharacterName(selectedCharacter) {
  return typeof selectedCharacter === 'string'
    ? selectedCharacter
    : selectedCharacter?.name || selectedCharacter?.id || '';
}

function canSyncSelectedCharacter(selectedCharacter) {
  if (!selectedCharacter) {
    return false;
  }
  if (typeof selectedCharacter === 'string') {
    return true;
  }
  return selectedCharacter.builtIn !== true;
}

function accountErrorMessage(error) {
  const message = error?.message || String(error || '');
  if (/invalid login credentials/i.test(message)) {
    return 'メール/パスワードログインに失敗しました。Googleで登録したアカウントは「Googleで登録/ログイン」を使ってください。GoogleのパスワードはTaskMateには保存されません。';
  }
  if (/localhost:3000|ERR_CONNECTION_REFUSED|redirect/i.test(message)) {
    return 'Googleログインの戻り先設定に問題があります。SupabaseのAuthentication > URL Configurationで、PCは http://127.0.0.1:53682/oauth-callback、スマホは taskmate://auth/callback と taskmate://** を許可してください。';
  }
  return message;
}

function formatLinkedAt(value) {
  if (!value) {
    return '未同期';
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '未同期';
  }
}

function SyncSummary({ status, characterCount }) {
  const isSyncing = status?.state === 'syncing';
  const isError = status?.state === 'error';
  const isPartial = status?.state === 'partial';
  const isTaskError = isError || status?.taskState === 'error';
  const isCharacterSyncing = status?.characterState === 'syncing';
  const isCharacterError = status?.characterState === 'error';
  const taskText = isSyncing
    ? '同期中...'
    : isTaskError
      ? '同期に失敗'
      : status
    ? `送信 ${status.uploaded} / 取込 ${status.downloaded} / 削除 ${status.deleted}`
    : '未同期';
  const characterText = isCharacterSyncing
    ? '同期中...'
    : isCharacterError
      ? '同期に失敗'
      : `${characterCount} 件`;
  return (
    <div className="account-sync-summary" aria-label="アカウント連携状況" aria-live="polite">
      <div className={isTaskError ? 'is-error' : isSyncing ? 'is-syncing' : isPartial ? 'is-partial' : ''}>
        <span>タスク連携</span>
        <strong>{taskText}</strong>
        <small>
          {isTaskError
            ? status.taskErrorMessage || status.errorMessage
            : `端末内 ${status?.localCount ?? 0} 件 / 最終 ${formatLinkedAt(status?.syncedAt)}`}
        </small>
      </div>
      <div className={isCharacterError ? 'is-error' : isCharacterSyncing ? 'is-syncing' : isPartial ? 'is-partial' : ''}>
        <span>キャラクター連携</span>
        <strong>{characterText}</strong>
        <small>
          {isCharacterError
            ? status.characterErrorMessage
            : 'クラウドに保存済みのカスタムキャラクター'}
        </small>
      </div>
    </div>
  );
}

export default function AccountPanel({ selectedCharacter }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cloudCharacters, setCloudCharacters] = useState([]);
  const [taskSyncStatus, setTaskSyncStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refreshCloudCharacters() {
    if (!isSupabaseConfigured || !session) {
      setCloudCharacters([]);
      return [];
    }
    const characters = await listCloudCharacterPacks();
    setCloudCharacters(characters);
    return characters;
  }

  async function refreshLinkedData() {
    setTaskSyncStatus((current) => ({
      ...current,
      state: 'syncing',
      taskState: 'syncing',
      characterState: 'syncing',
      startedAt: new Date().toISOString()
    }));
    const syncedAt = new Date().toISOString();
    let taskResult = {
      uploaded: 0,
      downloaded: 0,
      deleted: 0,
      localCount: 0
    };
    let taskErrorMessage = '';
    let characterErrorMessage = '';
    let characters = cloudCharacters;

    try {
      taskResult = await syncTaskData();
    } catch (taskError) {
      taskErrorMessage = accountErrorMessage(taskError);
    }

    try {
      if (canSyncSelectedCharacter(selectedCharacter)) {
        characters = await uploadCharacterPack(selectedCharacterName(selectedCharacter));
      } else {
        characters = await listCloudCharacterPacks();
      }
      setCloudCharacters(characters);
    } catch (characterError) {
      characterErrorMessage = accountErrorMessage(characterError);
    }

    const nextTaskStatus = {
      ...taskResult,
      state: taskErrorMessage ? 'error' : characterErrorMessage ? 'partial' : 'success',
      taskState: taskErrorMessage ? 'error' : 'success',
      characterState: characterErrorMessage ? 'error' : 'success',
      taskErrorMessage,
      characterErrorMessage,
      syncedAt
    };
    setTaskSyncStatus(nextTaskStatus);
    return { taskResult: nextTaskStatus, characters };
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined;
    }
    let mounted = true;
    getAccountSession()
      .then((loadedSession) => {
        if (mounted) {
          setSession(loadedSession);
        }
      })
      .catch((loadError) => setError(loadError.message));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined;
    }
    return onAccountStateChange((nextSession) => {
      setSession(nextSession);
      setMessage(nextSession ? 'アカウントに接続しました。' : 'ログアウトしました。');
      if (!nextSession) {
        setTaskSyncStatus(null);
      }
    });
  }, []);

  useEffect(() => {
    refreshCloudCharacters().catch((refreshError) => setError(accountErrorMessage(refreshError)));
  }, [session]);

  useEffect(() => {
    if (!session || taskSyncStatus) {
      return;
    }
    refreshLinkedData().catch((syncError) => setError(accountErrorMessage(syncError)));
  }, [session, taskSyncStatus, selectedCharacter]);

  async function runAction(action, successMessage) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      if (successMessage) {
        setMessage(successMessage);
      }
    } catch (actionError) {
      setError(accountErrorMessage(actionError));
    } finally {
      setBusy(false);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <section className="settings-card account-panel">
        <div className="settings-card__heading">
          <div>
            <span>ACCOUNT</span>
            <h2>Supabase未設定</h2>
          </div>
        </div>
        <p>
          公式ビルド用の公開Supabase設定が未登録です。開発中は`.env`、
          配布ビルドでは`renderer/config/publicRuntimeConfig.js`にURLとpublishable keyを設定してください。
        </p>
      </section>
    );
  }

  return (
    <>
      {(message || error) && (
        <div className={`settings-message${error ? ' settings-message--error' : ''}`}>
          {error || message}
        </div>
      )}

      <section className="settings-card account-panel">
        <div className="settings-card__heading">
          <div>
            <span>ACCOUNT</span>
            <h2>{session ? 'ログイン済み' : 'ログイン'}</h2>
          </div>
          {session && <strong>{accountLabel(session)}</strong>}
        </div>

        {session ? (
          <>
            <SyncSummary status={taskSyncStatus} characterCount={cloudCharacters.length} />
            <div className="account-actions">
              {isGoogleAccountSession(session) && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      async () => {
                        const nextSession = await signInWithGoogleCalendar();
                        setSession(nextSession);
                        await refreshLinkedData();
                      },
                      'Googleアカウントのカレンダー権限と連携状況を確認しました。'
                    )
                  }
                >
                  カレンダー権限を再許可
                </button>
              )}
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() =>
                  runAction(
                    async () => {
                      await refreshLinkedData();
                    },
                    'タスクとキャラクターの連携状況を確認しました。'
                  )
                }
              >
                連携状況を更新
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={busy}
                onClick={() => runAction(signOut)}
              >
                ログアウト
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      'TaskMateアカウントとクラウド上のキャラクターデータを削除します。元に戻せません。続行しますか？'
                    )
                  ) {
                    runAction(deleteAccount, 'アカウント削除を実行しました。');
                  }
                }}
              >
                アカウント削除
              </button>
            </div>
          </>
        ) : (
          <form
            className="account-form"
            onSubmit={(event) => {
              event.preventDefault();
              runAction(
                async () => {
                  const nextSession = await signInWithEmail(email, password);
                  setSession(nextSession);
                  await refreshLinkedData();
                },
                'ログインし、タスクとキャラクターの連携状況を確認しました。'
              );
            }}
          >
            <div className="account-login-guide" aria-label="ログイン方法の違い">
              <div>
                <strong>Googleで登録した方</strong>
                <span>
                  「Googleで登録/ログイン」を使います。GoogleのパスワードはTaskMateには保存されません。
                </span>
              </div>
              <div>
                <strong>メールで登録した方</strong>
                <span>TaskMateで作成したメールアドレスとパスワードでログインします。</span>
              </div>
            </div>
            <button
              type="button"
              className="google-login-button"
              disabled={busy}
              onClick={() =>
                runAction(
                  async () => {
                    const nextSession = await signInWithGoogleCalendar();
                    setSession(nextSession);
                    await refreshLinkedData();
                  },
                  'Googleアカウントでログインし、タスクとキャラクターの連携状況を確認しました。'
                )
              }
            >
              Googleで登録/ログイン
            </button>
            <div className="account-form-divider">
              <span>またはメール/パスワードでログイン</span>
            </div>
            <label className="field">
              <span>メールアドレス</span>
              <input
                type="email"
                value={email}
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>パスワード</span>
              <input
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <div className="task-form__actions">
              <button type="submit" className="primary-button" disabled={busy}>
                メールでログイン
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() =>
                  runAction(
                    async () => {
                      const nextSession = await signUpWithEmail(email, password);
                      setSession(nextSession);
                      if (nextSession) {
                        await refreshLinkedData();
                      }
                    },
                    'サインアップしました。メール確認が必要な場合は受信箱を確認してください。'
                  )
                }
              >
                メールで新規登録
              </button>
            </div>
          </form>
        )}
      </section>

      {session && (
        <section className="settings-card account-panel">
          <div className="settings-card__heading">
            <div>
              <span>CHARACTER SYNC</span>
              <h2>カスタムキャラ同期</h2>
            </div>
          </div>
          <p>
            現在選択中のキャラクターをSupabase Storageへ保存し、別端末から取り込めます。
          </p>
          <div className="account-actions">
            <button
              type="button"
              className="primary-button"
              disabled={busy || !canSyncSelectedCharacter(selectedCharacter)}
              onClick={() =>
                runAction(
                  async () => {
                    await uploadCharacterPack(selectedCharacterName(selectedCharacter));
                    await refreshCloudCharacters();
                  },
                  'キャラクターをクラウドへ保存しました。'
                )
              }
            >
              選択中のキャラを保存
            </button>
          </div>

          <div className="cloud-character-list">
            {cloudCharacters.map((character) => (
              <article key={character.local_character_id}>
                <div>
                  <strong>{character.name}</strong>
                  <small>
                    {character.source_device || 'unknown'} /{' '}
                    {character.updated_at
                      ? new Date(character.updated_at).toLocaleString()
                      : '未同期'}
                  </small>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      () => downloadCharacterPack(character.local_character_id),
                      'クラウドのキャラクターを端末へ保存しました。'
                    )
                  }
                >
                  取り込む
                </button>
              </article>
            ))}
            {cloudCharacters.length === 0 && (
              <p className="task-settings-empty">クラウドに保存されたキャラクターはまだありません。</p>
            )}
          </div>
        </section>
      )}
    </>
  );
}
