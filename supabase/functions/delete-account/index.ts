import { createClient } from '@supabase/supabase-js';

const CHARACTER_BUCKET = 'taskmate-character-assets';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders
  });
}

function getSecretKey() {
  const secretKeysJson = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeysJson) {
    const secretKeys = JSON.parse(secretKeysJson);
    if (typeof secretKeys.default === 'string' && secretKeys.default) {
      return secretKeys.default;
    }
  }

  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacyKey) {
    return legacyKey;
  }

  throw new Error('Supabase secret/service-role key is not configured.');
}

function imagePathsFromPacks(packs: Array<{ image_paths: Record<string, unknown> | null }>) {
  const paths = new Set<string>();
  for (const pack of packs) {
    for (const value of Object.values(pack.image_paths || {})) {
      if (typeof value === 'string' && value) {
        paths.add(value);
      }
    }
  }
  return [...paths];
}

export default {
  async fetch(req: Request) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed.' }, 405);
    }

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      if (!supabaseUrl) {
        throw new Error('SUPABASE_URL is not configured.');
      }

      const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
      if (!token) {
        return jsonResponse({ error: 'Login is required.' }, 401);
      }

      const supabaseAdmin = createClient(supabaseUrl, getSecretKey(), {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const {
        data: { user },
        error: userError
      } = await supabaseAdmin.auth.getUser(token);
      if (userError || !user) {
        return jsonResponse({ error: 'Invalid session.' }, 401);
      }

      const userId = user.id;
      const { data: packs, error: packError } = await supabaseAdmin
        .from('character_packs')
        .select('image_paths')
        .eq('user_id', userId);
      if (packError) {
        throw packError;
      }

      const imagePaths = imagePathsFromPacks(packs || []);
      if (imagePaths.length > 0) {
        const { error: storageError } = await supabaseAdmin.storage
          .from(CHARACTER_BUCKET)
          .remove(imagePaths);
        if (storageError) {
          throw storageError;
        }
      }

      await supabaseAdmin.from('account_deletion_requests').insert({
        user_id: userId,
        status: 'processed',
        processed_at: new Date().toISOString(),
        note: 'Deleted by delete-account Edge Function.'
      });

      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId, false);
      if (deleteUserError) {
        throw deleteUserError;
      }

      return jsonResponse({ ok: true });
    } catch (error) {
      console.error('delete-account failed', error);
      return jsonResponse(
        { error: error instanceof Error ? error.message : 'Account deletion failed.' },
        500
      );
    }
  }
};
