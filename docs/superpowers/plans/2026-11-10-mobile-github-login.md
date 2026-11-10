# Mobile GitHub Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PCと同じGitHubアカウントでスマホのタスク受信箱へログインできる。

**Architecture:** Supabase PKCE + Expo WebBrowser、固定deep linkと既存SecureStoreを利用。既存のmutation barrier内でコードを交換する。

**Tech Stack:** React Native / Expo 56, supabase-js 2, Node test runner.

**Spec:** docs/superpowers/specs/2026-11-10-mobile-github-login-design.md

## Global Constraints

- `taskmate://auth/callback` だけを戻り先に利用する。
- 既存のアプリID・署名で更新し、既存のタスクを保持する。
- Freeプランを継続し、秘密鍵・コード・セッションを公開しない。

## Review Focus

- ブラウザーが別host・pathや重複コードを返したら交換しない。
- キャンセルで既存セッションを書き換えない。
- OAuth開始・コード交換の失敗でURLや秘密をエラー表示しない。
- リセット中に遅いOAuthが戻ってもログインを復活させない。
- 二重操作・端末の復帰でログイン処理を重複開始しない。

### Task 1: GitHub OAuthと設定画面

**Files:** Create `mobile/src/services/taskInboxOAuth.js`, `mobile/tests/taskInboxOAuth.test.js`; modify `mobile/src/hooks/useTaskInbox.js`, `mobile/src/services/taskInboxClient.js`, `mobile/src/components/TaskInboxSettingsCard.jsx`, mobile dependencies.

**Interfaces:** `createGitHubLogin({auth, openAuthSession, projectUrl})` produces async `(isCurrent) => session | null`. Exports `GITHUB_REDIRECT_TO`.

- [x] Write tests for a valid PKCE flow, browser cancellation, malformed callback / authorization URLs, safe errors, stale browser return and reset during exchange.
- [x] Run `node --test mobile/tests/taskInboxOAuth.test.js`; confirm RED for missing OAuth implementation.
- [x] Implement the helper, install Expo-compatible `expo-web-browser`, set `flowType: 'pkce'`, and add GitHub action / button under existing mutation barrier.
- [x] Run `npm --prefix mobile test` and `npm --prefix mobile run export:android`; expect all passing and export success.
- [x] Commit the implementation and docs; request one fresh review of the integration, fix important findings with RED→GREEN.

### Task 2: 配備設定と実機更新

**Files:** Update `docs/muse-task-inbox-setup.md`, `docs/deployments/2026-11-10-mobile-task-inbox.md`.

**Interfaces:** Uses `GITHUB_REDIRECT_TO`; no new endpoints or task schemas.

- [x] Add the exact callback to Supabase Auth URL allowlist without replacing PC redirect entries.
- [x] Build release APK, sign with the installed app's existing key, verify its certificate, then update with `adb install -r`.
- [x] Verify existing tasks and the GitHub button; hand off GitHub credentials / consent to the user and observe successful session + inbox retrieval.
- [x] Run root / core / mobile suites, update the PR, and verify CI.
