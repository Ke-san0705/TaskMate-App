# TaskMate Mobile 現行仕様書 / README

最終更新: 2026-11-10
対象: TaskMate Android / Expo React Native 版  
現行ブランチ確認時点: `feature/windows-installer` / `b6b1638 fix: defer installed app loading`

## 1. 概要

TaskMate Mobile は、タスク管理に集中支援を組み合わせたローカルファーストのAndroidアプリです。

中心体験は次の流れです。

```text
タスクを決める
制限するアプリを選ぶ
集中を開始する
制限対象アプリを開いたらTaskMateが介入する
タスクを完了して制限を解除する
```

TaskMate v2では、旧版の感情シミュレーションや生活圧のような複雑なキャラクター状態管理は廃止されています。キャラクターは、タスク管理と集中を支える案内役およびブランド要素として残しています。

## 2. 現在の主な機能

現在のスマホ版には、以下の機能が入っています。

- 通常タスク管理
- 長期タスク / プロジェクト管理
- 「今やる」タスク
- 集中モード
- 制限対象アプリの検知とブロック画面
- アンロックモード
- Androidホーム画面ウィジェット
- 締切通知
- キャラクター選択
- カスタムキャラクター
- 設定管理
- ローカルデータ削除

## 3. 技術構成

### アプリ本体

- Expo / React Native 構成です。
- エントリポイントは `mobile/App.js` です。
- グローバル状態は `mobile/src/context/TaskMateContext.jsx` の `TaskMateProvider` が管理します。
- 画面遷移は React Navigation を使用します。
- 主要データは SQLite に保存します。
- 設定、キャラクター設定、旧データ互換情報は AsyncStorage に保存します。

### 主要依存

`mobile/package.json` 時点の主な依存は以下です。

- `expo`
- `react`
- `react-native`
- `expo-sqlite`
- `expo-notifications`
- `expo-image-picker`
- `@react-native-async-storage/async-storage`
- `@react-navigation/native`
- `@react-navigation/bottom-tabs`
- `@react-navigation/native-stack`
- `@taskmate/core`

### Androidネイティブ

Android固有機能は、Expo config plugin と Kotlin テンプレートで管理されています。

- Config plugin: `mobile/plugins/withTaskMateWidget.cjs`
- Kotlinテンプレート: `mobile/plugins/android-native/java/`
- 生成先: `mobile/android/app/src/main/java/com/taskmate/mobile/`

主なネイティブクラスは以下です。

- `TaskMateFocusModule.kt`
- `TaskMateFocusPackage.kt`
- `TaskMateAccessibilityService.kt`
- `TaskMateRestrictionPolicy.kt`
- `FocusBlockedActivity.kt`
- `TaskMateWidgetProvider.kt`
- `TaskMateBootReceiver.kt`

`npm --prefix mobile run prebuild:android` を実行すると、config plugin から Android ネイティブコードが再生成されます。

## 4. ナビゲーション構成

下部タブは次の4つです。

- ホーム
- タスク
- キャラクター
- 設定

集中モードは独立タブではなく、ホームまたはタスク画面から開始します。

主な画面は以下です。

- `HomeScreen`
- `TasksScreen`
- `TaskEditScreen`
- `FocusSetupScreen`
- `FocusBlockedScreen`
- `CharactersScreen`
- `CharacterEditScreen`
- `SettingsScreen`

ディープリンクのスキームは `taskmate` です。

## 5. データ保存

### SQLite

SQLite DB名は `taskmate-mobile.db` です。

主なテーブルは以下です。

- `tasks`
- `notification_schedules`
- `project_categories`
- `projects`
- `project_milestones`
- `project_tasks`
- `focus_state`
- `focus_sessions`
- `blocked_apps`
- `focus_interventions`
- `schema_meta`

### AsyncStorage

主なキーは以下です。

- `taskmate:settings:v1`
- `taskmate:life-state:v1`
- `taskmate:characters:v1`
- `taskmate:selected-character:v1`

`taskmate:life-state:v1` は旧感情システム由来の互換キーです。現行v2では感情状態の制御には使いません。

## 6. 通常タスク

通常タスクは、今日やる作業や締切のある作業を管理する基本単位です。

主な項目は以下です。

- `id`
- `title`
- `description`
- `date`
- `time`
- `genre`
- `priority`
- `completed`
- `created_at`
- `updated_at`
- `completed_at`
- `source`
- `project_task_id`
- `project_id`
- `project_name`

対応済み操作は以下です。

- 作成
- 編集
- 削除
- 完了
- 完了取り消し
- 今日のタスク表示
- 期限超過表示
- 今後のタスク表示
- 完了済みタスク表示
- 締切通知
- 「今やる」タスクへの指定

締切通知は `expo-notifications` を使用します。デフォルトの通知チャンネルは `taskmate-deadlines` です。

## 7. 長期タスク / プロジェクト

スマホ版には、長期タスク機能が復元されています。UIは `mobile/src/components/LongTermTasksPanel.jsx` にあります。

長期タスクは、プロジェクト、マイルストーン、プロジェクト内タスクを扱います。

### 主なデータ

カテゴリ:

- `project_categories`

プロジェクト:

- `projects`

マイルストーン:

- `project_milestones`

プロジェクト内タスク:

- `project_tasks`

### デフォルトカテゴリ

- 学習
- 研究
- 部活・活動
- 個人開発
- イベント
- その他

### 主な機能

- プロジェクト作成、編集、削除
- マイルストーン作成、編集、削除
- プロジェクト内タスク作成、編集、削除
- 進捗率、重要度、難易度、見積時間、状態の管理
- 依存関係テキストの管理
- プロジェクト内タスクを今日の通常タスクへ追加
- 通常タスクとプロジェクト内タスクの完了状態同期

`addProjectTaskToToday` により、長期タスクから今日取り組む通常タスクを作成できます。作成された通常タスクには、元のプロジェクト情報が紐づきます。

## 8. 今やるタスク

「今やる」タスクは、ユーザーが今取り組む1件の未完了タスクです。

仕様は以下です。

- 同時に1件のみ保持します。
- `focus_state` に保存します。
- アプリ再起動後も復元します。
- 集中開始時に対象タスクを「今やる」にします。
- タスク完了時に解除します。
- タスク削除時に解除します。
- 集中完了時に解除します。

ホーム画面では、「今やる」タスクを最優先で表示します。

## 9. 集中モード

集中モードは、現在のTaskMate v2の中心機能です。

開始フローは以下です。

```text
タスクを選択
制限するアプリを選択
集中開始
```

集中開始時には、次の情報を保存します。

- セッションID
- タスクID
- タスクタイトル
- 開始時刻
- 状態
- 完了フラグ
- 制限対象アプリ一覧

アクティブなセッションは `focus_state` と `focus_sessions` で復元されます。Androidネイティブ側には `TaskMateFocusModule` 経由で監視状態を渡します。

## 10. 制限対象アプリ検知

制限対象アプリの検知には Android AccessibilityService を使用します。

現在の方針は以下です。

- `TYPE_WINDOW_STATE_CHANGED` などの前面アプリ変化を利用します。
- foreground package name の検知に限定します。
- `canRetrieveWindowContent=false` を維持します。
- 画面内容、入力内容、SNS本文、Web閲覧内容は取得しません。
- 検知情報は外部送信しません。
- `SYSTEM_ALERT_WINDOW` は使いません。
- VPN、Device Admin、強制終了APIは使いません。

AccessibilityService が制限対象アプリを検知すると、直接ホームに戻すのではなく、専用のブロック画面を表示します。

## 11. ブロック画面

ブロックUIは、Androidネイティブの `FocusBlockedActivity` を主経路として表示します。React Native側にも `FocusBlockedScreen` があります。

表示内容は以下です。

- TaskMate名
- 制限対象アプリ名
- 「このアプリは現在制限されています」
- 厳しめのメッセージ
- 現在のタスク名
- 集中経過時間
- `TaskMateに戻る` ボタン

集中モード時の標準メッセージは以下です。

```text
持ち場に戻れ。
お前の居場所はここではない。
```

この表現は厳しい口調ですが、ユーザー本人を侮辱する内容にはしていません。

Backボタンで制限対象アプリに戻れてしまわないよう、Back操作時もTaskMate側へ戻す動作にしています。Recents経由で再度制限対象アプリへ戻った場合も、AccessibilityService が再検知します。

## 12. アンロックモード

アンロックモードは、指定したアプリを一定時間使うまで、別の誘惑アプリを開けないようにする機能です。

例:

```text
英単語アプリを30分使うまで
YouTubeとChromeを制限する
```

### 主な設定

- 有効 / 無効
- 条件アプリ
- 必要利用時間
- 制限アプリ
- Usage Access 説明同意日時

### 技術方式

Androidの `UsageStatsManager.queryAndAggregateUsageStats` を使用し、当日の条件アプリ利用時間を端末内で集計します。

現在の制約は以下です。

- `PACKAGE_USAGE_STATS` 権限が必要です。
- ユーザーが Android 設定画面で Usage Access を手動許可する必要があります。
- 集計対象はユーザーが選んだ条件アプリです。
- 集計結果は外部送信しません。
- Focus mode と Unlock mode が同時に該当する場合は、Focus mode を優先します。

アンロック条件を満たしていない状態で制限対象アプリを開くと、ブロック画面にアンロックモード用の理由と進捗が表示されます。

### 設定画面のUI

- ON/OFF、今日の進捗、条件アプリと制限アプリの件数・名前を上部に表示します。
- 必要時間は「条件設定」、アプリ一覧は「アプリを選択」、権限の説明は「権限 / 状態」で開閉できます。
- 必要時間は「保存」ボタン、入力終了時、条件設定の折りたたみ時に保存します。保存に失敗した場合は条件設定を開いたままにします。
- アプリ選択は「条件アプリ / 制限アプリ」のセグメント切替で共通の一覧を使います。
- アプリ一覧は名前を表示し、package nameは内部識別と検索にのみ使います。
- アプリ一覧の表示高さを制限し、一覧内でスクロールできます。
- 権限説明・明示的な同意は有効化前に確認します。同意が未保存なら権限設定へ進みません。

## 13. ホーム画面ウィジェット

Androidホーム画面ウィジェットを実装済みです。

実装は `TaskMateWidgetProvider.kt` と Expo config plugin で管理しています。

表示目的は、TaskMateを開かなくても次の情報が分かることです。

- 今やるタスク
- 今日の進捗
- 残りタスク数
- 集中状態
- キャラクター

ウィジェットは、タスク変更、集中開始、集中終了、完了操作などに応じて更新されます。端末再起動後の復元用に `RECEIVE_BOOT_COMPLETED` を利用します。

## 14. キャラクター

キャラクターはTaskMateの案内役です。旧版の感情シミュレーションは復活させていません。

現在の役割は以下です。

- ホーム画面での案内
- タスクがないときの案内
- 集中開始前の案内
- 集中中の案内
- キャラクター選択
- カスタムキャラクター作成

バンドルキャラクターは `mobile/assets/characters/` 配下にあります。

ホーム画面の見出しは「ホーム」です。ホームとキャラクター画面では、キャラクター名の下に状態ラベルを表示しません。キャラクター画面の属性チップは廃止し、選択状態は一覧の色・枠線と「選択中」ボタンで示します。

カスタムキャラクターでは以下を編集できます。

- 名前
- 説明
- 画像
- セリフ

画像選択時のみ `expo-image-picker` を使用します。

## 15. 設定

設定画面には、以下の項目があります。

- 通知ON/OFF
- 静かな時間帯
- 集中モードの制限機能ON/OFF
- AccessibilityService 権限案内
- アンロックモード
- Usage Access 権限案内
- モーション軽減
- キャラクター選択
- カスタムキャラクター
- ローカルデータ削除
- アプリ情報

権限は必要になったタイミングで案内します。初回起動時にすべての権限を一括要求する設計ではありません。

集中モードの権限説明も開閉できます。未同意の場合は最初から説明を表示し、同意済みの場合は折りたたみます。

## 16. プライバシー方針

TaskMate Mobile はローカルファーストです。

現行v2では以下を収集しません。

- キー入力
- SNS本文
- メッセージ本文
- Webページ本文
- 写真内容
- 通話履歴
- 位置情報
- アカウント情報

アプリ制限で利用する情報は、必要最小限の前面アプリpackage nameです。アンロックモードでは、選択された条件アプリの当日利用時間を端末内で集計します。

通常機能はローカルで動作します。任意の外部タスク連携を有効にすると、Supabase Authと受信箱を利用します。
連携元から送られたタスクだけを起動・復帰時に取得し、既存の端末内タスクはアップロードしません。
広告、アプリ内課金、AI / LLMの推論は利用しません。

### 外部タスク連携（2026-11-10追加）

- 設定画面から作成済みの連携用アカウントでログインします。ログインは任意です。
- Museに追加専用キーを発行し、HTTP APIで送られた通常タスクをSQLiteへ取り込みます。
- 起動・復帰時の自動取得と手動取得に対応します。日本時間のスマホ1台が初版の対象です。
- 受領確認の失敗や再送でも重複登録しません。登録済みのローカルタスクを上書きしません。
- ログアウトでは端末のタスクが残ります。キー失効とサーバーの連携データ削除も設定画面から行えます。
- 詳細・配備手順・費用は `docs/muse-task-inbox-setup.md` を参照してください。

Privacy Policy 関連の文書は以下です。

- `docs/privacy-policy.md`
- `docs/privacy-policy.html`

## 17. Android権限

`mobile/app.json` で明示しているAndroid権限は以下です。

- `POST_NOTIFICATIONS`
- `RECEIVE_BOOT_COMPLETED`
- `PACKAGE_USAGE_STATS`

AndroidManifestや依存ライブラリ由来で確認対象になる主な権限は以下です。

- `INTERNET`
- `ACCESS_NETWORK_STATE`
- `VIBRATE`
- `WAKE_LOCK`
- `READ_EXTERNAL_STORAGE` with max SDK
- Expo notifications / badge 関連権限

意図的に追加しない、または削除対象としている権限は以下です。

- `SYSTEM_ALERT_WINDOW`
- `RECORD_AUDIO`
- `WRITE_EXTERNAL_STORAGE`
- `CAMERA`

`SYSTEM_ALERT_WINDOW` はブロック画面表示には使っていません。Expoまたは依存関係経由で混入する可能性があるため、`blockedPermissions` と manifest の remove 指定で除去対象にしています。

## 18. Google Play公開上の注意

Google Play公開で特に注意が必要なのは次の2点です。

- Accessibility API の利用申告
- Usage Access / `PACKAGE_USAGE_STATS` の利用説明

AccessibilityService は、前面アプリ検知による集中支援に使っています。画面内容の読み取りや入力補助を目的にしていないため、申告文とアプリ内説明では以下を明確にする必要があります。

- TaskMateはユーザーが選んだ制限アプリを検知するためにAccessibility APIを使うこと
- 画面内容、入力内容、メッセージ内容は取得しないこと
- 検知情報を外部送信しないこと
- ユーザーが明示的に有効化した場合のみ動作すること

アンロックモードでは Usage Access を使います。申告文とアプリ内説明では以下を明確にする必要があります。

- 選択した条件アプリの利用時間を端末内で確認すること
- 目的はアンロック条件の判定であること
- 利用時間を外部送信しないこと

Google Playでは、技術的に動作することよりも、ユーザーへの明確な説明と必要最小限の権限利用が重要です。

## 19. Androidビルド設定

現行のアプリIDとバージョンは以下です。

- applicationId: `com.kesan0705.taskmate`
- versionCode: `20`
- versionName: `2.0.0`
- Expo version: `2.0.0`
- Expo package: `com.kesan0705.taskmate`
- Native namespace: `com.taskmate.mobile`

直近のAndroid 16 / API 36対応ビルドでは、以下の構成を確認しています。

- minSdk: `24`
- targetSdk: `36`
- compileSdk: `36`
- buildTools: `36.0.0`
- Hermes: enabled
- New Architecture: enabled
- release minify: enabled
- release resource shrink: enabled

release signing は、本番用アップロードキー設定がある場合はそれを使い、未設定の場合はローカル確認用に debug key fallback します。本番公開用AABでは debug keystore を使用しないでください。

## 20. よく使うコマンド

ルートから実行するコマンド:

```powershell
npm install
npm run test:core
npm test
```

モバイル用:

```powershell
npm --prefix mobile install
npm --prefix mobile run test
npm --prefix mobile run export:android
npm --prefix mobile run prebuild:android
```

Androidビルド:

```powershell
cd mobile/android
.\gradlew.bat assembleDebug
.\gradlew.bat assembleRelease
.\gradlew.bat bundleRelease
```

ADB確認:

```powershell
adb devices
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
```

APKインストール:

```powershell
adb install -r path\to\taskmate.apk
```

通常の `adb install -r` がPlay Protect確認などで止まる場合は、PackageInstaller session を使います。

```powershell
adb push path\to\taskmate.apk /data/local/tmp/taskmate-current.apk
adb shell pm install-create -r --user 0 -S <APK_BYTES>
adb shell pm install-write -S <APK_BYTES> <SESSION_ID> base /data/local/tmp/taskmate-current.apk
adb shell pm install-commit <SESSION_ID>
```

既存データを引き継ぐには、同じ `applicationId` と同じ署名系統で `-r` 更新インストールします。署名が一致しない場合、アンインストールが必要になり、端末内のローカルデータは失われます。

## 21. テスト

直近の確認済みテストは以下です。

```text
npm --prefix mobile run test : PASS
npm run test:core          : PASS
npm test                   : PASS
Android release APK build  : PASS
```

直近の実機確認端末は以下です。

- Device ID: `359971911833969`
- Model: `SH-RM19s`
- Android: `13`
- API: `33`

直近インストール済みAPK:

```text
C:\Users\kensh\Documents\TaskMate\mobile\artifacts\unlock-mode-20260908\taskmate-current-local-release-debugkey.apk
```

SHA-256:

```text
2FAC77C26C52FE204FF74532586E1D5B945DBD7624A762643639414E52C77AAA
```

このAPKはローカル実機確認用の debug key 署名版です。本番公開用ではありません。

## 22. 実機確認チェックリスト

基本機能:

- 起動
- タスク作成
- タスク編集
- タスク削除
- タスク完了
- 完了取り消し
- 「今やる」指定
- 再起動後のデータ保持
- 締切通知
- キャラクター表示
- 設定画面

長期タスク:

- プロジェクト作成
- プロジェクト編集
- プロジェクト削除
- マイルストーン作成
- プロジェクト内タスク作成
- プロジェクト内タスクを今日のタスクへ追加
- 通常タスク完了時の同期

集中モード:

- タスク選択
- 制限アプリ選択
- 集中開始
- AccessibilityService設定画面への誘導
- AccessibilityService有効化
- 制限対象アプリ起動
- ブロック画面表示
- アプリ名表示
- 現在のタスク名表示
- 集中時間表示
- `TaskMateに戻る` ボタン
- Backボタン時の戻り防止
- Recents経由の再検知
- タスク完了後の制限解除

アンロックモード:

- Usage Access説明表示
- Usage Access設定画面への誘導
- 条件アプリ選択
- 必要分数設定
- 制限アプリ選択
- 条件未達時のブロック
- 条件達成後の解除
- Focus mode との優先順位

ウィジェット:

- ホーム画面への追加
- 今日の進捗表示
- 今やるタスク表示
- 集中状態表示
- タスク更新後の反映
- 集中開始後の反映
- 完了後の反映
- TaskMate終了後の表示
- 端末再起動後の復元

## 23. 現行成果物と公開準備

Google Play公開準備に関する文書は以下に整理されています。

- `docs/google-play-release.md`
- `docs/privacy-policy.md`
- `docs/privacy-policy.html`
- `docs/release-note-template.md`

Play Console向けには、少なくとも以下を最終確認してください。

- 本番用アップロードキーで署名されたAAB
- debug keystoreを使っていないこと
- `versionCode`
- `versionName`
- `targetSdk`
- `minSdk`
- Adaptive Icon
- Screenshot一式
- Short description
- Full description
- Privacy Policy URL
- Data Safety
- Accessibility API declaration
- Usage Access の説明

直近のローカル修正 `b6b1638` 以降にPlay提出用AABを作る場合は、必ず再度 `bundleRelease` を実行し、最新コミットを反映したAABを生成してください。

## 24. 非対応 / v2初期版で入れないもの

現行v2では以下を実装しません。

- AI / LLM
- クラウド同期
- アカウント
- 広告
- 課金
- SNS機能
- ランキング
- フレンド
- ガチャ
- キャラクター育成
- 複雑な統計画面
- PCリアルタイム同期

## 25. 今後の主な課題

優先度が高い残作業は以下です。

- Accessibility API申告文の最終調整
- Usage Access説明文の最終調整
- Google Play用AABの本番署名確認
- Internal testing へのアップロード
- Android 13以外の端末での実機確認
- Android 14、15、16相当環境での権限挙動確認
- ウィジェットの複数サイズ表示確認
- 通知権限拒否時のUX確認
- 端末再起動後の集中状態、アンロック状態、ウィジェット状態の再確認

## 26. 開発時の注意

- `mobile/android/` は生成物を含みますが、現行ではネイティブ実装確認のためソース管理対象として扱っています。
- Androidネイティブの恒久的な変更は、可能な限り `mobile/plugins/android-native/java/` と `mobile/plugins/withTaskMateWidget.cjs` 側へ反映してください。
- `prebuild:android` 後に `mobile/android/` だけを直接直すと、次回prebuildで変更が失われる可能性があります。
- 既存端末のタスクを残したい場合は、同一署名で `adb install -r` してください。
- 署名不一致でアンインストールする場合は、SQLiteとAsyncStorageのローカルデータが消えます。
- AccessibilityService と Usage Access は、Google Play審査で最も説明責任が重い箇所です。新しい制限方式を追加する場合も、必要最小限の権限に留めてください。

