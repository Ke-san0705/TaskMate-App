import { useEffect, useState } from 'react';
import {
  deleteAccount,
  downloadCharacterPack,
  getAccountSession,
  isSupabaseConfigured,
  listCloudCharacterPacks,
  onAccountStateChange,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  uploadCharacterPack
} from '../services/characterCloudSync';

function accountLabel(session) {
  return session?.user?.email || session?.user?.id || 'ログイン中';
}

export default function AccountPanel({ selectedCharacter }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cloudCharacters, setCloudCharacters] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function refreshCloudCharacters() {
    if (!isSupabaseConfigured || !session) {
      setCloudCharacters([]);
      return;
    }
    const characters = await listCloudCharacterPacks();
    setCloudCharacters(characters);
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
    });
  }, []);

  useEffect(() => {
    refreshCloudCharacters().catch((refreshError) => setError(refreshError.message));
  }, [session]);

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
      setError(actionError.message);
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
          `.env`に`VITE_SUPABASE_URL`と`VITE_SUPABASE_PUBLISHABLE_KEY`を入れて、
          dev serverを再起動するとログイン機能が有効になります。
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
          <div className="account-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => runAction(refreshCloudCharacters, 'クラウド一覧を更新しました。')}
            >
              クラウド一覧を更新
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
        ) : (
          <form
            className="account-form"
            onSubmit={(event) => {
              event.preventDefault();
              runAction(
                async () => {
                  const nextSession = await signInWithEmail(email, password);
                  setSession(nextSession);
                },
                'ログインしました。'
              );
            }}
          >
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
                ログイン
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
                    },
                    'サインアップしました。メール確認が必要な場合は受信箱を確認してください。'
                  )
                }
              >
                新規登録
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
              disabled={busy || !selectedCharacter}
              onClick={() =>
                runAction(
                  async () => {
                    await uploadCharacterPack(selectedCharacter);
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
