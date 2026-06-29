const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const taskRepository = require('../repositories/taskRepository');
const projectRepository = require('../repositories/projectRepository');
const { isSupabaseConfigured, supabase } = require('./supabaseClient');

const TABLE_NAME = 'task_sync_items';
const SOURCE_DEVICE = 'mobile';
const KNOWN_ITEMS_KEY = 'taskmate.taskSyncKnownItems.v1';

const ITEM_TYPES = Object.freeze({
  TASK: 'task',
  CATEGORY: 'project_category',
  PROJECT: 'project',
  MILESTONE: 'project_milestone',
  PROJECT_TASK: 'project_task'
});

const UPSERT_ORDER = [
  ITEM_TYPES.CATEGORY,
  ITEM_TYPES.PROJECT,
  ITEM_TYPES.MILESTONE,
  ITEM_TYPES.PROJECT_TASK,
  ITEM_TYPES.TASK
];

const DELETE_ORDER = [
  ITEM_TYPES.PROJECT_TASK,
  ITEM_TYPES.MILESTONE,
  ITEM_TYPES.PROJECT,
  ITEM_TYPES.CATEGORY,
  ITEM_TYPES.TASK
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
    throw new Error('タスク同期にはログインが必要です。');
  }
  return session.user;
}

function itemKey(itemType, localId) {
  return `${itemType}:${localId}`;
}

function splitItemKey(key) {
  const index = key.indexOf(':');
  return index === -1
    ? { itemType: '', localId: '' }
    : { itemType: key.slice(0, index), localId: key.slice(index + 1) };
}

function knownItemsKey(userId) {
  return `${KNOWN_ITEMS_KEY}:${userId}`;
}

async function readKnownKeys(userId) {
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(knownItemsKey(userId))) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((key) => typeof key === 'string') : []);
  } catch {
    return new Set();
  }
}

async function writeKnownKeys(userId, keys) {
  await AsyncStorage.setItem(knownItemsKey(userId), JSON.stringify([...keys].sort()));
}

function updatedAt(payload, fallback = null) {
  return (
    payload?.updatedAt ||
    payload?.updated_at ||
    payload?.createdAt ||
    payload?.created_at ||
    fallback ||
    '1970-01-01T00:00:00.000Z'
  );
}

function remoteTimestamp(row) {
  return row.deleted_at || updatedAt(row.payload, row.updated_at || row.created_at);
}

function timestampValue(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function remoteIsNewer(remote, local) {
  return timestampValue(remoteTimestamp(remote)) > timestampValue(updatedAt(local));
}

function localIsNewer(local, remote) {
  return timestampValue(updatedAt(local)) > timestampValue(remoteTimestamp(remote));
}

function toMap(items) {
  return new Map(items.map((item) => [itemKey(item.itemType, item.localId), item]));
}

function sortByType(items, order) {
  const indexByType = new Map(order.map((type, index) => [type, index]));
  return [...items].sort(
    (left, right) =>
      (indexByType.get(left.itemType) ?? 999) - (indexByType.get(right.itemType) ?? 999)
  );
}

function normalizeLocalItem(itemType, payload) {
  if (!payload?.id) {
    return null;
  }
  return {
    itemType,
    localId: payload.id,
    payload
  };
}

async function readLocalItems() {
  const [tasks, projectState] = await Promise.all([
    taskRepository.listTasks(),
    projectRepository.listProjectState()
  ]);
  const items = [];
  for (const task of tasks || []) {
    const item = normalizeLocalItem(ITEM_TYPES.TASK, task);
    if (item) items.push(item);
  }
  for (const category of projectState?.categories || []) {
    const item = normalizeLocalItem(ITEM_TYPES.CATEGORY, category);
    if (item) items.push(item);
  }
  for (const project of projectState?.projects || []) {
    const item = normalizeLocalItem(ITEM_TYPES.PROJECT, project);
    if (item) items.push(item);
  }
  for (const milestone of projectState?.milestones || []) {
    const item = normalizeLocalItem(ITEM_TYPES.MILESTONE, milestone);
    if (item) items.push(item);
  }
  for (const task of projectState?.projectTasks || []) {
    if (!task.projectId) {
      continue;
    }
    const item = normalizeLocalItem(ITEM_TYPES.PROJECT_TASK, task);
    if (item) items.push(item);
  }
  return items;
}

async function readLocalStateForApply() {
  const [tasks, projectState] = await Promise.all([
    taskRepository.listTasks(),
    projectRepository.listProjectState()
  ]);
  return {
    tasks: tasks || [],
    categories: projectState?.categories || [],
    projects: projectState?.projects || [],
    milestones: projectState?.milestones || [],
    projectTasks: projectState?.projectTasks || []
  };
}

async function fetchRemoteItems() {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('item_type,local_id,payload,source_device,created_at,updated_at,deleted_at');
  if (error) {
    throw error;
  }
  return (data || []).map((row) => ({
    itemType: row.item_type,
    localId: row.local_id,
    payload: row.payload || {},
    sourceDevice: row.source_device || 'unknown',
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at
  }));
}

async function upsertRemoteItem(userId, item) {
  const { error } = await supabase.from(TABLE_NAME).upsert(
    {
      user_id: userId,
      item_type: item.itemType,
      local_id: item.localId,
      payload: item.payload || {},
      source_device: SOURCE_DEVICE,
      deleted_at: null
    },
    { onConflict: 'user_id,item_type,local_id' }
  );
  if (error) {
    throw error;
  }
}

async function tombstoneRemoteItem(userId, itemType, localId, payload = {}) {
  const { error } = await supabase.from(TABLE_NAME).upsert(
    {
      user_id: userId,
      item_type: itemType,
      local_id: localId,
      payload: payload || {},
      source_device: SOURCE_DEVICE,
      deleted_at: new Date().toISOString()
    },
    { onConflict: 'user_id,item_type,local_id' }
  );
  if (error) {
    throw error;
  }
}

function firstCategoryId(state) {
  return state.categories[0]?.id || 'category-other';
}

async function applyLocalUpsert(item) {
  const state = await readLocalStateForApply();
  const payload = item.payload || {};
  if (item.itemType === ITEM_TYPES.TASK) {
    const exists = state.tasks.some((task) => task.id === item.localId);
    return exists
      ? taskRepository.updateTask(item.localId, payload)
      : taskRepository.createTask(payload);
  }
  if (item.itemType === ITEM_TYPES.CATEGORY) {
    const exists = state.categories.some((category) => category.id === item.localId);
    return exists
      ? projectRepository.updateCategory(item.localId, payload)
      : projectRepository.createCategory(payload);
  }
  if (item.itemType === ITEM_TYPES.PROJECT) {
    const input = {
      ...payload,
      categoryId: state.categories.some((category) => category.id === payload.categoryId)
        ? payload.categoryId
        : firstCategoryId(state)
    };
    const exists = state.projects.some((project) => project.id === item.localId);
    return exists
      ? projectRepository.updateProject(item.localId, input)
      : projectRepository.createProject(input);
  }
  if (item.itemType === ITEM_TYPES.MILESTONE) {
    if (!state.projects.some((project) => project.id === payload.projectId)) {
      return null;
    }
    const exists = state.milestones.some((milestone) => milestone.id === item.localId);
    return exists
      ? projectRepository.updateMilestone(item.localId, payload)
      : projectRepository.createMilestone(payload);
  }
  if (item.itemType === ITEM_TYPES.PROJECT_TASK) {
    if (!state.projects.some((project) => project.id === payload.projectId)) {
      return null;
    }
    const exists = state.projectTasks.some((task) => task.id === item.localId);
    return exists
      ? projectRepository.updateProjectTask(item.localId, payload)
      : projectRepository.createProjectTask(payload);
  }
  return null;
}

async function applyLocalDelete(item) {
  const state = await readLocalStateForApply();
  if (item.itemType === ITEM_TYPES.TASK) {
    if (state.tasks.some((task) => task.id === item.localId)) {
      await taskRepository.deleteTask(item.localId);
    }
  } else if (item.itemType === ITEM_TYPES.PROJECT_TASK) {
    if (state.projectTasks.some((task) => task.id === item.localId)) {
      await projectRepository.deleteProjectTask(item.localId);
    }
  } else if (item.itemType === ITEM_TYPES.MILESTONE) {
    if (state.milestones.some((milestone) => milestone.id === item.localId)) {
      await projectRepository.deleteMilestone(item.localId);
    }
  } else if (item.itemType === ITEM_TYPES.PROJECT) {
    if (state.projects.some((project) => project.id === item.localId)) {
      await projectRepository.deleteProject(item.localId, 'keepTasks');
    }
  } else if (item.itemType === ITEM_TYPES.CATEGORY) {
    if (state.categories.some((category) => category.id === item.localId)) {
      await projectRepository.deleteCategory(item.localId);
    }
  }
}

async function syncTaskData() {
  const user = await currentUser();
  const knownKeys = await readKnownKeys(user.id);
  const localItems = await readLocalItems();
  const localMap = toMap(localItems);
  const remoteItems = await fetchRemoteItems();
  const remoteMap = toMap(remoteItems);
  const uploadKeys = new Set();
  const appliedKeys = new Set();
  let uploaded = 0;
  let downloaded = 0;
  let deleted = 0;

  for (const key of knownKeys) {
    if (localMap.has(key)) {
      continue;
    }
    const { itemType, localId } = splitItemKey(key);
    if (!itemType || !localId) {
      continue;
    }
    const remote = remoteMap.get(key);
    if (!remote?.deleted_at) {
      await tombstoneRemoteItem(user.id, itemType, localId, remote?.payload || {});
      uploaded += 1;
      remoteMap.set(key, {
        itemType,
        localId,
        payload: remote?.payload || {},
        deleted_at: new Date().toISOString()
      });
    }
  }

  const remoteDeletes = [];
  const remoteUpserts = [];
  for (const [key, remote] of remoteMap.entries()) {
    const local = localMap.get(key);
    if (remote.deleted_at) {
      if (local && remoteIsNewer(remote, local.payload)) {
        remoteDeletes.push(remote);
      } else if (local && localIsNewer(local.payload, remote)) {
        uploadKeys.add(key);
      }
      continue;
    }
    if (!local) {
      if (!knownKeys.has(key)) {
        remoteUpserts.push(remote);
      }
      continue;
    }
    if (remoteIsNewer(remote, local.payload)) {
      remoteUpserts.push(remote);
    } else if (localIsNewer(local.payload, remote)) {
      uploadKeys.add(key);
    }
  }

  for (const [key] of localMap.entries()) {
    if (!remoteMap.has(key)) {
      uploadKeys.add(key);
    }
  }

  for (const item of sortByType(remoteDeletes, DELETE_ORDER)) {
    await applyLocalDelete(item);
    appliedKeys.add(itemKey(item.itemType, item.localId));
    deleted += 1;
  }

  for (const item of sortByType(remoteUpserts, UPSERT_ORDER)) {
    const applied = await applyLocalUpsert(item);
    if (applied !== null) {
      appliedKeys.add(itemKey(item.itemType, item.localId));
      downloaded += 1;
    }
  }

  const finalItems = await readLocalItems();
  const finalMap = toMap(finalItems);
  const keysToUpload = new Set([...uploadKeys, ...appliedKeys]);
  for (const key of keysToUpload) {
    const item = finalMap.get(key);
    if (item) {
      await upsertRemoteItem(user.id, item);
      uploaded += 1;
    }
  }

  const remoteDeletedKeys = [...remoteMap.values()]
    .filter((item) => item.deleted_at)
    .map((item) => itemKey(item.itemType, item.localId));
  await writeKnownKeys(user.id, new Set([...knownKeys, ...finalMap.keys(), ...remoteDeletedKeys]));

  return {
    uploaded,
    downloaded,
    deleted,
    localCount: finalItems.length
  };
}

module.exports = {
  isSupabaseConfigured,
  syncTaskData
};
