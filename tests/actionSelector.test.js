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

test('クールダウン中は自発行動を選ばない', () => {
  const now = new Date(2026, 5, 17, 10, 0);
  const result = selectAction({
    pressure: pressure('attentive'),
    now,
    lifeState: { behavior: { lastActionAt: new Date(2026, 5, 17, 9, 58).toISOString() } }
  });
  assert.equal(result.action, 'idle');
  assert.equal(result.reason, 'level-cooldown');
});

test('同じ行動を短時間に避ける', () => {
  const now = new Date(2026, 5, 17, 10, 0);
  const result = selectAction({
    pressure: pressure('attentive'),
    now,
    random: () => 0,
    lifeState: {
      behavior: {
        recentActions: [
          { id: 'look-at-task', at: new Date(2026, 5, 17, 9, 55).toISOString() }
        ]
      }
    }
  });
  assert.notEqual(result.action, 'look-at-task');
});

test('候補が空でも安全にidleへ戻る', () => {
  const now = new Date(2026, 5, 17, 10, 0);
  const recentActions = ['idle', 'soft-breathe', 'look-around', 'small-talk', 'stay-near-user-position'].map(
    (id) => ({ id, at: new Date(2026, 5, 17, 9, 55).toISOString() })
  );
  const result = selectAction({
    pressure: pressure('calm'),
    now,
    lifeState: { behavior: { recentActions } }
  });
  assert.equal(result.action, 'idle');
  assert.equal(result.reason, 'no-candidate');
});

test('注入した乱数で決定的に選べる', () => {
  const result = selectAction({
    pressure: pressure('attentive'),
    now: new Date(2026, 5, 17, 10, 0),
    random: () => 0,
    lifeState: { behavior: {} }
  });
  assert.equal(result.action, 'look-at-task');
});

test('quietHoursを判定する', () => {
  assert.equal(
    isWithinQuietHours(
      { quietHours: { enabled: true, start: '22:00', end: '07:00' } },
      new Date(2026, 5, 17, 23, 0)
    ),
    true
  );
});

test('behaviorEnabled falseでは静かなidleになる', () => {
  const result = selectAction({
    pressure: pressure('overloaded'),
    settings: { behaviorEnabled: false },
    now: new Date(2026, 5, 17, 10, 0)
  });
  assert.equal(result.action, 'idle');
  assert.equal(result.mood, 'calm');
  assert.equal(result.reason, 'behavior-disabled');
});

test('autonomousMovement falseでは移動を出さない', () => {
  const result = selectAction({
    pressure: pressure('attentive'),
    settings: { autonomousMovement: false },
    now: new Date(2026, 5, 17, 10, 0),
    random: () => 0.65,
    lifeState: { behavior: {} }
  });
  assert.equal(result.action, 'small-nudge');
  assert.equal(result.movement, null);
});
