import '../styles/TaskBubble.css';

export default function DialogueBubble({
  text,
  notification,
  expanded,
  onToggle,
  onAcknowledge,
  onOpenSettings
}) {
  return (
    <section
      className={`dialogue-bubble${notification ? ' dialogue-bubble--alarm' : ''}`}
      data-interactive="true"
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="dialogue-bubble__topline">
        <span>{notification ? 'お知らせ' : 'TaskMate'}</span>
        {!notification && (
          <button
            type="button"
            aria-label="設定を開く"
            onClick={(event) => {
              event.stopPropagation();
              onOpenSettings();
            }}
          >
            ⚙
          </button>
        )}
      </div>
      <p>{text}</p>
      {notification ? (
        <div className="dialogue-bubble__notification">
          <strong>{notification.title}</strong>
          <span>{notification.time}</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAcknowledge();
            }}
          >
            確認
          </button>
        </div>
      ) : (
        <small>{expanded ? 'クリックして閉じる' : 'クリックしてタスクを見る'}</small>
      )}
    </section>
  );
}
