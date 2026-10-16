// Temporary independent exploration-only viewport. The original crypt geometry
// and messages come from chess-studio; this deliberately offers no combat/saves.
import { CRYPT_MAP } from './crypt-map.js';
import {
  DIRECTIONS, activeEnemies, createExplorationState, explorationStep, visibleInteraction,
} from './exploration-core.js';

const ARROWS = ['↑', '→', '↓', '←'];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountExplorationPreview() {
  const root = document.getElementById('crypt-exploration');
  const board = document.getElementById('crypt-map');
  const message = document.getElementById('crypt-message');
  const readout = document.getElementById('crypt-readout');
  const interactions = document.getElementById('crypt-interaction');
  const restart = document.getElementById('crypt-restart');
  if (!root || !board || !message || !readout || !interactions || !restart) return;
  let state = createExplorationState();

  function redraw() {
    const hostile = new Map(activeEnemies(state).map((enemy) => {
      const pos = state.enemyPositions?.[enemy.id]
        || (enemy.positionKey && enemy.positions?.[state[enemy.positionKey]])
        || { x: enemy.x, y: enemy.y };
      return [`${pos.x},${pos.y}`, enemy];
    }));
    const fragment = document.createDocumentFragment();
    for (let y = 0; y < CRYPT_MAP.grid.length; y += 1) {
      for (let x = 0; x < CRYPT_MAP.grid[y].length; x += 1) {
        const tile = CRYPT_MAP.grid[y][x];
        const cell = element('span', 'crypt-cell');
        const enemy = hostile.get(`${x},${y}`);
        if (tile === '#') cell.classList.add('crypt-wall');
        if (tile === 'X') cell.classList.add('crypt-gate');
        if (tile === 'S') cell.classList.add('crypt-sigil');
        if (x === 5 && y === 5) cell.classList.add('crypt-lever');
        if (x === state.x && y === state.y) {
          cell.classList.add('crypt-party');
          cell.textContent = ARROWS[state.direction];
        } else if (enemy) {
          cell.classList.add('crypt-enemy');
          cell.textContent = '✹';
          cell.title = enemy.name;
        } else if (tile === 'X') {
          cell.textContent = '◆';
        } else if (tile === 'S') {
          cell.textContent = state.sigilAwake ? '✦' : '◇';
        } else if (x === 5 && y === 5) {
          cell.textContent = '⚙';
        } else if (tile !== '#') {
          cell.textContent = '·';
        }
        fragment.append(cell);
      }
    }
    board.replaceChildren(fragment);
    board.setAttribute('aria-label',
      `Mapa de la cripta, grupo en columna ${state.x + 1}, fila ${state.y + 1}, rumbo ${DIRECTIONS[state.direction].key}. ${hostile.size} enemigos activos.`);
    readout.textContent = `Posición ${state.x + 1},${state.y + 1} · Rumbo ${DIRECTIONS[state.direction].label} · Turnos ${state.turns} · ${hostile.size} amenazas`;
    message.textContent = state.message || 'La cripta aguarda.';
    const nearby = visibleInteraction(state);
    interactions.textContent = nearby
      ? `${nearby.label || 'Interactuar'} — pulsa «Interactuar».`
      : 'Acércate a la palanca o a un objeto para interactuar.';
  }

  root.querySelectorAll('[data-explore-action]').forEach((button) => {
    button.addEventListener('click', () => {
      state = explorationStep(state, button.dataset.exploreAction);
      redraw();
      root.focus({ preventScroll: true });
    });
  });
  restart.addEventListener('click', () => {
    state = createExplorationState();
    redraw();
    root.focus({ preventScroll: true });
  });

  root.addEventListener('keydown', (event) => {
    const tag = event.target?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const actions = {
      ArrowUp: 'forward', ArrowDown: 'backward',
      ArrowLeft: 'turn-left', ArrowRight: 'turn-right',
      q: 'strafe-left', e: 'strafe-right',
    };
    const action = actions[event.key];
    if (!action || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    state = explorationStep(state, action);
    redraw();
  });

  redraw();
}

if (typeof document !== 'undefined') mountExplorationPreview();
