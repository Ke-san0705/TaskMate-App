const FALLBACK_DIALOGUES = {
  click: ['どうしたの？', '今日も一緒に進めよう。', '今ある予定を一つ見てみる？'],
  noTasks: ['長期タスクを整理しよう。', 'Todoまで小さく分けると進めやすいよ。'],
  calm: ['空気は落ち着いているよ。', '今は静かに進められそう。'],
  attentive: ['少し予定が見えているよ。まず一つだけ見よう。'],
  restless: ['少し予定が詰まっているみたい。小さく分けてみよう。'],
  anxious: ['全部じゃなくていいよ。今できることを一つ見よう。'],
  overloaded: ['情報を減らして、一つだけ選べば大丈夫。'],
  smallTalk: ['ここにいるよ。必要なときに一緒に見よう。'],
  suggestOneTask: ['まず「{title}」を見てみる？'],
  showNextTask: ['今は「{title}」が目に入りやすいよ。'],
  warningSoft: ['「{title}」が近づいているよ。できる形に分けてみる？'],
  showOneChoice: ['今は「{title}」だけ選ぶのがよさそう。'],
  askFocusTask: ['今やる予定を一つ選んでおく？'],
  offerTaskList: ['一覧を開いて、軽いものから選んでも大丈夫。'],
  suggestSmallStart: ['最初の一歩だけ決めよう。'],
  focusing: ['「{title}」を今やる予定として置いておくね。'],
  relieved: ['「{title}」が片付いたね。少し空気が軽くなった。'],
  celebrating: ['今日の予定が全部片付いたね。ゆっくりして大丈夫。'],
  firstMeeting: ['はじめまして。今日の予定を一緒に静かに見ていこう。'],
  reconnectingShort: ['久しぶり。また今日から始めれば大丈夫。'],
  reconnectingLong: ['戻ってきたね。空いていた分は気にしなくて大丈夫。'],
  oneTask: ['長期タスク「{title}」を見てみよう。'],
  multipleTasks: ['長期タスクを上から一つずつ見ていこう。', 'まずジャンルを選んで、Todoまで分けよう。'],
  deadlineNear: ['「{title}」まで、あと{minutes}分だよ。'],
  deadlineNow: ['「{title}」の時間になったよ。'],
  overdue: ['期限を過ぎたTodoがあります。今からできる形に分けてみる？'],
  loadError: ['長期タスクのデータをうまく読み込めなかったみたい。JSONを確認してね。'],
  project_created: ['長期タスクを作ったよ。大きな目標も、今日の一歩から始めよう。'],
  project_updated: ['計画を更新したよ。今の状況に合わせて進めよう。'],
  project_deleted: ['長期タスクを整理したよ。残すものと手放すものを分けられたね。'],
  project_task_created: ['Todoを一つ切り出したよ。小さく見える形にしておくのは大事だね。'],
  project_task_updated: ['Todoを更新したよ。見通しが少しはっきりしたね。'],
  project_task_completed: ['「{title}」が進んだね。長い道でも一歩は一歩だよ。'],
  project_warning: ['期限が近い長期タスクがあるよ。今日できる一手を選ぼう。'],
  project_overdue: ['期限を過ぎた長期タスクがあります。まず状況を小さく整理しよう。'],
  milestone_completed: ['段階を達成したね。ここまで積み上げた分はちゃんと残っているよ。'],
  project_completed: ['長期タスク完了。大きな流れを最後まで運べたね。'],
  daily_plan_created: ['今日の進め方を作ったよ。全部ではなく、まず一つから始めよう。'],
  longTermIdle: [
    '長期タスクを整理しよう。まずジャンルから見ていけば大丈夫。',
    '大きな予定は、Todoまで小さくすると進めやすいよ。'
  ]
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
