# TaskMate Supabase Account Setup

This is the setup checklist for enabling account login and character-pack sync.

## 1. Create A Supabase Project

Create a project in Supabase, then open **Project Settings > API Keys** and copy:

- Project URL
- Publishable key

Use only the publishable key in TaskMate clients. Never put a secret or service-role key in Electron or mobile code.

## 2. Run The SQL

Open the Supabase SQL editor and run:

```sql
-- supabase/migrations/20260622_account_sync.sql
```

The migration creates:

- `profiles`
- `task_items`
- `task_sync_items`
- `character_packs`
- `account_deletion_requests`
- private Storage bucket `taskmate-character-assets`
- RLS policies so users can access only their own rows and files

## 2.5. Deploy The Account Deletion Function

The repository contains:

```text
supabase/functions/delete-account/
```

This Edge Function deletes the signed-in Auth user and that user's private character files. It must run server-side because it uses a Supabase secret/service-role key.

With Supabase CLI:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy delete-account --use-api
```

If you deploy through the Supabase Dashboard/GitHub integration, deploy the `delete-account` function from the same folder. Keep `verify_jwt = true`.

Do not put a secret or service-role key into `.env`, Electron, or the mobile app.

## 3. Configure Public Client Settings

For official desktop builds, do not ask users to edit `.env`. Put only the
public Supabase URL and publishable key in:

```text
renderer/config/publicRuntimeConfig.js
```

Example:

```js
export const PUBLIC_RUNTIME_CONFIG = Object.freeze({
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  supabasePublishableKey: 'sb_publishable_...'
});
```

These values are safe to bundle in a desktop app when RLS is enabled. Never put
a Supabase secret key, service-role key, or Google client secret in Electron,
the mobile app, or this public config file.

For desktop development overrides, `.env` is still supported:

Desktop:

```powershell
Copy-Item .env.example .env
```

Then set:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

If both `.env` and `publicRuntimeConfig.js` are set, `.env` wins so developers
can test against a separate Supabase project without changing release config.

Mobile:

```powershell
Copy-Item mobile\.env.example mobile\.env
```

Then set:

```text
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Restart the dev servers after editing `.env` or public runtime config.

## 4. Auth Configuration

For the first test, enable email/password signups in Supabase Auth. If email confirmation is enabled, sign-up will show a "check your email" flow until the user confirms.

### Google Login And Calendar Permission

TaskMate v1.3.0 can use Supabase Google login as the preferred path for
Google Calendar permission.

In Supabase Dashboard:

1. Open **Authentication > Providers > Google**.
2. Enable Google.
3. Add the Google OAuth client ID and client secret used by Supabase.
4. Add this redirect URL:

```text
http://127.0.0.1:53682/oauth-callback
```

When users press **Googleで登録/ログイン**, TaskMate requests these scopes:

```text
openid email profile
https://www.googleapis.com/auth/calendar.calendarlist.readonly
https://www.googleapis.com/auth/calendar.events.readonly
```

TaskMate stores the returned Google provider token in the same local protected
Google Calendar cache used by the standalone calendar connection.

If a user signs in with email/password, they can still use the standalone
Google Calendar connection from the Google Calendar settings tab.

## 5. Current Implementation Scope

Prepared now:

- Desktop Supabase client
- Desktop account tab
- Desktop character pack upload/download bridge
- Mobile Supabase client
- Mobile settings account card
- Mobile custom-character upload/download service
- Desktop/mobile task and long-project sync via `task_sync_items`
- Desktop Google login with Calendar read permission
- SQL/RLS/Storage setup

Still to implement after real project credentials are available:

- production SMTP and redirect URLs
