import { chroniclesAttackMode, chroniclesOpeningVolleyShots } from '../chroniclesOfMatthias.js';
import { chroniclesVolleyProjectileKinds } from './chroniclesVolleyProjectileArt.js';

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

// S within initiative fires one physical projectile from the active hero.
// Auto attacks share the same visual whenever the reducer chooses missiles.
// An invalid/unarmed shooter never falls back to a fictional sword slash.
export function chroniclesPlayAttackPresentation(engine, state, memberId, requestedMode = 'auto') {
  const mode = requestedMode === 'auto' && state?.combatRules === 'mm3'
    ? chroniclesAttackMode(state, memberId) : requestedMode;
  if (mode === 'missile' && state?.combatRules === 'mm3') {
    if (!chroniclesVolleyProjectileKinds(state, [memberId]).length) return false;
    engine?.playVolley?.([memberId]);
    return true;
  }
  engine?.playAttack?.(memberId);
  return true;
}
