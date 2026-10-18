import { afterEach, describe, expect, it, vi } from 'vitest';
import { identityProviderUrl, ssoLogin, ssoSilentToken } from './shadowopsIdentity.js';
import { requestJson, setSessionRefresher } from './http.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('ShadowOps identity', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setSessionRefresher(null);
  });

  it('picks the Chess Studio of the same environment from the game origin', () => {
    expect(identityProviderUrl('https://staging.chronicles.shadowops.dpdns.org')).toBe('https://api-staging.chess-studio.shadowops.dpdns.org');
    expect(identityProviderUrl('https://chronicles.shadowops.dpdns.org')).toBe('https://api.chess-studio.shadowops.dpdns.org');
    expect(identityProviderUrl('http://localhost:4173')).toBeNull();
  });

  it('signs in at Chess Studio, then hands the session over for a Chronicles token', async () => {
    vi.stubGlobal('location', { origin: 'https://staging.chronicles.shadowops.dpdns.org' });
    const calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/api/auth/login')) return jsonResponse(200, { token: 'chess-session', username: 'evilsysadmin' });
      return jsonResponse(200, { token: 'game-token', username: 'evilsysadmin', expiresAt: 1800003600 });
    }));
    const session = await ssoLogin('evilsysadmin', 'pw');
    expect(session).toEqual({ token: 'game-token', username: 'evilsysadmin', expiresAt: 1800003600 });
    expect(calls[0].url).toBe('https://api-staging.chess-studio.shadowops.dpdns.org/api/auth/login');
    expect(calls[1].url).toBe('https://api-staging.chess-studio.shadowops.dpdns.org/api/identity/session');
    expect(calls[1].init.credentials).toBe('include');
    expect(calls[1].init.headers.Authorization).toBe('Bearer chess-session');
    expect(JSON.parse(calls[1].init.body)).toEqual({ audience: 'chronicles' });
  });

  it('silently gets nothing (not an error) without a ShadowOps session', async () => {
    vi.stubGlobal('location', { origin: 'https://staging.chronicles.shadowops.dpdns.org' });
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(401, { detail: 'Sin sesión ShadowOps en este navegador.' })));
    await expect(ssoSilentToken()).resolves.toBeNull();
  });

  it('renews an expired game token once and retries before giving up the session', async () => {
    const seen = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      seen.push(init.headers.Authorization);
      return init.headers.Authorization === 'Bearer fresh' ? jsonResponse(200, { ok: true }) : jsonResponse(401, { detail: 'expired' });
    }));
    setSessionRefresher(async () => 'fresh');
    await expect(requestJson('https://api.example/x', { headers: { Authorization: 'Bearer old' } })).resolves.toEqual({ ok: true });
    expect(seen).toEqual(['Bearer old', 'Bearer fresh']);
  });
});
