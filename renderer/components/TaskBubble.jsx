import TaskList from './TaskList';
import '../styles/TaskBubble.css';

export default function TaskBubble({
  tasks,
  onComplete,
  onFocusTask,
  focusTaskId,
  onClose,
  onOpenSettings
}) {
  return (
    <section className="task-bubble" data-interactive="true" aria-label="タスク一覧">
      <header className="task-bubble__header">
        <div>
          <span className="task-bubble__eyebrow">TASK LIST</span>
          <h2>今日のタスク</h2>
        </div>
        <div className="task-bubble__actions">
          <button type="button" onClick={onOpenSettings} aria-label="設定を開く">
            ⚙
          </button>
          <button type="button" onClick={onClose} aria-label="タスク一覧を閉じる">
            ×
          </button>
        </div>
      </header>
      <TaskList
        tasks={tasks}
        onComplete={onComplete}
        onFocusTask={onFocusTask}
        focusTaskId={focusTaskId}
      />
    </section>
  );
}
