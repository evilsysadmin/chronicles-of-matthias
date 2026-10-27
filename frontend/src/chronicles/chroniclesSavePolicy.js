// Only the actual combat initiative owns this restriction. Keep the earlier
// durable checkpoint intact until the fight has been resolved; a pending
// request must not commit a stale pre-combat snapshot once battle has started.
export const CHRONICLES_COMBAT_SAVE_NOTICE =
  'No puedes guardar durante el combate. Termina el enfrentamiento para guardar.';

export function chroniclesCanCheckpoint(state) {
  return Boolean(state && !state.initiative);
}

// First-person Chronicles is an MM3 tribute: no per-action checkpoint writes.
// Only a deliberate Save or a transition between distinct areas may persist a run.
export function chroniclesCheckpointReason(previousMapId, nextMapId, manual = false) {
  if (manual) return 'manual';
  if (typeof previousMapId === 'string' && previousMapId
    && typeof nextMapId === 'string' && nextMapId
    && previousMapId !== nextMapId) return 'area-change';
  return null;
}
