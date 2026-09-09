const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const fsPromises = fs.promises;

const STATE_VERSION = 1;
const TOKEN_REFRESH_BUFFER_MS = 90_000;
const AUTH_TIMEOUT_MS = 2 * 60 * 1000;
const TODAY_SYNC_INTERVAL_MS = 12 * 60 * 1000;
const MAX_EVENTS_PER_CALENDAR = 80;
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_SCOPES = Object.freeze([
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly'
]);

const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  showTodayOnHome: true,
  hidePrivateDetails: true,
  selectedCalendarIds: []
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createDefaultState() {
  return {
    version: STATE_VERSION,
    settings: clone(DEFAULT_SETTINGS),
    auth: null,
    calendars: [],
    events: [],
    createdTaskMap: {},
    sync: {
      lastSyncedAt: null,
      error: null,
      calendarErrors: []
    }
  };
}

function normalizeSettings(value) {
  const source = isPlainObject(value) ? value : {};
  const selectedCalendarIds = Array.isArray(source.selectedCalendarIds)
    ? source.selectedCalendarIds
        .filter((id) => typeof id === 'string' && id.trim())
        .map((id) => id.trim())
        .slice(0, 50)
    : DEFAULT_SETTINGS.selectedCalendarIds;
  return {
    enabled:
      typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_SETTINGS.enabled,
    showTodayOnHome:
      typeof source.showTodayOnHome === 'boolean'
        ? source.showTodayOnHome
        : DEFAULT_SETTINGS.showTodayOnHome,
    hidePrivateDetails:
      typeof source.hidePrivateDetails === 'boolean'
        ? source.hidePrivateDetails
        : DEFAULT_SETTINGS.hidePrivateDetails,
    selectedCalendarIds: [...new Set(selectedCalendarIds)]
  };
}

function normalizeCalendar(calendar) {
  const source = isPlainObject(calendar) ? calendar : {};
  return {
    id: typeof source.id === 'string' ? source.id : '',
    summary: typeof source.summary === 'string' ? source.summary : '',
    description: typeof source.description === 'string' ? source.description : '',
    primary: source.primary === true,
    accessRole: typeof source.accessRole === 'string' ? source.accessRole : '',
    backgroundColor:
      typeof source.backgroundColor === 'string' ? source.backgroundColor : '',
    foregroundColor:
      typeof source.foregroundColor === 'string' ? source.foregroundColor : ''
  };
}

function normalizeEvent(event) {
  const source = isPlainObject(event) ? event : {};
  return {
    key: typeof source.key === 'string' ? source.key : '',
    id: typeof source.id === 'string' ? source.id : '',
    calendarId: typeof source.calendarId === 'string' ? source.calendarId : '',
    calendarSummary:
      typeof source.calendarSummary === 'string' ? source.calendarSummary : '',
    title: typeof source.title === 'string' ? source.title : 'Googleカレンダーの予定',
    date: typeof source.date === 'string' ? source.date : '',
    time: typeof source.time === 'string' ? source.time : null,
    endDate: typeof source.endDate === 'string' ? source.endDate : '',
    endTime: typeof source.endTime === 'string' ? source.endTime : null,
    allDay: source.allDay === true,
    startText: typeof source.startText === 'string' ? source.startText : '',
    endText: typeof source.endText === 'string' ? source.endText : '',
    location: typeof source.location === 'string' ? source.location : '',
    htmlLink: typeof source.htmlLink === 'string' ? source.htmlLink : '',
    private: source.private === true,
    taskId: typeof source.taskId === 'string' ? source.taskId : null
  };
}

function normalizeState(value) {
  const source = isPlainObject(value) ? value : {};
  const fallback = createDefaultState();
  return {
    ...fallback,
    version: STATE_VERSION,
    settings: normalizeSettings(source.settings),
    auth: isPlainObject(source.auth) ? source.auth : null,
    calendars: Array.isArray(source.calendars)
      ? source.calendars.map(normalizeCalendar).filter((calendar) => calendar.id)
      : [],
    events: Array.isArray(source.events)
      ? source.events.map(normalizeEvent).filter((event) => event.key && event.date)
      : [],
    createdTaskMap: isPlainObject(source.createdTaskMap) ? source.createdTaskMap : {},
    sync: {
      lastSyncedAt:
        typeof source.sync?.lastSyncedAt === 'string' ? source.sync.lastSyncedAt : null,
      error: typeof source.sync?.error === 'string' ? source.sync.error : null,
      errorMessage:
        typeof source.sync?.errorMessage === 'string'
          ? source.sync.errorMessage
          : typeof source.sync?.error === 'string'
            ? source.sync.error
            : null,
      calendarErrors: Array.isArray(source.sync?.calendarErrors)
        ? source.sync.calendarErrors.filter(isPlainObject)
        : []
    }
  };
}

function parseEnvText(text) {
  const result = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

async function readProjectEnv(app) {
  const candidates = [
    path.join(app.getAppPath(), '.env'),
    path.join(process.cwd(), '.env')
  ];
  for (const filePath of candidates) {
    try {
      return parseEnvText(await fsPromises.readFile(filePath, 'utf8'));
    } catch {
      // Missing .env is normal for packaged builds.
    }
  }
  return {};
}

function base64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest();
}

function randomToken(bytes = 32) {
  return base64Url(crypto.randomBytes(bytes));
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return {
    date: localDateKey(start),
    start,
    end
  };
}

function datePartsFromDateTime(value) {
  if (typeof value !== 'string' || !value) {
    return { date: '', time: null, text: '' };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: '', time: null, text: '' };
  }
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`;
  return {
    date: localDateKey(date),
    time,
    text: time
  };
}

function datePartsFromEventDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { date: '', time: null, text: '終日' };
  }
  return { date: value, time: null, text: '終日' };
}

function eventKey(calendarId, eventId) {
  return `${calendarId}|${eventId}`;
}

function taskIdForEvent(key) {
  const hash = crypto.createHash('sha1').update(key).digest('hex').slice(0, 18);
  return `task-google-${hash}`;
}

function publicConfig(config) {
  return {
    configured: config.configured,
    clientIdHint: config.clientId ? `${config.clientId.slice(0, 8)}...` : '',
    scopes: GOOGLE_SCOPES
  };
}

function publicState(state, config) {
  const selected = new Set(state.settings.selectedCalendarIds);
  return {
    config: publicConfig(config),
    connected: Boolean(state.auth),
    authSource: typeof state.auth?.source === 'string' ? state.auth.source : null,
    connectedAccount:
      typeof state.auth?.accountEmail === 'string' ? state.auth.accountEmail : '',
    needsReauthorization:
      state.sync?.error === 'google-provider-token-expired' ||
      state.sync?.error === 'google-provider-token-refresh-unavailable',
    settings: state.settings,
    calendars: state.calendars.map((calendar) => ({
      ...calendar,
      selected: selected.has(calendar.id)
    })),
    events: [...state.events].sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      if (a.time && b.time) {
        return a.time.localeCompare(b.time);
      }
      if (a.time !== b.time) {
        return a.time ? -1 : 1;
      }
      return a.title.localeCompare(b.title, 'ja');
    }),
    sync: state.sync
  };
}

function fetchJson(url, options = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('この環境ではfetchが利用できないため、Googleカレンダーへ接続できません。');
  }
  return fetch(url, options).then(async (response) => {
    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }
    if (!response.ok) {
      const message =
        body?.error_description ||
        body?.error?.message ||
        body?.error ||
        `Google API request failed (${response.status})`;
      const error = new Error(String(message));
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body || {};
  });
}

function toFormBody(values) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') {
      body.set(key, value);
    }
  }
  return body;
}

function createOAuthServer(expectedState) {
  let server;
  let timeout = null;
  let finished = false;
  const promise = new Promise((resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new Error('Googleカレンダー接続の待ち時間が過ぎました。'));
      server?.close();
    }, AUTH_TIMEOUT_MS);

    server = http.createServer((request, response) => {
      const requestUrl = new URL(request.url, 'http://127.0.0.1');
      if (requestUrl.pathname !== '/oauth2callback') {
        response.writeHead(404);
        response.end('Not found');
        return;
      }

      const code = requestUrl.searchParams.get('code');
      const state = requestUrl.searchParams.get('state');
      const oauthError = requestUrl.searchParams.get('error');
      if (state !== expectedState) {
        clearTimeout(timeout);
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<p>TaskMate Google Calendar connection failed.</p>');
        reject(new Error('Google認証のstateが一致しませんでした。'));
        return;
      }
      if (oauthError) {
        clearTimeout(timeout);
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<p>TaskMate Google Calendar connection was cancelled.</p>');
        reject(new Error(`Google認証がキャンセルされました: ${oauthError}`));
        return;
      }
      if (!code) {
        clearTimeout(timeout);
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<p>TaskMate Google Calendar connection failed.</p>');
        reject(new Error('Google認証コードを受け取れませんでした。'));
        return;
      }

      finished = true;
      clearTimeout(timeout);
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(
        '<p>TaskMate connected to Google Calendar. You can close this tab.</p>'
      );
      resolve(code);
      server.close();
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        redirectUri: `http://127.0.0.1:${address.port}/oauth2callback`,
        codePromise: promise,
        close: () => {
          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
          if (!finished) {
            finished = true;
            server.close();
          }
        }
      });
    });
  });
}

function protectTokens(tokens, safeStorage) {
  const serialized = JSON.stringify(tokens);
  if (safeStorage?.isEncryptionAvailable?.()) {
    return {
      storage: 'safeStorage',
      value: safeStorage.encryptString(serialized).toString('base64')
    };
  }
  return {
    storage: 'plain',
    value: serialized
  };
}

function revealTokens(auth, safeStorage) {
  if (!isPlainObject(auth) || typeof auth.value !== 'string') {
    return null;
  }
  if (auth.storage === 'safeStorage') {
    if (!safeStorage?.isEncryptionAvailable?.()) {
      throw new Error('保存済みのGoogle認証情報を復号できません。再接続してください。');
    }
    const text = safeStorage.decryptString(Buffer.from(auth.value, 'base64'));
    return JSON.parse(text);
  }
  if (auth.storage === 'plain') {
    return JSON.parse(auth.value);
  }
  return null;
}

function normalizeProviderAuthInput(input) {
  const source = isPlainObject(input) ? input : {};
  const accessToken = typeof source.accessToken === 'string' ? source.accessToken : '';
  const refreshToken = typeof source.refreshToken === 'string' ? source.refreshToken : '';
  if (!accessToken && !refreshToken) {
    throw new Error('Googleカレンダー権限のトークンを受け取れませんでした。');
  }
  const expiresAt = Number.isFinite(source.expiresAt)
    ? source.expiresAt
    : Date.now() + 55 * 60 * 1000;
  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    scope: typeof source.scope === 'string' ? source.scope : GOOGLE_SCOPES.join(' '),
    expiresAt,
    source: 'supabase-google',
    accountEmail: typeof source.accountEmail === 'string' ? source.accountEmail : ''
  };
}

function eventToCalendarItem(event, calendar, settings, createdTaskMap) {
  const start = isPlainObject(event.start) ? event.start : {};
  const end = isPlainObject(event.end) ? event.end : {};
  const allDay = typeof start.date === 'string';
  const startParts = allDay
    ? datePartsFromEventDate(start.date)
    : datePartsFromDateTime(start.dateTime);
  const endParts = allDay
    ? datePartsFromEventDate(end.date)
    : datePartsFromDateTime(end.dateTime);
  const isPrivate = event.visibility === 'private' || event.privateCopy === true;
  const hideTitle = settings.hidePrivateDetails && isPrivate;
  const key = eventKey(calendar.id, event.id);

  return normalizeEvent({
    key,
    id: event.id,
    calendarId: calendar.id,
    calendarSummary: calendar.summary,
    title: hideTitle ? 'Googleカレンダーの予定' : event.summary || 'Googleカレンダーの予定',
    date: startParts.date,
    time: startParts.time,
    endDate: endParts.date,
    endTime: endParts.time,
    allDay,
    startText: startParts.text,
    endText: endParts.text,
    location: hideTitle ? '' : event.location || '',
    htmlLink: event.htmlLink || '',
    private: isPrivate,
    taskId: typeof createdTaskMap[key] === 'string' ? createdTaskMap[key] : null
  });
}

function createGoogleCalendarService({
  app,
  fileManager,
  paths,
  safeStorage,
  shell,
  onUpdated
}) {
  let syncPromise = null;

  async function readOAuthConfig() {
    const fileEnv = await readProjectEnv(app);
    const value = (key) => process.env[key] || fileEnv[key] || '';
    const clientId =
      value('GOOGLE_OAUTH_CLIENT_ID') || value('VITE_GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret =
      value('GOOGLE_OAUTH_CLIENT_SECRET') || value('VITE_GOOGLE_OAUTH_CLIENT_SECRET');
    return {
      configured: Boolean(clientId),
      clientId,
      clientSecret
    };
  }

  async function readState() {
    try {
      const text = await fsPromises.readFile(paths.googleCalendarFile, 'utf8');
      return normalizeState(JSON.parse(text.replace(/^\uFEFF/, '')));
    } catch {
      return createDefaultState();
    }
  }

  async function writeState(state) {
    await fsPromises.mkdir(path.dirname(paths.googleCalendarFile), { recursive: true });
    const normalized = normalizeState(state);
    const temporaryPath = `${paths.googleCalendarFile}.${process.pid}.${Date.now()}.tmp`;
    await fsPromises.writeFile(
      temporaryPath,
      `${JSON.stringify(normalized, null, 2)}\n`,
      'utf8'
    );
    try {
      await fsPromises.rename(temporaryPath, paths.googleCalendarFile);
    } catch (error) {
      if (!['EEXIST', 'EPERM'].includes(error.code)) {
        await fsPromises.rm(temporaryPath, { force: true });
        throw error;
      }
      await fsPromises.copyFile(temporaryPath, paths.googleCalendarFile);
      await fsPromises.rm(temporaryPath, { force: true });
    }
    return normalized;
  }

  async function emit(state = null) {
    const [nextState, config] = await Promise.all([
      state ? Promise.resolve(normalizeState(state)) : readState(),
      readOAuthConfig()
    ]);
    const status = publicState(nextState, config);
    onUpdated?.(status);
    return status;
  }

  function readTokens(state) {
    const tokens = revealTokens(state.auth, safeStorage);
    if (!tokens?.accessToken && !tokens?.refreshToken) {
      throw new Error('Googleカレンダーへ再接続してください。');
    }
    return tokens;
  }

  async function saveTokens(state, tokens) {
    const protectedTokens = protectTokens(tokens, safeStorage);
    return writeState({
      ...state,
      auth: {
        connectedAt: state.auth?.connectedAt || new Date().toISOString(),
        source: typeof tokens.source === 'string' ? tokens.source : state.auth?.source,
        accountEmail:
          typeof tokens.accountEmail === 'string'
            ? tokens.accountEmail
            : state.auth?.accountEmail,
        storage: protectedTokens.storage,
        value: protectedTokens.value
      }
    });
  }

  async function requestToken(params) {
    const config = await readOAuthConfig();
    if (!config.configured) {
      throw new Error(
        '.envにGOOGLE_OAUTH_CLIENT_IDまたはVITE_GOOGLE_OAUTH_CLIENT_IDを設定してください。'
      );
    }
    const body = toFormBody({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...params
    });
    return fetchJson(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
  }

  async function ensureAccessToken(state) {
    const tokens = readTokens(state);
    if (
      tokens.accessToken &&
      Number.isFinite(tokens.expiresAt) &&
      tokens.expiresAt - Date.now() > TOKEN_REFRESH_BUFFER_MS
    ) {
      return { state, accessToken: tokens.accessToken };
    }
    if (!tokens.refreshToken) {
      if (tokens.source === 'supabase-google') {
        const error = new Error('Googleログインのカレンダー権限を再許可してください。');
        error.code = 'google-provider-token-expired';
        throw error;
      }
      throw new Error('Googleカレンダーの再認証が必要です。');
    }
    const config = await readOAuthConfig();
    if (tokens.source === 'supabase-google' && !config.clientSecret) {
      const error = new Error(
        'Googleログインのカレンダー権限が期限切れです。設定から再許可してください。'
      );
      error.code = 'google-provider-token-refresh-unavailable';
      throw error;
    }
    const refreshed = await requestToken({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken
    });
    const nextTokens = {
      ...tokens,
      accessToken: refreshed.access_token,
      tokenType: refreshed.token_type || tokens.tokenType || 'Bearer',
      scope: refreshed.scope || tokens.scope,
      expiresAt: Date.now() + Math.max(0, Number(refreshed.expires_in || 3600)) * 1000
    };
    const nextState = await saveTokens(state, nextTokens);
    return { state: nextState, accessToken: nextTokens.accessToken };
  }

  async function apiGet(pathname, accessToken, params = {}) {
    const url = new URL(`${GOOGLE_CALENDAR_API}${pathname}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    }
    return fetchJson(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  }

  async function listCalendars(accessToken) {
    const calendars = [];
    let pageToken = null;
    do {
      const response = await apiGet('/users/me/calendarList', accessToken, {
        maxResults: '250',
        showDeleted: 'false',
        showHidden: 'false',
        pageToken
      });
      for (const item of response.items || []) {
        calendars.push(normalizeCalendar(item));
      }
      pageToken = response.nextPageToken || null;
    } while (pageToken);
    return calendars.filter((calendar) => calendar.id && calendar.accessRole !== 'none');
  }

  async function listEventsForCalendar(calendar, accessToken, range, settings, createdTaskMap) {
    const events = [];
    let pageToken = null;
    do {
      const response = await apiGet(
        `/calendars/${encodeURIComponent(calendar.id)}/events`,
        accessToken,
        {
          maxResults: String(MAX_EVENTS_PER_CALENDAR),
          singleEvents: 'true',
          orderBy: 'startTime',
          showDeleted: 'false',
          timeMin: range.start.toISOString(),
          timeMax: range.end.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
          pageToken
        }
      );
      for (const item of response.items || []) {
        if (item.status === 'cancelled') {
          continue;
        }
        const normalized = eventToCalendarItem(
          item,
          calendar,
          settings,
          createdTaskMap
        );
        if (normalized.date === range.date) {
          events.push(normalized);
        }
      }
      pageToken = response.nextPageToken || null;
    } while (pageToken);
    return events;
  }

  async function status() {
    const [state, config] = await Promise.all([readState(), readOAuthConfig()]);
    return publicState(state, config);
  }

  async function connect() {
    const config = await readOAuthConfig();
    if (!config.configured) {
      throw new Error(
        '.envにGOOGLE_OAUTH_CLIENT_IDまたはVITE_GOOGLE_OAUTH_CLIENT_IDを設定してください。'
      );
    }
    const stateToken = randomToken(24);
    const codeVerifier = randomToken(48);
    const codeChallenge = base64Url(sha256(codeVerifier));
    const oauthServer = await createOAuthServer(stateToken);
    const authUrl = new URL(GOOGLE_AUTH_URL);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', oauthServer.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('include_granted_scopes', 'true');
    authUrl.searchParams.set('state', stateToken);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    try {
      await shell.openExternal(authUrl.toString());
      const code = await oauthServer.codePromise;
      const tokenResponse = await requestToken({
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: oauthServer.redirectUri
      });
      const current = await readState();
      const nextTokens = {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        tokenType: tokenResponse.token_type || 'Bearer',
        scope: tokenResponse.scope || GOOGLE_SCOPES.join(' '),
        expiresAt:
          Date.now() + Math.max(0, Number(tokenResponse.expires_in || 3600)) * 1000
      };
      await writeState({
        ...current,
        settings: {
          ...current.settings,
          enabled: true
        },
        auth: {
          connectedAt: new Date().toISOString(),
          ...protectTokens(nextTokens, safeStorage)
        },
        sync: {
          lastSyncedAt: null,
          error: null,
          calendarErrors: []
        }
      });
      return syncToday({ force: true });
    } finally {
      oauthServer.close();
    }
  }

  async function connectWithProviderAuth(providerAuth) {
    const current = await readState();
    const tokens = normalizeProviderAuthInput(providerAuth);
    await writeState({
      ...current,
      settings: {
        ...current.settings,
        enabled: true
      },
      auth: {
        connectedAt: new Date().toISOString(),
        source: 'supabase-google',
        accountEmail: tokens.accountEmail,
        ...protectTokens(tokens, safeStorage)
      },
      sync: {
        lastSyncedAt: null,
        error: null,
        calendarErrors: []
      }
    });
    return syncToday({ force: true });
  }

  async function disconnect() {
    const current = await readState();
    try {
      if (current.auth) {
        const tokens = readTokens(current);
        const token = tokens.refreshToken || tokens.accessToken;
        if (token) {
          const body = toFormBody({ token });
          await fetchJson(GOOGLE_REVOKE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
          }).catch(() => null);
        }
      }
    } finally {
      const next = await writeState(createDefaultState());
      return emit(next);
    }
  }

  async function updateSettings(partial) {
    const current = await readState();
    const source = isPlainObject(partial) ? partial : {};
    const settings = normalizeSettings({
      ...current.settings,
      ...source
    });
    const next = await writeState({ ...current, settings });
    await emit(next);
    if (
      current.auth &&
      (Array.isArray(source.selectedCalendarIds) ||
        typeof source.hidePrivateDetails === 'boolean')
    ) {
      return syncToday({ force: true });
    }
    return status();
  }

  async function syncToday(options = {}) {
    if (syncPromise) {
      return syncPromise;
    }
    syncPromise = (async () => {
      let current = await readState();
      const config = await readOAuthConfig();
      if (!current.auth) {
        return publicState(current, config);
      }
      if (current.settings.enabled === false) {
        return publicState(current, config);
      }
      if (!options.force && current.sync.lastSyncedAt) {
        const age = Date.now() - new Date(current.sync.lastSyncedAt).getTime();
        if (age >= 0 && age < TODAY_SYNC_INTERVAL_MS) {
          return publicState(current, config);
        }
      }

      try {
        const tokenResult = await ensureAccessToken(current);
        current = tokenResult.state;
        const accessToken = tokenResult.accessToken;
        const calendars = await listCalendars(accessToken);
        const existingSelected = new Set(current.settings.selectedCalendarIds);
        let selectedCalendarIds = calendars
          .filter((calendar) => existingSelected.has(calendar.id))
          .map((calendar) => calendar.id);
        if (selectedCalendarIds.length === 0) {
          const primary = calendars.find((calendar) => calendar.primary) || calendars[0];
          selectedCalendarIds = primary ? [primary.id] : [];
        }
        const selectedCalendars = calendars.filter((calendar) =>
          selectedCalendarIds.includes(calendar.id)
        );
        const range = todayRange();
        const allEvents = [];
        const calendarErrors = [];
        for (const calendar of selectedCalendars) {
          try {
            const calendarEvents = await listEventsForCalendar(
              calendar,
              accessToken,
              range,
              current.settings,
              current.createdTaskMap
            );
            allEvents.push(...calendarEvents);
          } catch (error) {
            calendarErrors.push({
              calendarId: calendar.id,
              calendarSummary: calendar.summary,
              message: error.message
            });
          }
        }
        const next = await writeState({
          ...current,
          settings: {
            ...current.settings,
            selectedCalendarIds
          },
          calendars,
          events: allEvents,
          sync: {
            lastSyncedAt: new Date().toISOString(),
            error: null,
            calendarErrors
          }
        });
        return emit(next);
      } catch (error) {
        const next = await writeState({
          ...current,
          sync: {
            ...current.sync,
            error: error.code || error.message,
            errorMessage: error.message,
            calendarErrors: []
          }
        });
        return emit(next);
      }
    })();
    try {
      return await syncPromise;
    } finally {
      syncPromise = null;
    }
  }

  async function createTaskFromEvent(key) {
    const current = await readState();
    const event = current.events.find((candidate) => candidate.key === key);
    if (!event) {
      throw new Error('Googleカレンダーの予定が見つかりませんでした。同期し直してください。');
    }
    const tasks = await fileManager.getTasks();
    const existingTaskId = current.createdTaskMap[key];
    const existing = existingTaskId
      ? tasks.find((task) => task.id === existingTaskId)
      : null;
    if (existing) {
      return {
        task: existing,
        tasks,
        status: publicState(current, await readOAuthConfig())
      };
    }

    const taskId = taskIdForEvent(key);
    const descriptionLines = [
      `Googleカレンダー: ${event.calendarSummary || event.calendarId}`,
      event.startText
        ? `予定: ${event.startText}${event.endText ? ` - ${event.endText}` : ''}`
        : '',
      event.location ? `場所: ${event.location}` : '',
      event.htmlLink ? `URL: ${event.htmlLink}` : ''
    ].filter(Boolean);
    const result = await fileManager.addTask({
      id: taskId,
      title: event.title,
      description: descriptionLines.join('\n'),
      date: event.date,
      time: event.time,
      genre: 'Googleカレンダー',
      priority: 'normal',
      completed: false
    });
    const createdTaskMap = {
      ...current.createdTaskMap,
      [key]: result.task.id
    };
    const events = current.events.map((candidate) =>
      candidate.key === key ? { ...candidate, taskId: result.task.id } : candidate
    );
    const next = await writeState({
      ...current,
      createdTaskMap,
      events
    });
    return {
      task: result.task,
      tasks: result.tasks,
      status: publicState(next, await readOAuthConfig())
    };
  }

  return {
    connect,
    connectWithProviderAuth,
    createTaskFromEvent,
    disconnect,
    status,
    syncToday,
    updateSettings
  };
}

module.exports = {
  createGoogleCalendarService,
  normalizeState,
  eventToCalendarItem
};
