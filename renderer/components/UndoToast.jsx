import { useEffect } from 'react';

function UndoItem({ item, onUndo, onExpire }) {
  useEffect(() => {
    const timer = setTimeout(() => onExpire(item.id), 5000);
    return () => clearTimeout(timer);
  }, [item.id, onExpire]);

  return (
    <div className="undo-toast__item" data-interactive="true">
      <span>「{item.title}」を完了しました</span>
      <button type="button" onClick={() => onUndo(item.id)}>
        元に戻す
      </button>
    </div>
  );
}

export default function UndoToast({ items, onUndo, onExpire }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <aside className="undo-toast" aria-live="polite">
      {items.map((item) => (
        <UndoItem key={item.id} item={item} onUndo={onUndo} onExpire={onExpire} />
      ))}
    </aside>
  );
}
