# スマホ版GitHubログイン

利用者はPCでGitHub認証を利用しており、スマホも同じアカウントで外部タスク連携を使いたい。
2026-11-10に「スマホにGitHubログインを追加し、細部は任せて実装・更新まで進める」を選択した。
追加の設計質問は省略し、既存のReact Native / Supabase構成で実装する。

## Approaches

- 採用: スマホにGitHub OAuthを追加する。既存アカウントと認証プロバイダーを利用できる。ネイティブ再ビルドが必要。
- 代案: 同じアカウントにメール認証用パスワードを設定する。アプリのOAuth対応は不要だが、新しい資格情報の設定・管理が必要。

## 動作と制約

- 設定 → 外部タスク連携に「GitHubでログイン」を追加。従来のメール認証も残す。
- Expo WebBrowserの標準ブラウザー認証セッションを開き、SupabaseのPKCEでコードを交換する。
- 戻り先は既存schemeの `taskmate://auth/callback` に固定。Supabaseの許可URLにはこの完全な値のみ追加する。
- 認証開始URLは設定済みSupabaseのHTTPS認証URLのみ許可。コールバックはscheme・host・pathが完全一致し、単一コードの場合だけ交換する。
- キャンセル、外部URL、不正なコールバック、期限切れ、ログイン途中のリセットを扱い、認証コードやトークンをエラーに表示しない。
- 既存のSecureStore、mutation barrier、本人認証と自動取得を利用する。ログアウト・リセット後に遅い応答で自動取得を再開しない。
- 端末の既存タスク、PC側の認証、同期テーブルは変更しない。
- 現在のAndroidアプリID・署名で更新し、アンインストールやデータ消去は行わない。
- OSが認証途中にアプリを終了した場合はログインをやり直す。終了後に届いた任意のdeep linkからセッションは作らない。

## 検証

標準ブラウザーとSupabaseの境界を置き換える単体テストで正常・キャンセル・不正URL・失敗・リセットを確認。
既存テスト、Expo Android export、署名済みAPKビルドを実施し、実機で利用者がGitHub認証を完了する。

参照: [Supabase mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)、
[PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow)、[Expo WebBrowser](https://docs.expo.dev/versions/v56.0.0/sdk/webbrowser/)
