import { getLocalDateKey } from './dateUtils';

export function getVisibleTasks(tasks, today = getLocalDateKey()) {
  return tasks
    .filter((task) => !task.completed && task.date <= today)
    .sort((a, b) => {
      const aOverdue = a.date < today;
      const bOverdue = b.date < today;
      if (aOverdue !== bOverdue) {
        return aOverdue ? -1 : 1;
      }
      if (aOverdue && a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      if (a.time && b.time) {
        return a.time.localeCompare(b.time);
      }
      if (a.time !== b.time) {
        return a.time ? -1 : 1;
      }
      return a.title.localeCompare(b.title, 'ja');
    });
}

export function getOverdueTasks(tasks, today = getLocalDateKey()) {
  return tasks.filter((task) => !task.completed && task.date < today);
}

export function getTodayTasks(tasks, today = getLocalDateKey()) {
  return tasks.filter((task) => !task.completed && task.date === today);
}
