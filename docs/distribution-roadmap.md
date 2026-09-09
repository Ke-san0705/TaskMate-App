# TaskMate Distribution Roadmap

## 第1段階: Installer生成と手動配布

- `npm run dist`でWindows向けNSIS Installerを生成する。
- 生成された`TaskMate-Installer-x.x.x.exe`はリポジトリへコミットせず、GitHub Releasesで手動配布する。
- GitHub Actionsではまずartifact生成までを自動化し、公開Releaseの作成は手動確認後に行う。

## 第2段階: 利用者向け説明の整備

- READMEと配布ページに、インストール方法、保存データ、外部通信の有無、SmartScreen警告の理由を明記する。
- 不具合報告の導線をGitHub Issuesやフォームで用意する。
- Windows 11を主確認対象とし、Windows 10は確認状況に応じて表記を更新する。

## 第3段階: コード署名と自動更新

- TODO: 利用者が増え、配布経路が安定してからコード署名証明書を導入する。
- TODO: 署名後にSmartScreen警告の軽減状況を確認する。
- TODO: GitHub Releases運用が安定してから`electron-updater`などによる自動更新を検討する。
- 今回は証明書がないため、署名設定を入れない。未署名のまま強引に設定するとビルド失敗や利用者環境での警告増加につながる可能性がある。

## 第4段階: 公式配布ページ

- 公式サイトまたは簡易配布ページを用意する。
- スクリーンショット、機能説明、プライバシー説明、ダウンロード導線を整理する。
- 必要に応じてMicrosoft Storeやwinget配布を検討する。
