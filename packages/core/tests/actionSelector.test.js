const test = require('node:test');
const assert = require('node:assert/strict');
const { selectAction, isWithinQuietHours } = require('../behavior/actionSelector');

function pressure(level = 'attentive') {
  return {
    score: level === 'overloaded' ? 90 : 32,
    level,
    dominantReason: 'test',
    dominantTaskId: 'task-1'
  };
}

test('behaviorEnabled falseでは静かなidleになる', () => {
  const result = selectAction({
    pressure: pressure('overloaded'),
    settings: { behaviorEnabled: false },
    now: new Date(2026, 5, 18, 10, 0)
  });
  assert.equal(result.action, 'idle');
  assert.equal(result.mood, 'calm');
  assert.equal(result.reason, 'behavior-disabled');
});

test('quietHoursを判定する', () => {
  assert.equal(
    isWithinQuietHours(
      { quietHours: { enabled: true, start: '22:00', end: '07:00' } },
      new Date(2026, 5, 18, 23, 0)
    ),
    true
  );
});

test('同じ行動を短時間に避ける', () => {
  const now = new Date(2026, 5, 18, 10, 0);
  const result = selectAction({
    pressure: pressure('attentive'),
    now,
    random: () => 0,
    lifeState: {
      behavior: {
        recentActions: [
          { id: 'look-at-task', at: new Date(2026, 5, 18, 9, 55).toISOString() }
        ]
      }
    }
  });
  assert.notEqual(result.action, 'look-at-task');
});

test('候補0件でも安全にidleへ戻る', () => {
  const now = new Date(2026, 5, 18, 10, 0);
  const recentActions = ['idle', 'soft-breathe', 'look-around', 'small-talk'].map((id) => ({
    id,
    at: new Date(2026, 5, 18, 9, 55).toISOString()
  }));
  const result = selectAction({
    pressure: pressure('calm'),
    now,
    lifeState: { behavior: { recentActions } }
  });
  assert.equal(result.action, 'idle');
  assert.equal(result.reason, 'no-candidate');
});

test('注入乱数で決定的に選べる', () => {
  const result = selectAction({
    pressure: pressure('attentive'),
    now: new Date(2026, 5, 18, 10, 0),
    random: () => 0,
    lifeState: { behavior: {} }
  });
  assert.equal(result.action, 'look-at-task');
});

test('overloadedとreduce motionでは動きを増やさない', () => {
  const result = selectAction({
    pressure: pressure('overloaded'),
    settings: { reduceMotion: true },
    now: new Date(2026, 5, 18, 10, 0),
    random: () => 0.65,
    lifeState: { behavior: {} }
  });
  assert.equal(result.movement, null);
});
