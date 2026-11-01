import { chroniclesApplyContentEffects, chroniclesGoldBalance, CHRONICLES_GOLD_ITEM_ID } from './chroniclesContentRuntime.js';
import { chroniclesMapForState } from './chroniclesMapCatalog.js';

// Authoritative, repeatable temple transactions. They operate on the same
// expedition currency and party as every other MM3 interaction.
export const CHRONICLES_TEMPLE_BLESSING = Object.freeze({ armorClass: 2, duration: 12 });
const TEMPLE_COSTS = Object.freeze({ heal: 5, revive: 10, purify: 6, donate: 8 });
const REMOVABLE_AILMENTS = new Set(['disease', 'poison']);

export function chroniclesTempleWithinReach(state) {
  if (!state || state.phase !== 'explore' || state.initiative
    || state.combatRules !== 'mm3' || state.mapId !== 'swordhaven-first-book') return false;
  const map = chroniclesMapForState(state);
  const door = map?.interactables?.find((entry) => entry.id === 'first-book-temple');
  if (!door) return false;
  if (state.x === door.x && state.y === door.y) return true;
  const facing = [[0, -1], [1, 0], [0, 1], [-1, 0]][state.direction];
  return Boolean(facing && state.x + facing[0] === door.x && state.y + facing[1] === door.y
    && map.grid?.[door.y]?.[door.x] !== '#');
}

export function chroniclesTempleBlessingRemaining(state) {
  const boon = state?.templeBlessing;
  if (boon?.source !== 'swordhaven-temple' || !Number.isSafeInteger(boon.expiresAtTurn)
    || !Number.isSafeInteger(state?.turns) || boon.expiresAtTurn <= state.turns) return 0;
  return Math.min(CHRONICLES_TEMPLE_BLESSING.duration, boon.expiresAtTurn - state.turns);
}

export function chroniclesTempleBlessingArmor(state) {
  return state?.combatRules === 'mm3' && chroniclesTempleBlessingRemaining(state) > 0
    ? CHRONICLES_TEMPLE_BLESSING.armorClass : 0;
}

function templeNeed(state, id) {
  const party = Array.isArray(state?.party) ? state.party : [];
  if (id === 'heal') return party.some((member) => member.hp > 0 && member.hp < member.maxHp);
  if (id === 'revive') return party.some((member) => member.hp <= 0);
  if (id === 'purify') return party.some((member) => Array.isArray(member.ailments)
    && member.ailments.some((ailment) => REMOVABLE_AILMENTS.has(ailment)));
  if (id === 'donate') return chroniclesTempleBlessingRemaining(state) === 0;
  return false;
}

export function chroniclesTempleServiceChoices(state) {
  if (!chroniclesTempleWithinReach(state)) return [];
  const gold = chroniclesGoldBalance(state);
  return [
    ['heal', 'Curar heridas · +20 PV a los vivos', 'Nadie necesita curación.'],
    ['revive', 'Resucitar y sanar a los caídos', 'No hay miembros caídos.'],
    ['purify', 'Purificar enfermedad o veneno', 'No hay dolencias tratables.'],
    ['donate', 'Donar por bendición · +2 CA, 12 acciones', 'La bendición sigue activa.'],
  ].map(([id, text, unnecessary]) => {
    const cost = TEMPLE_COSTS[id];
    const need = templeNeed(state, id);
    return {
      id: 'temple-' + id, kind: 'temple-service', serviceId: id,
      label: text + ' · ' + cost + ' oro',
      disabled: !need || gold < cost,
      reason: !need ? unnecessary : gold < cost ? 'Oro insuficiente.' : '',
    };
  });
}

export function chroniclesApplyTempleService(state, serviceId) {
  if (!chroniclesTempleWithinReach(state) || !Object.hasOwn(TEMPLE_COSTS, serviceId)
    || !templeNeed(state, serviceId) || !Number.isSafeInteger(state.turns)
    || state.turns < 0) return state;
  const cost = TEMPLE_COSTS[serviceId];
  const gold = chroniclesGoldBalance(state);
  if (gold < cost) return state;
  const oldCoin = state.inventory?.[CHRONICLES_GOLD_ITEM_ID];
  const inventory = { ...state.inventory };
  if (gold === cost) delete inventory[CHRONICLES_GOLD_ITEM_ID];
  else inventory[CHRONICLES_GOLD_ITEM_ID] = { ...oldCoin, quantity: gold - cost };
  const paid = { ...state, inventory, turns: state.turns + 1 };
  if (serviceId === 'heal') {
    return { ...chroniclesApplyContentEffects(paid, [{ type: 'heal-party', amount: 20 }]),
      message: 'Ilse cura las heridas de los vivos. El altar recibe 5 monedas.' };
  }
  if (serviceId === 'revive') {
    return { ...chroniclesApplyContentEffects(paid, [
      { type: 'revive-party' }, { type: 'heal-party', amount: 20 },
    ]), message: 'Ilse devuelve el aliento a los caídos y sana a la compañía. El altar recibe 10 monedas.' };
  }
  if (serviceId === 'purify') {
    return { ...paid, party: paid.party.map((member) => ({
      ...member,
      ...(Array.isArray(member.ailments) ? {
        ailments: member.ailments.filter((name) => !REMOVABLE_AILMENTS.has(name)),
      } : {}),
    })), message: 'Ilse purifica la enfermedad y el veneno de la compañía. El altar recibe 6 monedas.' };
  }
  return { ...paid,
    templeBlessing: { source: 'swordhaven-temple',
      expiresAtTurn: paid.turns + CHRONICLES_TEMPLE_BLESSING.duration },
    message: 'Ilse bendice a la compañía: +2 CA durante las próximas 12 acciones. Gracias por tu donación de 8 monedas.',
  };
}
