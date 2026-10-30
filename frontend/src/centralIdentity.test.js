import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { centralIdentityActive, centralIdentityAvailable, centralIdentityLoginUrl, identityProviderUrl, ssoLogin, ssoRegister, ssoSilentToken } from './shadowopsIdentity.js';
import { getToken, logout, refreshSsoToken } from './auth.js';

const origin = 'https://staging.chronicles.shadowops.dpdns.org';
const issuer = 'https://id-staging.shadowops.dpdns.org';
const subject = '11111111-1111-4111-8111-111111111111';

// Unsigned payloads test frontend transport/routing only. Actual JWT signature
// and live authority checks are exercised by the backend TLS tests.
function transportToken(changes = {}) {
  const now = Math.floor(Date.now() / 1000);
  return `header.${btoa(JSON.stringify({ iss: issuer, aud: 'chronicles', sub: subject, sv: 1, jti: 'abcdefghijklmnopqrstuv', iat: now, nbf: now, exp: now + 120, ...changes }))}.signature`;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubEnv('VITE_SHADOWOPS_IDENTITY', 'central-staging');
  vi.stubGlobal('location', { origin, search: '?shadowops=central' });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); localStorage.clear(); });

describe('central Identity opt-in', () => {
  it('requires the staging flag and staging game origin, preserving the old entry path', () => {
    expect(centralIdentityAvailable()).toBe(true);
    expect(centralIdentityLoginUrl()).toBe(`${issuer}/login?app=chronicles`);
    expect(identityProviderUrl()).toBe(issuer);
    vi.stubGlobal('location', { origin, search: '' });
    expect(centralIdentityActive()).toBe(false);
    expect(identityProviderUrl()).toBe('https://api-staging.chess-studio.shadowops.dpdns.org');
    localStorage.setItem('chess-study-auth-token', transportToken());
    expect(identityProviderUrl()).toBe(issuer);
    expect(centralIdentityAvailable('https://chronicles.shadowops.dpdns.org')).toBe(false);
    expect(centralIdentityAvailable('http://localhost:5173')).toBe(false);
    vi.stubEnv('VITE_SHADOWOPS_IDENTITY', '');
    expect(centralIdentityActive()).toBe(false);
  });

  it('exchanges only the central cookie and uses an issuer/UUID product profile key', async () => {
    const token = transportToken();
    const fetch = vi.fn(async () => new Response(JSON.stringify({ token }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const session = await ssoSilentToken();
    expect(session).toMatchObject({ token, username: `shadowops:staging:${subject}` });
    expect(fetch).toHaveBeenCalledWith(`${issuer}/api/identity/token`, expect.objectContaining({ credentials: 'include', body: '{}' }));
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('declines a wrong realm/audience or expired transport payload', async () => {
    for (const changes of [{ iss: 'https://id.shadowops.dpdns.org' }, { aud: 'chess-studio' }, { sub: 'alice' }, { exp: 1 }]) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ token: transportToken(changes) }), { status: 200 })));
      await expect(ssoSilentToken()).resolves.toBeNull();
    }
  });

  it('keeps passwords on the central page instead of sending them from Chronicles', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(ssoLogin('alice', 'secret')).rejects.toThrow('ShadowOps');
    await expect(ssoRegister('alice', 'secret', 'alice@example.test')).rejects.toThrow('ShadowOps');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('a late silent renewal cannot restore a session after explicit logout', async () => {
    localStorage.setItem('chess-study-auth-token', transportToken());
    localStorage.setItem('chess-study-auth-username', `shadowops:staging:${subject}`);
    let finish;
    vi.stubGlobal('fetch', vi.fn(url => url.endsWith('/logout')
      ? Promise.resolve(new Response(null, { status: 204 }))
      : new Promise(resolve => { finish = resolve; })));
    const pending = refreshSsoToken();
    logout();
    finish(new Response(JSON.stringify({ token: transportToken() }), { status: 200 }));
    await expect(pending).resolves.toBeNull();
    expect(getToken()).toBeNull();
  });
});
