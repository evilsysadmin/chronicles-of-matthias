// MM3 resting away from the inns: the company camps wherever it stands,
// outside the towns and out of a fight. Each hero on their feet eats one
// ration; a quiet night gives back half of everyone's life and spell
// points. Creatures nearby may not let them sleep: an ambush breaks the
// camp (the rations are gone) and starts the fight next to the bedrolls.
import { chroniclesActiveEnemies, CHRONICLES_DIRECTIONS } from '../chroniclesOfMatthias.js';
import { chroniclesEnemyCanOccupy, chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import { chroniclesEngagedEnemies, chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import { chroniclesMemberMaxSp, chroniclesMemberSp } from './chroniclesMagic.js';
import { chroniclesMapForState } from './chroniclesMapCatalog.js';
import { chroniclesMM3Roll } from './chroniclesMM3Rules.js';
import { CHRONICLES_RATION_ITEM_ID, chroniclesRations } from './chroniclesTavern.js';

// A creature this close hears the camp; each one rolls a d20 and comes on
// a roll at or under AMBUSH_ON (5 of 20 = 25%).
export const CHRONICLES_CAMP_HEARING = 8;
const AMBUSH_ON = 5;

function standing(state) {
  return (state?.party || []).filter((member) => member.hp > 0);
}

function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// Whether the company can camp here, and why not.
export function chroniclesCampStatus(state) {
  const map = chroniclesMapForState(state);
  const heroes = standing(state).length;
  if (!state || state.phase !== 'explore' || state.initiative) return { ok: false, reason: 'No se acampa en mitad de un combate.' };
  if (map?.regionKind === 'settlement') return { ok: false, reason: 'En el pueblo se duerme en la taberna.' };
  if (state.shop || state.guild || state.tavern) return { ok: false, reason: 'Aquí no se puede montar el campamento.' };
  if (chroniclesEngagedEnemies(state, chroniclesActiveEnemies(state)).length) {
    return { ok: false, reason: 'Hay enemigos encima: nadie va a cerrar los ojos.' };
  }
  const rations = chroniclesRations(state);
  if (rations < heroes) {
    return { ok: false, reason: `Hacen falta ${heroes} raciones (una por héroe en pie) y lleváis ${rations}. Se compran en las tabernas.` };
  }
  return { ok: true, rations: heroes };
}

function nearbyAmbusher(state) {
  const party = { x: state.x, y: state.y };
  return chroniclesActiveEnemies(state)
    .filter((enemy) => Number(state[enemy.hpKey] || 0) > 0)
    .map((enemy) => ({ enemy, at: distance(chroniclesRuntimeEnemyPosition(state, enemy), party) }))
    .filter(({ at }) => at <= CHRONICLES_CAMP_HEARING)
    .sort((a, b) => a.at - b.at)
    .find(({ enemy }) => chroniclesMM3Roll(state, 'camp-ambush', enemy.id) <= AMBUSH_ON)?.enemy || null;
}

function freeCellBeside(state, enemy) {
  return CHRONICLES_DIRECTIONS
    .map((step) => ({ x: state.x + step.dx, y: state.y + step.dy }))
    .find((cell) => chroniclesEnemyCanOccupy(state, enemy, cell)) || null;
}

export function chroniclesCamp(state) {
  const status = chroniclesCampStatus(state);
  if (!status.ok) return { ...state, message: status.reason };
  const fed = chroniclesApplyContentEffects(state, [{ type: 'consume-item', itemId: CHRONICLES_RATION_ITEM_ID, quantity: status.rations }]);
  if (fed === state) return state;
  const camped = { ...fed, turns: (state.turns || 0) + 1 };

  const ambusher = nearbyAmbusher(camped);
  const cell = ambusher ? freeCellBeside(camped, ambusher) : null;
  if (ambusher && cell) {
    const placed = { ...camped, enemyPositions: { ...camped.enemyPositions, [ambusher.id]: cell } };
    const fight = chroniclesStartInitiativeCombat(placed, chroniclesActiveEnemies(placed), { forceEnemyIds: [ambusher.id] });
    return {
      ...fight,
      message: `¡Emboscada! ${ambusher.name[0].toUpperCase()}${ambusher.name.slice(1)} cae sobre el campamento antes del primer sueño. Las raciones ya estaban en la panza.`,
    };
  }

  const party = camped.party.map((member) => (member.hp > 0
    ? { ...member, hp: Math.min(member.maxHp, member.hp + Math.ceil(member.maxHp / 2)) }
    : member));
  const spellPoints = { ...camped.spellPoints };
  for (const member of camped.party.filter((hero) => hero.hp > 0)) {
    const max = chroniclesMemberMaxSp(camped, member);
    if (max > 0) spellPoints[member.id] = Math.min(max, chroniclesMemberSp(camped, member) + Math.ceil(max / 2));
  }
  return {
    ...camped,
    party,
    spellPoints,
    message: `La compañía acampa y come (${status.rations} ${status.rations === 1 ? 'ración' : 'raciones'}). Una noche tranquila: recuperan la mitad de la vida y de los puntos de hechizo.`,
  };
}
