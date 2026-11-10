const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateDailyStreak, selectStreakMessage } = require('@taskmate/core');

function achieved(date, count = 1) {
  return { date, completedTaskCount: count, achieved: true };
}

test('継続記録は同じ日に複数タスクを完了しても1日として扱う', () => {
  const result = calculateDailyStreak(
    [achieved('2026-09-09', 5)],
    new Date(2026, 8, 9, 21, 0, 0)
  );

  assert.equal(result.currentStreak, 1);
  assert.equal(result.longestStreak, 1);
  assert.equal(result.totalActiveDays, 1);
  assert.equal(result.achievedToday, true);
});

test('今日未達成でも昨日までの継続は今日中だけ表示する', () => {
  const today = calculateDailyStreak(
    [achieved('2026-09-07'), achieved('2026-09-08')],
    new Date(2026, 8, 9, 8, 0, 0)
  );
  const missed = calculateDailyStreak(
    [achieved('2026-09-07'), achieved('2026-09-08')],
    new Date(2026, 8, 10, 8, 0, 0)
  );

  assert.equal(today.currentStreak, 2);
  assert.equal(today.achievedToday, false);
  assert.equal(missed.currentStreak, 0);
});

test('状態に応じたモチベーションメッセージを返す', () => {
  const result = calculateDailyStreak(
    [achieved('2026-09-08'), achieved('2026-09-09')],
    new Date(2026, 8, 9, 12, 0, 0)
  );

  assert.equal(result.isBestToday, true);
  assert.equal(typeof selectStreakMessage(result), 'string');
  assert.notEqual(selectStreakMessage(result), '');
});
