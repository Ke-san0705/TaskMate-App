import { InboxError, UUID, readJson, validateBatch } from './protocol.mjs';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Cache-Control': 'no-store' };
const json = (body, status = 200) => Response.json(body, { status, headers });

export function createInboxHandler({ store, validateUser, digest, generateToken }) {
  return async function handle(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    try {
      const url = new URL(request.url);
      const path = url.pathname.split('/task-inbox/')[1] || '';
      const bearer = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
      if (!bearer) throw new InboxError(401, 'Authentication required.');
      if (path === 'tasks' && request.method === 'POST') {
        if (!/^tm_muse_[a-f0-9]{64}$/.test(bearer)) throw new InboxError(401, 'Integration key required.');
        const items = validateBatch(await readJson(request));
        for (const item of items) item.hash = await digest(JSON.stringify(item.task));
        const result = await store.ingest(await digest(bearer), items);
        return json({ status: 'received', ...result }, 202);
      }
      if (bearer.startsWith('tm_muse_')) throw new InboxError(401, 'User session required.');
      const user = await validateUser(bearer);
      if (!user?.id) throw new InboxError(401, 'User session required.');
      if (path === 'items' && request.method === 'GET') {
        const cursor = url.searchParams.get('after');
        if (cursor && !UUID.test(cursor)) throw new InboxError(400, 'Invalid cursor.');
        const rows = await store.listItems(user.id, cursor);
        return json({ items: rows.map((row) => ({ id: row.id, externalId: row.external_id, source: row.source, task: row.payload })), nextCursor: rows.length === 50 ? rows.at(-1).id : null });
      }
      if (path === 'ack' && request.method === 'POST') {
        const ids = (await readJson(request))?.ids;
        if (!Array.isArray(ids) || ids.length < 1 || ids.length > 50 || ids.some((id) => typeof id !== 'string' || !UUID.test(id))) throw new InboxError(400, 'Invalid receipt IDs.');
        await store.acknowledge(user.id, ids);
        return json({ ok: true });
      }
      if (path === 'keys' && request.method === 'GET') return json({ keys: await store.listKeys(user.id) });
      if (path === 'keys' && request.method === 'POST') {
        const token = generateToken();
        const result = await store.createKey(user.id, await digest(token), token.slice(-6));
        return json({ ...result, token, timezone: 'Asia/Tokyo' }, 201);
      }
      if (path === 'keys' && request.method === 'DELETE') {
        const id = (await readJson(request))?.id;
        if (typeof id !== 'string' || !UUID.test(id)) throw new InboxError(400, 'Invalid key ID.');
        await store.revokeKey(user.id, id);
        return json({ ok: true });
      }
      if (path === 'data' && request.method === 'DELETE') {
        await store.clear(user.id);
        return json({ ok: true });
      }
      throw new InboxError(404, 'Unknown endpoint or method.');
    } catch (error) {
      const codeStatus = /^PT(400|401|409|429)$/.exec(error?.code || '');
      const status = error instanceof InboxError ? error.status : codeStatus ? Number(codeStatus[1]) : 500;
      // Never return database details or tokens to the sender.
      return json({ error: status === 500 ? 'Inbox service unavailable.' : error.message }, status);
    }
  };
}
