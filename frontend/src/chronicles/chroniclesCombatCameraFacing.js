// MM3 initiative must never rotate the view, including automatic focus on
// an adjacent enemy behind the party. Melee may still hit a real engaged
// cardinal neighbor without changing the camera or projectile direction.
export function chroniclesCombatCameraFacing(state) {
  return state?.direction;
}

// Keep the existing orchestration hook: with a fixed combat camera there is
// no last visual heading to persist after victory. Save/F5/exploration keep
// the canonical direction already present in next.
export function chroniclesKeepVictoryFacing(_previous, next) {
  return next;
}
