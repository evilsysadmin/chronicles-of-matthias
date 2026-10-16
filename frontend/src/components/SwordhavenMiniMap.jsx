import { SWORDHAVEN_WALK_GRID, SWORDHAVEN_DIRECTIONS } from '../chronicles/swordhavenWalk.js';

// The minimap reveals only actually visited coordinates and their immediate
// surroundings, from the untouched Swordhaven collision grid. No synthetic
// shops, quests, explored rooms, discovered enemies or campaign state.
export function swordhavenMiniCells(state, radius = 4) {
  const visited = new Set(Array.isArray(state?.visited) ? state.visited : []);
  const cells = [];
  for (let y = state.y - radius; y <= state.y + radius; y += 1) {
    for (let x = state.x - radius; x <= state.x + radius; x += 1) {
      const known = [...visited].some(key => {
        const [vx, vy] = key.split(',').map(Number);
        return Math.abs(vx - x) <= 1 && Math.abs(vy - y) <= 1;
      });
      const tile = SWORDHAVEN_WALK_GRID[y]?.[x] || '#';
      cells.push({
        id: x + ',' + y,
        x, y,
        kind: x === state.x && y === state.y ? 'party'
          : !known ? 'hidden' : tile === '#' ? 'wall' : 'floor',
      });
    }
  }
  return cells;
}

const HEADING_ARROWS = ['▲', '▶', '▼', '◀'];

export default function SwordhavenMiniMap({ state }) {
  const cells = swordhavenMiniCells(state);
  return (
    <div className="react-town-minimap" role="img"
      aria-label={`Mapa de Swordhaven: X${state.x} Y${state.y}, rumbo ${SWORDHAVEN_DIRECTIONS[state.direction]?.name}. Solo se muestran casillas conocidas.`}>
      <div className="react-town-minimap-heading">X{state.x} Y{state.y}</div>
      <div className="react-town-minimap-cells">
        {cells.map(cell => (
          <span key={cell.id} className={'react-town-map-cell is-' + cell.kind}
            aria-hidden="true">{cell.kind === 'party' ? HEADING_ARROWS[state.direction] : ''}</span>
        ))}
      </div>
    </div>
  );
}
