import { describe, expect, it, vi } from 'vitest';
import { manifestUrl, updateAvailable, fetchPublishedRelease } from './releaseUpdate.js';

describe('Chronicles staging release updates', () => {
  const oldSha = 'a'.repeat(40);
  const newSha = 'b'.repeat(40);

  it('checks a cache-busted same-origin manifest', () => {
    expect(manifestUrl('/', 123)).toBe('/release.json?ts=123');
    expect(manifestUrl('/chronicles', 300)).toBe('/chronicles/release.json?ts=300');
  });

  it('uses immutable SHA, not the human-readable release name', () => {
    expect(updateAvailable(newSha, oldSha)).toBe(true);
    expect(updateAvailable(oldSha, oldSha)).toBe(false);
    expect(updateAvailable('bad release', oldSha)).toBe(false);
  });

  it('loads a valid published release without cached responses', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({
      release: 'v16.6dm46zfrv', build: newSha,
    }) }));
    expect(await fetchPublishedRelease({ fetchImpl, now: 500 })).toBe(newSha);
    expect(fetchImpl).toHaveBeenCalledWith('/release.json?ts=500',
      expect.objectContaining({ method: 'GET', cache: 'no-store', signal: expect.anything() }));
  });

  it('ignores failed, invalid or missing manifests safely', async () => {
    const bad = [
      async () => { throw new Error('offline'); },
      async () => ({ ok: false }),
      async () => ({ ok: true, json: async () => ({ release: 5, build: 'nope' }) }),
    ];
    for (const fetchImpl of bad) {
      expect(await fetchPublishedRelease({ fetchImpl })).toBe(null);
    }
    const controller = new AbortController();
    controller.abort();
    const never = vi.fn();
    expect(await fetchPublishedRelease({ fetchImpl: never, signal: controller.signal })).toBe(null);
    expect(never).not.toHaveBeenCalled();
  });
});
