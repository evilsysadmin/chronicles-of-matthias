import { resolveChroniclesEnemyBuildDefinition } from './chroniclesEnemyBuilds.js';
import { chroniclesEnemyAttackReach, chroniclesEnemyHasSightline, chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import {
  chroniclesCollapsePartyAfterCombat,
  chroniclesDeployPartyForCombat,
} from '../chroniclesPartyFootprint.js';

export const CHRONICLES_INITIATIVE_VERSION = 1;
export const CHRONICLES_INITIATIVE_DIE_SIDES = 8;
// Leave room for the largest 1d8 roll, even with extreme legacy stats.
const MAX_SAFE_INITIATIVE_AGILITY = Number.MAX_SAFE_INTEGER - CHRONICLES_INITIATIVE_DIE_SIDES;

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

// Legacy or computed HP may be non-finite. Infinity is not a living
// combatant: admitting it can leave an unkillable actor in initiative.
function hasLivingHitPoints(value) {
  const hp = Number(value);
  return Number.isFinite(hp) && hp > 0;
}

export function chroniclesRollD8(random = Math.random) {
  const raw = Number(random());
  const normalized = Number.isFinite(raw) ? Math.min(0.999999999999, Math.max(0, raw)) : 0;
  return 1 + Math.floor(normalized * CHRONICLES_INITIATIVE_DIE_SIDES);
}

// Progression AGI reaches initiative exactly once: through the
// `rpgModifiers` that applyChroniclesProgressionToTacticsState/reconcile
// already keep in the run state. Callers must not add it again.
export function chroniclesPartyInitiativeAgility(state, member) {
  if (!member) return 0;
  const base = nonNegativeInteger(member.agility);
  const progressionBonus = nonNegativeInteger(state?.rpgModifiers?.[member.id]?.initiativeBonus);
  // MM Speed: its bonus (negative for slow heroes) moves the hero in the order.
  const rawSpeedBonus = Number(member.mm3?.bonuses?.speed ?? 0);
  // Corrupt legacy MM3 bonuses must not turn AGI or initiative into NaN/Infinity.
  // Only whole, safely representable MM3 bonuses can affect AGI + 1d8.
  // Fractional/unsafe legacy values would break the integer initiative contract.
  const speedBonus = Number.isSafeInteger(rawSpeedBonus) ? rawSpeedBonus : 0;
  return Math.min(MAX_SAFE_INITIATIVE_AGILITY, Math.max(0, base + progressionBonus + speedBonus));
}

export function chroniclesEnemyInitiativeAgility(enemy) {
  if (!enemy) return 0;
  const resolved = resolveChroniclesEnemyBuildDefinition(enemy);
  const buildAgility = nonNegativeInteger(resolved?.build?.attributes?.agility);
  // Whitespace-only legacy strings are missing values, not explicit AGI 0.
  const missingAgility = enemy.agility == null
    || (typeof enemy.agility === 'string' && !enemy.agility.trim());
  return Math.min(MAX_SAFE_INITIATIVE_AGILITY,
    nonNegativeInteger(missingAgility ? buildAgility : enemy.agility, buildAgility));
}

function actorEntry({ id, kind, name, agility, random }) {
  const roll = chroniclesRollD8(random);
  return {
    id,
    kind,
    name,
    agility,
    roll,
    initiative: agility + roll,
  };
}

export function chroniclesRollInitiative(
  state,
  enemies,
  { random = Math.random } = {},
) {
  const partyActors = (state?.party || [])
    .filter((member) => hasLivingHitPoints(member?.hp))
    .map((member) => actorEntry({
      id: member.id,
      kind: 'party',
      name: member.name || member.id,
      agility: chroniclesPartyInitiativeAgility(state, member),
      random,
    }));

  const enemyActors = (Array.isArray(enemies) ? enemies : [])
    .filter((enemy) => hasLivingHitPoints(state?.[enemy?.hpKey]))
    .map((enemy) => actorEntry({
      id: enemy.id,
      kind: 'enemy',
      name: enemy.name || enemy.id,
      agility: chroniclesEnemyInitiativeAgility(enemy),
      random,
    }));

  const order = [...partyActors, ...enemyActors].sort((left, right) => (
    right.initiative - left.initiative
    || right.agility - left.agility
    || right.roll - left.roll
    || left.kind.localeCompare(right.kind)
    || left.id.localeCompare(right.id)
  ));

  return {
    version: CHRONICLES_INITIATIVE_VERSION,
    die: '1d8',
    round: 1,
    cursor: 0,
    order,
  };
}

export function chroniclesCurrentInitiativeActor(initiative) {
  if (!initiative?.order?.length) return null;
  const cursor = Math.max(0, Math.min(initiative.order.length - 1, nonNegativeInteger(initiative.cursor)));
  return initiative.order[cursor] || null;
}

export function chroniclesAdvanceInitiative(initiative) {
  if (!initiative?.order?.length) return initiative;
  const nextCursor = nonNegativeInteger(initiative.cursor) + 1;
  if (nextCursor < initiative.order.length) return { ...initiative, cursor: nextCursor };
  return {
    ...initiative,
    round: nonNegativeInteger(initiative.round, 1) + 1,
    cursor: 0,
  };
}


function manhattanDistance(left, right) {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function enemyEngagementRange(enemy) {
  // Corrupt or legacy reach values must neither disable engagement (NaN)
  // nor grant an unlimited sightline range (Infinity).
  // Engagement and real attacks must agree on the same bounded reach.
  const attackReach = chroniclesEnemyAttackReach(enemy);
  const configured = Number(enemy?.ai?.engageRange);
  return Number.isFinite(configured) && configured >= 1
    ? Math.max(attackReach, configured)
    : attackReach;
}

// A creature joins a fight only if it is close AND can see the party: a
// spider three tiles away behind solid masonry must not start combat.
export function chroniclesEngagedEnemies(state, enemies) {
  if (!state || state.phase === 'escaped' || state.phase === 'defeated') return [];
  const partyPosition = { x: state.x, y: state.y };
  return (Array.isArray(enemies) ? enemies : []).filter((enemy) => {
    // Match the initiative roster's living-enemy predicate: NaN from a
    // malformed legacy HP value must not start a party-only combat.
    if (!(hasLivingHitPoints(state?.[enemy?.hpKey]))) return false;
    const enemyPosition = chroniclesRuntimeEnemyPosition(state, enemy);
    return manhattanDistance(partyPosition, enemyPosition) <= enemyEngagementRange(enemy)
      && chroniclesEnemyHasSightline(state, enemyPosition, partyPosition);
  });
}

// Extra tiles beyond its engage range before a creature that also cannot see
// the party gives up the chase and leaves the initiative order.
export const CHRONICLES_COMBAT_LEASH = 2;

// A creature that lost the party (far away and out of sight) is no longer in
// the fight. Without this, an enemy stuck behind walls kept combat going
// forever while the party walked off.
export function chroniclesEnemyLostParty(state, enemy) {
  // Legacy null/blank ranges mean "not configured", not a zero-tile leash.
  const rawRange = enemy?.ai?.engageRange;
  const range = Number(rawRange);
  if (rawRange == null || !Number.isFinite(range) || range < 1) return false;
  const partyPosition = { x: state.x, y: state.y };
  const enemyPosition = chroniclesRuntimeEnemyPosition(state, enemy);
  return manhattanDistance(partyPosition, enemyPosition) > enemyEngagementRange(enemy) + CHRONICLES_COMBAT_LEASH
    && !chroniclesEnemyHasSightline(state, enemyPosition, partyPosition);
}

function actorIsAlive(state, enemyById, actor) {
  if (actor.kind === 'party') {
    return (state?.party || []).some((member) => member.id === actor.id && hasLivingHitPoints(member.hp));
  }
  const enemy = enemyById.get(actor.id);
  return Boolean(enemy && hasLivingHitPoints(state?.[enemy.hpKey]));
}

export function chroniclesStartInitiativeCombat(state, enemies, options = {}) {
  if (!state || state.initiative) return state;
  // Forced engagements must not revive a finished expedition. Proximity
  // engagement already excludes these phases; apply the same rule here.
  if (state.phase === 'defeated' || state.phase === 'escaped') return state;
  // A wiped company cannot take a turn: never create an enemy-only combat.
  // Defeat resolution belongs to the reducer, not to this engagement helper.
  if (!Array.isArray(state.party) || !state.party.some((member) => hasLivingHitPoints(member?.hp))) return state;
  const forceEnemyIds = new Set(Array.isArray(options.forceEnemyIds) ? options.forceEnemyIds : []);
  const candidates = Array.isArray(enemies) ? enemies : [];
  const engagedById = new Map(
    chroniclesEngagedEnemies(state, candidates).map((enemy) => [enemy.id, enemy]),
  );
  candidates.forEach((enemy) => {
    if (forceEnemyIds.has(enemy.id) && hasLivingHitPoints(state?.[enemy.hpKey])) {
      engagedById.set(enemy.id, enemy);
    }
  });
  const engaged = [...engagedById.values()];
  if (!engaged.length) return state;
  const deployedState = chroniclesDeployPartyForCombat(state);
  const initiative = chroniclesRollInitiative(deployedState, engaged, options);
  if (!initiative.order.length) return state;
  const { combatWard: _staleWard, ...fresh } = deployedState;
  return {
    ...fresh,
    phase: 'combat',
    initiative,
    message: `Combate por turnos · iniciativa = AGI + 1d8: ${initiative.order.map((actor) => `${actor.name} ${actor.initiative}`).join(' · ')}.`,
  };
}

export function chroniclesAdvanceCombatInitiative(state, enemies) {
  if (!state?.initiative?.order?.length) return state;
  // A party wiped during an active round must end in defeat, even if
  // enemies survive or the final enemy fell at the same time.
  if (!Array.isArray(state.party) || !state.party.some((member) => hasLivingHitPoints(member?.hp))) {
    const { combatWard: _ward, enemyStatus: _status, ...collapsed } = chroniclesCollapsePartyAfterCombat(state);
    return { ...collapsed, phase: 'defeated', turnPhase: 'party', initiative: null };
  }
  // Preserve the original turn boundary before leashed enemies are pruned.
  const orderBeforeLeash = state.initiative.order;
  const cursorBeforeLeash = Math.min(orderBeforeLeash.length - 1, nonNegativeInteger(state.initiative.cursor));
  const enemyById = new Map((Array.isArray(enemies) ? enemies : []).map((enemy) => [enemy.id, enemy]));
  const lost = state.initiative.order.filter((actor) => (
    actor.kind === 'enemy' && actorIsAlive(state, enemyById, actor) && chroniclesEnemyLostParty(state, enemyById.get(actor.id))
  ));
  if (lost.length) {
    const lostIds = new Set(lost.map((actor) => actor.id));
    const order = state.initiative.order.filter((actor) => actor.kind !== 'enemy' || !lostIds.has(actor.id));
    // Keep the cursor on the last remaining actor at or before the current
    // one, so whoever comes next still gets their turn.
    const original = state.initiative.order;
    const at = Math.min(original.length - 1, nonNegativeInteger(state.initiative.cursor));
    let cursor = order.length - 1;
    for (let index = at; index >= 0; index -= 1) {
      const kept = order.findIndex((actor) => actor.kind === original[index].kind && actor.id === original[index].id);
      if (kept >= 0) { cursor = kept; break; }
    }
    state = {
      ...state,
      initiative: { ...state.initiative, order, cursor },
      message: `${lost.map((actor) => actor.name).join(' y ')} ${lost.length === 1 ? 'pierde' : 'pierden'} vuestro rastro.`,
    };
  }
  const livingOrder = state.initiative.order.filter((actor) => actorIsAlive(state, enemyById, actor));
  const enemiesRemain = livingOrder.some((actor) => actor.kind === 'enemy');
  if (!enemiesRemain) {
    // Escudo de fe and any paralysis end with the fight.
    const { combatWard: _ward, enemyStatus: _status, ...collapsed } = chroniclesCollapsePartyAfterCombat(state);
    return {
      ...collapsed,
      phase: state.phase === 'defeated' ? 'defeated' : 'explore',
      turnPhase: 'party',
      initiative: null,
    };
  }
  if (!livingOrder.length) return { ...state, initiative: null };

  const originalOrder = state.initiative.order;
  const currentCursor = Math.max(
    0,
    Math.min(originalOrder.length - 1, nonNegativeInteger(state.initiative.cursor)),
  );
  let nextActor = null;
  for (let offset = 1; offset <= originalOrder.length; offset += 1) {
    const rawIndex = currentCursor + offset;
    const index = rawIndex % originalOrder.length;
    const candidate = originalOrder[index];
    if (!actorIsAlive(state, enemyById, candidate)) continue;
    nextActor = candidate;
    break;
  }
  if (!nextActor) return { ...state, initiative: null };
  // A removed first actor can make the shortened list wrap without ending the
  // original round. Count a new round only across the original turn boundary.
  const nextOriginalIndex = orderBeforeLeash.findIndex((actor) => (
    actor.kind === nextActor.kind && actor.id === nextActor.id
  ));
  const wrapped = nextOriginalIndex <= cursorBeforeLeash;

  const nextCursor = livingOrder.findIndex((actor) => (
    actor.kind === nextActor.kind && actor.id === nextActor.id
  ));
  return {
    ...state,
    initiative: {
      ...state.initiative,
      order: livingOrder,
      cursor: Math.max(0, nextCursor),
      round: nonNegativeInteger(state.initiative.round, 1) + (wrapped ? 1 : 0),
    },
  };
}
