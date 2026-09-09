const test = require('node:test');
const assert = require('node:assert/strict');
const { chooseDialogue, fillDialogue, normalizeDialogues } = require('../characters/guideDialogue');

test('セリフ変数を置換する', () => {
  assert.equal(fillDialogue('「{title}」まであと{minutes}分', {
    title: 'レポート',
    minutes: 30
  }), '「レポート」まであと30分');
});

test('直前と同じセリフを避ける', () => {
  const dialogues = { ready: ['A', 'B'] };
  assert.equal(chooseDialogue(dialogues, 'ready', 'A', () => 0), 'B');
});

test('壊れたdialoguesを安全に正規化する', () => {
  assert.deepEqual(normalizeDialogues({ ready: [' ok ', '', 10], bad: 'x' }).ready, ['ok']);
  assert.deepEqual(normalizeDialogues({ focusing: [' focus '] }).focusActive, [
    'focus',
    '今は「{taskTitle}」に取り組む時間だよ。'
  ]);
});
