# Mobile Task Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Museから追加専用APIで受け取ったタスクをスマホの次回起動・復帰時に登録する。

**Architecture:** Supabase Authでスマホ利用者を認証し、追加専用キーでEdge Functionが受信箱へ保存する。端末ではSQLiteの取り込み記録とタスクを同時保存し、保存完了後だけ受領確認する。

**Tech Stack:** Expo / React Native、SQLite、Supabase JS/Auth、Deno Edge Functions、Postgres、node:test。

**Spec:** `docs/superpowers/specs/2026-11-10-mobile-task-inbox-design.md`（利用者承認済み）

## Global Constraints

- 通常タスク追加のみ。スマホ1台、日本時間。即時プッシュなし。
- 1リクエスト最大50件、64KB、キーごとに1日200件、有効キー最大3本。
- 外部IDの再送は上書きしない。本文が異なる場合は競合とする。
- 端末保存と取り込み記録は同じトランザクション。受領確認の失敗は重複を作らず再試行。
- 既存端末タスクのアップロードなし。未接続・オフラインでもローカル起動できる。
- 公開設定だけをクライアントへ配布する。有料化・実環境デプロイは含めない。
- 元の作業フォルダの未コミット変更を保全する。

## Review Focus

- 受領確認失敗後に利用者がタスクを削除しても再作成しない（Task 2）。
- 連携解除・ログアウト中の通信が古い利用者のタスクを追加しない（Task 2/3）。
- 取り込み済み本文削除後も同一IDの変更された再送を拒否する（Task 1）。
- 不正項目1件で後続の正常タスクが永久に取得できなくならない（Task 2）。
- ローカル全削除と受信処理の競合でデータが復活しない（Task 3）。

## Task 1: 受信APIとPostgres権限

**Files:** `supabase/migrations/20261110_task_inbox.sql`、`supabase/functions/task-inbox/`、`supabase/functions/_shared/`、`tests/taskInboxApi.test.js`、`tests/taskInboxDatabase.test.js`。

**Interfaces:** HTTP POST `task-inbox/tasks`（追加専用キー）、認証済みGET `task-inbox/items`、POST `task-inbox/ack`、GET/POST/DELETE `task-inbox/keys`、DELETE `task-inbox/data`。レスポンスの項目形式は `{id,externalId,source,task:{title,date,time,description,genre,priority}}`。

- [ ] 欠落日付、バッチ途中の不正入力、認証なし、無効キー、形式・サイズ上限の拒否テストを書く。
- [ ] `node --test tests/taskInboxApi.test.js` で未実装による失敗を確認する。
- [ ] ハンドラー・入力検証・キー生成とハッシュ化・Supabaseストアを実装する。
- [ ] SQLの利用者分離、重複、競合、原子的な上限判定、受領後の本文削除をPostgres互換環境で検証する。使えない環境なら未検証を明記する。
- [ ] API・DBテストを実行し、緑になった結果を記録する。

## Task 2: 端末への確実な取り込み

**Files:** `mobile/src/repositories/database.js`、`mobile/src/repositories/taskInboxRepository.js`、`mobile/src/services/taskInboxSync.js`、`mobile/tests/taskInboxSync.test.js`。

**Interfaces:** `importInboxItem(userId,item)` は `{created,taskId}` を返す。`createInboxSync({fetchPage,importItem,acknowledge,isCurrent,onImported})` は `sync(userId)` を返す。

- [ ] 再送、受領確認失敗、削除後の再送、アカウント切替、不正項目のスキップ、ページ継続のテストを書く。
- [ ] `node --test mobile/tests/taskInboxSync.test.js` で未実装の失敗を確認する。
- [ ] SQLite migration v6と取り込みトランザクションを実装する。保存時には共有コアで再検証する。
- [ ] 取得を直列化し、正常保存後だけ受領確認する。有限の通信時間と起動単位の処理上限を設ける。
- [ ] 対象テストとスマホ既存テストを実行して結果を記録する。

## Task 3: 任意のログインと設定画面、起動連携

**Files:** `mobile/src/services/taskInboxClient.js`、`mobile/src/hooks/useTaskInbox.js`、`mobile/src/components/TaskInboxSettingsCard.jsx`、`mobile/src/context/TaskMateContext.jsx`、`mobile/src/screens/SettingsScreen.jsx`、`mobile/package.json`、公開設定ファイル。

**Interfaces:** フックは設定カードの状態・ログイン・ログアウト・同期・キー管理を提供する。成功した取り込み後に既存 `refreshTasksAndFocus()` を呼ぶ。

- [ ] 無効セッション、タイムアウト、ログアウト時の処理無効化、全削除時の再取り込み防止をサービス境界でテストする。
- [ ] テストの失敗を確認し、Supabaseクライアント、セッション永続化、設定カード、起動／復帰連携を実装する。
- [ ] 通常起動を通信待ちにしない。接続は任意とし、登録済みローカルタスクをアップロードしない。
- [ ] `npm.cmd --prefix mobile run export:android` と既存テストを実行する。

## Task 4: 導入手順・費用説明と全体検証

**Files:** `docs/muse-task-inbox-setup.md`、`docs/privacy-policy.md`、対応HTML、`docs/mobile-current-spec.md`。

**Interfaces:** SQL適用・Function配置・公開設定・検証ユーザー作成・Museの資格情報設定・テスト用リクエストを再現可能に記載する。

- [ ] 導入手順、API仕様、受信箱と端末の状態の違い、無料枠とProの費用を記載する。
- [ ] `npm.cmd test`、`npm.cmd run test:core`、`npm.cmd --prefix mobile test`、Androidバンドル、差分チェックを実行する。
- [ ] 別担当が機能差分と承認済み設計をレビューし、重要な指摘を修正・再検証する。
- [ ] 変更したファイル、実施した検証、未実施の実接続・配備作業を利用者へ報告する。
