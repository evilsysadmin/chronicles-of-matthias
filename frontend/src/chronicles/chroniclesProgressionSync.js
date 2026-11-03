import { authHeader, getUsername } from '../auth.js';
import { requestJson } from '../http.js';
import { chroniclesAllowedAttributes, chroniclesSkillsForMember, normalizeChroniclesProgression } from '../chroniclesOfMatthiasProgression.js';

// The heroes' progression (build, XP, attributes) lives on the server too,
// so it follows the account between the phone and the desktop. Each save
// pushes it; entering the game pulls it. When two devices disagree, the
// more advanced one (more total XP) wins, never the older write.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const URL = `${BASE_URL}/chronicles/progression`;

// The source revision belongs to one account, not to the JS module lifetime.
// A second user can sign in without reloading the page.
let knownRevision = 0;
let knownRevisionOwner = null;

function currentRevision() {
  const owner = getUsername() || null;
  if (owner !== knownRevisionOwner) {
    knownRevisionOwner = owner;
    knownRevision = 0;
  }
  return { owner, revision: knownRevision };
}

function assertCurrentRevisionOwner(owner) {
  // A request issued under Alice must never update Bob's revision if its
  // response arrives after a cross-tab login/logout.
  if ((getUsername() || null) === owner && knownRevisionOwner === owner) return;
  const error = new Error('Chronicles progression synchronization session changed');
  error.name = 'AbortError';
  throw error;
}

function totalXp(progression) {
  return Object.values(progression?.heroes || {}).reduce((sum, hero) => sum + Math.max(0, Number(hero?.xp || 0)), 0);
}

function sameProgression(left, right) {
  return JSON.stringify(normalizeChroniclesProgression(left)) === JSON.stringify(normalizeChroniclesProgression(right));
}

// Spending earned attribute/skill points does not add XP. On an XP tie,
// preserve a local upgrade only when it is demonstrably descended from the
// remote state. Never merge competing skill choices, different character
// builds, or incomparable receipts: server remains authoritative for those.
function localAdvancesEqualXp(local, remote) {
  if (JSON.stringify(local.characterBuild) !== JSON.stringify(remote.characterBuild)
    || JSON.stringify(local.mm3TemporaryBoon) !== JSON.stringify(remote.mm3TemporaryBoon)) return false;

  let advanced = false;
  for (const field of ['claimedAwards', 'claimedWorldStatSources', 'claimedTemporaryWorldSources']) {
    if (!remote[field].every((id) => local[field].includes(id))) return false;
    if (local[field].length > remote[field].length) advanced = true;
  }

  for (const [memberId, previous] of Object.entries(remote.heroes)) {
    const next = local.heroes[memberId];
    // Equal total XP can conceal one hero gaining XP while another falls
    // behind. That is a divergent progression, not a safe local upgrade.
    if (next.xp !== previous.xp) return false;
    if (!previous.skills.every((id) => next.skills.includes(id))) return false;

    let spentSkills = 0;
    const definitions = chroniclesSkillsForMember(memberId);
    for (const id of next.skills) {
      if (previous.skills.includes(id)) continue;
      const definition = definitions.find((skill) => skill.id === id);
      if (!definition || definition.requiredLevel > next.level
        || next.skills.some((other) => other !== id
          && definitions.some((skill) => skill.id === other && skill.group === definition.group))) return false;
      spentSkills += definition.cost;
    }
    if (next.skillPoints + spentSkills !== previous.skillPoints) return false;
    if (spentSkills > 0) advanced = true;

    let spentAttributes = 0;
    for (const [key, value] of Object.entries(previous.attributes)) {
      const delta = next.attributes[key] - value;
      if (delta < 0 || (delta > 0 && !chroniclesAllowedAttributes(memberId).includes(key))) return false;
      spentAttributes += delta;
    }
    if (next.attributePoints + spentAttributes !== previous.attributePoints) return false;
    if (spentAttributes > 0) advanced = true;

    for (const [key, value] of Object.entries(previous.mm3WorldBonuses)) {
      if (next.mm3WorldBonuses[key] < value) return false;
      if (next.mm3WorldBonuses[key] > value) advanced = true;
    }
  }
  return advanced;
}

export function chroniclesPickProgression(local, remote, { hasLocalCopy = true } = {}) {
  if (!remote) return { progression: normalizeChroniclesProgression(local), from: 'local' };
  const normalizedRemote = normalizeChroniclesProgression(remote);
  // A fresh device has no local progression to lose. Do not mistake the
  // default party for a conflicting user-created character build.
  if (!hasLocalCopy) return { progression: normalizedRemote, from: 'remote' };
  const normalizedLocal = normalizeChroniclesProgression(local);
  const localXp = totalXp(normalizedLocal);
  const remoteXp = totalXp(normalizedRemote);
  if (localXp > remoteXp) return { progression: normalizedLocal, from: 'local' };
  if (localXp < remoteXp) return { progression: normalizedRemote, from: 'remote' };
  if (sameProgression(normalizedLocal, normalizedRemote))
    return { progression: normalizedRemote, from: 'remote' };
  if (localAdvancesEqualXp(normalizedLocal, normalizedRemote))
    return { progression: normalizedLocal, from: 'local' };
  if (localAdvancesEqualXp(normalizedRemote, normalizedLocal))
    return { progression: normalizedRemote, from: 'remote' };
  // Equal XP but irreconcilable changes: keep both local and server copies
  // untouched, and let the caller warn the player. Never auto-merge doctrines.
  return { progression: normalizedLocal, from: 'conflict' };
}

export async function chroniclesPullProgression(local, { signal, hasLocalCopy = true } = {}) {
  const { owner } = currentRevision();
  const payload = await requestJson(URL, { headers: authHeader(), signal });
  assertCurrentRevisionOwner(owner);
  knownRevision = Number.isInteger(payload?.revision) ? payload.revision : 0;
  const picked = chroniclesPickProgression(local, payload?.progression || null, { hasLocalCopy });
  const needsPush = !payload?.progression || (picked.from === 'local' && !sameProgression(picked.progression, payload.progression));
  if (picked.from === 'conflict') {
    return {
      ...picked,
      needsPush: false,
      remoteProgression: normalizeChroniclesProgression(payload.progression),
      serverRevision: knownRevision,
    };
  }
  return { ...picked, needsPush };
}

export async function chroniclesPushProgression(progression, { retries = 1 } = {}) {
  const { owner, revision } = currentRevision();
  const body = (base) => JSON.stringify({ progression: normalizeChroniclesProgression(progression), baseRevision: base });
  try {
    const saved = await requestJson(URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: body(revision),
    });
    assertCurrentRevisionOwner(owner);
    knownRevision = Number(saved?.revision || knownRevision);
    return { pushed: true, progression: normalizeChroniclesProgression(progression) };
  } catch (error) {
    assertCurrentRevisionOwner(owner);
    if (error?.status !== 409 || retries <= 0) throw error;
    // Another device saved meanwhile: keep the more advanced progression.
    knownRevision = Number(error.body?.revision || 0);
    const picked = chroniclesPickProgression(progression, error.body?.progression || null);
    if (picked.from === 'conflict') {
      return {
        pushed: false,
        progression: picked.progression,
        conflict: true,
        remoteProgression: normalizeChroniclesProgression(error.body.progression),
        serverRevision: knownRevision,
      };
    }
    if (picked.from === 'remote') return { pushed: false, progression: picked.progression };
    return chroniclesPushProgression(picked.progression, { retries: retries - 1 });
  }
}
