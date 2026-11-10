import { createClient } from 'npm:@supabase/supabase-js@2';
import { createInboxHandler } from './handler.mjs';

const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const admin = createClient(Deno.env.get('SUPABASE_URL')!, secretKeys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false }
});
async function result(query: PromiseLike<{data: unknown; error: unknown}>) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
const handler = createInboxHandler({
  validateUser: async (token: string) => {
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : data.user;
  },
  digest: async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, '0')).join(''),
  generateToken: () => `tm_muse_${Array.from(crypto.getRandomValues(new Uint8Array(32))).map((byte) => byte.toString(16).padStart(2, '0')).join('')}`,
  store: {
    ingest: (hash: string, items: unknown[]) => result(admin.rpc('task_inbox_ingest', { p_hash: hash, p_items: items })),
    createKey: (userId: string, hash: string, suffix: string) => result(admin.rpc('task_inbox_create_key', { p_user_id: userId, p_hash: hash, p_suffix: suffix })),
    listItems: async (userId: string, cursor: string | null) => {
      let query = admin.from('task_inbox_items').select('id,external_id,source,payload').eq('user_id', userId).is('imported_at', null).order('id').limit(50);
      if (cursor) query = query.gt('id', cursor);
      return result(query);
    },
    acknowledge: (userId: string, ids: string[]) => result(admin.rpc('task_inbox_ack', { p_user_id: userId, p_ids: ids })),
    listKeys: (userId: string) => result(admin.from('task_inbox_keys').select('id,token_suffix,created_at,revoked_at,last_used_at').eq('user_id', userId).is('revoked_at', null).order('created_at')),
    revokeKey: (userId: string, id: string) => result(admin.from('task_inbox_keys').update({ revoked_at: new Date().toISOString() }).eq('user_id', userId).eq('id', id)),
    clear: (userId: string) => result(admin.rpc('task_inbox_clear', { p_user_id: userId }))
  }
});
Deno.serve(handler);
