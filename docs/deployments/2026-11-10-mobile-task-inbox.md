# スマホ版タスク受信箱の配備記録

日付: 2026-11-10（日本時間）

## Supabase

- 既存プロジェクト: `nppqtkehgeusoghkecsw`（Sydney）
- 既存組織のDashboardで **Free plan usage** を確認。配備前のDB使用量は27 / 500 MB。
- プロジェクト作成、プラン変更、有料オプション追加は行っていない。
- CodexのSupabaseツールが利用できなかったため、ログイン済みDashboardから配備した。
- SQL Editorで `supabase/migrations/20261110_task_inbox.sql` をトランザクション内で適用し、成功を確認。
- 既存のPC同期テーブルとスマホ内タスクは変更していない。
- Edge Function `task-inbox` の3ファイルをリポジトリと一致させて配備。
- Function内で本人セッション／追加専用キーを検証するため、同Functionのlegacy JWT検証は無効。
- 実環境の疎通確認: OPTIONSは204、認証なし・無効な追加キー・無効な本人セッションはいずれも401。
- 有効なアカウントからのキー発行、取り込み、Museからの送信は別途実機で確認する。

追加先: `https://nppqtkehgeusoghkecsw.supabase.co/functions/v1/task-inbox/tasks`

## Android実機更新

- 接続されたSH-51C（arm64）の既存アプリIDは `com.taskmate.mobile`、versionCodeは21。
- リポジトリの本番アプリID `com.kesan0705.taskmate` は変更していない。
- 検証APKだけ既存端末と同じアプリIDにし、手元の既存リリース鍵で署名した。
- 署名証明書SHA-256が既存インストールと一致することを確認した。
- `adb install -r` による更新が成功。アンインストール、データ消去は行っていない。
- 更新後のversionNameは `2.1.0-muse-test`、versionCodeは21。
- 更新前後でアプリのデータ領域識別値とホーム画面の内容が一致し、既存の「3 / 4」の進捗を確認。
- 設定の「外部タスク連携」でメール／パスワードのログイン欄を確認。
- APK内に既存プロジェクトURLとPublishable keyが含まれることを確認。サーバー秘密鍵は含めていない。

検証APKのSHA-256:

```text
144764A22864FCD7AD871910E9F1D426A213FBCC5D2601349A72C3AC7CC02284
```

APK、署名鍵、パスワード、ログインセッション、Muse用キーはGitHubへ追加していない。
ローカルのビルド成果物と作業用ファイルは `.codex-temp/` に保存する。

## 利用者の接続手順

1. スマホの設定 → 外部タスク連携で、既存のメール／パスワードアカウントにログインする。
2. 「Museとの接続」から追加専用キーを発行し、Museの資格情報保存欄に設定する。
3. `docs/task-inbox.openapi.json` の追加操作をMuseへ登録する。
4. テストタスクを1件送信し、スマホの起動・復帰または「今すぐ取得」で反映を確認する。
5. 同じexternalId・本文を再送しても増えないことを確認する。

キーはチャット本文、URL、公開ファイル、通常ログへ貼り付けない。
認証情報が未設定の段階では、実際のMuseとの往復確認は未完了である。
