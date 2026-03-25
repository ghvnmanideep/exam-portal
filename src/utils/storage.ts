/**
 * storage.ts
 * A small utility for storing and retrieving large media blobs (images/audio)
 * using IndexedDB, as localStorage has a 5MB limit.
 */

const DB_NAME = 'ExamoraDB';
const DB_VERSION = 1;
const STORES = ['examImages', 'examScreenCaptures', 'examAudio'] as const;

type StoreName = (typeof STORES)[number];

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      STORES.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id', autoIncrement: true });
        }
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveMedia = async (storeName: StoreName, data: { timestamp: string; image?: string; audio?: string }): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.add(data);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error(`Failed to save to ${storeName}:`, err);
  }
};

export const getMedia = async <T>(storeName: StoreName): Promise<T[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error(`Failed to get from ${storeName}:`, err);
    return [];
  }
};

export const clearAllMedia = async (): Promise<void> => {
  try {
    const db = await openDB();
    const promises = STORES.map((storeName) => {
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
    await Promise.all(promises);
  } catch (err) {
    console.error('Failed to clear all media:', err);
  }
};
