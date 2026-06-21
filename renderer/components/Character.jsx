import { useRef } from 'react';
import '../styles/Character.css';

const DRAG_THRESHOLD = 14;
const FAST_DRAG_THRESHOLD = 28;
const DRAG_ARM_DELAY_MS = 120;

function distanceFromStart(event, current) {
  return Math.max(
    Math.hypot(event.clientX - current.startClientX, event.clientY - current.startClientY),
    Math.hypot(event.screenX - current.startScreenX, event.screenY - current.startScreenY)
  );
}

function shouldStartDrag(event, current) {
  const distance = distanceFromStart(event, current);
  if (distance >= FAST_DRAG_THRESHOLD) {
    return true;
  }
  return distance >= DRAG_THRESHOLD && performance.now() - current.startedAt >= DRAG_ARM_DELAY_MS;
}

export default function Character({ state, images, name, onClick, onContextMenu }) {
  const pointerState = useRef(null);
  const imageSource = images?.[state] || images?.wait;

  function handlePointerDown(event) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    window.taskMate.setClickThrough(false);
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerState.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScreenX: event.screenX,
      startScreenY: event.screenY,
      startedAt: performance.now(),
      dragging: false
    };
  }

  function handlePointerMove(event) {
    const current = pointerState.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }
    if ((event.buttons & 1) !== 1) {
      void finishPointer(event, { cancelled: true });
      return;
    }
    if (!current.dragging && shouldStartDrag(event, current)) {
      current.dragging = true;
      window.taskMate.beginWindowDrag({
        x: current.startScreenX,
        y: current.startScreenY
      });
    }
    if (current.dragging) {
      event.preventDefault();
      window.taskMate.moveWindowDrag({ x: event.screenX, y: event.screenY });
    }
  }

  async function finishPointer(event, { cancelled = false } = {}) {
    const current = pointerState.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }
    pointerState.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (current.dragging) {
      event.preventDefault();
      await window.taskMate.endWindowDrag();
    } else if (!cancelled) {
      // 透過へ戻すタイミングはuseClickThroughへ集約します。
      // キャラクター側で即時に戻すと、短い連続クリックの2回目が背面へ抜けるためです。
      onClick();
    }
  }

  return (
    <button
      type="button"
      className={`character character--${state}`}
      data-interactive="true"
      aria-label={`${name}をクリックまたはドラッグ`}
      title="クリックで会話、ドラッグで移動"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={(event) => finishPointer(event, { cancelled: true })}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu();
      }}
    >
      {imageSource ? (
        <img
          src={imageSource}
          alt={`${name} - ${state}`}
          draggable="false"
          onDragStart={(event) => event.preventDefault()}
        />
      ) : (
        <span className="character__fallback" role="img" aria-label="画像なし">
          <span>TaskMate</span>
          <small>画像を確認してください</small>
        </span>
      )}
    </button>
  );
}
