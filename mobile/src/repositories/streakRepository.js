const {
  calculateDailyStreak,
  localDateKey,
  selectStreakMessage
} = require('@taskmate/core');
const { getAll, getDatabase, run } = require('./database');
const { warn } = require('../utils/logger');

function emptyStreak(now = new Date()) {
  const streak = calculateDailyStreak([], now);
  return {
    ...streak,
    motivationMessage: selectStreakMessage(streak)
  };
}

function completedAtToDateKey(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return localDateKey(date);
}

function rowToActivity(row) {
  return {
    date: row.date,
    completedTaskCount: Number(row.completed_task_count || 0),
    achieved: row.achieved === 1
  };
}

async function readDailyActivity() {
  const db = await getDatabase();
  const rows = await getAll(
    db,
    `SELECT date, completed_task_count, achieved
       FROM daily_activity
      WHERE achieved = 1
      ORDER BY date ASC`
  );
  return rows.map(rowToActivity);
}

async function readStreak(now = new Date()) {
  try {
    const activity = await readDailyActivity();
    const streak = calculateDailyStreak(activity, now);
    return {
      ...streak,
      motivationMessage: selectStreakMessage(streak)
    };
  } catch (error) {
    warn('Streak', 'read failed', error);
    return emptyStreak(now);
  }
}

async function rebuildDailyActivity(now = new Date()) {
  const db = await getDatabase();
  const rows = await getAll(
    db,
    `SELECT COALESCE(completed_at, updated_at) AS completed_at
       FROM tasks
      WHERE completed = 1
        AND COALESCE(completed_at, updated_at) IS NOT NULL`
  );
  const counts = new Map();
  for (const row of rows) {
    const dateKey = completedAtToDateKey(row.completed_at);
    if (!dateKey) {
      continue;
    }
    counts.set(dateKey, (counts.get(dateKey) || 0) + 1);
  }

  const timestamp = now.toISOString();
  await run(db, 'DELETE FROM daily_activity');
  for (const [date, count] of [...counts.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    await run(
      db,
      `INSERT INTO daily_activity
        (date, completed_task_count, achieved, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [date, count, count > 0 ? 1 : 0, timestamp, timestamp]
    );
  }

  return readStreak(now);
}

module.exports = {
  emptyStreak,
  readDailyActivity,
  readStreak,
  rebuildDailyActivity
};
