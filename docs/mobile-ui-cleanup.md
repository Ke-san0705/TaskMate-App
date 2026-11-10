# TaskMate Mobile UI改善

更新日: 2026-09-29

## 変更点

既存の淡いグリーンのテーマを使用し、タスク管理・集中・アンロック設定の保存形式は維持しています。

| ファイル | 変更内容 |
| --- | --- |
| `mobile/src/screens/HomeScreen.jsx` | 見出しを「ホーム」に変更。キャラクターの状態ラベルを非表示にし、見出しと案内の幅を調整。 |
| `mobile/src/screens/CharactersScreen.jsx` | 属性チップ、重複する案内役表示、種類ラベルを削除。選択状態は枠線・背景・選択中ボタンで表示。 |
| `mobile/src/components/CharacterView.jsx` | 状態ラベルの表示切替を追加。キャラクター名の表示幅を画像幅に合わせ、中央に整列。 |
| `mobile/src/constants/bundledCharacters.js` | 既定キャラクターの説明から「PC版」を削除。 |
| `mobile/src/components/UnlockModeSettingsCard.jsx` | ON/OFF・今日の進捗・選択アプリの概要を上部に集約。条件、アプリ選択、権限、注意事項を折りたたみ化。条件/制限のセグメント切替を導入。必要時間の保存ボタンと折りたたみ時の保存を追加。 |
| `mobile/src/components/AppSelectionList.jsx` | package nameの表示を削除。アンロック設定では一覧を最大320dpの内部スクロールに制限。 |
| `mobile/src/components/AccordionSection.jsx` | 開閉状態を読み上げに伝える、共通のアコーディオンを追加。 |
| `mobile/src/components/SegmentedSwitcher.jsx` | 選択状態が明確な共通のセグメント切替を追加。 |
| `mobile/src/screens/SettingsScreen.jsx` | 集中モードの権限説明を開閉可能に変更。未同意時は展開し、説明と明示的な同意を維持。キーボード表示中のボタン操作を改善。 |
| `docs/mobile-current-spec.md` | 現行UIと必要時間の保存操作を追記。 |

## 確認方法

1. ホームで見出し「ホーム」とキャラクター名を確認する。「案内中」は表示されない。
2. キャラクター画面で属性チップと「PC版」がないことを確認し、別のキャラクターを選択する。
3. 設定のアンロックモードで、ON/OFF、今日の進捗、条件アプリと制限アプリの件数、必要時間の概要を確認する。
4. 「条件設定」を開き、必要時間を変更して折りたたむ。保存後の数値が概要に表示されることを確認する。「保存」ボタンでも保存できる。
5. 「アプリを選択」を開き、条件アプリ/制限アプリを切り替える。条件アプリの検索欄は「学習アプリなど」で、一覧にはアプリ名だけが表示される。
6. 条件アプリに選択したアプリが、制限アプリ側では選択できないことを確認する。
7. アプリ一覧を内部スクロールし、全体の設定概要や切替操作が長い一覧に埋もれないことを確認する。
8. アプリを再起動し、必要時間とアプリ選択が保持されることを確認する。

## 実機確認

- 端末: SH-RM19s、Android 13 / API 33。
- 既存10件のタスクを保持したまま、同じアプリIDと署名で更新インストール。
- ホームの見出し変更、案内中の非表示、キャラクター属性の削除、説明文、Chara1/Chara2の切替を確認。
- アプリ名のみの一覧、条件/制限の切替、Chromeの選択、条件と制限の重複禁止を確認。
- 必要時間を30分から31分へ変更して折りたたみ、再起動後も31分が復元されることを確認。その後30分へ戻す操作を確認。
- 制限アプリにChromeを追加し、再起動後も選択が保持されることを確認。
- アプリ一覧だけがスクロールし、外側の設定見出しが動かないことを確認。
- テスト後は必要時間30分、条件アプリ1件、制限アプリ8件、アンロックOFF、Chara1へ復元。Androidの強制停止で無効になったアプリ制限サービスも、Android設定画面からテスト前の有効状態に戻しています。
- 実機アプリのlogcatでReact Nativeエラー、SQLite例外、クラッシュがないことを確認。

実機テストで、必要時間を入力してすぐ折りたたむと保存されないケースを検出しました。折りたたみ時の明示的な保存と保存ボタンを追加し、保存と再起動復元まで再確認しています。

## ビルドと成果物

- `npm --prefix mobile run test`: 20件成功。
- `npm run test:core`: 17件成功。
- Android向けExpo export: 成功。
- Android release APKビルド: 成功。
- UI確認用APK: `mobile/artifacts/ui-cleanup-20260929/taskmate-ui-local.apk`。
- 実機スクリーンショットとUIダンプ: `mobile/artifacts/ui-cleanup-20260929/`。

APK SHA-256:

```text
640EE6E01F9857D0AB296017EF53FBB5E5E9DDB04E3C3D81826C75F01633C821
```

主なスクリーンショット:

- `home-final.png`: ホーム。
- `characters-phone.png`: キャラクター画面。
- `unlock-aligned-phone.png`: 折りたたみ状態のアンロック概要。
- `apps-final-phone.png`: 条件/制限の切替とアプリ名のみの一覧。

実機用APKは、既存端末のデータを引き継ぐため `com.taskmate.mobile` と既存のdebug署名を使用するローカル確認版です。通常のGoogle Play向け設定である `com.kesan0705.taskmate` と本番用署名設定は変更していません。端末用の一時的なビルド指定は成果物ディレクトリの `local-device.gradle` にあります。

新しい権限やライブラリは追加していません。
