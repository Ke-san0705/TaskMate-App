const assert = require('node:assert/strict');
const test = require('node:test');
const {
  classifyTask,
  compareDateKeys,
  localDateKey,
  parseDateParts,
  parseTimeParts
} = require('../tasks/taskSchedule');

function task(overrides = {}) {
  return {
    id: 'task-1',
    title: 'Report',
    date: '2026-06-18',
    time: null,
    priority: 'normal',
    completed: false,
    ...overrides
  };
}

test('localDateKey uses local calendar fields', () => {
  assert.equal(localDateKey(new Date(2026, 5, 18, 1, 2, 3)), '2026-06-18');
});

test('parseDateParts and parseTimeParts reject broken values', () => {
  assert.deepEqual(parseDateParts('2026-06-18'), { year: 2026, month: 6, day: 18 });
  assert.equal(parseDateParts('2026-02-30'), null);
  assert.deepEqual(parseTimeParts('23:59'), { hour: 23, minute: 59 });
  assert.equal(parseTimeParts('24:00'), null);
});

test('classifyTask separates overdue, today, urgent, warning, and future states', () => {
  const now = new Date(2026, 5, 18, 12, 0);
  assert.equal(classifyTask(task({ date: '2026-06-17' }), now).state, 'overdue');
  assert.equal(classifyTask(task({ time: '12:30' }), now).state, 'urgent');
  assert.equal(classifyTask(task({ time: '16:30' }), now).state, 'warning');
  assert.equal(classifyTask(task({ time: '20:00' }), now).state, 'today');
  assert.equal(classifyTask(task({ date: '2026-06-20' }), now).state, 'future');
});

test('high priority future task warns the day before', () => {
  const now = new Date(2026, 5, 18, 12, 0);
  assert.equal(
    classifyTask(task({ date: '2026-06-19', priority: 'high' }), now).state,
    'warning'
  );
});

test('compareDateKeys orders valid local dates', () => {
  assert.equal(compareDateKeys('2026-06-18', '2026-06-17'), 1);
  assert.equal(compareDateKeys('2026-06-18', '2026-06-18'), 0);
  assert.equal(compareDateKeys('2026-06-18', '2026-06-19'), -1);
});
