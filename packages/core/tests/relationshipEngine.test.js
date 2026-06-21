const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createDefaultLifeState,
  deriveRelationshipStage,
  normalizeLifeState,
  recordInteraction,
  recordTaskCompletion,
  registerLaunch
} = require('../behavior/relationshipEngine');

test('初回起動はfirstMeetingになる', () => {
  const now = new Date(2026, 5, 18, 9, 0);
  const result = registerLaunch(createDefaultLifeState(now), now);
  assert.equal(result.reconnectEvent, 'firstMeeting');
  assert.equal(result.state.activeDays, 1);
  assert.equal(result.state.visitCount, 1);
});

test('同日複数操作でactiveDaysが増えすぎない', () => {
  const now = new Date(2026, 5, 18, 9, 0);
  let state = registerLaunch(createDefaultLifeState(now), now).state;
  state = recordInteraction(state, 'character-click', new Date(2026, 5, 18, 10, 0));
  state = recordInteraction(state, 'task-list-open', new Date(2026, 5, 18, 11, 0));
  assert.equal(state.activeDays, 1);
});

test('翌日の利用はactiveDaysを増やす', () => {
  const first = new Date(2026, 5, 18, 9, 0);
  const second = new Date(2026, 5, 19, 9, 0);
  const state = registerLaunch(registerLaunch(createDefaultLifeState(first), first).state, second)
    .state;
  assert.equal(state.activeDays, 2);
});

test('数日空いた後に再訪イベントを返す', () => {
  const first = new Date(2026, 5, 18, 9, 0);
  const next = new Date(2026, 5, 21, 9, 0);
  const state = registerLaunch(createDefaultLifeState(first), first).state;
  const result = registerLaunch(state, next);
  assert.equal(result.reconnectEvent, 'returnShort');
});

test('relationshipStageは利用と完了で上がる', () => {
  const state = normalizeLifeState({
    activeDates: ['2026-06-16', '2026-06-17', '2026-06-18'],
    activeDays: 3,
    completedTaskCount: 8
  });
  assert.equal(deriveRelationshipStage(state), 'familiar');
});

test('不在期間でstageが下がらない', () => {
  const state = normalizeLifeState({
    relationshipStage: 'steady',
    activeDates: [],
    activeDays: 0,
    completedTaskCount: 0
  });
  assert.equal(state.relationshipStage, 'steady');
});

test('不正値は正規化される', () => {
  const state = normalizeLifeState({
    activeDates: ['bad', '2026-06-18'],
    activeDays: -20,
    completedTaskCount: 'many',
    relationshipStage: 'unknown',
    interactions: [{ type: 'bad-action' }]
  });
  assert.deepEqual(state.activeDates, ['2026-06-18']);
  assert.equal(state.completedTaskCount, 0);
  assert.equal(state.relationshipStage, 'new');
  assert.deepEqual(state.interactions, []);
});

test('タスク完了を記録する', () => {
  const now = new Date(2026, 5, 18, 12, 0);
  const state = recordTaskCompletion(createDefaultLifeState(now), { id: 'task-1' }, now);
  assert.equal(state.completedTaskCount, 1);
  assert.equal(state.completedToday, 1);
  assert.equal(state.interactions[0].type, 'task-complete');
});
