import { chroniclesActiveEnemies, chroniclesEnemyTargetAhead, chroniclesOpeningVolleyShots } from '../chroniclesOfMatthias.js';
import {
  chroniclesResolveEnemyActor,
  chroniclesRuntimeEnemyPosition,
} from '../chroniclesOfMatthiasTurns.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';

// A single touch attack button advertises the *company* salvo even when
// the selected member has no bow. Melee adjacent targets keep attack priority.
// Do not expose the salvos in initiative: there S is the active hero's shot.
export function chroniclesTouchVolleyOpportunity(state) {
  if (!state || state.combatRules !== 'mm3' || state.phase !== 'explore'
    || state.initiative || chroniclesEnemyTargetAhead(state, 1)) {
    return { available: false, shooters: 0 };
  }
  const shooters = chroniclesOpeningVolleyShots(state).shots.length;
  return { available: shooters > 0, shooters };
}

// The party occupies the camera tile while exploring (as opposed to the
// deployed four-cell formation during initiative). Only physical adjacency
// ends pre-contact shooting; a ranged foe may shoot back without closing.
export function chroniclesPrecontactMeleeContact(state) {
  if (!state || !Number.isInteger(Number(state.x)) || !Number.isInteger(Number(state.y))) return false;
  return chroniclesActiveEnemies(state).some((enemy) => {
    const position = chroniclesRuntimeEnemyPosition(state, enemy);
    return Math.abs(position.x - state.x) + Math.abs(position.y - state.y) <= 1;
  });
}

// Called by the UI *after* the reducer has committed the entire volley.
// Keep combat resolution pure and deterministic; an enemy gets one authored
// actor action per eligible salvo, not one reaction per arrow. No initiative
// roll is made at missile range.
export function chroniclesAdvanceOpeningVolley(previous, after) {
  if (!previous || !after || previous.combatRules !== 'mm3'
    || previous.phase !== 'explore' || previous.initiative
    || after.phase !== 'explore' || after.initiative
    || previous.mapId !== after.mapId) return after;

  const { target, shots } = chroniclesOpeningVolleyShots(previous);
  if (!target || !shots.length) return after;
  const alive = chroniclesActiveEnemies(after).some((enemy) => enemy.id === target.id);
  const reply = alive ? chroniclesResolveEnemyActor(after, target.id) : after;
  const next = {
    ...reply,
    round: Math.max(0, Number(previous.round || 0)) + 1,
    turnPhase: 'party',
    // Retain the meaningful volley report; preserve whether the enemy
    // moved, missed or actually hit rather than silently swallowing its turn.
    message: alive && reply.message !== after.message
      ? `${after.message} ${reply.message}`
      : after.message,
  };
  if (next.phase === 'defeated' || !chroniclesPrecontactMeleeContact(next)) return next;
  return chroniclesStartInitiativeCombat(next, chroniclesActiveEnemies(next));
}
