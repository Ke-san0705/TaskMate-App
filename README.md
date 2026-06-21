# TaskMate

TaskMate ver1.1.0は、Windows 11向けのデスクトップ常駐型タスク管理アプリです。Electron、React、Viteで構成され、キャラクター、漫画風の吹き出し、ローカルJSON保存、Windows通知、システムトレイ、設定画面を備えています。

ver1.1.0では、TaskMateを「生活状態シミュレーター型タスク管理」として拡張しました。未完了タスク、締切までの時間、期限超過、タスク完了、再訪などが、キャラクターの状態、吹き出し、周辺表現、注目タスクへ反映されます。キャラクターはユーザーを責める存在ではなく、デスクトップ上でタスク状況を一緒に見ている存在です。

## Requirements

- Windows 11
- Node.js 22 or newer
- npm 10 or newer

## Install

```powershell
npm install
npm run dev
```

PowerShellで`npm.ps1`がブロックされる場合は、`.cmd`シムを使います。

```powershell
npm.cmd install
npm.cmd run dev
```

## Build And Run

```powershell
npm run build
npm run start
```

Windows向けインストーラーは次で作成します。

```powershell
npm run dist
```

## Tests

```powershell
npm test
node --check main.js
npm run test:core
npm run mobile:test
```

`npm test`はNode.js標準の`node:test`で、タスク感情モデル、継続関係、行動選択、キャラクター状態エンジンを検証します。

## Smartphone Version / Android MVP

`mobile/`にAndroid先行のExpo / React Native版TaskMateを追加しています。デスクトップ常駐ウィンドウを小さく移植するのではなく、スマホでは「アプリを開くとキャラクターが今の生活状態を一緒に見てくれる」体験に再設計しています。

デスクトップ版との主な違い:

- Electron、BrowserWindow、tray、クリック透過、Windows自動起動は使いません。
- タスクは端末内SQLiteへ保存します。
- settings、life-state、カスタムキャラクター情報はAsyncStorageへ保存します。
- 締切通知は`expo-notifications`のローカル通知で登録します。
- 他アプリ上の常時表示、ウィジェット、PC同期、Firebase/Supabase/API連携はMVPでは未実装です。
- AI、LLM、広告、課金、テレメトリーは使いません。

### Mobile Requirements

- Node.js 22 or newer
- npm 10 or newer
- Android Studio
- Android SDK
- Java/JDK with `JAVA_HOME`
- Android emulator or Android device with USB debugging

PowerShellで`npm.ps1`がブロックされる場合は`npm.cmd`を使ってください。

### Mobile Install And Run

```powershell
cd mobile
npm install
npx expo-doctor
npx expo start
```

Androidエミュレーターまたは実機で開発ビルドを動かす場合:

```powershell
cd mobile
npx expo prebuild --platform android
npx expo run:android
```

Gradle debug build:

```powershell
cd mobile
.\android\gradlew.bat assembleDebug
```

EAS Buildを使う場合は、Expoアカウント設定後に次のような流れでAndroidビルドを作成できます。

```powershell
cd mobile
npx eas build --platform android --profile preview
```

### Mobile Root Scripts

ルートからも実行できます。

```powershell
npm run mobile:start
npm run mobile:doctor
npm run mobile:test
npm run mobile:export:android
npm run mobile:prebuild:android
npm run mobile:android
```

### Mobile Project Structure

```text
packages/core/      desktop/mobileで共有する純粋JavaScriptロジック
mobile/             Expo React Nativeアプリ
mobile/src/repositories/
  database.js       SQLite初期化とmigration
  taskRepository.js タスクCRUD
  settingsRepository.js
  lifeStateRepository.js
  characterRepository.js
mobile/src/services/
  notificationService.js
  notificationReconciler.js
mobile/src/screens/ ホーム、タスク、キャラクター、設定
```

### Mobile Data

SQLite:

- `tasks`
- `notification_schedules`
- `schema_meta`

AsyncStorage:

- `taskmate:settings:v1`
- `taskmate:life-state:v1`
- `taskmate:characters:v1`
- `taskmate:selected-character:v1`

タスク形式はPC版と共通する基本フィールドに、`createdAt`、`updatedAt`、`completedAt`を加えています。日付は`YYYY-MM-DD`、時刻は`HH:mm`または空です。時刻なしタスクは「今日中」として扱います。

### Mobile Features

- タスク追加、編集、削除、完了、5秒以内の完了取り消し。
- 期限超過、今日、これから、完了済みの分類。
- `calm`、`warning`、`urgent`、`overdue`、`future`のタスク状態計算。
- 生活圧0〜100と`calm`、`attentive`、`restless`、`anxious`、`overloaded`への変換。
- 「今やる」タスクをlife-stateへ保存し、再起動後も復元。
- 完了時の`relieved`、当日全完了時の`celebrating`、再訪時の挨拶。
- PC版と同じ`Chara1`、`Chara2`を同梱。
- カスタムキャラクター作成、画像コピー、主要セリフ編集。
- 通知権限確認、事前通知、締切時刻通知、通知無効時の既存通知整理。
- 静かな時間帯、モーション軽減、関係記憶リセット、全ローカルデータ削除。

### Mobile Character Packs

同梱キャラクターは`mobile/assets/characters/`へ配置しています。カスタムキャラクター画像は、写真ライブラリの一時URIをそのまま参照せず、`expo-file-system`の`File`/`Directory` APIでアプリ管理領域へコピーします。

対応画像:

- `wait`
- `click`
- `alarm`

任意状態画像が不足する場合は、`wait`、`click`、`alarm`へフォールバックします。セリフカテゴリが不足する場合は`packages/core`のフォールバックセリフを使用します。

### Mobile Known Limits

- Android先行です。iOSでも動く構成ですが、iOS実機確認は未完了です。
- 他アプリ上のフローティングマスコットは実装していません。
- ホーム画面ウィジェット、ロック画面Live Activities、PCとのリアルタイム同期は未実装です。
- 日付/時刻入力はMVPではテキスト入力です。
- Android実機起動とGradle buildには、Android SDK、adb、JDK/JAVA_HOMEが必要です。

## ver1.1.0 Features

- タスクを`future`、`calm`、`warning`、`urgent`、`overdue`へ分類します。
- 生活圧を0から100で集約し、`calm`、`attentive`、`restless`、`anxious`、`overloaded`へ変換します。
- 通知中は`notifying`、完了時は`relieved`、今日の表示対象が全完了した日は`celebrating`を優先します。
- 「今やる」で1件のタスクをフォーカスし、再起動後も`life-state.json`から復元します。
- 再訪時は`firstMeeting`、`reconnectingShort`、`reconnectingLong`の自然な挨拶を1日1回だけ表示します。
- 自律移動は小さなnudgeだけで、手動ドラッグが始まると即停止します。
- 周辺表現はクリックを妨げない装飾レイヤーで、`prefers-reduced-motion`に対応します。

## Local Data

TaskMateはローカルファーストです。タスク、設定、通知状態、継続関係は外部へ送信されません。テレメトリー、キー入力、ブラウザ履歴、他アプリの内容は取得しません。

初回起動時に次を作成します。

- `data/tasks.json`
- `data/settings.json`
- `data/notification-state.json`
- `data/life-state.json`

パッケージ版では、書き込み可能なデータはElectronの`userData`配下へ保存されます。

## life-state.json

`life-state.json`には、起動日、再訪状態、完了数、関係段階、最近の行動、フォーカスタスクIDを保存します。壊れたJSONはconsoleへ詳細を出し、アプリは既定値で復旧します。設定画面の「ふるまい」タブから関係記憶だけをリセットできます。タスク、通知状態、表示設定は削除されません。

## Behavior Settings

設定画面の「ふるまい」タブで調整できます。

- ふるまい全体
- 周辺表現
- 自律移動
- 完了リアクション
- 継続関係の記憶
- ふるまいの強さ: `low`、`normal`、`high`
- 静かな時間帯
- 関係記憶リセット

ふるまい全体をオフにすると、自発行動と周辺表現を抑え、ver1.0.0に近い静かな表示へ戻せます。

## Character Packs

キャラクターは`Chara/`配下へ追加できます。

```text
Chara/MyCharacter/
  wait.png
  click.png
  alarm.png
  dialogues.json
```

ver1.1.0の任意画像として、次のPNGを置くこともできます。ない場合は`wait`、`click`、`alarm`へフォールバックします。

```text
calm.png
attentive.png
restless.png
anxious.png
overloaded.png
focusing.png
reconnecting.png
relieved.png
celebrating.png
notifying.png
clicked.png
```

`dialogues.json`では、従来カテゴリに加えて次を定義できます。

- `calm`
- `attentive`
- `restless`
- `anxious`
- `overloaded`
- `suggestOneTask`
- `showOneChoice`
- `askFocusTask`
- `focusing`
- `relieved`
- `celebrating`
- `firstMeeting`
- `reconnectingShort`
- `reconnectingLong`

メッセージでは`{title}`、`{minutes}`、`{count}`、`{time}`、`{genre}`などのプレースホルダーを使えます。

## Project Structure

- `main.js`, `main/`: Electron main process、tray、IPC、task watching、notifications、window management、behavior controller。
- `behavior/`: タスク感情、生活圧、継続関係、行動選択、キャラクター状態の純粋ロジック。
- `renderer/`: React UI、hooks、components、utilities、styles。
- `tests/`: `node:test`ベースの単体テスト。
- `Chara/`: キャラクターパック。
- `assets/`: tray iconなどのアセット。
- `data/`: ローカルJSONデータとexample files。

## Migration From ver1.0.0

既存の`tasks.json`は移行なしで読み込めます。既存の`settings.json`にver1.1.0の項目がない場合は、既定値で補完します。`life-state.json`がない場合は自動生成されます。

## Notes

- AI、LLM、クラウドAPI、音声生成は使用しません。
- Rendererから`fs`や`BrowserWindow`を直接操作しません。
- `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`を維持します。
- `node_modules/`、`dist/`、インストーラー出力、個人用JSONはGit管理から外しています。
