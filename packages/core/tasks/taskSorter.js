const { classifyTask, compareDateKeys, localDateKey } = require('../behavior/taskPressureEngine');

function compareTaskSchedule(left, right) {
  const dateCompare = compareDateKeys(left.date, right.date);
  if (dateCompare !== 0) {
    return dateCompare;
  }
  if (left.time && right.time) {
    return left.time.localeCompare(right.time);
  }
  if (left.time !== right.time) {
    return left.time ? -1 : 1;
  }
  return left.title.localeCompare(right.title, 'ja');
}

function sortTasks(tasks = []) {
  return [...tasks].sort((left, right) => {
    if (left.completed !== right.completed) {
      return left.completed ? 1 : -1;
    }
    return compareTaskSchedule(left, right);
  });
}

function groupTasksForMobile(tasks = [], now = new Date()) {
  const today = localDateKey(now);
  const groups = {
    overdue: [],
    today: [],
    future: [],
    completed: []
  };

  for (const task of sortTasks(tasks)) {
    if (task.completed) {
      groups.completed.push(task);
      continue;
    }
    const state = classifyTask(task, now).state;
    if (state === 'overdue') {
      groups.overdue.push(task);
    } else if (task.date <= today) {
      groups.today.push(task);
    } else {
      groups.future.push(task);
    }
  }

  return groups;
}

module.exports = {
  groupTasksForMobile,
  sortTasks
};
