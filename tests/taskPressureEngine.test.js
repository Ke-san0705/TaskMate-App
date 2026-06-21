const test = require('node:test');
const assert = require('node:assert/strict');
const {
  aggregateLifePressure,
  classifyTask,
  localDateKey
} = require('../behavior/taskPressureEngine');

function task(overrides = {}) {
  return {
    id: overrides.id || 'task-1',
    title: overrides.title || '予定',
    date: overrides.date || '2026-06-17',
    time: Object.hasOwn(overrides, 'time') ? overrides.time : '18:00',
    genre: '',
    priority: overrides.priority || 'normal',
    completed: false
  };
}

test('時刻ありタスクをcalm/warning/urgent/overdueへ分類する', () => {
  const now = new Date(2026, 5, 17, 10, 0, 0);
  assert.equal(classifyTask(task({ time: '18:00' }), now).state, 'calm');
  assert.equal(classifyTask(task({ time: '15:00' }), now).state, 'warning');
  assert.equal(classifyTask(task({ time: '10:45' }), now).state, 'urgent');
  assert.equal(classifyTask(task({ time: '09:30' }), now).state, 'overdue');
});

test('優先度補正でhighは早めに上がりlowは圧が下がる', () => {
  const now = new Date(2026, 5, 17, 10, 0, 0);
  const high = classifyTask(task({ time: '12:30', priority: 'high' }), now);
  const low = classifyTask(task({ time: '10:45', priority: 'low' }), now);
  assert.equal(high.state, 'urgent');
  assert.equal(low.state, 'urgent');
  assert.ok(low.pressure < classifyTask(task({ time: '10:45' }), now).pressure);
});

test('時刻なしタスクはローカル時刻で夕方以降に状態が上がる', () => {
  assert.equal(
    classifyTask(task({ time: null }), new Date(2026, 5, 17, 16, 30)).state,
    'calm'
  );
  assert.equal(
    classifyTask(task({ time: null }), new Date(2026, 5, 17, 17, 0)).state,
    'warning'
  );
  assert.equal(
    classifyTask(task({ time: null }), new Date(2026, 5, 17, 21, 0)).state,
    'urgent'
  );
  assert.equal(
    classifyTask(task({ date: '2026-06-16', time: null }), new Date(2026, 5, 17, 9, 0)).state,
    'overdue'
  );
});

test('localDateKeyはtoISOStringに依存せずローカル日付を返す', () => {
  assert.equal(localDateKey(new Date(2026, 0, 2, 0, 30)), '2026-01-02');
});

test('タスク0件の生活圧は0', () => {
  const result = aggregateLifePressure([], new Date(2026, 5, 17, 10, 0));
  assert.equal(result.score, 0);
  assert.equal(result.level, 'calm');
});

test('緊急1件は多数のcalmへ埋もれない', () => {
  const now = new Date(2026, 5, 17, 10, 0, 0);
  const tasks = [
    task({ id: 'urgent', time: '10:30' }),
    ...Array.from({ length: 8 }, (_, index) =>
      task({ id: `calm-${index}`, time: '20:00', priority: 'low' })
    )
  ];
  const result = aggregateLifePressure(tasks, now);
  assert.equal(result.dominantTaskId, 'urgent');
  assert.ok(result.score >= 55);
  assert.notEqual(result.level, 'calm');
});
