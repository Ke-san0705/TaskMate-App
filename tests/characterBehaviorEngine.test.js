const test = require('node:test');
const assert = require('node:assert/strict');
const { createBehaviorState } = require('../behavior/characterBehaviorEngine');

function task(overrides = {}) {
  return {
    id: overrides.id || 'task-1',
    title: overrides.title || '予定',
    date: overrides.date || '2026-06-17',
    time: Object.hasOwn(overrides, 'time') ? overrides.time : '10:30',
    genre: '',
    priority: overrides.priority || 'normal',
    completed: false
  };
}

test('notificationが最優先される', () => {
  const state = createBehaviorState({
    tasks: [task({ time: '15:00' })],
    now: new Date(2026, 5, 17, 10, 0),
    notification: { taskId: 'task-1', title: '予定', minutes: 30 }
  });
  assert.equal(state.mood, 'notifying');
  assert.equal(state.dialogueCategory, 'deadlineNear');
});

test('completionは通常状態より優先される', () => {
  const state = createBehaviorState({
    tasks: [task()],
    now: new Date(2026, 5, 17, 10, 0),
    event: { type: 'task-complete', task: task({ title: '提出' }) }
  });
  assert.equal(state.mood, 'relieved');
  assert.equal(state.dialogueCategory, 'relieved');
});

test('focusTaskがあるとfocusingになる', () => {
  const state = createBehaviorState({
    tasks: [task({ id: 'focus' })],
    lifeState: { focusTaskId: 'focus', relationshipStage: 'new' },
    now: new Date(2026, 5, 17, 10, 0)
  });
  assert.equal(state.mood, 'focusing');
  assert.equal(state.focusTask.id, 'focus');
});

test('overloadedでは移動を増やしすぎない', () => {
  const tasks = Array.from({ length: 4 }, (_, index) =>
    task({ id: `late-${index}`, date: '2026-06-15', time: null, priority: 'high' })
  );
  const state = createBehaviorState({
    tasks,
    now: new Date(2026, 5, 17, 22, 0),
    random: () => 0.99
  });
  assert.equal(state.pressure.level, 'overloaded');
  assert.equal(state.movement, null);
});

test('hidden時は通常行動を表示しない', () => {
  const state = createBehaviorState({
    tasks: [task()],
    now: new Date(2026, 5, 17, 10, 0),
    isMainVisible: false
  });
  assert.equal(state.action, 'idle');
  assert.equal(state.dialogueCategory, null);
  assert.equal(state.reason, 'main-window-hidden');
});

test('reduced motionでは移動を出さない', () => {
  const state = createBehaviorState({
    tasks: [task({ time: '15:00' })],
    now: new Date(2026, 5, 17, 10, 0),
    random: () => 0.65,
    reducedMotion: true
  });
  assert.equal(state.action, 'small-nudge');
  assert.equal(state.movement, null);
});
