import { chroniclesMapForState } from './chroniclesMapCatalog.js';

// Every hit point lost between two states becomes a splat: on the enemy in
// front of the company, or on the hero's portrait. Size follows the share of
// the victim's maximum lost in that one blow, MM3 style.
export const CHRONICLES_SPLAT_MS = 1400;

// A missing/corrupt snapshot value is not a death or a hit. Numeric
// strings remain valid for legacy saves; never coerce booleans or arrays.
function finiteHp(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const hp = Number(value);
  return Number.isFinite(hp) ? Math.max(0, hp) : null;
}

function damageBetween(before, after) {
  const from = finiteHp(before), to = finiteHp(after);
  return from === null || to === null ? 0 : Math.max(0, from - to);
}

function share(amount, max) {
  const ceiling = Math.max(1, finiteHp(max) ?? 1);
  return Math.max(0, Math.min(1, amount / ceiling));
}

export function chroniclesHitImpacts(previous, next) {
  if (!previous || !next || previous.mapId !== next.mapId) return [];
  // A fresh expedition on the same map is not a continuation of a fight.
  if (previous.runSeed != null && next.runSeed != null && previous.runSeed !== next.runSeed) return [];
  const impacts = [];
  const priorParty = Array.isArray(previous.party) ? previous.party : [];
  const seen = new Set();
  for (const member of Array.isArray(next.party) ? next.party : []) {
    if (!member?.id || seen.has(member.id)) continue;
    seen.add(member.id);
    const before = priorParty.find((entry) => entry?.id === member.id);
    const lost = damageBetween(before?.hp, member.hp);
    if (lost > 0) impacts.push({ kind: 'party', id: member.id, amount: lost, share: share(lost, member.maxHp) });
  }
  const map = chroniclesMapForState(next);
  for (const enemy of map?.enemies || []) {
    if (!enemy?.hpKey) continue;
    const lost = damageBetween(previous[enemy.hpKey], next[enemy.hpKey]);
    if (lost > 0) impacts.push({ kind: 'enemy', id: enemy.id, amount: lost, share: share(lost, enemy.maxHp) });
  }
  return impacts;
}

// Keep the MM3 damage feedback readable without letting the blood drop
// dominate either portraits or the enemy in view (~15% smaller than before).
export function chroniclesSplatScale(impact) {
  return 0.85 * (0.55 + 0.6 * Math.min(1, (Number(impact?.share) || 0) * 2));
}
