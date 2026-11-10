require('react-native-url-polyfill/auto');
const { createClient, processLock } = require('@supabase/supabase-js');
const SecureStore = require('expo-secure-store');
const { TASK_INBOX_PUBLIC_CONFIG } = require('../config/taskInboxConfig');
const { createSecureSessionStorage } = require('./secureSessionStorage');
const { createInboxTransport } = require('./taskInboxTransport');
const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || TASK_INBOX_PUBLIC_CONFIG.supabaseUrl).trim();
const key = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || TASK_INBOX_PUBLIC_CONFIG.supabasePublishableKey).trim();
const configured = /^https:\/\/[^/]+\/?$/.test(url) && !!key && !key.startsWith('sb_secret_');
const client = configured ? createClient(url, key, {
  auth: { storage: createSecureSessionStorage(SecureStore), autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, lock: processLock, storageKey: 'taskmate-inbox-auth' }
}) : null;
const transport = configured ? createInboxTransport({ baseUrl: url, publishableKey: key, getSession: async () => {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
} }) : null;
module.exports = { client, configured, transport, endpoint: configured ? `${url.replace(/\/$/, '')}/functions/v1/task-inbox/tasks` : '' };
