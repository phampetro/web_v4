const DB_NAME = 'DMS_Report_Cache';
const DB_VERSION = 5;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Store cho mỗi bảng cache, key = storeName
      if (!db.objectStoreNames.contains('cache_meta')) {
        db.createObjectStore('cache_meta', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('kh_kpsds')) {
        db.createObjectStore('kh_kpsds', { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('ds_kh_3m')) {
        db.createObjectStore('ds_kh_3m', { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('config_all_products')) {
        db.createObjectStore('config_all_products', { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('config_user_products')) {
        db.createObjectStore('config_user_products', { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('common_categories')) {
        db.createObjectStore('common_categories', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('kh_cho_pho')) {
        db.createObjectStore('kh_cho_pho', { autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Lưu toàn bộ data vào 1 store (xóa cũ, ghi mới) */
export async function setStoreData<T>(storeName: string, data: T[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    for (const item of data) {
      store.add(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Đọc toàn bộ data từ 1 store */
export async function getStoreData<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

/** Lưu metadata (vd: ngày cập nhật đã cache) */
export async function setCacheMeta(key: string, value: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cache_meta', 'readwrite');
    const store = tx.objectStore('cache_meta');
    store.put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Đọc metadata */
export async function getCacheMeta(key: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cache_meta', 'readonly');
    const store = tx.objectStore('cache_meta');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Xóa dữ liệu trong tất cả các bảng (khi logout, v.v.) */
export async function clearAllCache(): Promise<void> {
  const db = await openDB();
  const storeNames = Array.from(db.objectStoreNames);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    for (const name of storeNames) {
      tx.objectStore(name).clear();
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
