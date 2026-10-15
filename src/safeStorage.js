export const STORAGE_LOCAL = 'local';
export const STORAGE_SESSION = 'session';

function resolveStorage(kind) {
  try {
    if (typeof window === 'undefined') return null;
    return kind === STORAGE_SESSION ? window.sessionStorage : window.localStorage;
  } catch { return null; }
}

export function getStorageItem(kind, key) {
  try { return resolveStorage(kind)?.getItem(key) ?? null; } catch { return null; }
}
export function setStorageItem(kind, key, value) {
  try { const storage = resolveStorage(kind); if (!storage) return false; storage.setItem(key, String(value)); return true; } catch { return false; }
}
export function removeStorageItem(kind, key) {
  try { const storage = resolveStorage(kind); if (!storage) return false; storage.removeItem(key); return true; } catch { return false; }
}
