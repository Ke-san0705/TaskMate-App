const ACCESSIBILITY_DISCLOSURE = Object.freeze({
  title: 'ユーザー補助を使う理由',
  consentLabel: '内容を理解して、TaskMateのアプリ制限に同意します',
  paragraphs: Object.freeze([
    'TaskMateは集中モードまたはアンロックモード中だけ、あなたが選んだ制限対象アプリが前面に出たことと、端末に表示できるアプリ一覧を確認します。',
    '制限対象アプリを開いたときは、あなたが設定したルールに従ってTaskMateの案内画面を表示します。',
    'TaskMateは画面内容、キー入力、メッセージ内容、Web閲覧内容、写真、通話履歴、位置情報を読み取りません。',
    'タスク、集中状態、アンロック設定、制限アプリの情報は端末内に保存し、外部サーバーへ送信しません。同意しない場合もタスク管理と通常の集中画面は利用できます。'
  ])
});

function hasAcceptedAccessibilityDisclosure(settings) {
  return Boolean(settings?.focusAccessibilityDisclosureAcceptedAt);
}

module.exports = {
  ACCESSIBILITY_DISCLOSURE,
  hasAcceptedAccessibilityDisclosure
};
