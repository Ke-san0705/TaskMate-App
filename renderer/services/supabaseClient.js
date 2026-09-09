import { createClient } from '@supabase/supabase-js';
import { PUBLIC_RUNTIME_CONFIG } from '../config/publicRuntimeConfig';

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

const envSupabaseUrl = clean(import.meta.env.VITE_SUPABASE_URL);
const envSupabasePublishableKey = clean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const bundledSupabaseUrl = clean(PUBLIC_RUNTIME_CONFIG.supabaseUrl);
const bundledSupabasePublishableKey = clean(
  PUBLIC_RUNTIME_CONFIG.supabasePublishableKey
);

const supabaseUrl = envSupabaseUrl || bundledSupabaseUrl;
const supabasePublishableKey =
  envSupabasePublishableKey || bundledSupabasePublishableKey;

export const supabaseConfigSource =
  envSupabaseUrl && envSupabasePublishableKey
    ? 'env'
    : bundledSupabaseUrl && bundledSupabasePublishableKey
      ? 'bundled'
      : 'missing';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        persistSession: true,
        storageKey: 'taskmate-desktop-auth'
      }
    })
  : null;
