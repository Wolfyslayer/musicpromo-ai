/**
 * IndexedDB cache with the Web Cache API shape Transformers.js expects
 * (`match` / `put`). Model weights stay on device after the first download.
 */

const DB_NAME = "musicpromo-whisper";
const STORE = "weights";

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error || new Error("Could not open the model cache."));
      };
    });
  }
  return dbPromise;
}

function cacheKey(request) {
  if (typeof request === "string") return request;
  if (request && typeof request.url === "string") return request.url;
  return String(request);
}

function idbGet(key) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

function idbPut(key, value) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

export function createModelCache() {
  return {
    async match(request) {
      try {
        const record = await idbGet(cacheKey(request));
        if (!record || !record.body) return undefined;
        return new Response(record.body, {
          status: 200,
          headers: record.headers || {},
        });
      } catch (err) {
        console.warn("[lyrics-sync] model cache read failed", err);
        return undefined;
      }
    },

    async put(request, response) {
      const key = cacheKey(request);
      const body = await response.arrayBuffer();
      const headers = {};
      response.headers.forEach((value, name) => {
        headers[name] = value;
      });
      await idbPut(key, { body, headers });
    },
  };
}
