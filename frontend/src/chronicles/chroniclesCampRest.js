// One press of R is one atomic eight-hour camp attempt. Rations are paid once;
// a nearby living patrol can interrupt the night without healing the party.
// No new monsters, real-world timers or free revivals are generated here.
import {
  chroniclesEnemyCanAttackParty, chroniclesEnemyHasSightline, chroniclesRuntimeEnemyPosition,
} from '../chroniclesOfMatthiasTurns.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import { chroniclesWorldMinutes } from './chroniclesWorldTime.js';

export const CHRONICLES_CAMP_RATION_ID = 'road-rations';

// Match the initiative roster: old saves may contain numeric HP strings,
// but booleans, arrays, objects and non-finite values are not living actors.
function hasLivingHitPoints(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return false;
  if (typeof value === 'string' && !value.trim()) return false;
  const hp = Number(value);
  return Number.isFinite(hp) && hp > 0;
}

function rationCount(state) {
  const value = state?.inventory?.[CHRONICLES_CAMP_RATION_ID]?.quantity;
  // Old checkpoints can contain numeric-string quantities, just like HP.
  // Never coerce booleans, arrays, objects or whitespace into usable food.
  if (typeof value !== 'number' && typeof value !== 'string') return 0;
  if (typeof value === 'string' && !value.trim()) return 0;
  const quantity = Number(value);
  return Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 9999 ? quantity : 0;
}

export function chroniclesCampRestStatus(state, enemies = []) {
  const living = (Array.isArray(state?.party) ? state.party : [])
    .filter((member) => hasLivingHitPoints(member?.hp));
  const rationsNeeded = living.length;
  const rationsAvailable = rationCount(state);
  const blocked = (reason) => ({ canRest: false, rationsNeeded, rationsAvailable, reason });
  if (state?.combatRules !== 'mm3' || state?.phase !== 'explore' || state?.initiative) {
    return blocked('Solo puedes acampar explorando, fuera de la iniciativa.');
  }
  if (state.shop || state.guild || state.inn) {
    return blocked('Sal del establecimiento antes de acampar.');
  }
  if (!rationsNeeded) return blocked('No queda nadie en pie para preparar el campamento.');
  // Two cardinal steps are always unsafe, even through a wall. Beyond that,
  // an archer with a clear shot can still attack the camp from its real reach.
  let closeThreat = false;
  let rangedThreat = false;
  for (const enemy of (Array.isArray(enemies) ? enemies : [])) {
    if (!hasLivingHitPoints(state?.[enemy?.hpKey])) continue;
    const position = chroniclesRuntimeEnemyPosition(state, enemy);
    if (!position) continue;
    if (Math.abs(position.x - state.x) + Math.abs(position.y - state.y) <= 2) {
      closeThreat = true;
      break;
    }
    if (chroniclesEnemyCanAttackParty(state, enemy, position)) rangedThreat = true;
  }
  if (closeThreat) return blocked('Hay enemigos demasiado cerca para descansar.');
  if (rangedThreat) return blocked('Hay enemigos que pueden atacar el campamento a distancia.');
  if (rationsAvailable < rationsNeeded) {
    return blocked(`Necesitas ${rationsNeeded} raciones y llevas ${rationsAvailable}.`);
  }
  // Sleeping is also how the party passes the night, not just a heal button.
  return { canRest: true, rationsNeeded, rationsAvailable, reason: '' };
}

// The seed is the persisted expedition identity, not Math.random() or the wall
// clock. Identical checkpoint + action yields the same interruption, even on F5.
function campRoll(state, salt) {
  const key = `${state.runSeed}:${state.mapId}:${state.x}:${state.y}:${state.turns}:${chroniclesWorldMinutes(state.worldMinutes)}:${salt}`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

// Only monsters still alive on this very map may raid a camp. They must be
// close enough to have wandered over during the night and have an unobstructed
// route of sight. Cleared areas never respawn enemies through the rest action.
export function chroniclesCampAmbush(state, enemies = [], map = null) {
  if (!state?.runSeed || typeof state.runSeed !== 'string') return null;
  const nearby = (Array.isArray(enemies) ? enemies : []).filter((enemy) => {
    if (!hasLivingHitPoints(state[enemy?.hpKey])) return false;
    const position = chroniclesRuntimeEnemyPosition(state, enemy);
    if (!position) return false;
    const distance = Math.abs(position.x - state.x) + Math.abs(position.y - state.y);
    return distance > 2 && distance <= 6
      && chroniclesEnemyHasSightline(state, position, { x: state.x, y: state.y });
  });
  if (!nearby.length) return null;
  const chance = map?.regionKind === 'settlement' ? 0.08
    : map?.regionKind === 'wilderness' || map?.regionKind === 'outdoor' ? 0.32 : 0.24;
  if (campRoll(state, 'ambush') >= chance) return null;
  const enemy = nearby[Math.floor(campRoll(state, 'enemy') * nearby.length)];
  const elapsedHours = 1 + Math.floor(campRoll(state, 'hour') * 7);
  const living = state.party.filter((member) => hasLivingHitPoints(member.hp));
  // At least one sleeper, but leave an awake companion when possible. An
  // ambushed sleeper misses precisely their first initiative action.
  const asleepCount = living.length === 1 ? 1
    : 1 + Math.floor(campRoll(state, 'count') * Math.min(2, living.length - 1));
  const asleepIds = living.slice().sort((a, b) => (
    campRoll(state, `sleeper:${a.id}`) - campRoll(state, `sleeper:${b.id}`)
  )).slice(0, asleepCount).map((member) => member.id);
  return { enemyId: enemy.id, elapsedHours, asleepIds };
}

export function chroniclesCampRest(state, enemies = [], map = null) {
  const status = chroniclesCampRestStatus(state, enemies);
  if (!status.canRest) return state;
  const inventory = { ...state.inventory };
  const remaining = status.rationsAvailable - status.rationsNeeded;
  if (remaining) {
    inventory[CHRONICLES_CAMP_RATION_ID] = {
      ...inventory[CHRONICLES_CAMP_RATION_ID], quantity: remaining,
    };
  } else {
    delete inventory[CHRONICLES_CAMP_RATION_ID];
  }
  const spent = { ...state, inventory, turns: state.turns + 1 };
  const ambush = chroniclesCampAmbush(state, enemies, map);
  if (ambush) {
    // The world clock receives only the hours actually slept. The ordinary
    // successful rest still gets its full eight hours in the world-time layer.
    const interrupted = {
      ...spent,
      worldMinutes: Math.min(Number.MAX_SAFE_INTEGER,
        chroniclesWorldMinutes(state.worldMinutes) + ambush.elapsedHours * 60),
    };
    let rollIndex = 0;
    const started = chroniclesStartInitiativeCombat(interrupted, enemies, {
      forceEnemyIds: [ambush.enemyId],
      random: () => campRoll(state, `initiative:${rollIndex++}`),
    });
    if (started !== interrupted && started.initiative) {
      const sleepers = new Set(ambush.asleepIds);
      return {
        ...started,
        initiative: {
          ...started.initiative,
          order: started.initiative.order.map((actor) => (
            actor.kind === 'party' && sleepers.has(actor.id) ? { ...actor, asleep: true } : actor
          )),
        },
        message: `¡Emboscada! Tras ${ambush.elapsedHours} horas de sueño, los enemigos atacan. Algunos héroes siguen dormidos.`,
      };
    }
  }
  const spellPoints = { ...(state.spellPoints || {}) };
  const party = state.party.map((member) => {
    if (!hasLivingHitPoints(member.hp)) return member;
    delete spellPoints[member.id]; // Missing means full PH; preserve fallen heroes' ledger.
    return { ...member, hp: member.maxHp };
  });
  return {
    ...spent, party, spellPoints,
    message: '8 hours passed - the party rested',
  };
}
