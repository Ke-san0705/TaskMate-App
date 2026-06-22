# TaskMate v1.2.0

## Highlights

- Supabase Authを使ったメール/パスワードのアカウント管理を追加しました。
- デスクトップ設定画面にアカウントタブを追加しました。
- カスタムキャラクター画像と`dialogues.json`をSupabase Storageへ保存し、別端末から取り込める同期基盤を追加しました。
- モバイル版の設定画面にもアカウント管理とカスタムキャラ同期UIを追加しました。
- 退会/クラウドデータ削除用のSupabase Edge Function雛形を追加しました。

## Setup Notes

Supabaseを使う場合は、`docs/supabase-account-setup.md`に従ってSQL、環境変数、Edge Functionを設定してください。

## Validation

- `npm.cmd test`
- `npm.cmd run test:core`
- `npm.cmd run mobile:test`
- `npm.cmd run build`
- `npm.cmd --prefix mobile run export:android`
