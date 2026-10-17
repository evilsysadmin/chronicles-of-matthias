import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestJson } from './http.js';
import { onSessionExpired } from './sessionExpiry.js';

function respond(status, body = {}) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

describe('session expiry', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('raises session expiry when an authenticated request gets 401', async () => {
    vi.stubGlobal('fetch', respond(401, { detail: 'Sesión inválida o expirada.' }));
    const heard = vi.fn();
    const stop = onSessionExpired(heard);
    await expect(requestJson('https://api.test/api/chronicles/runs', { headers: { Authorization: 'Bearer old' } })).rejects.toThrow();
    stop();
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('stays quiet for a wrong login, a wrong current password or another error', async () => {
    const heard = vi.fn();
    const stop = onSessionExpired(heard);
    vi.stubGlobal('fetch', respond(401, { detail: 'Usuario o contraseña incorrectos.' }));
    await expect(requestJson('https://api.test/api/auth/login', { method: 'POST' })).rejects.toThrow();
    await expect(requestJson('https://api.test/api/auth/password', { method: 'POST', headers: { Authorization: 'Bearer ok' } })).rejects.toThrow();
    vi.stubGlobal('fetch', respond(503));
    await expect(requestJson('https://api.test/api/chronicles/runs', { headers: { Authorization: 'Bearer ok' } })).rejects.toThrow();
    stop();
    expect(heard).not.toHaveBeenCalled();
  });
});
