import {
  chroniclesActiveEnemies, chroniclesEnemyTargetAhead,
  chroniclesOpeningVolleyShots, chroniclesOpeningVolleyShooters,
} from '../chroniclesOfMatthias.js';
import { chroniclesEquippedItem } from './chroniclesEquipment.js';
import { chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';

// S launches an expedition-wide volley outside combat, or the active
// hero's missile while initiative is running. No weapon means no action.
export function chroniclesMissileRefusal(state, memberId = null) {
  if (!state || state.combatRules !== 'mm3') return null;
  if (!state.initiative) {
    return chroniclesOpeningVolleyShooters(state).length ? null : 'Sin arma a distancia';
  }
  const actor = state.party?.find((member) => member.id === memberId);
  return actor?.hp > 0 && !chroniclesEquippedItem(state, actor.id, 'missile')
    ? 'Sin arma a distancia' : null;
}

// A single touch attack button advertises the *company* salvo even when
// the selected member has no bow. Melee adjacent targets keep attack priority.
// Do not expose the salvos in initiative: there S is the active hero's shot.
export function chroniclesTouchVolleyOpportunity(state) {
  if (!state || state.combatRules !== 'mm3' || state.phase !== 'explore'
    || state.initiative || chroniclesEnemyTargetAhead(state, 1)) {
    return { available: false, shooters: 0 };
  }
  const { target, shooters } = chroniclesOpeningVolleyShots(state);
  return { available: Boolean(target && shooters.length), shooters: target ? shooters.length : 0 };
}

// The party occupies the camera tile while exploring (as opposed to the
// deployed four-cell formation during initiative). Only physical adjacency
// ends pre-contact shooting; a ranged foe may shoot back without closing.
function validPartyGridCoordinate(value) {
  // Number(null), Number('') and Number(false) are zero: malformed saves must
  // not invent a party position and trigger phantom pre-contact combat.
  if (typeof value !== 'number' && typeof value !== 'string') return false;
  if (typeof value === 'string' && !value.trim()) return false;
  const coordinate = Number(value);
  return Number.isSafeInteger(coordinate) && coordinate >= 0;
}

export function chroniclesPrecontactMeleeContact(state) {
  if (!state || !validPartyGridCoordinate(state.x) || !validPartyGridCoordinate(state.y)) return false;
  return chroniclesActiveEnemies(state).some((enemy) => {
    const position = chroniclesRuntimeEnemyPosition(state, enemy);
    return Math.abs(position.x - state.x) + Math.abs(position.y - state.y) <= 1;
  });
}

// A collective volley remains an exploration action: ranged enemies may
// shoot back on their regular exploration tick, but distant fire never
// forces a stationary melee initiative. The reducer owns actual damage.
export function chroniclesAdvanceOpeningVolley(previous, after) {
  if (!previous || !after || previous.combatRules !== 'mm3'
    || previous.phase !== 'explore' || previous.initiative
    || after.phase !== 'explore' || after.initiative
    || previous.mapId !== after.mapId
    // A stale/no-op volley cannot provoke initiative without paying its turn.
    || !(Number(after.turns) > Number(previous.turns))) return after;

  const { target, shooters, shots } = chroniclesOpeningVolleyShots(previous);
  if (!shooters.length) return after;
  if (!target || !shots.length) return after; // Empty air or solid wall: no engagement.
  return {
    ...after,
    round: Math.max(0, Number(previous.round || 0)) + 1,
    turnPhase: 'party',
  };
}
