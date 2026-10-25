import {
  chroniclesActiveEnemies, chroniclesEnemyTargetAhead,
  chroniclesOpeningVolleyShots, chroniclesOpeningVolleyShooters,
} from '../chroniclesOfMatthias.js';
import { chroniclesEquippedItem } from './chroniclesEquipment.js';
import { chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';

// The first-person tactical dossier shows foes as far as four squares away.
// S at that distance can start an encounter but cannot magically extend the
// weapon's hit range. Use the same limit for keyboard and touch behavior.
export const CHRONICLES_VOLLEY_PROVOCATION_RANGE = 4;

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
  const visible = chroniclesEnemyTargetAhead(state, CHRONICLES_VOLLEY_PROVOCATION_RANGE);
  const { shooters } = chroniclesOpeningVolleyShots(state);
  return { available: Boolean(visible && shooters.length), shooters: visible ? shooters.length : 0 };
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

// Once an armed company shoots at a visible enemy, combat starts on that
// single volley action, whether the actual d20 shots hit, miss, or fall short.
// The reducer alone decides damage. Never reward phantom hits or roll a
// separate pre-contact enemy turn before initiative.
export function chroniclesAdvanceOpeningVolley(previous, after) {
  if (!previous || !after || previous.combatRules !== 'mm3'
    || previous.phase !== 'explore' || previous.initiative
    || after.phase !== 'explore' || after.initiative
    || previous.mapId !== after.mapId) return after;

  const { target, shooters, shots } = chroniclesOpeningVolleyShots(previous);
  if (!shooters.length) return after;
  // Reach is a hard limit for *damage*, not for alerting a visible foe.
  // A longer-range weapon can legitimately target beyond the usual four
  // squares, so respect the actual reducer target if one exists.
  const sighted = target
    ? { enemy: target }
    : chroniclesEnemyTargetAhead(previous, CHRONICLES_VOLLEY_PROVOCATION_RANGE);
  if (!sighted) return after; // Empty air or solid wall: no engagement.
  const alive = chroniclesActiveEnemies(after).some((enemy) => enemy.id === sighted.enemy.id);
  const report = shots.length
    ? after.message
    : `La salva cae fuera de alcance: ${sighted.enemy.name} no recibe daño, pero advierte los disparos.`;
  const next = {
    ...after,
    round: Math.max(0, Number(previous.round || 0)) + 1,
    turnPhase: 'party',
    message: report,
  };
  if (!alive) return next; // Defeated enemy cannot join an initiative order.
  const engaged = chroniclesStartInitiativeCombat(
    next, chroniclesActiveEnemies(next), { forceEnemyIds: [sighted.enemy.id] },
  );
  return engaged.initiative
    ? { ...engaged, message: `${report} ¡Comienza el combate!` }
    : next;
}
