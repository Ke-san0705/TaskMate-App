import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Character from './components/Character';
import DialogueBubble from './components/DialogueBubble';
import SettingsPanel from './components/SettingsPanel';
import TaskBubble from './components/TaskBubble';
import UndoToast from './components/UndoToast';
import useCharacter from './hooks/useCharacter';
import useClickThrough from './hooks/useClickThrough';
import useTasks from './hooks/useTasks';
import { chooseDialogue, fillDialogue } from './utils/dialogueUtils';
import { getOverdueTasks, getTodayTasks, getVisibleTasks } from './utils/taskUtils';
import './styles/App.css';

function MainView() {
  const { tasks, error, completeTask, undoCompleteTask } = useTasks();
  const { character, settings, loading: characterLoading } = useCharacter();
  const [expanded, setExpanded] = useState(false);
  const [notification, setNotification] = useState(null);
  const [clickActive, setClickActive] = useState(false);
  const [clickDialogueActive, setClickDialogueActive] = useState(false);
  const [dialogue, setDialogue] = useState('今日も一緒に進めよう！');
  const [undoItems, setUndoItems] = useState([]);
  const stageRef = useRef(null);
  const clickTimerRef = useRef(null);
  const dialogueTimerRef = useRef(null);
  const lastDialogueRef = useRef('');

  useClickThrough(true);

  const visibleTasks = useMemo(() => getVisibleTasks(tasks), [tasks]);
  const todayTasks = useMemo(() => getTodayTasks(visibleTasks), [visibleTasks]);
  const overdueTasks = useMemo(() => getOverdueTasks(visibleTasks), [visibleTasks]);

  const chooseAndSetDialogue = useCallback(
    (category, variables = {}) => {
      const selected = chooseDialogue(
        character?.dialogues,
        category,
        lastDialogueRef.current
      );
      const next = fillDialogue(selected, variables);
      lastDialogueRef.current = next;
      setDialogue(next);
    },
    [character?.dialogues]
  );

  // タスク状況が変わったら、通常時の案内セリフも更新します。
  useEffect(() => {
    if (notification || clickDialogueActive || characterLoading) {
      return;
    }
    if (error || character?.error) {
      chooseAndSetDialogue('loadError');
    } else if (overdueTasks.length > 0) {
      chooseAndSetDialogue('overdue', { count: overdueTasks.length });
    } else if (todayTasks.length === 0) {
      chooseAndSetDialogue('noTasks');
    } else if (todayTasks.length === 1) {
      chooseAndSetDialogue('oneTask', todayTasks[0]);
    } else {
      chooseAndSetDialogue('multipleTasks', { count: todayTasks.length });
    }
  }, [
    character?.error,
    characterLoading,
    chooseAndSetDialogue,
    clickDialogueActive,
    error,
    notification,
    overdueTasks,
    todayTasks
  ]);

  useEffect(() => {
    let mounted = true;
    window.taskMate.getActiveNotification().then((active) => {
      if (mounted && active) {
        setNotification(active);
      }
    });
    const unsubscribeNotification = window.taskMate.onNotification((next) => {
      setNotification(next);
      setExpanded(false);
    });
    const unsubscribeCleared = window.taskMate.onNotificationCleared(() => {
      setNotification(null);
    });
    const unsubscribeShowTasks = window.taskMate.onShowTaskList(() => {
      setExpanded(true);
    });
    return () => {
      mounted = false;
      unsubscribeNotification();
      unsubscribeCleared();
      unsubscribeShowTasks();
    };
  }, []);

  useEffect(() => {
    if (!notification) {
      return;
    }
    const category = notification.minutes > 0 ? 'deadlineNear' : 'deadlineNow';
    chooseAndSetDialogue(category, notification);
  }, [chooseAndSetDialogue, notification]);

  useEffect(() => {
    if (!stageRef.current) {
      return undefined;
    }
    let frame = null;
    const observer = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = entry.target.getBoundingClientRect();
        window.taskMate.resizeMainWindow({
          width: Math.ceil(rect.width + 24),
          height: Math.ceil(rect.height + 24)
        });
      });
    });
    observer.observe(stageRef.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(
    () => () => {
      clearTimeout(clickTimerRef.current);
      clearTimeout(dialogueTimerRef.current);
    },
    []
  );

  function handleCharacterClick() {
    if (notification) {
      return;
    }
    clearTimeout(clickTimerRef.current);
    clearTimeout(dialogueTimerRef.current);
    setClickActive(true);
    setClickDialogueActive(true);
    chooseAndSetDialogue('click');
    clickTimerRef.current = setTimeout(() => {
      setClickActive(false);
    }, settings.clickImageDuration);
    dialogueTimerRef.current = setTimeout(() => {
      setClickDialogueActive(false);
    }, Math.max(settings.clickImageDuration + 1800, 3500));
  }

  async function handleComplete(taskId) {
    try {
      const completedTask = await completeTask(taskId);
      setUndoItems((current) => [
        ...current.filter((item) => item.id !== completedTask.id),
        { id: completedTask.id, title: completedTask.title }
      ]);
    } catch (completeError) {
      setDialogue(`完了状態を保存できませんでした: ${completeError.message}`);
    }
  }

  async function handleUndo(taskId) {
    try {
      await undoCompleteTask(taskId);
      setUndoItems((current) => current.filter((item) => item.id !== taskId));
    } catch (undoError) {
      setDialogue(`元に戻せませんでした: ${undoError.message}`);
    }
  }

  const handleUndoExpire = useCallback((taskId) => {
    setUndoItems((current) => current.filter((item) => item.id !== taskId));
  }, []);

  async function acknowledgeNotification() {
    if (!notification) {
      return;
    }
    try {
      const result = await window.taskMate.acknowledgeNotification(notification.id);
      if (!result.active) {
        setNotification(null);
      }
    } catch (acknowledgeError) {
      setDialogue(`通知を確認できませんでした: ${acknowledgeError.message}`);
    }
  }

  const state = notification ? 'alarm' : clickActive ? 'click' : 'wait';
  const showCharacter = settings.showCharacter !== false;
  const showDialogue = showCharacter || Boolean(notification);
  const showTaskList = (expanded || !showCharacter) && !notification?.notificationOnly;
  const characterScale = settings.characterScale / 100;
  const bubbleScale = settings.bubbleScale / 100;

  useEffect(() => {
    if (!showCharacter && !notification) {
      setExpanded(true);
    }
  }, [notification, showCharacter]);

  return (
    <main
      className={`mascot-root${showCharacter ? '' : ' mascot-root--app-mode'}`}
      style={{
        '--character-scale': characterScale,
        '--bubble-scale': bubbleScale
      }}
    >
      <section
        ref={stageRef}
        className={`mascot-stage${showCharacter ? '' : ' mascot-stage--character-hidden'}`}
      >
        {showCharacter && (
          <Character
            state={state}
            images={character?.images}
            name={character?.name || settings.selectedCharacter}
            onClick={handleCharacterClick}
            onContextMenu={() => window.taskMate.showCharacterMenu()}
          />
        )}

        <div className="bubble-stack">
          {showDialogue && (
            <DialogueBubble
              text={dialogue}
              notification={notification}
              expanded={expanded}
              onToggle={() => {
                if (notification) {
                  acknowledgeNotification();
                } else {
                  setExpanded((value) => !value);
                }
              }}
              onAcknowledge={acknowledgeNotification}
              onOpenSettings={() => window.taskMate.openSettings()}
            />
          )}

          {showTaskList && (
            <TaskBubble
              tasks={visibleTasks}
              onComplete={handleComplete}
              onClose={() => {
                if (showCharacter) {
                  setExpanded(false);
                } else {
                  window.taskMate.hideMainWindow();
                }
              }}
              onOpenSettings={() => window.taskMate.openSettings()}
            />
          )}
        </div>
      </section>

      <UndoToast
        items={undoItems}
        onUndo={handleUndo}
        onExpire={handleUndoExpire}
      />
    </main>
  );
}

export default function App() {
  const view = new URLSearchParams(window.location.search).get('view');
  return view === 'settings' ? <SettingsPanel /> : <MainView />;
}
