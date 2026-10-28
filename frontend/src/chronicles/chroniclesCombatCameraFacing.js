import { CHRONICLES_DIRECTIONS, chroniclesCombatMeleeTarget } from '../chroniclesOfMatthias.js';

// During MM3 initiative the COMPANY stays fixed: its direction is part of
// game state, and no movement/turn action may change it. The 3D camera may
// automatically look towards the single REAL melee target when that target
// stands at a flank/behind the company. This is strictly a viewing aid; no
// reach, spell aim, projectile direction, pathfinding or turn cost changes.
export function chroniclesCombatCameraFacing(state) {
  const facing = state?.direction;
  if (state?.combatRules !== 'mm3' || !state.initiative || state.phase !== 'combat') return facing;
  const target = chroniclesCombatMeleeTarget(state);
  const position = target?.position;
  if (!position) return facing;
  const dx = position.x - state.x;
  const dy = position.y - state.y;
  // A restored legacy enemy occupying the same cell gives no useful look
  // direction; never pan toward a distant or non-cardinal / invented target.
  if (Math.abs(dx) + Math.abs(dy) !== 1) return facing;
  const direction = CHRONICLES_DIRECTIONS.findIndex((step) => step.dx === dx && step.dy === dy);
  return direction >= 0 ? direction : facing;
}
