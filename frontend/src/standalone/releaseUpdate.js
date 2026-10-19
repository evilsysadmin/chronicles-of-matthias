import { APP_BUILD_ID } from '../release.js';
import { normalizeReleaseIdentity, releaseIdentity } from '../releaseManifest.js';

// A tab that stays open should discover successful Pages deployments promptly.
export const CHECK_INTERVAL_MS = 60_000;
export const FETCH_TIMEOUT_MS = 7_000;

export function manifestUrl(base = '/', now = Date.now()) {
  const prefix = String(base || '/').endsWith('/') ? String(base || '/') : `${base}/`;
  return `${prefix}release.json?ts=${Math.max(0, Number(now) || 0)}`;
}

export function updateAvailable(latest, current = APP_BUILD_ID) {
  const deployed = normalizeReleaseIdentity(latest);
  const running = normalizeReleaseIdentity(current);
  return Boolean(deployed && running && deployed !== running);
}

export async function fetchPublishedRelease({
  fetchImpl = globalThis.fetch,
  base = '/',
  now = Date.now(),
  signal,
} = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) return null;
  signal?.addEventListener?.('abort', abort, { once: true });
  const timeout = setTimeout(abort, FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(manifestUrl(base, now), {
      cache: 'no-store',
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response?.ok) return null;
    return releaseIdentity(await response.json());
  } catch {
    // A blocked, offline or timed-out check never disrupts gameplay.
    return null;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener?.('abort', abort);
  }
}
