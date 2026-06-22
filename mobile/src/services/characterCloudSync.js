const { Directory, File, Paths } = require('expo-file-system');
const FileSystem = require('expo-file-system/legacy');
const { normalizeDialogues } = require('@taskmate/core');
const characterRepository = require('../repositories/characterRepository');
const { isSupabaseConfigured, supabase } = require('./supabaseClient');

const CHARACTER_BUCKET = 'taskmate-character-assets';
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

function importCharacterId(remoteId) {
  const value = String(remoteId || 'cloud-character');
  return value.startsWith('custom-') ? value : `cloud-${value.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

async function imageSourceToArrayBuffer(imageSource) {
  const uri = imageSource?.uri;
  if (!uri) {
    return null;
  }
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('画像ファイルを読み込めませんでした。');
  }
  return response.arrayBuffer();
}

async function downloadImage(objectPath, characterId, stateName) {
  const { data, error } = await supabase.storage
    .from(CHARACTER_BUCKET)
    .createSignedUrl(objectPath, 60);
  if (error) {
    throw error;
  }

  const characterDirectory = new Directory(Paths.document, 'characters', characterId);
  characterDirectory.create({ intermediates: true, idempotent: true });
  const destination = new File(characterDirectory, `${stateName}.png`);
  await FileSystem.deleteAsync(destination.uri, { idempotent: true });
  await FileSystem.downloadAsync(data.signedUrl, destination.uri);
  return { uri: destination.uri };
}

async function getAccountSession() {
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

function onAccountStateChange(callback) {
  if (!isSupabaseConfigured || !supabase) {
    return () => {};
  }
  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => subscription.unsubscribe();
}

async function signInWithEmail(email, password) {
  assertConfigured();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
  return data.session;
}

async function signUpWithEmail(email, password) {
  assertConfigured();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    throw error;
  }
  return data.session;
}

async function signOut() {
  assertConfigured();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

async function deleteAccount() {
  assertConfigured();
  const { error } = await supabase.functions.invoke('delete-account', {
    body: {}
  });
  if (error) {
    throw error;
  }
  await supabase.auth.signOut();
}

async function listCloudCharacterPacks() {
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

async function uploadCharacterPack(character) {
  const user = await currentUser();
  if (!character || character.builtIn) {
    throw new Error('クラウド保存はカスタムキャラクターが対象です。');
  }

  const localCharacterId = character.id;
  const characterPath = `${user.id}/${safePathSegment(localCharacterId)}`;
  const imagePaths = {};

  for (const stateName of CHARACTER_IMAGE_STATES) {
    const body = await imageSourceToArrayBuffer(character.images?.[stateName]);
    if (!body) {
      continue;
    }
    const objectPath = `${characterPath}/${stateName}.png`;
    const { error } = await supabase.storage
      .from(CHARACTER_BUCKET)
      .upload(objectPath, body, {
        cacheControl: '3600',
        contentType: 'image/png',
        upsert: true
      });
    if (error) {
      throw error;
    }
    imagePaths[stateName] = objectPath;
  }

  const dialoguesPath = `${characterPath}/dialogues.json`;
  const { error: dialogueUploadError } = await supabase.storage
    .from(CHARACTER_BUCKET)
    .upload(dialoguesPath, JSON.stringify(character.dialogues || {}, null, 2), {
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
      name: character.name || localCharacterId,
      description: character.description || '',
      dialogues: character.dialogues || {},
      image_paths: { ...imagePaths, dialogues: dialoguesPath },
      source_device: 'mobile',
      deleted_at: null
    },
    { onConflict: 'user_id,local_character_id' }
  );
  if (error) {
    throw error;
  }
  return listCloudCharacterPacks();
}

async function importCloudCharacter(localCharacterId) {
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

  const nextId = importCharacterId(record.local_character_id);
  const images = {};
  for (const [stateName, objectPath] of Object.entries(record.image_paths || {})) {
    if (stateName === 'dialogues' || typeof objectPath !== 'string') {
      continue;
    }
    images[stateName] = await downloadImage(objectPath, nextId, stateName);
  }

  return characterRepository.saveCustomCharacter({
    id: nextId,
    name: record.name || nextId,
    description: record.description || '',
    builtIn: false,
    images,
    dialogues: normalizeDialogues(record.dialogues || {})
  });
}

module.exports = {
  deleteAccount,
  getAccountSession,
  importCloudCharacter,
  isSupabaseConfigured,
  listCloudCharacterPacks,
  onAccountStateChange,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  uploadCharacterPack
};
