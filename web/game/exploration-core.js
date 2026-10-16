// Standalone *exploration-only* adapter for the authored Crypt of Eight Squares.
// Movement/turn/blocking/trigger order follows chess-studio
// frontend/src/chroniclesOfMatthias.js @ e4f8e6c4c78390c89e4ebc4fa63914bf8ac6bc6b.
// The full reducer, initiative, combat, loot and persistence are NOT yet ported.
import { CRYPT_MAP } from './crypt-map.js';

export const DIRECTIONS = Object.freeze([
  { key: 'north', dx: 0, dy: -1, label: 'N' },
  { key: 'east', dx: 1, dy: 0, label: 'E' },
  { key: 'south', dx: 0, dy: 1, label: 'S' },
  { key: 'west', dx: -1, dy: 0, label: 'O' },
]);

const ALLOWED_ACTIONS = new Set([
  'forward', 'backward', 'strafe-left', 'strafe-right', 'turn-left', 'turn-right', 'interact',
]);

export function cellAt(x, y) {
  return CRYPT_MAP.grid[y]?.[x] ?? '#';
}

export function contentPosition(entry) {
  if (Number.isInteger(entry.x) && Number.isInteger(entry.y)) return { x: entry.x, y: entry.y };
  if (typeof entry.tile !== 'string' || entry.tile.length !== 1) return null;
  for (let y = 0; y < CRYPT_MAP.grid.length; y += 1) {
    const x = CRYPT_MAP.grid[y].indexOf(entry.tile);
    if (x >= 0) return { x, y };
  }
  return null;
}

function matches(state, requirements = []) {
  return requirements.every((req) => {
    if (!req || typeof req.key !== 'string') return false;
    if (Object.hasOwn(req, 'equals')) return state[req.key] === req.equals;
    if (Object.hasOwn(req, 'lte')) return Number.isFinite(state[req.key]) && state[req.key] <= req.lte;
    return false; // An unported condition cannot silently unlock content.
  });
}

export function activeEnemies(state) {
  return CRYPT_MAP.enemies.filter((enemy) =>
    (enemy.activationWhen ? matches(state, enemy.activationWhen) : (enemy.activation || 'always') === 'always')
    && state[enemy.hpKey] > 0
  );
}

function enemyAt(state, x, y) {
  return activeEnemies(state).find((enemy) => {
    const pos = state.enemyPositions?.[enemy.id]
      || (enemy.positionKey && enemy.positions?.[state[enemy.positionKey]])
      || { x: enemy.x, y: enemy.y };
    return pos?.x === x && pos?.y === y;
  });
}

function contentAt(group, x, y) {
  return (CRYPT_MAP[group] || []).find((entry) => {
    const pos = contentPosition(entry);
    return pos?.x === x && pos?.y === y;
  });
}

function blocker(state, x, y) {
  if (cellAt(x, y) === '#') {
    return 'Hay una pared. Incluso Matthias concede que atravesarla sería excesivo.';
  }
  const enemy = enemyAt(state, x, y);
  if (enemy) return enemy.blockingMessage || `${enemy.name} bloquea el paso.`;
  const exit = contentAt('exits', x, y);
  if (exit && !matches(state, exit.requirements)) {
    const missing = exit.requirements.find((req) => !matches(state, [req]));
    return missing?.explorationMessage || missing?.message || 'El paso sigue cerrado.';
  }
  return null;
}

function applyAction(state, action) {
  if (!action || !Array.isArray(action.effects)) return state;
  // Do not pretend unsupported combat/reward/transition effects succeeded.
  if (action.effects.some((effect) => effect.type !== 'set' || typeof effect.key !== 'string')) {
    return { ...state, message: 'Esta acción todavía requiere el motor completo de Chronicles.' };
  }
  let next = { ...state };
  for (const effect of action.effects) next = { ...next, [effect.key]: effect.value };
  const journal = action.journal && !next.journal.some((entry) => entry.id === action.journal.id)
    ? [...next.journal, action.journal]
    : next.journal;
  return { ...next, journal, message: action.message || state.message };
}

export function createExplorationState() {
  const hp = Object.fromEntries(CRYPT_MAP.enemies.map((enemy) => [enemy.hpKey, enemy.maxHp]));
  const position = Object.fromEntries(CRYPT_MAP.enemies
    .filter((enemy) => enemy.positionKey)
    .map((enemy) => [enemy.positionKey, enemy.initialPosition]));
  return {
    mapId: CRYPT_MAP.id,
    ...CRYPT_MAP.partyStart,
    ...CRYPT_MAP.initialFlags,
    ...hp, ...position,
    phase: 'explore', turns: 0, journal: [CRYPT_MAP.initialJournal],
    message: CRYPT_MAP.introMessage,
  };
}

export function explorationStep(state, action) {
  if (!state || state.phase !== 'explore' || !ALLOWED_ACTIONS.has(action)) return state;
  if (action === 'turn-left' || action === 'turn-right') {
    return { ...state, turns: state.turns + 1,
      direction: (state.direction + (action === 'turn-left' ? 3 : 1)) % 4 };
  }
  const direction = DIRECTIONS[state.direction];
  if (!direction) return state;
  if (action === 'interact') {
    const front = { x: state.x + direction.dx, y: state.y + direction.dy };
    const candidates = ['interactables', 'treasures']
      .flatMap((group) => CRYPT_MAP[group] || [])
      .filter((entry) => matches(state, entry.when));
    const entry = candidates.find((candidate) => {
      const pos = contentPosition(candidate);
      return pos && ((pos.x === state.x && pos.y === state.y)
        || (pos.x === front.x && pos.y === front.y));
    });
    if (!entry) return { ...state, turns: state.turns + 1, message: 'Nada que manipular aquí.' };
    const next = applyAction(state, entry.action);
    return { ...next, turns: state.turns + 1 };
  }
  const displacement = {
    forward: [direction.dx, direction.dy],
    backward: [-direction.dx, -direction.dy],
    'strafe-left': [direction.dy, -direction.dx],
    'strafe-right': [-direction.dy, direction.dx],
  }[action];
  if (!displacement) return state;
  const x = state.x + displacement[0];
  const y = state.y + displacement[1];
  const blocked = blocker(state, x, y);
  if (blocked) return { ...state, turns: state.turns + 1, message: blocked };
  let next = { ...state, x, y, turns: state.turns + 1 };
  const trigger = contentAt('triggers', x, y);
  if (trigger && matches(next, trigger.when)) {
    next = applyAction(next, trigger.action);
  } else {
    // No victory/transition is invented: this preview stops before the full game.
    const exit = contentAt('exits', x, y);
    next.message = exit
      ? 'La siguiente región todavía no está integrada en este adelanto.'
      : 'La compañía avanza por la cripta.';
  }
  return next;
}

export function visibleInteraction(state) {
  const dir = DIRECTIONS[state.direction];
  if (!dir) return null;
  const front = { x: state.x + dir.dx, y: state.y + dir.dy };
  return [...(CRYPT_MAP.interactables || []), ...(CRYPT_MAP.treasures || [])]
    .find((entry) => matches(state, entry.when) && [state, front].some((cell) => {
      const pos = contentPosition(entry);
      return pos?.x === cell.x && pos?.y === cell.y;
    })) || null;
}
