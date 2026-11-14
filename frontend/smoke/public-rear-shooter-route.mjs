// Public staging golden path for the authored Swordhaven south-watch archer.
// Every step is an ordinary MM3 control. The real browser must attest each
// visible position, direction and committed turn; no teleport or state write.
export const REAR_SHOOTER_MAP_ID = 'swordhaven-first-book';
export const REAR_SHOOTER_ENEMY_ID = 'swordhaven-false-watch-recruit';
export const REAR_SHOOTER_START = Object.freeze({ x: 9, y: 7, direction: 0 });
export const REAR_SHOOTER_VANTAGE = Object.freeze({ x: 15, y: 13, direction: 0 });
export const REAR_SHOOTER_ROUTE = Object.freeze([
  { action: 'e', x: 10, y: 7, direction: 0 },
  { action: 'e', x: 11, y: 7, direction: 0 },
  { action: 'e', x: 12, y: 7, direction: 0 },
  { action: 'ArrowRight', x: 12, y: 7, direction: 1 },
  { action: 'ArrowRight', x: 12, y: 7, direction: 2 },
  { action: 'ArrowUp', x: 12, y: 8, direction: 2 },
  { action: 'ArrowUp', x: 12, y: 9, direction: 2 },
  { action: 'ArrowUp', x: 12, y: 10, direction: 2 },
  { action: 'ArrowLeft', x: 12, y: 10, direction: 1 },
  { action: 'ArrowUp', x: 13, y: 10, direction: 1 },
  { action: 'ArrowRight', x: 13, y: 10, direction: 2 },
  { action: 'ArrowUp', x: 13, y: 11, direction: 2 },
  { action: 'ArrowUp', x: 13, y: 12, direction: 2 },
  { action: 'ArrowUp', x: 13, y: 13, direction: 2 },
  { action: 'ArrowRight', x: 13, y: 13, direction: 3 },
  { action: 'ArrowRight', x: 13, y: 13, direction: 0 },
  { action: 'e', x: 14, y: 13, direction: 0 },
  { action: 'e', x: 15, y: 13, direction: 0 },
].map(step => Object.freeze(step)));
