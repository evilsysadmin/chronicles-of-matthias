import { chroniclesReduce, chroniclesActiveEnemies } from '../chroniclesOfMatthias.js';
import {
  chroniclesChooseEnemyStep,
  chroniclesEnemyCanAttackParty,
  chroniclesRememberEnemySight,
  chroniclesRuntimeEnemyPosition,
} from '../chroniclesOfMatthiasTurns.js';

// A spent exploration turn advances creature awareness and movement even
// without player displacement (turning, shooting into an empty corridor,
// casting). Refused actions and authored map transitions do not advance time.
export function chroniclesAdvanceExplorationEnemies(before, after) {
  if (!before || !after || before.phase !== 'explore' || after.phase !== 'explore'
    || before.initiative || after.initiative || before.mapId !== after.mapId
    || !(Number(after.turns) > Number(before.turns))) return after;

  const progressed = {
    ...after,
    explorationEnemySteps: Math.max(0, Math.floor(Number(after.explorationEnemySteps) || 0)) + 1,
  };
  const enemies = chroniclesActiveEnemies(progressed);
  // No free exploration attack or movement when combat initiative should
  // take over; keep the enemy in the cell where the player saw it.
  if (enemies.some((enemy) => chroniclesEnemyCanAttackParty(progressed, enemy))) return progressed;

  let current = progressed;
  for (const enemy of enemies) {
    current = chroniclesRememberEnemySight(current, enemy);
    const from = chroniclesRuntimeEnemyPosition(current, enemy);
    const to = chroniclesChooseEnemyStep(current, enemy);
    if (!to || (to.x === from.x && to.y === from.y)) continue;
    current = {
      ...current,
      enemyPositions: {
        ...(current.enemyPositions || {}),
        [enemy.id]: { x: to.x, y: to.y },
      },
    };
  }
  return current;
}

export function chroniclesGridExplorationStep(state, action) {
  return chroniclesAdvanceExplorationEnemies(state, chroniclesReduce(state, action));
}
