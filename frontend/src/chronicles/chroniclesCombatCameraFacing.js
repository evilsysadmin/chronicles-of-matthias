import { CHRONICLES_DIRECTIONS, chroniclesCombatMeleeTarget } from '../chroniclesOfMatthias.js';

// During MM3 initiative, turning and moving are legal hero actions with a
// full initiative cost. The 3D camera may still auto-focus a real adjacent
// flank/behind melee threat. This is only a viewing aid; the canonical
// direction controls projectile/spell aim and movement until changed by a turn.
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

// When the final opponent falls the visual auto-focus must NOT snap back to
// the direction from before combat. Commit the last legal combat camera
// heading as the exploration heading exactly once on a victorious exit.
// Keeping it in the canonical state also makes movement, save and restore
// agree with the image on screen. The auto-focus itself is free.
export function chroniclesKeepVictoryFacing(previous, next) {
  if (previous?.combatRules !== 'mm3'
    || !previous.initiative
    || previous.phase !== 'combat'
    || next?.initiative
    || next?.phase !== 'explore'
    || previous.mapId !== next.mapId) return next;

  const facing = chroniclesCombatCameraFacing(previous);
  return Number.isInteger(facing)
    && facing >= 0
    && facing < CHRONICLES_DIRECTIONS.length
    && facing !== next.direction
    ? { ...next, direction: facing }
    : next;
}
