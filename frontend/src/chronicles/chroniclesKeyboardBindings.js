// First-person control contract shared with regression tests:
// directional arrows move/turn; A and S never move the party.
export const CHRONICLES_DIRECTION_KEYS = Object.freeze({
  ArrowUp: 'forward',
  ArrowDown: 'backward',
  ArrowLeft: 'turn-left',
  ArrowRight: 'turn-right',
});

export function chroniclesCombatKeyMode(key) {
  if (key === 'a' || key === 'A') return 'melee';
  if (key === 's' || key === 'S') return 'missile';
  // Optional historical auto-attack alias; not a movement binding.
  if (key === ' ') return 'auto';
  return null;
}
