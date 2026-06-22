# TaskMate v1.1.5

## 概要

TaskMateのWindows向けInstaller版です。デスクトップ上のキャラクターと一緒にタスク管理を行い、期限や進捗に応じた通知、吹き出し、長期プロジェクト管理を利用できます。

## インストール方法

1. GitHub Releasesから`TaskMate-Setup-1.1.5.exe`をダウンロードします。
2. セットアップexeを実行します。
3. 画面の指示に従ってインストールします。
4. デスクトップショートカットまたはスタートメニューからTaskMateを起動します。

## 主な内容

- Windows用NSIS Installerに対応
- デスクトップショートカットとスタートメニュー登録に対応
- タスク、設定、通知状態、生活状態、長期プロジェクトデータのローカル保存方式を確認
- パッケージ版ではユーザー更新データをElectronの`userData`配下へ保存
- READMEにInstaller利用方法、ローカル保存、SmartScreen警告について追記

## 注意

コード署名はまだ行っていないため、初回起動時にWindows Defender SmartScreenなどの警告が表示される場合があります。証明書なしで無理に署名設定を入れるとビルドや配布が不安定になるため、今回の段階では未設定です。

## 配布前チェック

- `npm.cmd install`
- `npm.cmd test`
- `npm.cmd run test:core`
- `npm.cmd run build`
- `npm.cmd run dist`
- `dist/TaskMate-Setup-1.1.5.exe`が生成されること
