import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigSource
} from './supabaseClient';

export { isSupabaseConfigured, supabaseConfigSource };

const CHARACTER_BUCKET = 'taskmate-character-assets';
const GOOGLE_CALENDAR_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly'
];
const CHARACTER_IMAGE_STATES = [
  'wait',
  'click',
  'alarm',
  'calm',
  'attentive',
  'restless',
  'anxious',
  'overloaded',
  'focusing',
  'reconnecting',
  'relieved',
  'celebrating',
  'notifying',
  'clicked'
];

function assertConfigured() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('SupabaseのURLとpublishable keyが未設定です。');
  }
}

async function currentUser() {
  assertConfigured();
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  if (!session?.user) {
    throw new Error('ログインが必要です。');
  }
  return session.user;
}

function safePathSegment(value) {
  return encodeURIComponent(String(value || 'character').replace(/[\\/]/g, '-'));
}

function dataUrlToBlob(dataUrl) {
  const [header, body] = String(dataUrl).split(',');
  const mimeType = /data:([^;]+);base64/.exec(header)?.[1] || 'application/octet-stream';
  const binary = atob(body || '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('ファイルを読み込めませんでした。'));
    reader.readAsDataURL(blob);
  });
}

export async function getAccountSession() {
  assertConfigured();
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return session;
}

export function onAccountStateChange(callback) {
  if (!isSupabaseConfigured || !supabase) {
    return () => {};
  }
  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => subscription.unsubscribe();
}

export function isGoogleAccountSession(session) {
  const provider = session?.user?.app_metadata?.provider;
  const providers = session?.user?.app_metadata?.providers;
  return provider === 'google' || (Array.isArray(providers) && providers.includes('google'));
}

function waitForSupabaseOAuthCallback(callbackId) {
  return new Promise((resolve, reject) => {
    const unsubscribe = window.taskMate.onSupabaseOAuthCallback((payload) => {
      if (payload?.callbackId !== callbackId) {
        return;
      }
      unsubscribe();
      if (payload.error) {
        reject(new Error(payload.errorDescription || payload.error));
        return;
      }
      if (!payload.code) {
        reject(new Error('Supabase OAuth認証コードを受け取れませんでした。'));
        return;
      }
      resolve(payload.code);
    });
  });
}

export async function saveGoogleCalendarProviderAuthFromSession(session) {
  if (!session?.provider_token) {
    throw new Error('Googleカレンダー用のprovider tokenを受け取れませんでした。');
  }
  return window.taskMate.saveGoogleCalendarProviderAuth({
    accessToken: session.provider_token,
    refreshToken: session.provider_refresh_token || '',
    scope: GOOGLE_CALENDAR_SCOPES.join(' '),
    // Supabase does not expose provider token expiry consistently, so treat it
    // as a short-lived Google access token unless a refresh token is available.
    expiresAt: Date.now() + 55 * 60 * 1000,
    accountEmail: session.user?.email || ''
  });
}

export async function signInWithGoogleCalendar() {
  assertConfigured();
  let callback = null;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'http://127.0.0.1:53682/oauth-callback',
      skipBrowserRedirect: true,
      scopes: GOOGLE_CALENDAR_SCOPES.join(' '),
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true'
      }
    }
  });
  if (error) {
    throw error;
  }
  if (!data?.url) {
    throw new Error('GoogleログインURLを作成できませんでした。');
  }
  try {
    await window.taskMate.validateSupabaseOAuthUrl(data.url);
    callback = await window.taskMate.startSupabaseOAuthCallback();
    const codePromise = waitForSupabaseOAuthCallback(callback.callbackId);
    await window.taskMate.openExternalUrl(data.url);
    const code = await codePromise;
    const { data: exchangeData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      throw exchangeError;
    }
    const session = exchangeData.session || (await getAccountSession());
    await saveGoogleCalendarProviderAuthFromSession(session);
    return session;
  } catch (signInError) {
    if (callback?.callbackId) {
      await window.taskMate.cancelSupabaseOAuthCallback(callback.callbackId).catch(() => null);
    }
    throw signInError;
  }
}

export async function signInWithEmail(email, password) {
  assertConfigured();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
  return data.session;
}

export async function signUpWithEmail(email, password) {
  assertConfigured();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    throw error;
  }
  return data.session;
}

export async function signOut() {
  assertConfigured();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function deleteAccount() {
  assertConfigured();
  const { error } = await supabase.functions.invoke('delete-account', {
    body: {}
  });
  if (error) {
    throw error;
  }
  await supabase.auth.signOut();
}

export async function listCloudCharacterPacks() {
  await currentUser();
  const { data, error } = await supabase
    .from('character_packs')
    .select('local_character_id,name,description,updated_at,source_device,deleted_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
}

export async function uploadCharacterPack(characterName) {
  const user = await currentUser();
  const pack = await window.taskMate.exportCharacterPack(characterName);
  const localCharacterId = pack.id || pack.name;
  const characterPath = `${user.id}/${safePathSegment(localCharacterId)}`;
  const imagePaths = {};

  for (const stateName of CHARACTER_IMAGE_STATES) {
    const image = pack.images?.[stateName];
    if (!image) {
      continue;
    }
    const blob = dataUrlToBlob(image);
    const objectPath = `${characterPath}/${stateName}.png`;
    const { error } = await supabase.storage
      .from(CHARACTER_BUCKET)
      .upload(objectPath, blob, {
        cacheControl: '3600',
        contentType: blob.type || 'image/png',
        upsert: true
      });
    if (error) {
      throw error;
    }
    imagePaths[stateName] = objectPath;
  }

  const dialoguesBlob = new Blob([JSON.stringify(pack.dialogues || {}, null, 2)], {
    type: 'application/json'
  });
  const dialoguesPath = `${characterPath}/dialogues.json`;
  const { error: dialogueUploadError } = await supabase.storage
    .from(CHARACTER_BUCKET)
    .upload(dialoguesPath, dialoguesBlob, {
      cacheControl: '3600',
      contentType: 'application/json',
      upsert: true
    });
  if (dialogueUploadError) {
    throw dialogueUploadError;
  }

  const { error } = await supabase.from('character_packs').upsert(
    {
      user_id: user.id,
      local_character_id: localCharacterId,
      name: pack.name || localCharacterId,
      description: pack.description || '',
      dialogues: pack.dialogues || {},
      image_paths: { ...imagePaths, dialogues: dialoguesPath },
      source_device: 'desktop',
      deleted_at: null
    },
    { onConflict: 'user_id,local_character_id' }
  );
  if (error) {
    throw error;
  }
  return listCloudCharacterPacks();
}

export async function downloadCharacterPack(localCharacterId) {
  await currentUser();
  const { data: record, error } = await supabase
    .from('character_packs')
    .select('local_character_id,name,description,dialogues,image_paths')
    .eq('local_character_id', localCharacterId)
    .is('deleted_at', null)
    .single();
  if (error) {
    throw error;
  }

  const images = {};
  for (const [stateName, objectPath] of Object.entries(record.image_paths || {})) {
    if (stateName === 'dialogues' || typeof objectPath !== 'string') {
      continue;
    }
    const { data: blob, error: downloadError } = await supabase.storage
      .from(CHARACTER_BUCKET)
      .download(objectPath);
    if (downloadError) {
      throw downloadError;
    }
    images[stateName] = await blobToDataUrl(blob);
  }

  return window.taskMate.saveCloudCharacterPack({
    id: record.local_character_id,
    name: record.name,
    description: record.description || '',
    dialogues: record.dialogues || {},
    images
  });
}
