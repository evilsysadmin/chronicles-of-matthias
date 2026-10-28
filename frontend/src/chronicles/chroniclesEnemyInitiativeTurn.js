import { chroniclesActiveEnemies } from '../chroniclesOfMatthias.js';
import { chroniclesResolveEnemyActor } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesKeepVictoryFacing } from './chroniclesCombatCameraFacing.js';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesCurrentInitiativeActor,
} from './chroniclesInitiative.js';

// An enemy turn belongs to the game, not to a visual cue or a browser timer.
// A faulty enemy action must cost that enemy its action, never trap the entire
// party behind "TURNO ENEMIGO". The next actor is still selected by initiative.
export function chroniclesRunPendingEnemyTurn(state, expectedEnemyId, resolveActor = chroniclesResolveEnemyActor) {
  const actor = chroniclesCurrentInitiativeActor(state?.initiative);
  if (actor?.kind !== 'enemy' || actor.id !== expectedEnemyId) return null;

  let acted = state;
  let error = null;
  try {
    acted = resolveActor(state, expectedEnemyId) || state;
  } catch (failure) {
    error = failure;
    // Do not grant damage, movement or an extra action after a failed turn.
    // Just pass this single enemy's initiative slot and keep the encounter.
  }
  const advanced = acted.phase === 'defeated'
    ? acted
    : chroniclesAdvanceCombatInitiative(acted, chroniclesActiveEnemies(acted));
  // Also cover a restored/legacy encounter that finishes during an enemy
  // action; never leave the visual camera and saved facing out of sync.
  const committed = chroniclesKeepVictoryFacing(state, advanced);
  return { acted, committed, error };
}
