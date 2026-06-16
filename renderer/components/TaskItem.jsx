import { formatTaskTime } from '../utils/dateUtils';

const PRIORITY_LABELS = {
  high: '高',
  normal: '通常',
  low: '低'
};

export default function TaskItem({ task, overdue, onComplete }) {
  return (
    <li className={`task-item${overdue ? ' task-item--overdue' : ''}`}>
      <label className="task-item__check">
        <input
          type="checkbox"
          checked={false}
          aria-label={`${task.title}を完了にする`}
          onChange={() => onComplete(task.id)}
        />
        <span aria-hidden="true" />
      </label>
      <div className="task-item__content">
        <div className="task-item__main">
          <time>{formatTaskTime(task, overdue)}</time>
          <strong>{task.title}</strong>
        </div>
        {task.description && <p>{task.description}</p>}
        <div className="task-item__meta">
          {overdue && <span className="task-tag task-tag--danger">期限超過</span>}
          {task.genre && <span className="task-tag">{task.genre}</span>}
          <span className={`task-priority task-priority--${task.priority}`}>
            優先度 {PRIORITY_LABELS[task.priority]}
          </span>
        </div>
      </div>
    </li>
  );
}
