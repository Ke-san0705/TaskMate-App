const FALLBACK_DIALOGUES = Object.freeze({
  click: ['見に来てくれてありがとう。', '今日も一つずつ進めよう。'],
  noTasks: ['今日の予定は空いているみたい。少し休んでも大丈夫。'],
  calm: ['今は落ち着いて進められそう。'],
  attentive: ['予定が少し見えているよ。まず一つだけ見よう。'],
  restless: ['少し予定が詰まってきたね。小さく分けてみよう。'],
  anxious: ['全部を一度に見なくて大丈夫。今できる一つを選ぼう。'],
  overloaded: ['情報を減らそう。今は一つだけ選べば大丈夫。'],
  smallTalk: ['ここにいるよ。必要なときに一緒に見よう。'],
  suggestOneTask: ['まず「{title}」から見てみよう。'],
  showNextTask: ['次に目に入りやすいのは「{title}」だよ。'],
  warningSoft: ['「{title}」が近づいているよ。できる形に分けてみよう。'],
  showOneChoice: ['今は「{title}」だけ選ぶのがよさそう。'],
  askFocusTask: ['今やる予定を一つ選んでおく？'],
  offerTaskList: ['一覧を開いて、軽いものから選んでも大丈夫。'],
  suggestSmallStart: ['最初の一歩だけ決めよう。全部は見なくていいよ。'],
  focusing: ['「{title}」を今やる予定として置いておくね。'],
  relieved: ['「{title}」が片付いたね。少し空気が軽くなった。'],
  celebrating: ['今日の予定が全部片付いたね。ゆっくりして大丈夫。'],
  firstMeeting: ['はじめまして。今日の予定を一緒に静かに見ていこう。'],
  reconnectingShort: ['また来てくれてうれしい。今日からで大丈夫。'],
  reconnectingLong: ['戻ってきたね。空いていた時間は気にしなくて大丈夫。'],
  oneTask: ['今日の予定は「{title}」だよ。'],
  multipleTasks: ['今日は{count}件あるよ。順番に一つずつ見よう。'],
  deadlineNear: ['「{title}」まで、あと{minutes}分だよ。'],
  deadlineNow: ['「{title}」の時間になったよ。'],
  overdue: ['期限を過ぎた予定が{count}件あるよ。今からできる形で見よう。'],
  loadError: ['データをうまく読めなかったみたい。もう一度開き直してみてね。']
});

function normalizeDialogues(dialogues) {
  const result = {};
  if (!dialogues || typeof dialogues !== 'object') {
    return result;
  }
  for (const [category, messages] of Object.entries(dialogues)) {
    if (!Array.isArray(messages)) {
      continue;
    }
    const normalized = messages
      .filter((message) => typeof message === 'string' && message.trim())
      .map((message) => message.trim());
    if (normalized.length > 0) {
      result[category] = normalized;
    }
  }
  return result;
}

function chooseDialogue(dialogues, category, previous = '', random = Math.random) {
  const normalized = normalizeDialogues(dialogues);
  const custom = Array.isArray(normalized[category]) ? normalized[category] : [];
  const fallback = FALLBACK_DIALOGUES[category] || ['こんにちは。今日も一つずつ見よう。'];
  const candidates = custom.length > 0 ? custom : fallback;
  const withoutPrevious =
    candidates.length > 1 ? candidates.filter((message) => message !== previous) : candidates;
  const index = Math.floor(random() * withoutPrevious.length);
  return withoutPrevious[index] || withoutPrevious[0] || fallback[0];
}

function fillDialogue(template, variables = {}) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => {
    const value = variables[key];
    return value === undefined || value === null || value === '' ? match : String(value);
  });
}

module.exports = {
  FALLBACK_DIALOGUES,
  chooseDialogue,
  fillDialogue,
  normalizeDialogues
};
