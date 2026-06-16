export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTaskTime(task, overdue = false) {
  if (overdue) {
    const [, month, day] = task.date.split('-');
    return `${Number(month)}/${Number(day)} ${task.time || '今日中'}`;
  }
  return task.time || '今日中';
}
