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
- Publishable keyだけでの受信箱・キーハッシュの直接取得とキー発行RPCは401（42501）で拒否。
- GitHubで認証した実機からキー発行・取り込み・再送防止を確認済み。実際のMuseからの送信はMuse側の設定後に確認する。

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

その後、利用者の選択によりGitHubログイン（PKCE/S256）を追加し、同じ署名で再度更新した。
最終の検証版は `2.1.0-muse-github-test`（versionCode 21）。更新後も同じデータ領域と「3 / 4」の進捗を確認し、
設定の「GitHubでログイン」ボタンを確認した。APK内に追加コードと二重操作防止の修正を含むことも確認した。
最終APKのSHA-256:

```text
974A228DD8B52DE30D20D5906B867FCAC0971BA60A29435D0A40A542DDCB12C4
```

## GitHub認証の設定

利用者がGitHubでログインしていたのはSupabaseの管理画面で、TaskMateのAuthユーザーとは別だった。
対象プロジェクトのGitHubプロバイダーは無効で、Client ID / Secretは空だった。
Authの許可URLへ `taskmate://auth/callback` を追加し、GitHubのOAuth App登録フォームを準備した。
GitHub側のcallbackは `https://nppqtkehgeusoghkecsw.supabase.co/auth/v1/callback`。
利用者の承認後、GitHub OAuth App「TaskMate Mobile」を登録した。
GitHubの本人確認を利用者が完了した後、発行したClient ID / SecretをSupabaseのGitHubプロバイダーへ保存し、
DashboardのENABLED表示と公開Auth設定の `external.github = true` を確認した。
Secretは画面間の受け渡し時だけメモリで扱い、チャット・リポジトリ・作業用ファイルへ保存していない。
GitHub上の一度きりの表示を閉じ、利用者がスマホからGitHubログインを完了した。
スマホの本人認証による取得で「0件追加しました」と最終取得日時が更新されることを確認した。

## 配備後の実機疎通確認

利用者の承認を受け、Muse接続・検証用の追加専用キーを1本発行した。
キーはスマホ上に表示したままにし、検証時はメモリだけで扱った。チャットやファイルへ出力していない。

- タイトル `Muse連携テスト`、externalId `codex-smoke-2026-11-10` のテストタスクを1件送信し、202を確認。
- 同じ本文の再送も202で、同じ受信IDと `duplicate: true` を確認。
- 追加専用キーで本人用 `GET /items` を呼ぶと401になり、読み取りに使えないことを確認。
- スマホで取得した後、再送応答の `imported: true` により端末の保存完了通知を確認。
- スマホで再取得し、再送しても同じ受信IDのまま `duplicate: true, imported: true` を確認。
- Androidのホーム画面へ移動してTaskMateへ復帰すると、手動取得を押さずに最終取得日時が更新されることを確認。
- 追加したテストタスクは1件のみ。既存タスクの編集・削除やアプリのデータ消去は行っていない。

実際のMuseからのHTTP送信は今回の検証には含まない。Muse側へAPI定義と追加専用キーを設定すれば試せる状態。

## 追加実装の検証

- root 48/48、core 17/17、mobile 49/49（計114件）。
- Expo Android export成功。ネイティブビルド成功、署名検証成功、更新インストール成功。
- 新規OAuthコードのレビューで二重タップ時の再表示を修正し、再現テストのRED→GREENを確認。
- 軽微な残件: Supabase SDKが返すflowIdを交換に渡していないため、成功した認証の別管理verifierはSDKの整理まで残る。
  現在のlegacy verifierによるコード交換はテスト済み。ログインセッションそのものを外へ公開するものではない。

APK、署名鍵、パスワード、ログインセッション、Muse用キーはGitHubへ追加していない。
ローカルのビルド成果物と作業用ファイルは `.codex-temp/` に保存する。

## 利用者の接続手順

1. スマホの設定 → 外部タスク連携でGitHubにログインする。メール認証用のアカウントはメール／パスワードでも利用できる。
2. 「Museとの接続」から追加専用キーを発行し、Museの資格情報保存欄に設定する。
3. `docs/task-inbox.openapi.json` の追加操作をMuseへ登録する。
4. Museからテストタスクを1件送信し、スマホの起動・復帰または「今すぐ取得」で反映を確認する。
5. 同じexternalId・本文を再送しても増えないことを確認する。

キーはチャット本文、URL、公開ファイル、通常ログへ貼り付けない。
キーは再表示できないため、アプリを終了する前にMuseの資格情報保存欄へ設定する。
実際のMuseとの往復確認は、Muse側の接続設定が終わってから行う。
