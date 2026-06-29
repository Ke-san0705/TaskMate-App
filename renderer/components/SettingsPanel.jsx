import { useEffect, useState } from 'react';
import AccountPanel from './AccountPanel';
import GoogleCalendarPanel from './GoogleCalendarPanel';
import ProjectManagementMode from './ProjectManagementMode';
import '../styles/SettingsPanel.css';

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState('projectReview');
  const [settings, setSettings] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.all([
      window.taskMate.getSettings(),
      window.taskMate.getCharacters()
    ])
      .then(([loadedSettings, loadedCharacters]) => {
        if (mounted) {
          setSettings(loadedSettings);
          setCharacters(loadedCharacters);
        }
      })
      .catch((loadError) => setError(loadError.message));

    const unsubscribeSettings = window.taskMate.onSettingsUpdated((next) => {
      if (mounted) {
        setSettings(next);
      }
    });
    return () => {
      mounted = false;
      unsubscribeSettings();
    };
  }, []);

  useEffect(() => {
    if (!settings?.selectedCharacter) {
      return;
    }
    window.taskMate
      .getCharacterData(settings.selectedCharacter)
      .then(setPreview)
      .catch((previewError) => setError(previewError.message));
  }, [settings?.selectedCharacter]);

  async function update(partial) {
    setError('');
    setMessage('');
    try {
      const next = await window.taskMate.updateSettings(partial);
      setSettings(next);
      setMessage('表示設定を保存しました。');
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  async function selectCharacter(name) {
    setError('');
    setMessage('');
    try {
      const next = await window.taskMate.selectCharacter(name);
      setSettings(next);
      setMessage('キャラクターを切り替えました。');
    } catch (selectionError) {
      setError(selectionError.message);
    }
  }

  async function resetPosition() {
    setError('');
    setMessage('');
    try {
      const next = await window.taskMate.resetWindowPosition();
      setSettings(next);
      setMessage('ウィンドウ位置を画面左下へ戻しました。');
    } catch (resetError) {
      setError(resetError.message);
    }
  }

  async function resetLifeState() {
    if (!window.confirm('関係記憶だけをリセットします。タスクと設定は残ります。よろしいですか？')) {
      return;
    }
    setError('');
    setMessage('');
    try {
      await window.taskMate.resetLifeState();
      setMessage('関係記憶をリセットしました。');
    } catch (resetError) {
      setError(resetError.message);
    }
  }

  async function updateQuietHours(partial) {
    await update({
      quietHours: {
        ...(settings.quietHours || {}),
        ...partial
      }
    });
  }

  async function updateProjectSettings(partial) {
    await update({
      projectSettings: {
        ...(settings.projectSettings || {}),
        ...partial
      }
    });
  }

  if (!settings) {
    return <main className="settings-loading">設定を読み込んでいます...</main>;
  }

  return (
    <main className="settings-panel">
      <header className="settings-panel__hero">
        <div>
          <span>TASKMATE PREFERENCES</span>
          <h1>設定</h1>
          <p>
            表示の調整と、長期タスク管理の計算・通知設定をここから管理できます。
          </p>
        </div>
        <div className="settings-preview">
          {preview?.images?.wait ? (
            <img src={preview.images.wait} alt="キャラクタープレビュー" />
          ) : (
            <span>画像なし</span>
          )}
        </div>
      </header>

      <nav className="settings-toolbar" aria-label="設定カテゴリ">
        <button
          type="button"
          className={activeTab === 'appearance' ? 'is-active' : ''}
          onClick={() => setActiveTab('appearance')}
        >
          表示設定
        </button>
        <button
          type="button"
          className={activeTab === 'behavior' ? 'is-active' : ''}
          onClick={() => setActiveTab('behavior')}
        >
          ふるまい
        </button>
        <button
          type="button"
          className={activeTab === 'projectReview' ? 'is-active' : ''}
          onClick={() => setActiveTab('projectReview')}
        >
          長期プロジェクトレビュー
        </button>
        <button
          type="button"
          className={activeTab === 'projects' ? 'is-active' : ''}
          onClick={() => setActiveTab('projects')}
        >
          長期設定
        </button>
        <button
          type="button"
          className={activeTab === 'calendar' ? 'is-active' : ''}
          onClick={() => setActiveTab('calendar')}
        >
          Googleカレンダー
        </button>
        <button
          type="button"
          className={activeTab === 'account' ? 'is-active' : ''}
          onClick={() => setActiveTab('account')}
        >
          アカウント
        </button>
      </nav>

      {(message || error) && (
        <div
          className={`settings-message${error ? ' settings-message--error' : ''}`}
        >
          {error || message}
        </div>
      )}

      {activeTab === 'account' ? (
        <AccountPanel selectedCharacter={settings.selectedCharacter} />
      ) : activeTab === 'calendar' ? (
        <GoogleCalendarPanel />
      ) : activeTab === 'appearance' ? (
        <>
          <section className="settings-card">
            <div className="settings-card__heading">
              <div>
                <span>CHARACTER</span>
                <h2>使用するキャラクター</h2>
              </div>
              <strong>{settings.selectedCharacter}</strong>
            </div>
            <div className="character-options">
              {characters.map((character) => (
                <button
                  key={character.name}
                  type="button"
                  className={
                    settings.selectedCharacter === character.name ? 'is-selected' : ''
                  }
                  onClick={() => selectCharacter(character.name)}
                  disabled={!character.valid}
                >
                  <span>{character.name}</span>
                  <small>
                    {character.valid
                      ? '使用できます'
                      : `不足: ${character.missingFiles.join(', ')}`}
                  </small>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-card settings-card--compact">
            <div>
              <span className="settings-card__label">CHARACTER DISPLAY</span>
              <h2>キャラクター表示</h2>
              <p>
                オフにするとキャラクターを隠し、長期タスク管理をアプリ画面として使います。
              </p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.showCharacter !== false}
                onChange={(event) => update({ showCharacter: event.target.checked })}
              />
              <span />
            </label>
          </section>

          <section className="settings-card">
            <div className="settings-card__heading">
              <div>
                <span>APPEARANCE</span>
                <h2>表示サイズ</h2>
              </div>
            </div>
            <label className="range-setting">
              <span>
                キャラクターサイズ <strong>{settings.characterScale}%</strong>
              </span>
              <input
                type="range"
                min="50"
                max="200"
                step="10"
                value={settings.characterScale}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    characterScale: Number(event.target.value)
                  }))
                }
                onPointerUp={(event) =>
                  update({ characterScale: Number(event.currentTarget.value) })
                }
                onKeyUp={(event) =>
                  update({ characterScale: Number(event.currentTarget.value) })
                }
              />
            </label>
            <label className="range-setting">
              <span>
                吹き出しサイズ <strong>{settings.bubbleScale}%</strong>
              </span>
              <input
                type="range"
                min="50"
                max="200"
                step="10"
                value={settings.bubbleScale}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    bubbleScale: Number(event.target.value)
                  }))
                }
                onPointerUp={(event) =>
                  update({ bubbleScale: Number(event.currentTarget.value) })
                }
                onKeyUp={(event) =>
                  update({ bubbleScale: Number(event.currentTarget.value) })
                }
              />
            </label>
          </section>

          <section className="settings-card settings-card--compact">
            <div>
              <span className="settings-card__label">WINDOWS TOAST</span>
              <h2>Windows標準通知も表示</h2>
              <p>オンにすると、長期Todoの吹き出し通知に加えてWindowsの通知も表示します。</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.useNativeNotifications !== false}
                onChange={(event) =>
                  update({ useNativeNotifications: event.target.checked })
                }
              />
              <span />
            </label>
          </section>

          <section className="settings-card settings-card--compact">
            <div>
              <span className="settings-card__label">SYSTEM</span>
              <h2>Windows起動時の自動起動</h2>
              <p>ログイン後にTaskMateを自動で起動します。</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.autoStart}
                onChange={(event) => update({ autoStart: event.target.checked })}
              />
              <span />
            </label>
          </section>

          <section className="settings-card settings-card--compact">
            <div>
              <span className="settings-card__label">POSITION</span>
              <h2>ウィンドウ位置</h2>
              <p>キャラクターを主画面の左下へ戻します。</p>
            </div>
            <button type="button" className="secondary-button" onClick={resetPosition}>
              位置をリセット
            </button>
          </section>
        </>
      ) : activeTab === 'behavior' ? (
        <>
          <section className="settings-card settings-card--compact">
            <div>
              <span className="settings-card__label">BEHAVIOR</span>
              <h2>ふるまい全体</h2>
              <p>オフにすると、自発的なセリフや周辺表現を抑えます。</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.behaviorEnabled !== false}
                onChange={(event) => update({ behaviorEnabled: event.target.checked })}
              />
              <span />
            </label>
          </section>

          <section className="settings-card">
            <div className="settings-card__heading">
              <div>
                <span>DESKTOP ATMOSPHERE</span>
                <h2>生活圧の表現</h2>
              </div>
            </div>

            <div className="behavior-options">
              <section className="behavior-option">
                <div>
                  <strong>周辺表現</strong>
                  <p>タスク状態をキャラクター周りの控えめな空気感として表示します。</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.ambientEffects !== false}
                    onChange={(event) => update({ ambientEffects: event.target.checked })}
                  />
                  <span />
                </label>
              </section>

              <section className="behavior-option">
                <div>
                  <strong>自律移動</strong>
                  <p>キャラクターが現在位置の近くで小さく動きます。</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.autonomousMovement !== false}
                    onChange={(event) =>
                      update({ autonomousMovement: event.target.checked })
                    }
                  />
                  <span />
                </label>
              </section>

              <section className="behavior-option">
                <div>
                  <strong>完了リアクション</strong>
                  <p>タスク完了時に短いrelieved/celebrating反応を表示します。</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.completionReactions !== false}
                    onChange={(event) =>
                      update({ completionReactions: event.target.checked })
                    }
                  />
                  <span />
                </label>
              </section>

              <section className="behavior-option">
                <div>
                  <strong>継続関係の記憶</strong>
                  <p>起動日数や完了数をlife-state.jsonへ保存します。</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.relationshipMemoryEnabled !== false}
                    onChange={(event) =>
                      update({ relationshipMemoryEnabled: event.target.checked })
                    }
                  />
                  <span />
                </label>
              </section>
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card__heading">
              <div>
                <span>INTENSITY</span>
                <h2>強さと静かな時間帯</h2>
              </div>
            </div>

            <label className="field">
              <span>ふるまいの強さ</span>
              <select
                value={settings.behaviorIntensity || 'normal'}
                onChange={(event) => update({ behaviorIntensity: event.target.value })}
              >
                <option value="low">低</option>
                <option value="normal">通常</option>
                <option value="high">高</option>
              </select>
            </label>

            <div className="quiet-hours">
              <div className="notification-channel">
                <div>
                  <span className="settings-card__label">QUIET HOURS</span>
                  <strong>静かな時間帯</strong>
                  <p>この時間帯は自律移動と自発セリフを抑制します。</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.quietHours?.enabled !== false}
                    onChange={(event) =>
                      updateQuietHours({ enabled: event.target.checked })
                    }
                  />
                  <span />
                </label>
              </div>
              <div className="quiet-hours__times">
                <label className="field">
                  <span>開始</span>
                  <input
                    type="time"
                    value={settings.quietHours?.start || '22:00'}
                    onChange={(event) => updateQuietHours({ start: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>終了</span>
                  <input
                    type="time"
                    value={settings.quietHours?.end || '07:00'}
                    onChange={(event) => updateQuietHours({ end: event.target.value })}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="settings-card settings-card--compact">
            <div>
              <span className="settings-card__label">LIFE STATE</span>
              <h2>関係記憶をリセット</h2>
              <p>タスク、通知状態、表示設定はそのまま残します。</p>
            </div>
            <button type="button" className="danger-button" onClick={resetLifeState}>
              リセット
            </button>
          </section>
        </>
      ) : activeTab === 'projectReview' ? (
        <ProjectManagementMode
          settings={settings}
          title="長期プロジェクトレビュー"
          eyebrow="PROJECT REVIEW"
        />
      ) : activeTab === 'projects' ? (
        <>
          <section className="settings-card">
            <div className="settings-card__heading">
              <div>
                <span>LONG TERM TASKS</span>
                <h2>長期タスク管理</h2>
              </div>
            </div>
            <p>
              今日のおすすめTodo、遅延リスク、期限警告の計算に使う作業可能時間です。
            </p>

            <div className="project-settings-grid">
              <label className="field">
                <span>1日に作業可能な時間</span>
                <input
                  type="number"
                  min="15"
                  max="1440"
                  value={settings.projectSettings?.dailyAvailableMinutes || 120}
                  onChange={(event) =>
                    updateProjectSettings({ dailyAvailableMinutes: Number(event.target.value) })
                  }
                />
              </label>
              <label className="field">
                <span>平日の作業可能時間</span>
                <input
                  type="number"
                  min="15"
                  max="1440"
                  value={settings.projectSettings?.weekdayAvailableMinutes || 120}
                  onChange={(event) =>
                    updateProjectSettings({ weekdayAvailableMinutes: Number(event.target.value) })
                  }
                />
              </label>
              <label className="field">
                <span>休日の作業可能時間</span>
                <input
                  type="number"
                  min="15"
                  max="1440"
                  value={settings.projectSettings?.weekendAvailableMinutes || 240}
                  onChange={(event) =>
                    updateProjectSettings({ weekendAvailableMinutes: Number(event.target.value) })
                  }
                />
              </label>
              <label className="field">
                <span>1回のおすすめ作業時間</span>
                <input
                  type="number"
                  min="5"
                  max="240"
                  value={settings.projectSettings?.defaultSessionMinutes || 45}
                  onChange={(event) =>
                    updateProjectSettings({ defaultSessionMinutes: Number(event.target.value) })
                  }
                />
              </label>
              <label className="field">
                <span>おすすめTodo数</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={settings.projectSettings?.dailyRecommendationLimit || 5}
                  onChange={(event) =>
                    updateProjectSettings({ dailyRecommendationLimit: Number(event.target.value) })
                  }
                />
              </label>
              <label className="field">
                <span>期限警告を出す日数</span>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={settings.projectSettings?.deadlineWarningDays || 7}
                  onChange={(event) =>
                    updateProjectSettings({ deadlineWarningDays: Number(event.target.value) })
                  }
                />
              </label>
            </div>
          </section>

          <section className="settings-card settings-card--compact">
            <div>
              <span className="settings-card__label">LONG TERM NOTIFICATIONS</span>
              <h2>期限超過通知</h2>
              <p>長期タスク内のTodoの期限超過を通知対象にします。</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.projectSettings?.overdueNotificationsEnabled !== false}
                onChange={(event) =>
                  updateProjectSettings({
                    overdueNotificationsEnabled: event.target.checked
                  })
                }
              />
              <span />
            </label>
          </section>

          <section className="settings-card settings-card--compact">
            <div>
              <span className="settings-card__label">PROGRESS WATCH</span>
              <h2>進捗通知</h2>
              <p>遅延リスクが高い長期タスクの通知を有効にします。</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.projectSettings?.progressNotificationsEnabled !== false}
                onChange={(event) =>
                  updateProjectSettings({
                    progressNotificationsEnabled: event.target.checked
                  })
                }
              />
              <span />
            </label>
          </section>
        </>
      ) : null}
    </main>
  );
}
