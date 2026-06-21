const test = require('node:test');
const assert = require('node:assert/strict');
const { TaskValidationError } = require('../tasks/taskValidation');
const { normalizeTaskInput } = require('../tasks/taskNormalizer');

test('タスク入力を保存形式へ正規化する', () => {
  const now = new Date('2026-06-18T10:00:00.000Z');
  const task = normalizeTaskInput(
    {
      title: '  学習レポート  ',
      description: ' 実験結果 ',
      date: '2026-06-18',
      time: '',
      genre: ' 学習 ',
      priority: 'high'
    },
    { now, idFactory: () => 'task-fixed' }
  );
  assert.equal(task.id, 'task-fixed');
  assert.equal(task.title, '学習レポート');
  assert.equal(task.time, null);
  assert.equal(task.createdAt, now.toISOString());
  assert.equal(task.completedAt, null);
});

test('不正な日付を拒否する', () => {
  assert.throws(
    () =>
      normalizeTaskInput(
        { title: 'bad', date: '2026-02-31', time: null, priority: 'normal' },
        { idFactory: () => 'task-fixed' }
      ),
    TaskValidationError
  );
});

test('完了時にcompletedAtを記録し、取り消し時に消す', () => {
  const created = normalizeTaskInput(
    { title: '予定', date: '2026-06-18', completed: false },
    { now: new Date('2026-06-18T10:00:00.000Z'), idFactory: () => 'task-fixed' }
  );
  const completed = normalizeTaskInput(
    { ...created, completed: true },
    { current: created, now: new Date('2026-06-18T11:00:00.000Z') }
  );
  const undone = normalizeTaskInput(
    { ...completed, completed: false },
    { current: completed, now: new Date('2026-06-18T11:05:00.000Z') }
  );
  assert.equal(completed.completedAt, '2026-06-18T11:00:00.000Z');
  assert.equal(undone.completedAt, null);
});
