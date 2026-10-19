import { chroniclesOpeningVolleyShots } from '../chroniclesOfMatthias.js';

// There are two valid outcomes to pressing S before contact:
// 1. An enemy is in range: only shots that truly reach it cause hit feedback.
// 2. No enemy is in range: every equipped, living, class-compatible shooter
//    still visibly releases an arrow/bolt/stone into the empty corridor.
// This is presentation only: no phantom damage, enemy turns, XP or loot.
export function chroniclesVolleyPresentationShooterIds(state) {
  if (state?.phase !== 'explore' || state?.initiative || state?.combatRules !== 'mm3') return [];
  const { target, shooters, shots } = chroniclesOpeningVolleyShots(state);
  return target && shots.length
    ? shots.map(({ memberId }) => memberId)
    : shooters.map(({ id }) => id);
}
