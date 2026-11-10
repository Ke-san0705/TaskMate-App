export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class InboxError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const allowed = new Set(['externalId', 'title', 'description', 'date', 'time', 'genre', 'priority']);
function text(value, max, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw new InboxError(400, 'Invalid or missing text field.');
  return value.trim();
}
export function validateBatch(body) {
  if (!body || Object.keys(body).some((key) => key !== 'tasks') || !Array.isArray(body.tasks) || body.tasks.length < 1 || body.tasks.length > 50) throw new InboxError(400, 'Send between 1 and 50 tasks.');
  const ids = new Set();
  return body.tasks.map((item, index) => {
    try {
      if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some((key) => !allowed.has(key))) throw new InboxError(400, 'Unsupported task fields.');
      const externalId = text(item.externalId, 200, true);
      if (ids.has(externalId)) throw new InboxError(400, 'Duplicate externalId in batch.');
      ids.add(externalId);
      const date = text(item.date, 10, true);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0, 4)) < 100 || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) throw new InboxError(400, 'date must be an actual YYYY-MM-DD date in Asia/Tokyo.');
      const time = item.time === undefined || item.time === null || item.time === '' ? null : text(item.time, 5, true);
      if (time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new InboxError(400, 'Invalid time.');
      if (item.priority !== undefined && !['high', 'normal', 'low'].includes(item.priority)) throw new InboxError(400, 'Invalid priority.');
      return { externalId, task: { title: text(item.title, 100, true), description: text(item.description, 1000), date, time, genre: text(item.genre, 40), priority: item.priority || 'normal' } };
    } catch (error) {
      if (error instanceof InboxError) throw new InboxError(error.status, `tasks[${index}]: ${error.message}`);
      throw new InboxError(400, `tasks[${index}]: Invalid date or task.`);
    }
  });
}
export async function readJson(request) {
  const reader = request.body?.getReader();
  const chunks = []; let size = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) { await reader.cancel(); throw new InboxError(413, 'Body exceeds 64KB.'); }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new InboxError(400, 'Invalid JSON.'); }
}
