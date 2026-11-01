// A field rest is one explicit expedition action, not an autosave or a free
// healing item. One road ration feeds each living hero for this rest; fallen
// companions neither eat nor revive. No real-world hour/day conversion is
// implied by the single exploration turn.
import { chroniclesMemberMaxSp, chroniclesMemberSp } from './chroniclesMagic.js';
import { chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';

export const CHRONICLES_CAMP_RATION_ID = 'road-rations';

function rationCount(state) {
  const value = state?.inventory?.[CHRONICLES_CAMP_RATION_ID]?.quantity;
  return Number.isSafeInteger(value) && value > 0 && value <= 9999 ? value : 0;
}

export function chroniclesCampRestStatus(state, enemies = []) {
  const living = (Array.isArray(state?.party) ? state.party : [])
    .filter((member) => Number.isFinite(member?.hp) && member.hp > 0);
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
  // Conservative safety radius: no resting while a living creature is within
  // two cardinal steps, even if a wall currently blocks its attack.
  const threatened = (Array.isArray(enemies) ? enemies : []).some((enemy) => {
    if (!(Number(state?.[enemy?.hpKey]) > 0)) return false;
    const position = chroniclesRuntimeEnemyPosition(state, enemy);
    return position && Math.abs(position.x - state.x) + Math.abs(position.y - state.y) <= 2;
  });
  if (threatened) return blocked('Hay enemigos demasiado cerca para descansar.');
  if (rationsAvailable < rationsNeeded) {
    return blocked(`Necesitas ${rationsNeeded} raciones y llevas ${rationsAvailable}.`);
  }
  const needsRest = living.some((member) => member.hp < member.maxHp
    || chroniclesMemberSp(state, member) < chroniclesMemberMaxSp(state, member));
  if (!needsRest) return blocked('La compañía ya tiene todos sus PV y PH.');
  return { canRest: true, rationsNeeded, rationsAvailable, reason: '' };
}

export function chroniclesCampRest(state, enemies = []) {
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
  const spellPoints = { ...(state.spellPoints || {}) };
  const party = state.party.map((member) => {
    if (!(Number.isFinite(member.hp) && member.hp > 0)) return member;
    delete spellPoints[member.id]; // Missing means full PH; preserve fallen heroes' ledger.
    return { ...member, hp: member.maxHp };
  });
  return {
    ...state, inventory, party, spellPoints,
    turns: state.turns + 1,
    message: `La compañía descansa a salvo. Consume ${status.rationsNeeded} raciones; los héroes en pie recuperan PV y PH.`,
  };
}
