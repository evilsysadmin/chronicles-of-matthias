import { chroniclesReduce, chroniclesActiveEnemies } from '../chroniclesOfMatthias.js';
import {
  chroniclesChooseEnemyStep,
  chroniclesEnemyCanAttackParty,
  chroniclesRememberEnemySight,
  chroniclesRuntimeEnemyPosition,
} from '../chroniclesOfMatthiasTurns.js';

// Exploration-only adapter. Combats continue using their Agility + 1d8 initiative owner.
// A reducer transition that does not change the party tile never grants enemy movement.
export function chroniclesGridExplorationStep(state, action) {
  const before = state;
  const next = chroniclesReduce(before, action);
  if (!before || !next || before.phase !== 'explore' || next.phase !== 'explore') return next;
  // Crossing an authored gate changes areas, not an exploration tile inside the
  // destination. Never grant enemies a free step on the arrival transition.
  if (next.mapId !== before.mapId) return next;
  if (next.x === before.x && next.y === before.y) return next;
  // Only a real exploration tile advances patrol cadence and sighting age.
  // The turn engine already understands this clock, but it was never fed by
  // exploration, leaving patrol headings frozen and sightings unrecorded.
  const progressed = {
    ...next,
    explorationEnemySteps: Math.max(0, Math.floor(Number(next.explorationEnemySteps) || 0)) + 1,
  };
  // Engagement takes precedence over exploration movement: an enemy already
  // in reach must enter initiative, not escape the encounter on this tick.
  const activeEnemies = chroniclesActiveEnemies(progressed);
  if (activeEnemies.some((enemy) => chroniclesEnemyCanAttackParty(progressed, enemy))) return progressed;
  // Reuse the authored occupancy/AI predicates; this scheduler never calls attack or damage APIs.

  let current = progressed;
  for (const enemy of activeEnemies) {
    // Record visible party positions before each enemy's next movement, so
    // awareness-based pursuers can investigate the last real sighting rather
    // than instantly forgetting a party that moved behind masonry.
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
