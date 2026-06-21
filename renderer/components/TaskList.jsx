import TaskItem from './TaskItem';
import { getOverdueTasks, getTodayTasks } from '../utils/taskUtils';

function TaskSection({ title, tasks, overdue, onComplete, onFocusTask, focusTaskId }) {
  if (tasks.length === 0) {
    return null;
  }
  return (
    <section className="task-section">
      <h3 className={overdue ? 'task-section__title--overdue' : ''}>
        {overdue && <span aria-hidden="true">!</span>}
        {title}
        <small>{tasks.length}</small>
      </h3>
      <ul>
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            overdue={overdue}
            onComplete={onComplete}
            onFocusTask={onFocusTask}
            focused={focusTaskId === task.id}
          />
        ))}
      </ul>
    </section>
  );
}

export default function TaskList({ tasks, onComplete, onFocusTask, focusTaskId }) {
  const overdueTasks = getOverdueTasks(tasks);
  const todayTasks = getTodayTasks(tasks);

  if (tasks.length === 0) {
    return (
      <div className="task-list__empty">
        <span>✓</span>
        <p>タスクはありません</p>
        <small>今日は少しゆっくりできそうです。</small>
      </div>
    );
  }

  return (
    <div className="task-list">
      <TaskSection
        title="期限超過"
        tasks={overdueTasks}
        overdue
        onComplete={onComplete}
        onFocusTask={onFocusTask}
        focusTaskId={focusTaskId}
      />
      <TaskSection
        title="今日"
        tasks={todayTasks}
        onComplete={onComplete}
        onFocusTask={onFocusTask}
        focusTaskId={focusTaskId}
      />
    </div>
  );
}
