// Local-first persistence layer built directly on IndexedDB.
// No backend, no network calls. Everything the app needs survives a refresh.

const DB_NAME = 'study-planner';
const DB_VERSION = 1;

const STORES = {
  weeks: 'id',
  tasks: 'id',
  folders: 'id',
  dailyRecords: 'id',
  weeklyReports: 'id',
  meta: 'key',
};

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('weeks')) db.createObjectStore('weeks', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('tasks')) {
        const t = db.createObjectStore('tasks', { keyPath: 'id' });
        t.createIndex('weekId', 'weekId', { unique: false });
        t.createIndex('folderId', 'folderId', { unique: false });
      }
      if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('dailyRecords')) {
        const d = db.createObjectStore('dailyRecords', { keyPath: 'id' });
        d.createIndex('weekId', 'weekId', { unique: false });
      }
      if (!db.objectStoreNames.contains('weeklyReports')) db.createObjectStore('weeklyReports', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const idGen = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

export async function getAll(storeName) {
  const store = await tx(storeName, 'readonly');
  return promisify(store.getAll());
}

export async function getAllByIndex(storeName, indexName, value) {
  const store = await tx(storeName, 'readonly');
  const idx = store.index(indexName);
  return promisify(idx.getAll(value));
}

export async function getOne(storeName, key) {
  const store = await tx(storeName, 'readonly');
  return promisify(store.get(key));
}

export async function put(storeName, value) {
  const store = await tx(storeName, 'readwrite');
  await promisify(store.put(value));
  return value;
}

export async function putMany(storeName, values) {
  const store = await tx(storeName, 'readwrite');
  await Promise.all(values.map((v) => promisify(store.put(v))));
  return values;
}

export async function remove(storeName, key) {
  const store = await tx(storeName, 'readwrite');
  await promisify(store.delete(key));
}

export async function getMeta(key, fallback = null) {
  const row = await getOne('meta', key);
  return row ? row.value : fallback;
}

export async function setMeta(key, value) {
  return put('meta', { key, value });
}