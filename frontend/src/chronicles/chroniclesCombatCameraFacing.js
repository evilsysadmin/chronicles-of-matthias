// Entry into MM3 melee initiative sets the canonical direction toward a real
// adjacent attacker once. During initiative the view never reorients again;
// side/rear melee remains possible against an engaged cardinal neighbor.
export function chroniclesCombatCameraFacing(state) {
  return state?.direction;
}

// Keep the existing orchestration hook: with a fixed combat camera there is
// no last visual heading to persist after victory. Save/F5/exploration keep
// the canonical direction already present in next.
export function chroniclesKeepVictoryFacing(_previous, next) {
  return next;
}
