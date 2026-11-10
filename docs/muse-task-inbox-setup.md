# Muse → TaskMate Mobile 連携の導入

作成日: 2026-11-10。初版はAndroid、スマホ1台、日本時間（Asia/Tokyo）を対象とします。

MuseがHTTPS APIへ送ったタスクをSupabaseの受信箱に保存し、TaskMateの起動・復帰時に取得します。
既存の端末内タスクはアップロードしません。アプリを閉じている間の即時反映・通知、
スマホ間の同期、再インストール後の復元は含みません。

## 1. Supabaseを準備する

既存のTaskMate用Supabaseプロジェクトを利用できます。個人検証はFreeプランから始められます。
この変更ではプロジェクト作成・課金・実環境配備を実行していません。

Supabase DashboardのSQL Editorで次のSQLを実行します。

```text
supabase/migrations/20261110_task_inbox.sql
```

`task_inbox_keys` と `task_inbox_items`、本人用のRLS、サービス専用RPCを作成します。
既存のPC同期テーブルには変更を加えません。このSQLはスマホのログイン用Authユーザーを作成しません。

AuthenticationでEmail / Passwordを有効にし、Usersから検証用ユーザーを作成します。
初版のスマホには新規アカウント作成画面がないため、作成済みユーザーでログインしてください。
PC版に同じプロジェクトのメール／パスワードアカウントがあれば利用できます。

## 2. Edge Functionを配備する

Supabase CLIでログイン・対象プロジェクトの確認後、リポジトリ直下から実行します。

```powershell
npx supabase functions deploy task-inbox --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

このFunctionは通常のJWTとは異なる追加専用キーも受け付けるため、ゲートウェイのJWT検証を無効にします。
代わりにFunction内で、追加操作ではキーのハッシュ、本人用操作ではSupabase Authのセッションを検証します。
`delete-account`のJWT設定は変更しません。

サーバー専用の `SUPABASE_SECRET_KEYS.default` または `SUPABASE_SERVICE_ROLE_KEY` をFunctionが使用します。
ホスト環境で利用可能か確認してください。これらをスマホ・PC・Muse・公開設定へ渡さないでください。
Functionのエントリーポイントは `supabase/functions/task-inbox/index.ts` です。

## 3. スマホの公開設定を指定してビルドする

Supabase DashboardからProject URLと**Publishable key**を取得し、公式ビルドでは
`mobile/src/config/taskInboxConfig.js`の公開設定へ指定します。開発時は `mobile/.env` でも上書きできます。

```text
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
```

秘密キーやMuse用連携キーは設定しません。未設定のビルドでは接続先未設定の案内が表示され、ローカル機能は利用できます。
SecureStoreを追加しているため、既存のネイティブビルドへのJavaScript配信だけでは対応できません。

```powershell
npm --prefix mobile install
npm --prefix mobile run prebuild:android
npm --prefix mobile run android
```

保存済みデータを残すには、同じアプリID・署名で更新します。バージョン番号の更新と公開作業はリリース時に行います。

## 4. スマホで接続する

1. 設定 → 外部タスク連携でメール／パスワードを入力し、ログインします。
2. 自動取得が有効になります。日本時間以外の端末では保留理由を表示します。
3. 「Museとの接続」を開き、連携キーを発行します。
4. 表示されたキーをMuseの資格情報保存機能に設定します。キーは再表示できません。
5. 受信後は次回起動・復帰、または「今すぐ取得」で追加します。

ログインのセッションは端末のSecureStoreに保存します。追加専用キーの平文はサーバーに保存しません。
発行直後の表示を閉じるか、ログアウト・アプリ終了するとキーを再確認できません。必要なら失効して再発行します。

## 5. Museへ渡すAPI情報

API定義: `docs/task-inbox.openapi.json`。Custom Connectorのツールとして追加操作だけを登録してください。

- URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/task-inbox/tasks`
- Method: `POST`
- Header: `Authorization: Bearer <資格情報保存機能に登録した追加専用キー>`
- Content-Type: `application/json`
- タイムゾーン: `Asia/Tokyo`
- 期限が不明なら利用者に確認し、日付を推測して送らない。
- 同じ元情報のタスクには再試行時も同じ `externalId` を使う。

キーを会話本文、URL、公開ファイル、スクリーンショット、通常のログへ貼り付けないでください。
Muse側の実際の認証設定操作は、利用中のCustom Connectorの画面・案内に従います。

リクエスト例（キーを含まない公開可能な本文）:

```json
{
  "tasks": [
    {
      "externalId": "mail-thread-123:submit-document",
      "title": "資料を提出する",
      "description": "提出先を確認して資料を送る",
      "date": "2026-11-12",
      "time": "17:00",
      "genre": "仕事",
      "priority": "normal"
    }
  ]
}
```

必須は `externalId`（200文字以内）、`title`（100文字以内）、実在する `date`（YYYY-MM-DD）です。
`description`は1000文字以内、`genre`は40文字以内、`time`はHH:mmまたは空／null、
`priority`はhigh/normal/low（省略時normal）です。完了状態や端末内IDは指定できません。
1回50件、本文64KB、キーごとに日本時間の1日200件、有効キーは1人3本までです。
上限は新規タスク数で判定し、同じ内容の再送は枠を消費しません。

### 結果の意味

- `202` / `status: received`: **サーバーの受信箱へ保存済み**。スマホへの反映完了を意味しません。
- `items[].duplicate`: 同じIDと内容をすでに受信済み。
- `items[].imported`: そのタスクについてスマホの保存完了通知を受信済み。
- `400`: 不正な項目。バッチ全体を登録しません。
- `401`: キーが無効・失効済み、または本人セッションが無効。
- `409`: 同じexternalIdで内容が異なる。初版は更新APIを提供しません。
- `413`: 本文が64KBを超過。
- `429`: 件数またはキー発行上限。
- `500`: サーバー障害。externalIdを変えずに後で再試行します。

## 6. 導入後の確認

1. テスト用の1件を送信し、Supabase受信箱に未取り込みの行ができることを確認します。
2. スマホを開き、そのタスクが1件追加されることを確認します。
3. 同じ本文を再送し、スマホで再取得しても増えないことを確認します。
4. キーを失効し、以後の送信が401になることを確認します。
5. 別の検証ユーザーでログインしても、元の受信箱を取得できないことを確認します。

取り込み済みの本文は受領確認後にサーバーから削除します。externalId・入力のハッシュ・受信状態は
再送防止のため残します。未取り込み分と再送防止記録に自動期限はありません。
必要に応じて設定画面の「サーバーの連携データを削除」で受信箱とキーをまとめて削除できます。

ログアウトや端末データ削除ではサーバーの未取り込み分とキーは残ります。
取り込み済みタスクはログアウト・アカウント切替後も同じ端末の一覧に残ります。
本文削除後は再インストールしたアプリや別端末へ復元できません。

## 7. サーバー費用

2026-11-10に確認した [Supabase公式料金](https://supabase.com/pricing) に基づきます。

| 構成 | 月額の目安 | 条件 |
|---|---|---|
| Freeで個人検証 | 0米ドル | DB 500MB、Function月50万回、外向き転送5GBなどの枠内 |
| Proで1つのMicroプロジェクト | 25米ドルから | 最初のMicroを賄う計算資源クレジットを含む。利用超過・構成変更・税等は別 |
| Proで追加プロジェクト | 追加10米ドル／月から | プロジェクトの計算資源により変動 |

この機能のために別のレンタルサーバー、Realtime、有料ドメイン、LLM APIは必要ありません。
今回の規模なら無料枠から試せる見込みですが、既存プロジェクト全体の利用量も合算されます。
Freeは1週間非アクティブだと停止対象となり、Proにはその停止がありません。
DashboardのUsageでDBサイズ・転送量・Function実行数を確認してください。
ProのSpend Capはすべての追加料金を一律に封じる機能ではないため、計算資源や追加プロジェクトも確認します。
Muse自体のプランや、別途メール配信サービスを契約した場合の費用は含みません。

## 8. 開発時の検証

```powershell
npm test
npm run test:core
npm --prefix mobile test
npm --prefix mobile run export:android
npx deno check --no-lock supabase/functions/task-inbox/index.ts
```

APIハンドラーとPostgres互換のPGliteを使うテスト、実SQLiteでの取り込みテストを含みます。
これらはSupabaseホスト環境、実際のMuse、Android実機を組み合わせた接続確認の代替ではありません。
公開時はプライバシー文書とGoogle Playのデータセーフティ説明を、この任意連携の実態に合わせて更新します。
