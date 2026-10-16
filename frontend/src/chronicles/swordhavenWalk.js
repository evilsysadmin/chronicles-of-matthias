// Standalone movement subset for the authentic 19×19 Swordhaven collision grid.
// The grid and spawn are imported unchanged from the original Three.js builder.
// This is a VISUAL WALK preview, not the full campaign reducer.
import {
  createSwordhavenWalkGrid,
  SWORDHAVEN_SPAWN,
  SWORDHAVEN_GATE_CELL,
} from './chroniclesSwordhaven3D.js';

export const SWORDHAVEN_DIRECTIONS = Object.freeze([
  Object.freeze({ name: 'N', dx: 0, dy: -1 }),
  Object.freeze({ name: 'E', dx: 1, dy: 0 }),
  Object.freeze({ name: 'S', dx: 0, dy: 1 }),
  Object.freeze({ name: 'O', dx: -1, dy: 0 }),
]);

export const SWORDHAVEN_WALK_GRID = createSwordhavenWalkGrid();

export function createSwordhavenWalkState() {
  return {
    mapId: 'swordhaven-square',
    x: SWORDHAVEN_SPAWN.x,
    y: SWORDHAVEN_SPAWN.y,
    direction: SWORDHAVEN_SPAWN.direction,
    turns: 0,
    message: 'Swordhaven. La compañía se adentra en sus calles.',
  };
}

export function swordhavenWalkStep(state, action) {
  if (!state || state.mapId !== 'swordhaven-square') return state;
  if (action === 'turn-left' || action === 'turn-right') {
    return { ...state, turns: state.turns + 1,
      direction: (state.direction + (action === 'turn-left' ? 3 : 1)) % 4 };
  }
  const facing = SWORDHAVEN_DIRECTIONS[state.direction];
  if (!facing) return state;
  const movement = {
    forward: [facing.dx, facing.dy],
    backward: [-facing.dx, -facing.dy],
    'strafe-left': [facing.dy, -facing.dx],
    'strafe-right': [-facing.dy, facing.dx],
  }[action];
  if (!movement) return state;
  const x = state.x + movement[0];
  const y = state.y + movement[1];
  if (SWORDHAVEN_WALK_GRID[y]?.[x] === undefined || SWORDHAVEN_WALK_GRID[y][x] === '#') {
    return { ...state, turns: state.turns + 1,
      message: 'El edificio, muro o árbol bloquea el paso. La geometría manda.' };
  }
  return { ...state, x, y, turns: state.turns + 1,
    message: x === SWORDHAVEN_GATE_CELL.x && y === SWORDHAVEN_GATE_CELL.y
      ? 'La salida de Swordhaven aún no está conectada al siguiente mapa en esta vista de migración.'
      : 'La compañía recorre Swordhaven.' };
}
