import { chroniclesMapForState } from './chroniclesMapCatalog.js';

// Every hit point lost between two states becomes a splat: on the enemy in
// front of the company, or on the hero's portrait. Size follows the share of
// the victim's maximum lost in that one blow, MM3 style.
export const CHRONICLES_SPLAT_MS = 1400;

function share(amount, max) {
  const ceiling = Math.max(1, Number(max) || 1);
  return Math.max(0, Math.min(1, amount / ceiling));
}

export function chroniclesHitImpacts(previous, next) {
  if (!previous || !next || previous.mapId !== next.mapId) return [];
  const impacts = [];
  for (const member of next.party || []) {
    const before = (previous.party || []).find((entry) => entry.id === member.id);
    const lost = Math.max(0, Number(before?.hp || 0) - Math.max(0, Number(member.hp || 0)));
    if (lost > 0) impacts.push({ kind: 'party', id: member.id, amount: lost, share: share(lost, member.maxHp) });
  }
  const map = chroniclesMapForState(next);
  for (const enemy of map?.enemies || []) {
    if (!enemy?.hpKey || previous[enemy.hpKey] === undefined) continue;
    const lost = Math.max(0, Number(previous[enemy.hpKey] || 0) - Math.max(0, Number(next[enemy.hpKey] || 0)));
    if (lost > 0) impacts.push({ kind: 'enemy', id: enemy.id, amount: lost, share: share(lost, enemy.maxHp) });
  }
  return impacts;
}

// Keep the MM3 damage feedback readable without letting the blood drop
// dominate either portraits or the enemy in view (~15% smaller than before).
export function chroniclesSplatScale(impact) {
  return 0.85 * (0.55 + 0.6 * Math.min(1, (Number(impact?.share) || 0) * 2));
}
