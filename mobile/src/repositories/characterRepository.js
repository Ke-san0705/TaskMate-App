const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const { Directory, File, Paths } = require('expo-file-system');
const { normalizeDialogues } = require('@taskmate/core');
const { BUNDLED_CHARACTERS } = require('../constants/bundledCharacters');
const { DEFAULT_SETTINGS, STORAGE_KEYS } = require('../constants/defaults');
const { log, warn } = require('../utils/logger');

let characterQueue = Promise.resolve();

function normalizeImageMap(images = {}) {
  const wait = images.wait || null;
  const click = images.click || wait;
  const alarm = images.alarm || wait;
  return {
    wait,
    click,
    alarm,
    calm: images.calm || wait,
    attentive: images.attentive || wait,
    restless: images.restless || wait,
    anxious: images.anxious || alarm || wait,
    overloaded: images.overloaded || alarm || wait,
    focusing: images.focusing || wait,
    reconnecting: images.reconnecting || wait,
    relieved: images.relieved || click || wait,
    celebrating: images.celebrating || click || wait,
    notifying: images.notifying || alarm || wait,
    clicked: images.clicked || click || wait
  };
}

function normalizeCharacter(character) {
  return {
    id: character.id,
    name: character.name || character.id,
    description: character.description || '',
    builtIn: Boolean(character.builtIn),
    images: normalizeImageMap(character.images),
    dialogues: normalizeDialogues(character.dialogues)
  };
}

async function readCustomCharacters() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.characters);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeCharacter) : [];
  } catch (error) {
    warn('Character', 'broken custom character data recovered', error);
    await AsyncStorage.setItem(STORAGE_KEYS.characters, JSON.stringify([]));
    return [];
  }
}

function writeCustomCharacters(characters) {
  characterQueue = characterQueue
    .catch(() => {})
    .then(async () => {
      const normalized = characters.filter((character) => !character.builtIn);
      await AsyncStorage.setItem(STORAGE_KEYS.characters, JSON.stringify(normalized));
      return normalized;
    });
  return characterQueue;
}

async function listCharacters() {
  const custom = await readCustomCharacters();
  return [...BUNDLED_CHARACTERS.map(normalizeCharacter), ...custom];
}

async function getSelectedCharacterId() {
  const stored = await AsyncStorage.getItem(STORAGE_KEYS.selectedCharacter);
  return stored || DEFAULT_SETTINGS.selectedCharacterId;
}

async function selectCharacter(characterId) {
  const characters = await listCharacters();
  const found = characters.find((character) => character.id === characterId);
  if (!found) {
    throw new Error('選択するキャラクターが見つかりません。');
  }
  await AsyncStorage.setItem(STORAGE_KEYS.selectedCharacter, characterId);
  return found;
}

async function getSelectedCharacter() {
  const characters = await listCharacters();
  const selectedId = await getSelectedCharacterId();
  return (
    characters.find((character) => character.id === selectedId) ||
    characters.find((character) => character.id === DEFAULT_SETTINGS.selectedCharacterId) ||
    characters[0]
  );
}

function createCharacterId() {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createCustomCharacter({ name, description, dialogues }) {
  const characters = await readCustomCharacters();
  const id = createCharacterId();
  const base = normalizeCharacter({
    id,
    name: name?.trim() || 'カスタムキャラクター',
    description: description?.trim() || '自分で追加したキャラクターです。',
    builtIn: false,
    images: {},
    dialogues: normalizeDialogues(dialogues)
  });
  const next = [...characters, base];
  await writeCustomCharacters(next);
  log('Character', 'custom character created', { characterId: id });
  return base;
}

async function saveCustomCharacter(nextCharacter) {
  const characters = await readCustomCharacters();
  const next = characters.map((character) =>
    character.id === nextCharacter.id ? normalizeCharacter(nextCharacter) : character
  );
  if (!next.some((character) => character.id === nextCharacter.id)) {
    next.push(normalizeCharacter(nextCharacter));
  }
  await writeCustomCharacters(next);
  return normalizeCharacter(nextCharacter);
}

async function copyCharacterImage(characterId, stateName, sourceUri) {
  if (!sourceUri) {
    throw new Error('画像が選択されていません。');
  }
  const characterDirectory = new Directory(Paths.document, 'characters', characterId);
  characterDirectory.create({ intermediates: true, idempotent: true });
  const source = new File(sourceUri);
  const destination = new File(characterDirectory, `${stateName}.png`);

  // 画像は写真ライブラリの一時URIをそのまま使わず、アプリ管理領域へコピーします。
  // これにより、元の写真が移動・削除されてもキャラクター表示が壊れにくくなります。
  await source.copy(destination, { overwrite: true });
  log('Character', 'custom image copied', { characterId, stateName });
  return destination.uri;
}

async function updateCustomCharacterImage(characterId, stateName, sourceUri) {
  const characters = await readCustomCharacters();
  const character = characters.find((candidate) => candidate.id === characterId);
  if (!character || character.builtIn) {
    throw new Error('編集できるカスタムキャラクターが見つかりません。');
  }
  const copiedUri = await copyCharacterImage(characterId, stateName, sourceUri);
  const updated = {
    ...character,
    images: {
      ...(character.images || {}),
      [stateName]: { uri: copiedUri }
    }
  };
  return saveCustomCharacter(updated);
}

async function updateCustomCharacterDialogues(characterId, dialogues) {
  const characters = await readCustomCharacters();
  const character = characters.find((candidate) => candidate.id === characterId);
  if (!character || character.builtIn) {
    throw new Error('編集できるカスタムキャラクターが見つかりません。');
  }
  return saveCustomCharacter({
    ...character,
    dialogues: normalizeDialogues(dialogues)
  });
}

async function updateCustomCharacterProfile(characterId, profile) {
  const characters = await readCustomCharacters();
  const character = characters.find((candidate) => candidate.id === characterId);
  if (!character || character.builtIn) {
    throw new Error('編集できるカスタムキャラクターが見つかりません。');
  }
  return saveCustomCharacter({
    ...character,
    name: profile?.name?.trim() || character.name,
    description: profile?.description?.trim() || ''
  });
}

async function deleteCustomCharacter(characterId) {
  const characters = await readCustomCharacters();
  const target = characters.find((character) => character.id === characterId);
  if (!target) {
    throw new Error('削除するキャラクターが見つかりません。');
  }
  await writeCustomCharacters(characters.filter((character) => character.id !== characterId));
  const selectedId = await getSelectedCharacterId();
  if (selectedId === characterId) {
    await AsyncStorage.setItem(STORAGE_KEYS.selectedCharacter, DEFAULT_SETTINGS.selectedCharacterId);
  }
  return target;
}

module.exports = {
  createCustomCharacter,
  deleteCustomCharacter,
  getSelectedCharacter,
  getSelectedCharacterId,
  listCustomCharacters: readCustomCharacters,
  listCharacters,
  saveCustomCharacter,
  selectCharacter,
  updateCustomCharacterDialogues,
  updateCustomCharacterImage,
  updateCustomCharacterProfile
};
