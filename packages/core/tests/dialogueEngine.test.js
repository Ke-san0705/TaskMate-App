const test = require('node:test');
const assert = require('node:assert/strict');
const { chooseDialogue, fillDialogue, normalizeDialogues } = require('../behavior/dialogueEngine');

test('セリフ変数を置換する', () => {
  assert.equal(fillDialogue('「{title}」まであと{minutes}分', {
    title: 'レポート',
    minutes: 30
  }), '「レポート」まであと30分');
});

test('直前と同じセリフを避ける', () => {
  const dialogues = { calm: ['A', 'B'] };
  assert.equal(chooseDialogue(dialogues, 'calm', 'A', () => 0), 'B');
});

test('壊れたdialoguesを安全に正規化する', () => {
  assert.deepEqual(normalizeDialogues({ calm: [' ok ', '', 10], bad: 'x' }), {
    calm: ['ok']
  });
});
