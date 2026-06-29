# TaskMate Google Calendar Setup

TaskMate v1.3.0 can read today's Google Calendar events on the desktop app.
The integration is read-only until a user explicitly creates a normal TaskMate
task from an event.

## Recommended Path: TaskMate Google Login

If TaskMate account login is configured with Supabase Google provider, use
**Googleで登録/ログイン** in the Account tab or Google Calendar settings tab.
TaskMate asks for Google Calendar read-only permission during that login flow
and reuses the returned Google provider token for calendar sync.

For public desktop builds, this path should not require users to edit `.env`.
Bundle the public Supabase URL and publishable key in
`renderer/config/publicRuntimeConfig.js`, and keep the Google client secret in
the Supabase Google provider settings.

Supabase must allow this redirect URL:

```text
http://127.0.0.1:53682/oauth-callback
```

TaskMate Mobile uses the same Supabase Google provider and redirects back to
the app with the custom scheme below. Add it to Supabase Auth redirect URLs
when enabling Google Calendar sync on mobile:

```text
taskmate://auth/callback
```

See `docs/supabase-account-setup.md` for the Supabase provider setup.

## Standalone Path: Calendar Only

Use this path for users who sign in with email/password, who do not use a
TaskMate account, or for local development testing.

### 1. Create OAuth Client

1. Open Google Cloud Console.
2. Enable the Google Calendar API.
3. Configure the OAuth consent screen.
4. Create an OAuth Client ID with application type `Desktop app`.
5. Copy the client ID.

TaskMate uses a local loopback redirect with PKCE. A client secret is optional
for local development and is not required for the default desktop flow.

### 2. Configure TaskMate

Add the client ID to `.env`:

```text
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Then restart TaskMate.

### 3. Connect

1. Open TaskMate settings.
2. Select the Google Calendar tab.
3. Press Connect and complete the Google consent flow in the browser.
4. Choose the calendars to sync.

## Data Handling

- Calendar events are cached separately in `google-calendar.json`.
- Existing TaskMate tasks are not overwritten by Google events.
- A Google event becomes a normal TaskMate task only when the user presses
  `タスク化`.
- Disconnecting clears the local Google Calendar cache and revokes the Google
  token when possible.
- Private Google events are displayed as `Googleカレンダーの予定` by default.

## OAuth Scopes

TaskMate requests the narrow read-only scopes needed for the feature:

- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
- `https://www.googleapis.com/auth/calendar.events.readonly`
