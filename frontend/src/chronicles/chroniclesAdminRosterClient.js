import { authHeader } from '../auth.js';
import { requestJson } from '../http.js';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Never request cross-environment data. This always uses the host game's API.
export async function chroniclesAdminRoster(after = '', { signal } = {}) {
  const suffix = after ? `?after=${encodeURIComponent(after)}` : '';
  const payload = await requestJson(`${BASE_URL}/chronicles/admin/users${suffix}`, {
    headers: authHeader(),
    signal,
  });
  if (!Array.isArray(payload?.users) || typeof payload?.nextAfter !== 'string' && payload?.nextAfter !== undefined) {
    throw new Error('Respuesta de administración no válida.');
  }
  return { users: payload.users, nextAfter: payload.nextAfter || '' };
}
