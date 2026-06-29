const { AppState, Platform } = require('react-native');
require('react-native-url-polyfill/auto');
const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const { createClient, processLock } = require('@supabase/supabase-js');
const { PUBLIC_RUNTIME_CONFIG } = require('../config/publicRuntimeConfig');

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || PUBLIC_RUNTIME_CONFIG.supabaseUrl || '';
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  PUBLIC_RUNTIME_CONFIG.supabasePublishableKey ||
  '';
const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        lock: processLock,
        persistSession: true,
        storageKey: 'taskmate-mobile-auth'
      }
    })
  : null;

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

module.exports = {
  isSupabaseConfigured,
  supabase
};
