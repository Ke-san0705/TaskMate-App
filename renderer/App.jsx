import { useCallback, useEffect, useRef, useState } from 'react';
import AmbientStateLayer from './components/AmbientStateLayer';
import Character from './components/Character';
import CharacterStatusBadge from './components/CharacterStatusBadge';
import DialogueBubble from './components/DialogueBubble';
import GoogleCalendarToday from './components/GoogleCalendarToday';
import ProjectManagementMode from './components/ProjectManagementMode';
import SettingsPanel from './components/SettingsPanel';
import useCharacter from './hooks/useCharacter';
import useCharacterBehavior from './hooks/useCharacterBehavior';
import useClickThrough from './hooks/useClickThrough';
import { chooseDialogue, fillDialogue } from './utils/dialogueUtils';
import './styles/App.css';

const WINDOW_MARGIN_PX = 12;
const RESIZE_DEBOUNCE_MS = 90;
const RESIZE_EPSILON_PX = 4;

function readPixels(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boundsChanged(previous, next) {
  if (!previous && !next) {
    return false;
  }
  if (!previous || !next) {
    return true;
  }
  return ['x', 'y', 'width', 'height'].some(
    (key) => Math.abs(previous[key] - next[key]) > RESIZE_EPSILON_PX
  );
}

function resizePayloadChanged(previous, next) {
  if (!previous) {
    return true;
  }
  return (
    Math.abs(previous.width - next.width) > RESIZE_EPSILON_PX ||
    Math.abs(previous.height - next.height) > RESIZE_EPSILON_PX ||
    boundsChanged(previous.dragBounds, next.dragBounds)
  );
}

function measureStageWindow(stage) {
  const stageWidth = Math.ceil(stage.offsetWidth);
  const stageHeight = Math.ceil(stage.offsetHeight);
  if (stageWidth <= 0 || stageHeight <= 0) {
    return null;
  }

  const stageStyle = window.getComputedStyle(stage);
  const stageLeft = readPixels(stageStyle.left, WINDOW_MARGIN_PX);
  const stageBottom = readPixels(stageStyle.bottom, WINDOW_MARGIN_PX);
  const width = Math.ceil(stageWidth + stageLeft + WINDOW_MARGIN_PX);
  const height = Math.ceil(stageHeight + stageBottom + WINDOW_MARGIN_PX);
  const character = stage.querySelector('.character');
  let dragBounds = null;

  if (character && character.offsetWidth > 0 && character.offsetHeight > 0) {
    dragBounds = {
      x: Math.round(stageLeft + character.offsetLeft),
      y: Math.round(height - stageBottom - stageHeight + character.offsetTop),
      width: Math.ceil(character.offsetWidth),
      height: Math.ceil(character.offsetHeight)
    };
  }

  return { width, height, dragBounds };
}

function MainView() {
  const { character, settings, loading: characterLoading } = useCharacter();
  const { behavior, recordInteraction } = useCharacterBehavior();
  const [expanded, setExpanded] = useState(false);
  const [notification, setNotification] = useState(null);
  const [clickActive, setClickActive] = useState(false);
  const [clickDialogueActive, setClickDialogueActive] = useState(false);
  const [projectCompactCollapsed, setProjectCompactCollapsed] = useState(false);
  const [dialogue, setDialogue] = useState('今日も一緒に進めよう！');
  const stageRef = useRef(null);
  const clickTimerRef = useRef(null);
  const dialogueTimerRef = useRef(null);
  const lastDialogueRef = useRef('');
  const lastResizeRef = useRef(null);

  useClickThrough(true);

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

  // 長期タスク管理だけを表示するため、通常タスク件数には依存しない案内にします。
  // 通知やクリックの一時セリフが出ている間は、それらを優先して上書きしません。
  useEffect(() => {
    if (notification || clickDialogueActive || characterLoading) {
      return;
    }
    if (character?.error) {
      chooseAndSetDialogue('loadError');
    } else if (behavior.dialogueCategory) {
      chooseAndSetDialogue(behavior.dialogueCategory, {
        ...(behavior.dialogueVariables || {})
      });
    } else if (
      behavior.reason === 'quiet-hours' ||
      behavior.reason === 'main-window-hidden' ||
      behavior.reason === 'level-cooldown'
    ) {
      return;
    } else {
      chooseAndSetDialogue('longTermIdle');
    }
  }, [
    behavior.dialogueCategory,
    behavior.dialogueVariables,
    behavior.reason,
    character?.error,
    characterLoading,
    chooseAndSetDialogue,
    clickDialogueActive,
    notification
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
    const category =
      notification.dialogueCategory ||
      (notification.minutes > 0 ? 'deadlineNear' : 'deadlineNow');
    chooseAndSetDialogue(category, notification);
  }, [chooseAndSetDialogue, notification]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return undefined;
    }
    let frame = null;
    let timer = null;
    const scheduleResize = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      frame = requestAnimationFrame(() => {
        timer = setTimeout(() => {
          const next = measureStageWindow(stage);
          if (!next || !resizePayloadChanged(lastResizeRef.current, next)) {
            return;
          }
          lastResizeRef.current = next;
          window.taskMate.resizeMainWindow(next);
        }, RESIZE_DEBOUNCE_MS);
      });
    };
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(stage);
    scheduleResize();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
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
    recordInteraction('character-click');
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

  const state = notification ? 'notifying' : clickActive ? 'clicked' : behavior.mood || 'calm';
  const showCharacter = settings.showCharacter !== false;
  const showDialogue = showCharacter || Boolean(notification);
  const showProjectMode = !notification?.notificationOnly;
  const characterScale = settings.characterScale / 100;
  const bubbleScale = settings.bubbleScale / 100;

  useEffect(() => {
    if (!showCharacter && !notification) {
      setExpanded(true);
    }
  }, [notification, showCharacter]);

  useEffect(() => {
    if (!showProjectMode) {
      setProjectCompactCollapsed(false);
    }
  }, [showProjectMode]);

  return (
    <main
      className={`mascot-root${showCharacter ? '' : ' mascot-root--app-mode'}${
        showProjectMode ? ' mascot-root--project-mode' : ''
      }`}
      data-mood={behavior.mood || 'calm'}
      style={{
        '--character-scale': characterScale,
        '--bubble-scale': bubbleScale
      }}
    >
      <section
        ref={stageRef}
        className={`mascot-stage${showCharacter ? '' : ' mascot-stage--character-hidden'}`}
      >
        <AmbientStateLayer
          mood={behavior.mood || 'calm'}
          level={behavior.ambientLevel}
          enabled={settings.ambientEffects !== false && settings.behaviorEnabled !== false}
        />

        {showCharacter && (
          <Character
            state={state}
            images={character?.images}
            name={character?.name || settings.selectedCharacter}
            onClick={handleCharacterClick}
            onContextMenu={() => window.taskMate.showCharacterMenu()}
          />
        )}

        <div
          className={`bubble-stack${
            showProjectMode && projectCompactCollapsed
              ? ' bubble-stack--project-collapsed'
              : ''
          }`}
        >
          {showCharacter && <CharacterStatusBadge mood={state} />}

          {showDialogue && (
            <DialogueBubble
              text={dialogue}
              notification={notification}
              expanded={expanded}
              onToggle={() => {
                if (notification) {
                  acknowledgeNotification();
                } else {
                  if (!expanded) {
                    recordInteraction('task-list-open');
                  }
                  setExpanded((value) => !value);
                }
              }}
              onAcknowledge={acknowledgeNotification}
              onOpenSettings={() => window.taskMate.openSettings()}
            />
          )}

          {!notification && (
            <GoogleCalendarToday
              onTaskCreated={(task) =>
                chooseAndSetDialogue('showOneChoice', { title: task?.title || '' })
              }
            />
          )}

          {showProjectMode && (
            <ProjectManagementMode
              settings={settings}
              onDialogue={chooseAndSetDialogue}
              onCompactCollapsedChange={setProjectCompactCollapsed}
              compact
            />
          )}
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const view = new URLSearchParams(window.location.search).get('view');
  return view === 'settings' ? <SettingsPanel /> : <MainView />;
}
