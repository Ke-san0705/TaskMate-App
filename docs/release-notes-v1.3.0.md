# TaskMate v1.3.0

## Google Calendar

- Googleカレンダー連携を追加しました。
- TaskMateアカウントのGoogleログインから、カレンダー読み取り権限を許可できるようにしました。
- 公式デスクトップビルドでは、公開Supabase設定を同梱できるようにし、一般ユーザーが`.env`を編集しなくてもGoogleログインを使える設計にしました。
- 設定画面から接続、解除、同期、同期対象カレンダーの選択ができます。
- 今日のGoogleカレンダー予定をメイン画面に控えめに表示します。
- Google予定から通常のTaskMateタスクを作成できます。
- Google予定は通常タスクとは別のローカルキャッシュに保存し、既存タスクを自動上書きしません。
- 非公開予定のタイトルは既定で隠します。
- スマホ版にもGoogleカレンダー同期、同期カレンダー選択、今日の予定表示、予定からTaskMateタスク作成を追加しました。
- スマホ版のアプリバージョン、Android versionName/versionCode、Expo設定を1.3.0へ更新しました。

## Setup

Googleカレンダー連携を使う場合は、`docs/google-calendar-setup.md`と`docs/supabase-account-setup.md`に従ってGoogle OAuth設定を行ってください。
