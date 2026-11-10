const { normalizeTaskInput } = require('@taskmate/core');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INBOX_SCHEMA = `CREATE TABLE IF NOT EXISTS external_task_receipts (
  user_id TEXT NOT NULL, inbox_id TEXT NOT NULL, task_id TEXT NOT NULL,
  external_id TEXT NOT NULL, imported_at TEXT NOT NULL,
  PRIMARY KEY (user_id, inbox_id)
)`;

function validateItem(item) {
  const invalid = () => { const error = new Error('外部タスクの形式が正しくありません。'); error.name = 'TaskValidationError'; throw error; };
  if (!item || typeof item.id !== 'string' || !UUID.test(item.id) || item.source !== 'muse' || typeof item.externalId !== 'string' || !item.externalId.trim() || item.externalId.length > 200 || !item.task || typeof item.task !== 'object' || Array.isArray(item.task)) {
    invalid();
  }
  const taskFields = new Set(['title', 'description', 'date', 'time', 'genre', 'priority']);
  if (Object.keys(item.task).some((key) => !taskFields.has(key)) ||
      ['title', 'date'].some((key) => typeof item.task[key] !== 'string') ||
      ['description', 'genre', 'time'].some((key) => item.task[key] !== undefined && !(key === 'time' && item.task[key] === null) && typeof item.task[key] !== 'string') ||
      (item.task.priority !== undefined && !['high', 'normal', 'low'].includes(item.task.priority))) {
    invalid();
  }
  // No remote ID or completed flag is allowed to overwrite a local task.
  return normalizeTaskInput({ ...item.task, id: `muse-${item.id}`, completed: false });
}

function createInboxRepository(getDatabase) {
  async function importInboxItem(userId, item, isCurrent = () => true) {
    const task = validateItem(item);
    if (typeof userId !== 'string' || !userId) throw new Error('連携アカウントが必要です。');
    const db = await getDatabase();
    let result = { created: false, taskId: task.id };
    await db.withExclusiveTransactionAsync(async (transaction) => {
      if (!isCurrent()) throw new Error('連携処理が中断されました。');
      const receipt = await transaction.getFirstAsync('SELECT task_id FROM external_task_receipts WHERE user_id = ? AND inbox_id = ?', [userId, item.id]);
      if (receipt) { result.taskId = receipt.task_id; return; }
      if (!isCurrent()) throw new Error('連携処理が中断されました。');
      await transaction.runAsync(`INSERT INTO tasks
        (id,title,description,date,time,genre,priority,completed,created_at,updated_at,completed_at,source)
        VALUES (?,?,?,?,?,?,?,0,?,?,NULL,'muse')`, [task.id,task.title,task.description,task.date,task.time,task.genre,task.priority,task.createdAt,task.updatedAt]);
      await transaction.runAsync('INSERT INTO external_task_receipts(user_id,inbox_id,task_id,external_id,imported_at) VALUES (?,?,?,?,?)', [userId,item.id,task.id,item.externalId,task.createdAt]);
      if (!isCurrent()) throw new Error('連携処理が中断されました。');
      result.created = true;
    });
    return result;
  }
  return { importInboxItem };
}

const defaultRepository = createInboxRepository(() => require('./database').getDatabase());
module.exports = { INBOX_SCHEMA, createInboxRepository, importInboxItem: defaultRepository.importInboxItem };
