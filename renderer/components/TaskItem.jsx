import { formatTaskTime } from '../utils/dateUtils';

const PRIORITY_LABELS = {
  high: '高',
  normal: '通常',
  low: '低'
};

export default function TaskItem({ task, overdue, onComplete, onFocusTask, focused }) {
  return (
    <li
      className={`task-item${overdue ? ' task-item--overdue' : ''}${
        focused ? ' task-item--focused' : ''
      }`}
    >
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
        {task.source === 'project' && (
          <p className="task-item__project-link">
            プロジェクト：{task.projectName || '未分類'} / 分野：
            {task.projectCategoryName || '未分類'}
          </p>
        )}
        <div className="task-item__meta">
          {overdue && <span className="task-tag task-tag--danger">期限超過</span>}
          {task.genre && <span className="task-tag">{task.genre}</span>}
          <span className={`task-priority task-priority--${task.priority}`}>
            優先度 {PRIORITY_LABELS[task.priority]}
          </span>
          <button
            type="button"
            className="task-item__focus"
            onClick={() => onFocusTask(task.id)}
          >
            {focused ? '今やる中' : '今やる'}
          </button>
        </div>
      </div>
    </li>
  );
}
