const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateDailyStreak, selectStreakMessage } = require('../index');

function achieved(date, count = 1) {
  return { date, completedTaskCount: count, achieved: true };
}

test('yesterday and today achievements count as a two day streak', () => {
  const result = calculateDailyStreak(
    [achieved('2026-09-08'), achieved('2026-09-09')],
    new Date(2026, 8, 9, 12, 0, 0)
  );

  assert.equal(result.currentStreak, 2);
  assert.equal(result.longestStreak, 2);
  assert.equal(result.totalActiveDays, 2);
  assert.equal(result.achievedToday, true);
});

test('three consecutive days produce currentStreak 3', () => {
  const result = calculateDailyStreak(
    [achieved('2026-09-07'), achieved('2026-09-08'), achieved('2026-09-09')],
    new Date(2026, 8, 9, 12, 0, 0)
  );

  assert.equal(result.currentStreak, 3);
  assert.equal(result.longestStreak, 3);
});

test('a missed day breaks the current streak but keeps history', () => {
  const result = calculateDailyStreak(
    [achieved('2026-09-06'), achieved('2026-09-07'), achieved('2026-09-09')],
    new Date(2026, 8, 10, 9, 0, 0)
  );

  assert.equal(result.currentStreak, 1);
  assert.equal(result.longestStreak, 2);
  assert.equal(result.totalActiveDays, 3);
  assert.equal(result.achievedToday, false);
});

test('same-day multiple completions count as one active day', () => {
  const result = calculateDailyStreak(
    [achieved('2026-09-09', 5)],
    new Date(2026, 8, 9, 12, 0, 0)
  );

  assert.equal(result.currentStreak, 1);
  assert.equal(result.longestStreak, 1);
  assert.equal(result.totalActiveDays, 1);
});

test('yesterday streak remains visible until today is missed', () => {
  const morning = calculateDailyStreak(
    [achieved('2026-09-07'), achieved('2026-09-08')],
    new Date(2026, 8, 9, 8, 0, 0)
  );
  const afterMiss = calculateDailyStreak(
    [achieved('2026-09-07'), achieved('2026-09-08')],
    new Date(2026, 8, 10, 8, 0, 0)
  );

  assert.equal(morning.currentStreak, 2);
  assert.equal(morning.achievedToday, false);
  assert.equal(afterMiss.currentStreak, 0);
});

test('best streak update is detected only when today exceeds previous best', () => {
  const result = calculateDailyStreak(
    [achieved('2026-09-07'), achieved('2026-09-08'), achieved('2026-09-09')],
    new Date(2026, 8, 9, 12, 0, 0)
  );

  assert.equal(result.isBestToday, true);
  assert.match(selectStreakMessage(result), /自己ベスト/);
});
