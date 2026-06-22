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

## 3. Add Environment Variables

Desktop:

```powershell
Copy-Item .env.example .env
```

Then set:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Mobile:

```powershell
Copy-Item mobile\.env.example mobile\.env
```

Then set:

```text
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Restart the dev servers after editing `.env`.

## 4. Auth Configuration

For the first test, enable email/password signups in Supabase Auth. If email confirmation is enabled, sign-up will show a "check your email" flow until the user confirms.

## 5. Current Implementation Scope

Prepared now:

- Desktop Supabase client
- Desktop account tab
- Desktop character pack upload/download bridge
- Mobile Supabase client
- Mobile settings account card
- Mobile custom-character upload/download service
- SQL/RLS/Storage setup

Still to implement after real project credentials are available:

- Full task sync reconciliation
- OAuth providers such as Google login
- production SMTP and redirect URLs
