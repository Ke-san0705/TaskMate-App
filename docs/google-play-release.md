# TaskMate v2 Google Play Release Preparation

Last updated: 2026-08-29

## Build Identity

- Application ID: `com.taskmate.mobile`
- App label: `TaskMate Mobile`
- Version code: `20`
- Version name: `2.0.0`
- minSdk: `24`
- targetSdk: `36`
- compileSdk: `36`
- buildTools: `36.0.0`
- Android Gradle Plugin: `8.12.0`
- Gradle: `9.3.1`
- Kotlin: `2.1.20`
- Java/JDK: JetBrains JDK `21.0.10`
- Expo SDK dependency: `~56.0.12`
- Expo CLI observed: `56.1.16`
- React Native: `0.85.3`
- Release artifacts:
  - APK: `mobile/android/app/build/outputs/apk/release/app-release.apk`
  - AAB: `mobile/android/app/build/outputs/bundle/release/app-release.aab`

## Release Signing

Release builds use `android/taskmate-upload-key.properties` when present. This local file and the upload keystore must not be committed.

- Upload certificate DN: `CN=TaskMate, OU=TaskMate, O=TaskMate, L=Tokyo, ST=Tokyo, C=JP`
- Upload certificate SHA-256: `e4f982ad2d580f44f63fc3390b00057fa1093220a9db3ed64ff73b9ca44f898b`
- `app-release.apk` verified with `apksigner verify --print-certs`.
- Final APK has no `android:debuggable` manifest attribute.
- Release build uses R8/minify and resource shrinking via:
  - `android.enableMinifyInReleaseBuilds=true`
  - `android.enableShrinkResourcesInReleaseBuilds=true`

## Manifest Permissions

Observed in the final release APK:

- `android.permission.INTERNET`
  - Expo/React Native runtime and package dependencies may use network APIs. TaskMate v2 core features are local-first and do not send task/focus data to an external server.
- `android.permission.POST_NOTIFICATIONS`
  - Deadline and focus-return notifications.
- `android.permission.READ_EXTERNAL_STORAGE` with `maxSdkVersion=32`
  - Legacy Android support for selecting a custom character image. Android 13+ should use the system picker flow.
- `android.permission.RECEIVE_BOOT_COMPLETED`
  - Refresh widget/focus state after device restart.
- `android.permission.VIBRATE`
  - Notification feedback.
- `android.permission.ACCESS_NETWORK_STATE`
  - Added by Expo/Android dependencies. Not used to upload TaskMate local data.
- `android.permission.WAKE_LOCK`
  - Added by notification/runtime dependencies.
- `com.google.android.c2dm.permission.RECEIVE`
  - Added by notification dependencies. If push notifications remain unused, review removal before production.
- `com.taskmate.mobile.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`
  - AndroidX/React Native internal receiver protection.
- `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE`
  - Added by bundled Google Play/analytics dependency chain. Review before production if no install attribution is used.
- Launcher badge permissions from Expo notification dependencies:
  - `com.sec.android.provider.badge.permission.READ`
  - `com.sec.android.provider.badge.permission.WRITE`
  - `com.htc.launcher.permission.READ_SETTINGS`
  - `com.htc.launcher.permission.UPDATE_SHORTCUT`
  - `com.sonyericsson.home.permission.BROADCAST_BADGE`
  - `com.sonymobile.home.permission.PROVIDER_INSERT_BADGE`
  - `com.anddoes.launcher.permission.UPDATE_COUNT`
  - `com.majeur.launcher.permission.UPDATE_BADGE`
  - `com.huawei.android.launcher.permission.CHANGE_BADGE`
  - `com.huawei.android.launcher.permission.READ_SETTINGS`
  - `com.huawei.android.launcher.permission.WRITE_SETTINGS`
  - `android.permission.READ_APP_BADGE`
  - `com.oppo.launcher.permission.READ_SETTINGS`
  - `com.oppo.launcher.permission.WRITE_SETTINGS`
  - `me.everything.badger.permission.BADGE_COUNT_READ`
  - `me.everything.badger.permission.BADGE_COUNT_WRITE`

Explicitly removed from the final merged manifest:

- `android.permission.PACKAGE_USAGE_STATS`
- `android.permission.SYSTEM_ALERT_WINDOW`
- `android.permission.CAMERA`
- `android.permission.RECORD_AUDIO`
- `android.permission.WRITE_EXTERNAL_STORAGE`

## AccessibilityService

Component:

- Service: `com.taskmate.mobile/.TaskMateAccessibilityService`
- User-visible label: `TaskMate アプリ制限`
- User-visible description: `集中中にユーザーが選んだアプリの起動だけを検知し、TaskMateへ戻る案内を表示します。画面内容、入力内容、メッセージ内容は取得しません。`
- Accessibility config:
  - Event type: `typeWindowStateChanged`
  - `canRetrieveWindowContent=false`
  - `canPerformGestures=false`
  - `isAccessibilityTool=false`

Behavior:

- Only active while a TaskMate focus session is active.
- Only reacts to packages the user selected as blocked apps.
- Reads the foreground package name from accessibility window-state events.
- Does not read screen text, input text, messages, browser content, photos, calls, or location.
- When a blocked package is opened, it runs a deterministic rule: perform Android back action, open TaskMate with `taskmate://focus-blocked`, and show a focus-return notification.
- If Accessibility is disabled during an active focus session, TaskMate keeps the session state and shows an in-app warning with a button to open Android Accessibility settings.

Prominent disclosure shown before the user can enable app restriction:

> TaskMateは集中モード中だけ、あなたが選んだ制限対象アプリが前面に出たことと、端末に表示できるアプリ一覧を確認します。
>
> 制限対象アプリを開いたときは、戻る操作とTaskMateへの案内を行い、集中画面へ戻りやすくします。
>
> TaskMateは画面内容、キー入力、メッセージ内容、Web閲覧内容、写真、通話履歴、位置情報を読み取りません。
>
> タスク、集中状態、制限アプリの情報は端末内に保存し、外部サーバーへ送信しません。同意しない場合もタスク管理と通常の集中画面は利用できます。

Consent checkbox:

> 内容を理解して、集中モードのアプリ制限に同意します

Policy notes:

- Google Play requires Accessibility API usage to be for a narrow and clearly understood purpose, and prohibits autonomous planning/decision-making. TaskMate's behavior is static and user-defined: selected package opens -> return to TaskMate.
- Google Play prominent disclosure and User Data policies require in-app disclosure and an affirmative user action before unexpected sensitive/device data access.
- Accessibility API usage remains the highest Play review risk. Prepare a clear Accessibility declaration video showing the disclosure, user consent, enabling the service, selecting apps, and the blocked-app return flow.

Official references:

- [Use of the AccessibilityService API](https://support.google.com/googleplay/android-developer/answer/10964491?hl=en)
- [Best practices for prominent disclosure and consent](https://support.google.com/googleplay/android-developer/answer/11150561?hl=en)
- [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)
- [Data safety form guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
- [Target API level requirement](https://developer.android.com/google/play/requirements/target-sdk)
- [Android 16 behavior changes](https://developer.android.com/about/versions/16/behavior-changes-16)

## Data Safety Draft

Recommended declaration for the current v2 implementation:

- Data collected: No data collected or shared with external companies/servers by TaskMate app code.
- Data shared: No.
- Data encrypted in transit: Not applicable for TaskMate local data because it is not transmitted by TaskMate app code.
- Users can request deletion: Local deletion is available in Settings via all-local-data deletion.

Local-only data stored on device:

- Tasks: title, description, due date/time, completion status, timestamps.
- Settings: notification preferences, quiet hours, motion reduction, selected character, custom character reference.
- Focus sessions: active task id/title, start/end timestamps, selected blocked package names and app labels, completion/interruption status.
- Widget state is derived from the same local database/settings.

Sensitive/non-collected data to state clearly:

- No key input collection.
- No SNS or message content collection.
- No browser history or web page content collection.
- No photos are uploaded. Custom character images are selected locally.
- No call history.
- No contacts.
- No location.
- Foreground app package is observed locally only during focus mode, only to detect user-selected blocked apps, and is not sent externally.

Third-party SDK caveat:

- Expo/React Native dependencies may declare network, notification, install referrer, or badge-related permissions. Before production, verify no analytics/crash/push SDK is initialized in a way that transmits data. If any telemetry is enabled later, update Data Safety and the privacy policy.

## Privacy Policy Draft

TaskMateは、ユーザーが今やるタスクを決め、集中中に自分で選んだアプリから離れることを支援するローカルファーストのタスク管理アプリです。

TaskMateが端末内に保存する情報は、タスク、締切、完了状態、設定、選択したキャラクター、集中セッション、制限対象として選んだアプリ名とパッケージ名です。これらの情報は端末内に保存され、TaskMateの外部サーバーへ送信されません。

集中モードのアプリ制限を利用する場合、TaskMateはAndroidのユーザー補助機能を使い、集中中にユーザーが選んだ制限対象アプリが前面に表示されたことを検知します。TaskMateは画面内容、キー入力、メッセージ内容、Web閲覧内容、写真、通話履歴、連絡先、位置情報を読み取りません。制限対象アプリを検知した場合、TaskMateへ戻る案内を表示します。

通知機能は、締切や集中状態をユーザーに知らせるために使用されます。端末再起動後には、必要に応じてウィジェットと集中状態を復元します。

ユーザーは設定画面からローカルデータを削除できます。削除すると、端末内に保存されたTaskMateのタスク、設定、集中履歴などが削除されます。

TaskMateは広告、課金、アカウント、クラウド同期、AI機能をv2初期版では使用しません。

## Store Listing Draft

Short description:

> 今やるタスクを決め、集中中は選んだアプリから離れる手助けをするタスク管理アプリ。

Full description:

> TaskMateは、「何をやるか」を決めるだけでなく、それを終えるまでスマホの誘惑から守ってくれるタスク管理アプリです。
>
> 今日のタスクを追加し、今やるタスクを1つ選んで集中を開始できます。集中モードでは、Instagram、X、YouTube、Chromeなど、自分で選んだアプリを開いたときにTaskMateへ戻る案内を表示します。
>
> ホーム画面ウィジェットでは、アプリを開かなくても今やることと今日の進捗を確認できます。キャラクターはタスク管理の案内役として、集中開始や完了をやさしく支えます。
>
> TaskMateはローカルファーストです。タスクや集中状態は端末内に保存され、外部サーバーへ送信されません。AI、広告、アカウント、クラウド同期はv2初期版では使用しません。

Category:

- Productivity

Tags to consider:

- Tasks
- Focus
- Productivity
- Study

## Play Console Declarations

Prepare these before Internal testing review:

- App access: no login required.
- Ads: no ads.
- Content rating questionnaire.
- Target audience and content: likely general users / students; avoid claiming child-directed unless intentionally designed and policy-reviewed.
- Data Safety form.
- Privacy policy URL.
- Accessibility API declaration:
  - Purpose: focus support by detecting only user-selected blocked apps while a focus session is active.
  - User benefit: helps users return to the current task instead of distracting apps.
  - Data accessed: foreground app package name/app label only during focus mode.
  - Data not accessed: screen content, typed text, messages, browser content, photos, calls, contacts, location.
  - Sharing: none.
  - Prominent disclosure: shown in Focus setup and Settings before enabling restrictions.
  - Demo video: required/recommended for review evidence.
- Sensitive permissions declaration review:
  - No Usage Stats permission.
  - No overlay permission.
  - No VPN permission.
  - No broad file access permission.
- App signing:
  - Enroll in Play App Signing.
  - Upload the generated AAB signed with the TaskMate upload key.
  - Keep upload keystore and passwords outside git.

## Store Assets

Required or strongly recommended:

- App icon: 512 x 512 PNG.
- Feature graphic: 1024 x 500 PNG/JPG.
- Phone screenshots: 2 to 8 images.
- Optional tablet screenshots if tablet/large screen listing is desired.
- Privacy policy public URL.
- Accessibility declaration/demo video URL if Play Console requests it.

Recommended screenshot set:

- Home with "今やる" task.
- Focus setup with blocked app selection.
- Accessibility prominent disclosure.
- Focus active screen.
- Blocked-app warning screen.
- Widget showing today's progress.
- Settings screen.

## Internal Testing Flow

1. Upload `mobile/android/app/build/outputs/bundle/release/app-release.aab` to Play Console Internal testing.
2. Add tester email list.
3. Complete required App content sections.
4. Add release notes:
   - `TaskMate v2: focus session, user-selected app restriction, task-first home, Android widget, and Play policy disclosure updates.`
5. Submit Internal testing release for review.
6. Install through the Play internal testing link on the real device.
7. Re-test:
   - Task create/edit/delete/complete/undo.
   - Focus start/end.
   - Accessibility disclosure and enable flow.
   - Blocked app return flow.
   - Notification permission denial/approval.
   - Widget add/update/reboot behavior.
8. Move to Closed testing only after Internal testing is stable.
9. Move to Production only after policy declarations and privacy policy are final.

## Known Play Review Risks

- Accessibility API is policy-sensitive even with limited scope. The current implementation is narrower than Usage Access/overlay/VPN alternatives, but review may still ask for stronger justification.
- Android system Accessibility enable screen may show a generic "full control" warning even though TaskMate sets `canRetrieveWindowContent=false`. The in-app disclosure must explain the app's actual limited behavior before sending users to settings.
- Vendor badge, FCM receive, install referrer, and network-related permissions come from Expo/notification dependencies. If unused in production, consider removing or blocking them to reduce review questions.
- Target API 36 changes include large-screen orientation/resizability behavior. TaskMate is portrait-first but should be spot-checked on tablets/foldables before broad production rollout.
