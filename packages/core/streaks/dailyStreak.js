const { localDateKey, parseDateParts } = require('../tasks/taskSchedule');

const DAY_MS = 24 * 60 * 60 * 1000;

const PENDING_MESSAGES = Object.freeze([
  '今日も1つだけやろう。',
  'まずは1個終わらせよう。',
  '昨日までの記録を今日につなげよう。'
]);

const RESTART_MESSAGES = Object.freeze([
  'まずは今日の1つから。',
  '今日からまた始めよう。',
  '小さく再開しよう。'
]);

const ACHIEVED_MESSAGES = Object.freeze([
  '今日も達成！',
  'ちゃんと今日も積み上がった。',
  '明日につながる1日になった。'
]);

const LONG_STREAK_MESSAGES = Object.freeze([
  '一週間突破！',
  'ここまで続いてる。この調子だ。',
  'この積み重ねは強い。'
]);

function dateKeyToDayNumber(dateKey) {
  const parts = parseDateParts(dateKey);
  if (!parts) {
    return null;
  }
  return Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS;
}

function dayNumberToDateKey(dayNumber) {
  const date = new Date(dayNumber * DAY_MS);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeActivityRows(rows = []) {
  const active = new Map();
  for (const row of rows) {
    const date = typeof row?.date === 'string' ? row.date : '';
    if (!parseDateParts(date)) {
      continue;
    }
    const count = Number(row.completedTaskCount ?? row.completed_task_count ?? 0);
    const achieved =
      row.achieved === true ||
      row.achieved === 1 ||
      row.achieved === '1' ||
      count > 0;
    if (achieved) {
      active.set(date, Math.max(1, Number.isFinite(count) ? Math.floor(count) : 1));
    }
  }
  return [...active.entries()]
    .map(([date, completedTaskCount]) => ({ date, completedTaskCount, achieved: true }))
    .sort((left, right) => dateKeyToDayNumber(left.date) - dateKeyToDayNumber(right.date));
}

function countBackwards(activeDates, endDate) {
  let day = dateKeyToDayNumber(endDate);
  if (!Number.isFinite(day)) {
    return 0;
  }
  let count = 0;
  while (activeDates.has(dayNumberToDateKey(day))) {
    count += 1;
    day -= 1;
  }
  return count;
}

function longestRun(activeDates) {
  const days = [...activeDates]
    .map(dateKeyToDayNumber)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  let best = 0;
  let current = 0;
  let previous = null;
  for (const day of days) {
    current = previous !== null && day === previous + 1 ? current + 1 : 1;
    best = Math.max(best, current);
    previous = day;
  }
  return best;
}

function hashText(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickMessage(messages, streak) {
  if (messages.length === 0) {
    return '';
  }
  const seed = `${streak.dateKey}:${streak.currentStreak}:${streak.totalActiveDays}:${streak.achievedToday}`;
  return messages[hashText(seed) % messages.length];
}

function calculateDailyStreak(rows = [], now = new Date()) {
  const activityRows = normalizeActivityRows(rows);
  const activeDates = new Set(activityRows.map((row) => row.date));
  const today = localDateKey(now);
  const todayNumber = dateKeyToDayNumber(today);
  const yesterday = Number.isFinite(todayNumber) ? dayNumberToDateKey(todayNumber - 1) : '';
  const achievedToday = activeDates.has(today);
  const achievedYesterday = activeDates.has(yesterday);
  const currentStreak = achievedToday
    ? countBackwards(activeDates, today)
    : achievedYesterday
      ? countBackwards(activeDates, yesterday)
      : 0;
  const longestStreak = longestRun(activeDates);
  const beforeTodayDates = new Set([...activeDates].filter((date) => date !== today));
  const previousLongestStreak = longestRun(beforeTodayDates);

  return {
    dateKey: today,
    activityRows,
    currentStreak,
    longestStreak,
    totalActiveDays: activeDates.size,
    achievedToday,
    achievedYesterday,
    isBestToday: achievedToday && currentStreak > previousLongestStreak,
    previousLongestStreak
  };
}

function selectStreakMessage(streak) {
  if (!streak || typeof streak !== 'object') {
    return RESTART_MESSAGES[0];
  }
  if (streak.achievedToday && streak.isBestToday && streak.currentStreak >= 2) {
    return '自己ベスト更新だ。';
  }
  if (streak.achievedToday && streak.currentStreak >= 30) {
    return '30日達成！';
  }
  if (streak.achievedToday && streak.currentStreak >= 7) {
    return pickMessage(LONG_STREAK_MESSAGES, streak);
  }
  if (streak.achievedToday) {
    return pickMessage(ACHIEVED_MESSAGES, streak);
  }
  if (streak.currentStreak > 0) {
    return pickMessage(PENDING_MESSAGES, streak);
  }
  return pickMessage(RESTART_MESSAGES, streak);
}

module.exports = {
  calculateDailyStreak,
  normalizeActivityRows,
  selectStreakMessage
};
