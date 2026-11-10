const assert = require('node:assert/strict');
const test = require('node:test');
const {
  eventToCalendarItem,
  normalizeState
} = require('../main/googleCalendarService');

test('Google Calendar events are normalized into TaskMate today items', () => {
  const event = eventToCalendarItem(
    {
      id: 'event-1',
      summary: '研究ミーティング',
      start: { dateTime: new Date(2026, 5, 25, 10, 15).toISOString() },
      end: { dateTime: new Date(2026, 5, 25, 11, 0).toISOString() },
      htmlLink: 'https://calendar.google.com/event?eid=event-1'
    },
    { id: 'primary', summary: 'メイン', primary: true },
    { hidePrivateDetails: true },
    {}
  );

  assert.equal(event.key, 'primary|event-1');
  assert.equal(event.title, '研究ミーティング');
  assert.equal(event.date, '2026-06-25');
  assert.equal(event.time, '10:15');
  assert.equal(event.endTime, '11:00');
  assert.equal(event.calendarSummary, 'メイン');
  assert.equal(event.private, false);
});

test('Google Calendar timestamps are converted into the device timezone', () => {
  const { spawnSync } = require('node:child_process');
  for (const [timezone, expected] of [
    ['UTC', { date: '2026-06-25', time: '01:15' }],
    ['Asia/Tokyo', { date: '2026-06-25', time: '10:15' }],
    ['America/Los_Angeles', { date: '2026-06-24', time: '18:15' }]
  ]) {
    const script = `const {eventToCalendarItem}=require('./main/googleCalendarService');
      const item=eventToCalendarItem({id:'timezone',start:{dateTime:'2026-06-25T10:15:00+09:00'},end:{dateTime:'2026-06-25T11:00:00+09:00'}},{id:'primary'},{},{});
      process.stdout.write(JSON.stringify({date:item.date,time:item.time}));`;
    const result = spawnSync(process.execPath, ['-e', script], { cwd: require('node:path').join(__dirname, '..'), env: { ...process.env, TZ: timezone }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), expected, timezone);
  }
});

test('private Google Calendar events hide details when privacy setting is enabled', () => {
  const event = eventToCalendarItem(
    {
      id: 'private-1',
      summary: '秘密の予定',
      visibility: 'private',
      location: 'Room A',
      start: { date: '2026-06-25' },
      end: { date: '2026-06-26' }
    },
    { id: 'private-calendar', summary: 'Private' },
    { hidePrivateDetails: true },
    {}
  );

  assert.equal(event.title, 'Googleカレンダーの予定');
  assert.equal(event.location, '');
  assert.equal(event.allDay, true);
  assert.equal(event.time, null);
  assert.equal(event.startText, '終日');
  assert.equal(event.private, true);
});

test('Google Calendar state normalization keeps unknown data out of the public model', () => {
  const state = normalizeState({
    settings: {
      showTodayOnHome: false,
      selectedCalendarIds: ['primary', '', 'primary', 42]
    },
    calendars: [{ id: 'primary', summary: 'メイン', primary: true }],
    events: [{ key: 'primary|event-1', id: 'event-1', date: '2026-06-25' }],
    createdTaskMap: { 'primary|event-1': 'task-google-1' },
    sync: {
      lastSyncedAt: '2026-06-25T00:00:00.000Z',
      error: 'sample'
    }
  });

  assert.equal(state.version, 1);
  assert.deepEqual(state.settings.selectedCalendarIds, ['primary']);
  assert.equal(state.settings.showTodayOnHome, false);
  assert.equal(state.settings.hidePrivateDetails, true);
  assert.equal(state.calendars.length, 1);
  assert.equal(state.events.length, 1);
  assert.equal(state.createdTaskMap['primary|event-1'], 'task-google-1');
});
