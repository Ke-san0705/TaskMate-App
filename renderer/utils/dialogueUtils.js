const FALLBACK_DIALOGUES = {
  click: ['どうしたの？', '今日も一緒に進めよう！', 'タスクを確認してみる？'],
  noTasks: ['今日のタスクはないよ！', '今日はゆっくりできそうだね。'],
  oneTask: ['今日のタスクは「{title}」だよ！'],
  multipleTasks: ['今日は{count}件のタスクがあるよ。', '順番に片付けていこう！'],
  deadlineNear: ['「{title}」まで、あと{minutes}分だよ！'],
  deadlineNow: ['「{title}」の時間になったよ！'],
  overdue: ['期限を過ぎているタスクが{count}件あるよ。'],
  loadError: ['タスクをうまく読み込めなかったみたい。JSONを確認してね。']
};

export function chooseDialogue(dialogues, category, previous = '') {
  const custom = Array.isArray(dialogues?.[category])
    ? dialogues[category].filter(Boolean)
    : [];
  const candidates = custom.length > 0 ? custom : FALLBACK_DIALOGUES[category] || ['こんにちは！'];
  const withoutPrevious =
    candidates.length > 1 ? candidates.filter((message) => message !== previous) : candidates;
  return withoutPrevious[Math.floor(Math.random() * withoutPrevious.length)];
}

export function fillDialogue(template, variables = {}) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => {
    const value = variables[key];
    return value === undefined || value === null ? match : String(value);
  });
}
