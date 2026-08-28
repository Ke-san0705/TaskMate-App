const DEFAULT_DIALOGUES = Object.freeze({
  noTasks: ['今日やることを追加してみよう。'],
  ready: ['今やることを一つ決めよう。'],
  focusReady: ['これが終わるまで集中しよう！'],
  focusActive: ['今は「{taskTitle}」に取り組む時間だよ。'],
  blocked: ['今は「{taskTitle}」に戻ろう。'],
  complete: ['おつかれさま！1つ終わったね。']
});

const LEGACY_DIALOGUE_MAP = Object.freeze({
  calm: 'ready',
  attentive: 'ready',
  restless: 'ready',
  anxious: 'ready',
  overloaded: 'ready',
  focusing: 'focusActive',
  relieved: 'complete',
  celebrating: 'complete',
  reconnecting: 'ready',
  notifying: 'ready',
  clicked: 'ready'
});

function cleanList(list) {
  return Array.isArray(list)
    ? list.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
    : [];
}

function normalizeDialogues(dialogues = {}) {
  const normalized = {};
  for (const [key, fallback] of Object.entries(DEFAULT_DIALOGUES)) {
    normalized[key] = cleanList(dialogues[key]);
    if (normalized[key].length === 0) {
      normalized[key] = [...fallback];
    }
  }

  for (const [legacyKey, nextKey] of Object.entries(LEGACY_DIALOGUE_MAP)) {
    const legacyList = cleanList(dialogues[legacyKey]);
    if (legacyList.length > 0 && normalized[nextKey].every((text) => !legacyList.includes(text))) {
      normalized[nextKey] = [...legacyList, ...normalized[nextKey]];
    }
  }

  return normalized;
}

function chooseDialogue(dialogues, category, previous = '', random = Math.random) {
  const normalized = normalizeDialogues(dialogues);
  const options = normalized[category] || normalized.ready;
  const candidates =
    options.length > 1 ? options.filter((candidate) => candidate !== previous) : options;
  const index = Math.floor(random() * candidates.length);
  return candidates[index] || options[0] || DEFAULT_DIALOGUES.ready[0];
}

function fillDialogue(template, variables = {}) {
  if (!template || typeof template !== 'string') {
    return '';
  }
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = variables[key];
    return value === null || value === undefined ? '' : String(value);
  });
}

module.exports = {
  DEFAULT_DIALOGUES,
  chooseDialogue,
  fillDialogue,
  normalizeDialogues
};
