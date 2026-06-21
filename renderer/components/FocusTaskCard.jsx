import { formatTaskTime } from '../utils/dateUtils';
import '../styles/FocusTaskCard.css';

const STATE_LABELS = {
  future: 'これから',
  calm: '余裕あり',
  warning: '近づいています',
  urgent: 'まもなく',
  overdue: '期限超過'
};

export default function FocusTaskCard({
  task,
  taskState,
  focused = false,
  onFocus,
  onClear,
  onComplete
}) {
  if (!task) {
    return null;
  }

  const state = taskState?.state || 'calm';
  return (
    <article
      className={`focus-task focus-task--${state}${focused ? ' focus-task--focused' : ''}`}
      data-interactive="true"
      aria-label={focused ? '今やるタスク' : '注目タスク'}
    >
      <div className="focus-task__content">
        <span>{focused ? 'NOW' : STATE_LABELS[state] || 'TASK'}</span>
        <strong>{task.title}</strong>
        <small>{formatTaskTime(task, state === 'overdue')}</small>
      </div>
      <div className="focus-task__actions">
        {!focused ? (
          <button type="button" onClick={() => onFocus(task.id)}>
            今やる
          </button>
        ) : (
          <button type="button" onClick={onClear}>
            外す
          </button>
        )}
        <button type="button" onClick={() => onComplete(task.id)}>
          完了
        </button>
      </div>
    </article>
  );
}
