// ShadowOps account: one account and one sign-in for every game. Chess
// Studio is the identity provider (IdP); Chronicles keeps no passwords.
//
//   sign in / register  → Chess Studio's own /api/auth/login|register
//   hand the session    → IdP /api/identity/session: SSO cookie + our token
//   later visits        → IdP /api/identity/token: cookie only, silently
//
// Our token lives one hour and is renewed from the cookie. Design:
// shadowops-infra/docs/identity-sso.md.
import { request, requestJson } from './http.js';

export const SSO_AUDIENCE = 'chronicles';

// The game's own origin decides which Chess Studio vouches for it; another
// origin (local development, CI) keeps the API's local accounts unless
// VITE_IDENTITY_URL points somewhere.
const PROVIDERS = Object.freeze({
  'https://staging.chronicles.shadowops.dpdns.org': 'https://api-staging.chess-studio.shadowops.dpdns.org',
  'https://chronicles.shadowops.dpdns.org': 'https://api.chess-studio.shadowops.dpdns.org',
});

export function identityProviderUrl(origin = globalThis.location?.origin) {
  const override = import.meta.env?.VITE_IDENTITY_URL;
  if (override) return String(override).replace(/\/+$/, '');
  return PROVIDERS[origin] || null;
}

export function ssoEnabled() {
  return Boolean(identityProviderUrl());
}

const AUTH_TIMEOUT_MS = 65000;
const SILENT_TIMEOUT_MS = 8000;

function failure(response, body) {
  const detail = typeof body?.detail === 'string' ? body.detail : null;
  const error = new Error(detail || `Error ${response.status} de la cuenta ShadowOps.`);
  error.status = response.status;
  error.body = body;
  return error;
}

// Credentialed POST to the IdP. Not requestJson: a 401 here is about the
// ShadowOps session, never a reason to tear down the game's.
async function idpPost(path, { token = null, body = { audience: SSO_AUDIENCE }, timeoutMs = AUTH_TIMEOUT_MS, signal, keepalive = false } = {}) {
  const response = await request(`${identityProviderUrl()}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    timeoutMs,
    signal,
    keepalive,
  });
  const payload = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw failure(response, payload);
  return payload;
}

function gameSession(payload) {
  if (!payload?.token || !payload?.username) throw new Error('La cuenta ShadowOps no devolvió una sesión para Chronicles.');
  return { token: payload.token, username: payload.username, expiresAt: Number(payload.expiresAt) || 0 };
}

// Chess Studio session → SSO cookie in this browser + a Chronicles token.
async function handOver(chessStudioToken, { signal } = {}) {
  return gameSession(await idpPost('/api/identity/session', { token: chessStudioToken, signal }));
}

export async function ssoLogin(username, password, { signal } = {}) {
  const body = await requestJson(`${identityProviderUrl()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    timeoutMs: AUTH_TIMEOUT_MS,
    signal,
  });
  return handOver(body.token, { signal });
}

export async function ssoRegister(username, password, email, inviteCode = '', { signal } = {}) {
  const body = await requestJson(`${identityProviderUrl()}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, email, inviteCode }),
    timeoutMs: AUTH_TIMEOUT_MS,
    signal,
  });
  return handOver(body.token, { signal });
}

export async function ssoForgotPassword(email, { signal } = {}) {
  return requestJson(`${identityProviderUrl()}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
    timeoutMs: AUTH_TIMEOUT_MS,
    signal,
  });
}

// A fresh Chronicles token from the SSO cookie; null when this browser has
// no ShadowOps session (or the IdP cannot be reached).
export async function ssoSilentToken({ signal } = {}) {
  if (!ssoEnabled()) return null;
  try {
    return gameSession(await idpPost('/api/identity/token', { timeoutMs: SILENT_TIMEOUT_MS, signal }));
  } catch {
    return null;
  }
}

// Leaving Chronicles ends the ShadowOps session in this browser.
export function ssoLogout() {
  if (!ssoEnabled()) return Promise.resolve();
  return idpPost('/api/identity/logout', { body: {}, timeoutMs: 3000, keepalive: true }).catch(() => {});
}
