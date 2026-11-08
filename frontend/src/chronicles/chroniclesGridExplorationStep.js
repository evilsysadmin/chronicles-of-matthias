import { chroniclesReduce, chroniclesActiveEnemies } from '../chroniclesOfMatthias.js';
import {
  chroniclesChooseEnemyStep,
  chroniclesEnemyCanAttackParty,
  chroniclesEnemyAttackReach,
  chroniclesResolveEnemyActor,
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
  // Melee contact belongs to initiative: no free swing or retreat before
  // combat begins. Ranged attackers NEVER freeze exploration.
  if (enemies.some((enemy) => chroniclesEnemyAttackReach(enemy) === 1
    && chroniclesEnemyCanAttackParty(progressed, enemy))) return progressed;

  let current = { ...progressed, enemyTurnEvents: [] };
  const shots = [];
  for (const enemy of enemies) {
    if (current.phase !== 'explore') break;
    // Use the real enemy actor's to-hit, armor and damage mechanics once per
    // spent exploration turn, without opening initiative or granting a free
    // move after a shot. Blocked rays never produce shots.
    if (chroniclesEnemyAttackReach(enemy) > 1
      && chroniclesEnemyCanAttackParty(current, enemy)) {
      const acted = chroniclesResolveEnemyActor(current, enemy.id);
      const events = acted.enemyTurnEvents || [];
      if (events.some((event) => event.type === 'attack')) {
        shots.push(...events);
        current = { ...acted, turnPhase: 'party', enemyTurnEvents: [...shots] };
        continue;
      }
      // Paralysis or a legitimate retreat still costs that enemy its turn.
      if (events.length) {
        current = { ...acted, turnPhase: 'party', enemyTurnEvents: [...shots, ...events] };
        shots.push(...events);
        continue;
      }
    }
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
