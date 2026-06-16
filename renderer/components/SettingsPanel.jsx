import { useEffect, useMemo, useState } from 'react';
import { getLocalDateKey } from '../utils/dateUtils';
import '../styles/SettingsPanel.css';

const DEFAULT_NOTIFICATION_OFFSETS = [30, 0];
const MAX_NOTIFICATION_OFFSETS = 8;
const MAX_NOTIFICATION_OFFSET_MINUTES = 24 * 60;

function createEmptyTaskForm(date = getLocalDateKey()) {
  return {
    title: '',
    description: '',
    date,
    time: '',
    genre: '',
    priority: 'normal'
  };
}

const EMPTY_TASK_FORM = createEmptyTaskForm();

const PRIORITY_LABELS = {
  high: '高',
  normal: '通常',
  low: '低'
};

const NO_GENRE_LABEL = '未設定';

function sortTasksForSettings(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    if (a.time && b.time) {
      return a.time.localeCompare(b.time);
    }
    if (a.time !== b.time) {
      return a.time ? -1 : 1;
    }
    return a.title.localeCompare(b.title, 'ja');
  });
}

function getGenreCandidates(tasks, genreHistory = []) {
  const genres = new Set();
  for (const genre of genreHistory) {
    if (typeof genre === 'string' && genre.trim()) {
      genres.add(genre.trim());
    }
  }
  for (const task of tasks) {
    const genre = task.genre?.trim();
    if (genre) {
      genres.add(genre);
    }
  }
  return [...genres].sort((a, b) => a.localeCompare(b, 'ja'));
}

function groupTasksByGenre(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    const genre = task.genre?.trim() || NO_GENRE_LABEL;
    if (!groups.has(genre)) {
      groups.set(genre, []);
    }
    groups.get(genre).push(task);
  }

  return [...groups.entries()]
    .map(([genre, groupedTasks]) => ({
      genre,
      tasks: sortTasksForSettings(groupedTasks),
      incompleteCount: groupedTasks.filter((task) => !task.completed).length
    }))
    .sort((a, b) => {
      if (a.genre === NO_GENRE_LABEL) {
        return 1;
      }
      if (b.genre === NO_GENRE_LABEL) {
        return -1;
      }
      return a.genre.localeCompare(b.genre, 'ja');
    });
}

function formatTaskDate(task) {
  return `${task.date} ${task.time || '今日中'}`;
}

function taskToForm(task) {
  return {
    title: task.title,
    description: task.description || '',
    date: task.date,
    time: task.time || '',
    genre: task.genre || '',
    priority: task.priority || 'normal'
  };
}

function sanitizeNotificationOffsets(offsets) {
  const normalized = [];
  for (const offset of offsets) {
    if (!Number.isFinite(offset)) {
      continue;
    }
    const minutes = Math.min(
      MAX_NOTIFICATION_OFFSET_MINUTES,
      Math.max(0, Math.round(offset))
    );
    if (!normalized.includes(minutes)) {
      normalized.push(minutes);
    }
    if (normalized.length >= MAX_NOTIFICATION_OFFSETS) {
      break;
    }
  }
  return (normalized.length > 0 ? normalized : DEFAULT_NOTIFICATION_OFFSETS).sort(
    (a, b) => b - a
  );
}

function formatNotificationOffset(minutes) {
  return minutes === 0 ? '締切時刻ちょうど' : `${minutes}分前`;
}

function nextDefaultNotificationOffset(offsets) {
  const candidates = [10, 15, 30, 60, 120, 0, 5, 1];
  return candidates.find((minutes) => !offsets.includes(minutes)) ?? 1;
}

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState('appearance');
  const [settings, setSettings] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskLoadError, setTaskLoadError] = useState('');
  const [preview, setPreview] = useState(null);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const sortedTasks = useMemo(() => sortTasksForSettings(tasks), [tasks]);
  const genreCandidates = useMemo(
    () => getGenreCandidates(tasks, settings?.genreHistory),
    [settings?.genreHistory, tasks]
  );
  const groupedTasks = useMemo(() => groupTasksByGenre(sortedTasks), [sortedTasks]);
  const incompleteCount = useMemo(
    () => tasks.filter((task) => !task.completed).length,
    [tasks]
  );
  const notificationOffsets = useMemo(
    () => sanitizeNotificationOffsets(settings?.notificationOffsets || DEFAULT_NOTIFICATION_OFFSETS),
    [settings?.notificationOffsets]
  );
  const isEditingTask = Boolean(editingTaskId);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      window.taskMate.getSettings(),
      window.taskMate.getCharacters(),
      window.taskMate.getTasks()
    ])
      .then(([loadedSettings, loadedCharacters, taskResult]) => {
        if (mounted) {
          setSettings(loadedSettings);
          setCharacters(loadedCharacters);
          setTasks(taskResult.tasks || []);
          setTaskLoadError(taskResult.error || '');
        }
      })
      .catch((loadError) => setError(loadError.message));

    const unsubscribeSettings = window.taskMate.onSettingsUpdated((next) => {
      if (mounted) {
        setSettings(next);
      }
    });
    const unsubscribeTasks = window.taskMate.onTasksUpdated((result) => {
      if (mounted) {
        setTasks(result.tasks || []);
        setTaskLoadError(result.error || '');
      }
    });

    return () => {
      mounted = false;
      unsubscribeSettings();
      unsubscribeTasks();
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

  async function reloadTasks() {
    setError('');
    setMessage('');
    const result = await window.taskMate.reloadTasks();
    setTasks(result.tasks || []);
    setTaskLoadError(result.error || '');
    setMessage(result.error ? '' : 'tasks.jsonを再読み込みしました。');
  }

  function updateTaskForm(field, value) {
    setTaskForm((current) => ({ ...current, [field]: value }));
  }

  async function rememberGenre(genre) {
    const nextGenre = genre?.trim();
    if (nextGenre && !genreCandidates.includes(nextGenre)) {
      const nextSettings = await window.taskMate.updateSettings({
        genreHistory: [...genreCandidates, nextGenre]
      });
      setSettings(nextSettings);
    }
  }

  function resetTaskForm(date = getLocalDateKey()) {
    setTaskForm(createEmptyTaskForm(date));
    setEditingTaskId(null);
  }

  function startEditTask(task) {
    setError('');
    setMessage(`「${task.title}」を編集中です。`);
    setEditingTaskId(task.id);
    setTaskForm(taskToForm(task));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submitTask(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const taskInput = {
        ...taskForm,
        time: taskForm.time || null
      };

      if (editingTaskId) {
        const updatedTask = await window.taskMate.updateTask(editingTaskId, taskInput);
        setTasks((current) =>
          current.map((task) => (task.id === updatedTask.id ? updatedTask : task))
        );
        await rememberGenre(updatedTask.genre);
        resetTaskForm(taskForm.date || getLocalDateKey());
        setMessage(`「${updatedTask.title}」を更新しました。`);
      } else {
        const addedTask = await window.taskMate.addTask(taskInput);
        setTasks((current) =>
          current.some((task) => task.id === addedTask.id)
            ? current
            : [...current, addedTask]
        );
        await rememberGenre(addedTask.genre);
        resetTaskForm(taskForm.date || getLocalDateKey());
        setMessage(`「${addedTask.title}」を追加しました。`);
      }
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  function changeNotificationOffset(index, value) {
    const minutes = Number(value);
    if (!Number.isFinite(minutes)) {
      return;
    }
    setSettings((current) => ({
      ...current,
      notificationOffsets: notificationOffsets.map((offset, offsetIndex) =>
        offsetIndex === index ? minutes : offset
      )
    }));
  }

  async function saveNotificationOffsets(offsets) {
    await update({ notificationOffsets: sanitizeNotificationOffsets(offsets) });
  }

  async function addNotificationOffset() {
    if (notificationOffsets.length >= MAX_NOTIFICATION_OFFSETS) {
      return;
    }
    await saveNotificationOffsets([
      ...notificationOffsets,
      nextDefaultNotificationOffset(notificationOffsets)
    ]);
  }

  async function removeNotificationOffset(index) {
    if (notificationOffsets.length <= 1) {
      return;
    }
    await saveNotificationOffsets(
      notificationOffsets.filter((_, offsetIndex) => offsetIndex !== index)
    );
  }

  async function deleteTask(task) {
    if (!window.confirm(`「${task.title}」を削除しますか？`)) {
      return;
    }
    setError('');
    setMessage('');
    try {
      await window.taskMate.deleteTask(task.id);
      setTasks((current) => current.filter((candidate) => candidate.id !== task.id));
      if (editingTaskId === task.id) {
        resetTaskForm();
      }
      setMessage(`「${task.title}」を削除しました。`);
    } catch (deleteError) {
      setError(deleteError.message);
    }
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
            表示の調整と、TaskMateが使うタスクデータをここから管理できます。
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
          className={activeTab === 'tasks' ? 'is-active' : ''}
          onClick={() => setActiveTab('tasks')}
        >
          タスク設定
          <span>{incompleteCount}</span>
        </button>
      </nav>

      {(message || error || taskLoadError) && (
        <div
          className={`settings-message${
            error || taskLoadError ? ' settings-message--error' : ''
          }`}
        >
          {error || taskLoadError || message}
        </div>
      )}

      {activeTab === 'appearance' ? (
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
                オフにするとキャラクターを隠し、タスク一覧をアプリ画面として使います。
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

          <section className="settings-card">
            <div className="settings-card__heading">
              <div>
                <span>NOTIFICATIONS</span>
                <h2>通知タイミング</h2>
              </div>
              <strong>{notificationOffsets.length}回</strong>
            </div>
            <p>
              時刻が設定された未完了タスクに対して、締切の何分前に通知するかを指定できます。
              0分前は締切時刻ちょうどです。
            </p>

            <div className="notification-channel">
              <div>
                <span className="settings-card__label">WINDOWS TOAST</span>
                <strong>Windows標準通知も表示</strong>
                <p>オンにすると、TaskMateの吹き出し通知に加えてWindowsの通知も表示します。</p>
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
            </div>

            <div className="notification-rules">
              {notificationOffsets.map((minutes, index) => (
                <div key={`${minutes}-${index}`} className="notification-rule">
                  <label className="field">
                    <span>{index + 1}回目の通知</span>
                    <input
                      type="number"
                      min="0"
                      max={MAX_NOTIFICATION_OFFSET_MINUTES}
                      step="1"
                      value={minutes}
                      onChange={(event) =>
                        changeNotificationOffset(index, event.target.value)
                      }
                      onBlur={() => saveNotificationOffsets(notificationOffsets)}
                    />
                  </label>
                  <span className="notification-rule__label">
                    {formatNotificationOffset(minutes)}
                  </span>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => removeNotificationOffset(index)}
                    disabled={notificationOffsets.length <= 1}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>

            <div className="task-form__actions">
              <button
                type="button"
                className="secondary-button"
                onClick={addNotificationOffset}
                disabled={notificationOffsets.length >= MAX_NOTIFICATION_OFFSETS}
              >
                通知を追加
              </button>
            </div>
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
      ) : (
        <>
          <section className="settings-card">
            <div className="settings-card__heading">
              <div>
                <span>TASKS</span>
                <h2>{isEditingTask ? 'タスクを編集' : 'タスクを追加'}</h2>
              </div>
              <button type="button" className="secondary-button" onClick={reloadTasks}>
                再読み込み
              </button>
            </div>

            <form className="task-form" onSubmit={submitTask}>
              <label className="field field--wide">
                <span>タスク名</span>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(event) => updateTaskForm('title', event.target.value)}
                  placeholder="例: レポートを提出する"
                  required
                />
              </label>

              <label className="field">
                <span>日付</span>
                <input
                  type="date"
                  value={taskForm.date}
                  onChange={(event) => updateTaskForm('date', event.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span>時刻</span>
                <input
                  type="time"
                  value={taskForm.time}
                  onChange={(event) => updateTaskForm('time', event.target.value)}
                />
                <small>空欄なら「今日中」として扱います。</small>
              </label>

              <label className="field">
                <span>ジャンル</span>
                <input
                  list="task-genre-options"
                  type="text"
                  value={taskForm.genre}
                  onChange={(event) => updateTaskForm('genre', event.target.value)}
                  placeholder="学校、私用など"
                />
                <datalist id="task-genre-options">
                  {genreCandidates.map((genre) => (
                    <option key={genre} value={genre} />
                  ))}
                </datalist>
              </label>

              <label className="field">
                <span>優先度</span>
                <select
                  value={taskForm.priority}
                  onChange={(event) => updateTaskForm('priority', event.target.value)}
                >
                  <option value="high">高</option>
                  <option value="normal">通常</option>
                  <option value="low">低</option>
                </select>
              </label>

              <label className="field field--wide">
                <span>説明</span>
                <textarea
                  rows="3"
                  value={taskForm.description}
                  onChange={(event) => updateTaskForm('description', event.target.value)}
                  placeholder="必要ならメモを入力"
                />
              </label>

              <div className="task-form__actions">
                <button type="submit" className="primary-button">
                  {isEditingTask ? '保存する' : '追加する'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => resetTaskForm()}
                >
                  {isEditingTask ? '編集をキャンセル' : '入力をクリア'}
                </button>
              </div>
            </form>

            {genreCandidates.length > 0 && (
              <div className="genre-palette" aria-label="登録済みジャンル">
                <span>登録済みジャンル</span>
                <div>
                  {genreCandidates.map((genre) => (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => updateTaskForm('genre', genre)}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="settings-card">
            <div className="settings-card__heading">
              <div>
                <span>TASK LIST</span>
                <h2>登録済みタスク</h2>
              </div>
              <strong>{tasks.length}件</strong>
            </div>

            {groupedTasks.length > 0 ? (
              <div className="task-settings-list">
                {groupedTasks.map((group) => (
                  <section key={group.genre} className="task-genre-group">
                    <header>
                      <div>
                        <span>GENRE</span>
                        <h3>{group.genre}</h3>
                      </div>
                      <strong>
                        {group.tasks.length}件
                        {group.incompleteCount > 0 && ` / 未完了${group.incompleteCount}件`}
                      </strong>
                    </header>
                    <div className="task-genre-group__items">
                      {group.tasks.map((task) => (
                        <article
                          key={task.id}
                          className={`task-settings-item${
                            task.completed ? ' task-settings-item--completed' : ''
                          }`}
                        >
                          <div>
                            <time>{formatTaskDate(task)}</time>
                            <h4>{task.title}</h4>
                            {task.description && <p>{task.description}</p>}
                            <div className="task-settings-item__meta">
                              <span>優先度 {PRIORITY_LABELS[task.priority]}</span>
                              {task.completed && <span>完了済み</span>}
                            </div>
                          </div>
                          <div className="task-settings-item__actions">
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => startEditTask(task)}
                            >
                              編集
                            </button>
                            <button
                              type="button"
                              className="danger-button"
                              onClick={() => deleteTask(task)}
                            >
                              削除
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <p className="task-settings-empty">登録済みタスクはありません。</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
