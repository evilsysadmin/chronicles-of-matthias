import { authHeader } from '../auth.js';
import { requestJson } from '../http.js';
import { normalizeChroniclesProgression } from '../chroniclesOfMatthiasProgression.js';

// The heroes' progression (build, XP, attributes) lives on the server too,
// so it follows the account between the phone and the desktop. Each save
// pushes it; entering the game pulls it. When two devices disagree, the
// more advanced one (more total XP) wins, never the older write.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const URL = `${BASE_URL}/chronicles/progression`;

let knownRevision = 0;

function totalXp(progression) {
  return Object.values(progression?.heroes || {}).reduce((sum, hero) => sum + Math.max(0, Number(hero?.xp || 0)), 0);
}

function sameProgression(left, right) {
  return JSON.stringify(normalizeChroniclesProgression(left)) === JSON.stringify(normalizeChroniclesProgression(right));
}

export function chroniclesPickProgression(local, remote) {
  if (!remote) return { progression: normalizeChroniclesProgression(local), from: 'local' };
  const normalizedRemote = normalizeChroniclesProgression(remote);
  const normalizedLocal = normalizeChroniclesProgression(local);
  const localAhead = totalXp(normalizedLocal) > totalXp(normalizedRemote);
  return localAhead ? { progression: normalizedLocal, from: 'local' } : { progression: normalizedRemote, from: 'remote' };
}

export async function chroniclesPullProgression(local, { signal } = {}) {
  const payload = await requestJson(URL, { headers: authHeader(), signal });
  knownRevision = Number.isInteger(payload?.revision) ? payload.revision : 0;
  const picked = chroniclesPickProgression(local, payload?.progression || null);
  const needsPush = !payload?.progression || (picked.from === 'local' && !sameProgression(picked.progression, payload.progression));
  return { ...picked, needsPush };
}

export async function chroniclesPushProgression(progression, { retries = 1 } = {}) {
  const body = (base) => JSON.stringify({ progression: normalizeChroniclesProgression(progression), baseRevision: base });
  try {
    const saved = await requestJson(URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: body(knownRevision),
    });
    knownRevision = Number(saved?.revision || knownRevision);
    return { pushed: true, progression: normalizeChroniclesProgression(progression) };
  } catch (error) {
    if (error?.status !== 409 || retries <= 0) throw error;
    // Another device saved meanwhile: keep the more advanced progression.
    knownRevision = Number(error.body?.revision || 0);
    const picked = chroniclesPickProgression(progression, error.body?.progression || null);
    if (picked.from === 'remote') return { pushed: false, progression: picked.progression };
    return chroniclesPushProgression(picked.progression, { retries: retries - 1 });
  }
}
