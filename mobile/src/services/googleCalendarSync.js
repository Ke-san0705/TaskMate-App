const WebBrowser = require('expo-web-browser');
const { localDateKey } = require('@taskmate/core');
const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const { STORAGE_KEYS } = require('../constants/defaults');
const { isSupabaseConfigured, supabase } = require('./supabaseClient');

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_URI = 'taskmate://auth/callback';
const GOOGLE_CALENDAR_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly'
];

const DEFAULT_GOOGLE_CALENDAR_STATE = Object.freeze({
  connected: false,
  authSource: '',
  connectedAccount: '',
  settings: {
    enabled: true,
    showTodayOnHome: true,
    hidePrivateDetails: true,
    selectedCalendarIds: []
  },
  calendars: [],
  events: [],
  sync: {
    lastSyncedAt: null,
    error: null,
    errorMessage: null,
    calendarErrors: []
  }
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertConfigured() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('SupabaseのURLとpublishable keyが未設定です。');
  }
}

function normalizeSettings(settings = {}) {
  const selectedCalendarIds = Array.isArray(settings.selectedCalendarIds)
    ? settings.selectedCalendarIds.filter((id) => typeof id === 'string' && id)
    : [];
  return {
    ...DEFAULT_GOOGLE_CALENDAR_STATE.settings,
    ...settings,
    enabled:
      typeof settings.enabled === 'boolean'
        ? settings.enabled
        : DEFAULT_GOOGLE_CALENDAR_STATE.settings.enabled,
    showTodayOnHome:
      typeof settings.showTodayOnHome === 'boolean'
        ? settings.showTodayOnHome
        : DEFAULT_GOOGLE_CALENDAR_STATE.settings.showTodayOnHome,
    hidePrivateDetails:
      typeof settings.hidePrivateDetails === 'boolean'
        ? settings.hidePrivateDetails
        : DEFAULT_GOOGLE_CALENDAR_STATE.settings.hidePrivateDetails,
    selectedCalendarIds
  };
}

function normalizeState(state = {}) {
  const settings = normalizeSettings(state.settings);
  const calendars = Array.isArray(state.calendars) ? state.calendars : [];
  const events = Array.isArray(state.events) ? state.events : [];
  return {
    ...clone(DEFAULT_GOOGLE_CALENDAR_STATE),
    ...state,
    connected: Boolean(state.connected),
    authSource: typeof state.authSource === 'string' ? state.authSource : '',
    connectedAccount:
      typeof state.connectedAccount === 'string' ? state.connectedAccount : '',
    settings,
    calendars: calendars
      .filter((calendar) => calendar && typeof calendar.id === 'string')
      .map((calendar) => ({
        id: calendar.id,
        summary: String(calendar.summary || calendar.id),
        primary: Boolean(calendar.primary),
        accessRole: String(calendar.accessRole || ''),
        backgroundColor: String(calendar.backgroundColor || '#A45B25'),
        selected: settings.selectedCalendarIds.includes(calendar.id)
      })),
    events: events
      .filter((event) => event && typeof event.key === 'string')
      .map((event) => ({
        ...event,
        title: String(event.title || 'Googleカレンダーの予定'),
        taskId: typeof event.taskId === 'string' ? event.taskId : null
      })),
    sync: {
      ...DEFAULT_GOOGLE_CALENDAR_STATE.sync,
      ...(state.sync && typeof state.sync === 'object' ? state.sync : {})
    }
  };
}

async function readStatus() {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.googleCalendar);
  if (!raw) {
    return clone(DEFAULT_GOOGLE_CALENDAR_STATE);
  }
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEYS.googleCalendar);
    return clone(DEFAULT_GOOGLE_CALENDAR_STATE);
  }
}

async function writeStatus(next) {
  const normalized = normalizeState(next);
  await AsyncStorage.setItem(STORAGE_KEYS.googleCalendar, JSON.stringify(normalized));
  return normalized;
}

async function getSession() {
  assertConfigured();
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return session;
}

function parseAuthResultUrl(url) {
  const parsed = new URL(url);
  const error = parsed.searchParams.get('error') || parsed.hash.match(/error=([^&]+)/)?.[1];
  if (error) {
    throw new Error(
      decodeURIComponent(
        parsed.searchParams.get('error_description') ||
          parsed.hash.match(/error_description=([^&]+)/)?.[1] ||
          error
      )
    );
  }
  const code = parsed.searchParams.get('code');
  if (!code) {
    throw new Error('Googleログインの認証コードを受け取れませんでした。');
  }
  return code;
}

async function signInWithGoogleCalendar() {
  assertConfigured();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: REDIRECT_URI,
      skipBrowserRedirect: true,
      scopes: GOOGLE_CALENDAR_SCOPES.join(' '),
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true'
      }
    }
  });
  if (error) {
    throw error;
  }
  if (!data?.url) {
    throw new Error('GoogleログインURLを作成できませんでした。');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URI);
  if (result.type !== 'success' || !result.url) {
    throw new Error('Googleログインがキャンセルされました。');
  }
  const code = parseAuthResultUrl(result.url);
  const { data: exchangeData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    throw exchangeError;
  }
  const session = exchangeData.session || (await getSession());
  const current = await readStatus();
  return writeStatus({
    ...current,
    connected: true,
    authSource: 'supabase-google',
    connectedAccount: session?.user?.email || '',
    sync: {
      ...current.sync,
      error: null,
      errorMessage: null
    }
  });
}

function todayWindow() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { end, start, today: localDateKey(start) };
}

async function calendarFetch(path, accessToken) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Googleカレンダーの取得に失敗しました。');
  }
  return payload;
}

function normalizeCalendar(calendar, selectedIds) {
  return {
    id: calendar.id,
    summary: calendar.summary || calendar.id,
    primary: Boolean(calendar.primary),
    accessRole: calendar.accessRole || '',
    backgroundColor: calendar.backgroundColor || '#A45B25',
    selected: selectedIds.includes(calendar.id)
  };
}

function normalizeEvent(event, calendar, options) {
  const start = event.start || {};
  const end = event.end || {};
  const allDay = Boolean(start.date && !start.dateTime);
  const privateEvent = event.visibility === 'private';
  const date = allDay
    ? start.date
    : localDateKey(new Date(start.dateTime || start.date || Date.now()));
  const time = allDay ? '' : new Date(start.dateTime).toTimeString().slice(0, 5);
  const endDate = allDay
    ? end.date
    : end.dateTime
      ? localDateKey(new Date(end.dateTime))
      : date;
  const endTime = allDay || !end.dateTime ? '' : new Date(end.dateTime).toTimeString().slice(0, 5);
  return {
    key: `${calendar.id}|${event.id}`,
    id: event.id,
    calendarId: calendar.id,
    calendarSummary: calendar.summary,
    title:
      privateEvent && options.hidePrivateDetails
        ? 'Googleカレンダーの予定'
        : event.summary || 'Googleカレンダーの予定',
    date,
    time,
    endDate,
    endTime,
    allDay,
    startText: allDay ? '終日' : time,
    endText: endTime,
    location: privateEvent && options.hidePrivateDetails ? '' : event.location || '',
    htmlLink: event.htmlLink || '',
    private: privateEvent,
    taskId: null
  };
}

async function syncToday() {
  const session = await getSession();
  const accessToken = session?.provider_token;
  if (!accessToken) {
    throw new Error('Googleカレンダー権限がありません。もう一度Googleで接続してください。');
  }

  const current = await readStatus();
  const settings = normalizeSettings(current.settings);
  const calendarList = await calendarFetch('/users/me/calendarList', accessToken);
  const rawCalendars = Array.isArray(calendarList.items) ? calendarList.items : [];
  const defaultSelectedIds =
    settings.selectedCalendarIds.length > 0
      ? settings.selectedCalendarIds
      : rawCalendars.filter((calendar) => calendar.primary).map((calendar) => calendar.id);
  const selectedIds =
    defaultSelectedIds.length > 0
      ? defaultSelectedIds
      : rawCalendars.slice(0, 1).map((calendar) => calendar.id);
  const calendars = rawCalendars.map((calendar) => normalizeCalendar(calendar, selectedIds));
  const selectedCalendars = calendars.filter((calendar) => selectedIds.includes(calendar.id));
  const { end, start } = todayWindow();
  const existingTaskIds = new Map(
    current.events.map((event) => [event.key, event.taskId]).filter(([, taskId]) => taskId)
  );
  const events = [];
  const calendarErrors = [];

  for (const calendar of selectedCalendars) {
    try {
      const query = new URLSearchParams({
        maxResults: '20',
        orderBy: 'startTime',
        singleEvents: 'true',
        timeMax: end.toISOString(),
        timeMin: start.toISOString()
      });
      const payload = await calendarFetch(
        `/calendars/${encodeURIComponent(calendar.id)}/events?${query.toString()}`,
        accessToken
      );
      for (const item of payload.items || []) {
        const normalized = normalizeEvent(item, calendar, settings);
        normalized.taskId = existingTaskIds.get(normalized.key) || null;
        events.push(normalized);
      }
    } catch (error) {
      calendarErrors.push({
        calendarId: calendar.id,
        calendarSummary: calendar.summary,
        message: error.message
      });
    }
  }

  return writeStatus({
    ...current,
    connected: true,
    connectedAccount: session?.user?.email || current.connectedAccount || '',
    settings: {
      ...settings,
      selectedCalendarIds: selectedIds
    },
    calendars,
    events: events.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
    sync: {
      lastSyncedAt: new Date().toISOString(),
      error: calendarErrors.length > 0 ? 'partial' : null,
      errorMessage:
        calendarErrors.length > 0 ? '一部のGoogleカレンダーを同期できませんでした。' : null,
      calendarErrors
    }
  });
}

async function updateSettings(partial) {
  const current = await readStatus();
  return writeStatus({
    ...current,
    settings: {
      ...current.settings,
      ...(partial || {})
    }
  });
}

async function markEventTask(eventKey, taskId) {
  const current = await readStatus();
  return writeStatus({
    ...current,
    events: current.events.map((event) =>
      event.key === eventKey ? { ...event, taskId } : event
    )
  });
}

async function disconnect() {
  await AsyncStorage.removeItem(STORAGE_KEYS.googleCalendar);
  return clone(DEFAULT_GOOGLE_CALENDAR_STATE);
}

module.exports = {
  disconnect,
  GOOGLE_CALENDAR_SCOPES,
  readStatus,
  markEventTask,
  signInWithGoogleCalendar,
  syncToday,
  updateSettings
};
