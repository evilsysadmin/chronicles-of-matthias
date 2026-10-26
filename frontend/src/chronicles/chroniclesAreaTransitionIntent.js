import {
  CHRONICLES_DIRECTIONS,
  chroniclesActiveEnemies,
  chroniclesContextualContentAction,
  chroniclesEnemyPosition,
} from '../chroniclesOfMatthias.js';
import {
  chroniclesMapById,
  chroniclesMapContentPosition,
  chroniclesMapForState,
  chroniclesMapTileAt,
} from './chroniclesMapCatalog.js';
import { chroniclesRequirementsMet } from './chroniclesContentRuntime.js';
import { CHRONICLES_SWORDHAVEN_RETURN_PORTAL_ID } from './chroniclesSwordhavenReturnPortal.js';
import { chroniclesIsOverworldTravelExit } from './chroniclesWorldReturnLinks.js';

const MOVEMENTS = Object.freeze({
  forward: (dx, dy) => [dx, dy],
  backward: (dx, dy) => [-dx, -dy],
  'strafe-left': (dx, dy) => [dy, -dx],
  'strafe-right': (dx, dy) => [-dy, dx],
});

function destinationFor(effects) {
  return (effects || []).find((effect) => effect.type === 'transition-map' && effect.mapId)?.mapId || null;
}

function movementEntry(state, actionType, map) {
  const direction = CHRONICLES_DIRECTIONS[state.direction];
  const offset = direction && MOVEMENTS[actionType]?.(direction.dx, direction.dy);
  if (!offset) return null;
  const x = state.x + offset[0];
  const y = state.y + offset[1];
  if (chroniclesMapTileAt(map, x, y) === '#') return null;
  if (chroniclesActiveEnemies(state).some((enemy) => {
    const pos = chroniclesEnemyPosition(state, enemy);
    return pos.x === x && pos.y === y;
  })) return null;
  const at = (entry) => {
    const pos = chroniclesMapContentPosition(map, entry);
    return pos?.x === x && pos?.y === y;
  };
  // The reducer executes triggers before exits. A trigger which changes map
  // must be confirmed too, even if the tile is not marked as an exit.
  const trigger = (map.triggers || []).find((entry) => at(entry)
    && chroniclesRequirementsMet(state, entry.when)
    && destinationFor(entry.action?.effects));
  if (trigger) return { entry: trigger, destinationId: destinationFor(trigger.action?.effects) };
  const exit = (map.exits || []).find((entry) => at(entry)
    && chroniclesRequirementsMet(state, entry.requirements));
  if (!exit) return null;
  return {
    entry: exit,
    // Non-travel legacy dungeon exits finish the adventure, regardless of
    // any authored destination: never promise travel that will not occur.
    destinationId: chroniclesIsOverworldTravelExit(map, exit)
      ? destinationFor(exit.action?.effects)
      : null,
  };
}

function interactionEntry(state, map) {
  // F / Usar at a threshold retries the SAME crossing after «No».
  // Explicitly prioritize the tile underfoot over nearby buildings/NPCs.
  const at = (entry) => {
    const position = chroniclesMapContentPosition(map, entry);
    return position?.x === state.x && position?.y === state.y;
  };
  const trigger = (map.triggers || []).find((entry) => at(entry)
    && chroniclesRequirementsMet(state, entry.when)
    && destinationFor(entry.action?.effects));
  if (trigger) return { entry: trigger, destinationId: destinationFor(trigger.action?.effects), atThreshold: true };
  const exit = (map.exits || []).find((entry) => at(entry)
    && chroniclesRequirementsMet(state, entry.requirements));
  if (exit) return {
    entry: exit,
    destinationId: chroniclesIsOverworldTravelExit(map, exit)
      ? destinationFor(exit.action?.effects) : null,
    atThreshold: true,
  };

  const contextual = chroniclesContextualContentAction(state);
  if (!contextual || contextual.locked) return null;
  if (contextual.id === CHRONICLES_SWORDHAVEN_RETURN_PORTAL_ID) {
    return { entry: contextual, destinationId: 'swordhaven-first-book' };
  }
  const entry = [...(map.exits || []), ...(map.interactables || [])]
    .find((candidate) => candidate.id === contextual.id);
  if (!entry || !chroniclesRequirementsMet(state, entry.requirements)) return null;
  // Exits with fixed coordinates are retried with F only on the actual tile.
  // Approaching from a neighboring square remains a movement action.
  if (entry.kind === 'exit' && Number.isInteger(entry.x) && Number.isInteger(entry.y)
    && (state.x !== entry.x || state.y !== entry.y)) return null;
  const destinationId = destinationFor(entry.action?.effects);
  if (!destinationId) return null;
  return { entry, destinationId };
}

function areaTitle(map) {
  return String(map?.hudTitle || map?.title || 'la siguiente región').trim();
}

function invitation(source, target) {
  const destination = areaTitle(target);
  // Legacy authored dungeons omit regionKind; the world catalog treats them
  // as dungeons instead of a mysterious third kind of location.
  const fromKind = source.regionKind || 'dungeon';
  const toKind = target?.regionKind || 'dungeon';
  if (!target) return `¿Quieres abandonar ${areaTitle(source)}?`;
  if (toKind === 'dungeon' && fromKind !== 'dungeon') {
    return `¿Quieres entrar en ${destination}?`;
  }
  if (fromKind === 'dungeon' && toKind !== 'dungeon') {
    return `¿Quieres salir hacia ${destination}?`;
  }
  if (fromKind === 'settlement' && toKind !== 'settlement') {
    return `¿Quieres salir de ${areaTitle(source)} hacia ${destination}?`;
  }
  if (toKind === 'settlement' && fromKind !== 'settlement') {
    return `¿Quieres entrar en ${destination}?`;
  }
  return `¿Quieres viajar a ${destination}?`;
}

// Read-only intention: no speculative reducer tick, RNG, world mutation or
// checkpoint. The original player action is executed only upon acceptance.
export function chroniclesAreaTransitionIntent(state, action) {
  if (!state || state.phase !== 'explore' || state.initiative || state.shop || state.guild) return null;
  const actionType = typeof action === 'string' ? action : action?.type;
  const map = chroniclesMapForState(state);
  const candidate = actionType === 'interact'
    ? interactionEntry(state, map)
    : movementEntry(state, actionType, map);
  if (!candidate) return null;
  const destination = candidate.destinationId ? chroniclesMapById(candidate.destinationId) : null;
  return {
    sourceId: map.id,
    destinationId: candidate.destinationId,
    title: destination ? areaTitle(destination) : areaTitle(map),
    question: invitation(map, destination),
    exitId: candidate.entry.id,
    // Used by the UI to distinguish entering a threshold from crossing it.
    atThreshold: candidate.atThreshold === true,
  };
}
