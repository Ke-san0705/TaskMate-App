import { useRef } from 'react';
import '../styles/Character.css';

const DRAG_THRESHOLD = 7;

export default function Character({ state, images, name, onClick, onContextMenu }) {
  const pointerState = useRef(null);
  const imageSource = images?.[state] || images?.wait;

  function handlePointerDown(event) {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerState.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScreenX: event.screenX,
      startScreenY: event.screenY,
      dragging: false
    };
  }

  function handlePointerMove(event) {
    const current = pointerState.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }
    const distance = Math.hypot(
      event.clientX - current.startClientX,
      event.clientY - current.startClientY
    );
    if (!current.dragging && distance >= DRAG_THRESHOLD) {
      current.dragging = true;
      window.taskMate.beginWindowDrag({
        x: current.startScreenX,
        y: current.startScreenY
      });
    }
    if (current.dragging) {
      window.taskMate.moveWindowDrag({ x: event.screenX, y: event.screenY });
    }
  }

  async function finishPointer(event) {
    const current = pointerState.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }
    pointerState.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (current.dragging) {
      await window.taskMate.endWindowDrag();
    } else {
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
      onPointerCancel={finishPointer}
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
