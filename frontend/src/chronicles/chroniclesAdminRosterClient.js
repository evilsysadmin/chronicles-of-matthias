import { authHeader } from '../auth.js';
import { requestJson } from '../http.js';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Validate the API boundary before handing records to React. A malformed
// user used to crash the whole Admin screen during list rendering.
export function chroniclesValidateAdminRosterPage(payload) {
  if (!Array.isArray(payload?.users)
    || (payload.nextAfter !== undefined && typeof payload.nextAfter !== 'string')
    || payload.users.some((user) => !user || typeof user !== 'object'
      || Array.isArray(user) || typeof user.username !== 'string'
      || !user.username.trim() || typeof user.online !== 'boolean')) {
    throw new Error('Respuesta de administración no válida.');
  }
  return { users: payload.users, nextAfter: payload.nextAfter || '' };
}

// Never request cross-environment data. This always uses the host game's API.
export async function chroniclesAdminRoster(after = '', { signal } = {}) {
  const suffix = after ? `?after=${encodeURIComponent(after)}` : '';
  const payload = await requestJson(`${BASE_URL}/chronicles/admin/users${suffix}`, {
    headers: authHeader(),
    signal,
  });
  return chroniclesValidateAdminRosterPage(payload);
}
