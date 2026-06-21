const { localDateKey } = require('@taskmate/core');

function localDateTimeFromTask(task) {
  if (!task?.date || !task?.time) {
    return null;
  }
  const [year, month, day] = task.date.split('-').map(Number);
  const [hour, minute] = task.time.split(':').map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function formatTaskTime(task, use24HourClock = true) {
  if (!task?.time) {
    return '今日中';
  }
  if (use24HourClock) {
    return task.time;
  }
  const [hour, minute] = task.time.split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function todayKey() {
  return localDateKey(new Date());
}

module.exports = {
  formatTaskTime,
  localDateTimeFromTask,
  todayKey
};
