import {
  DEFAULT_CHRONICLES_MAP_ID,
  chroniclesMapById,
  chroniclesMapForState,
  chroniclesMapContentPosition,
  chroniclesMapInitialEnemyState,
  chroniclesMapTileAt,
  chroniclesRuntimeEntryMapId,
} from './chronicles/chroniclesMapCatalog.js';
import { settlementHouseBlocks, settlementHouseFacing } from './chronicles/chroniclesSettlementLayout.js';
import { chroniclesAdminReduce } from './chronicles/chroniclesAdmin.js';
import {
  chroniclesApplyContentAction,
  chroniclesApplyContentEffects,
  chroniclesContentDefinition,
  chroniclesContentInteractions,
  chroniclesContentVisible,
  chroniclesQuestEntries,
  chroniclesRequirementFailure,
  chroniclesRequirementMet,
  chroniclesRequirementsMet,
  chroniclesToName,
} from './chronicles/chroniclesContentRuntime.js';
import { resolveChroniclesCharacterParty } from './chronicles/chroniclesCharacterBuilds.js';
import { chroniclesEquipItem, chroniclesUnequipItem, chroniclesEquipmentBonuses, chroniclesEquippedItem } from './chronicles/chroniclesEquipment.js';
import {
  chroniclesCloseShop, chroniclesOpenShop, chroniclesShopBuy, chroniclesShopSell,
} from './chronicles/chroniclesShops.js';
import {
  chroniclesCloseGuild, chroniclesGuildJoin, chroniclesGuildLearn, chroniclesOpenGuild,
} from './chronicles/chroniclesGuild.js';
import {
  CHRONICLES_ELEMENT_LABELS,
  CHRONICLES_SPELLS,
  chroniclesDetectMagicMessage,
  chroniclesMemberKnowsSpell,
  chroniclesMemberSp,
  chroniclesMemberMaxSp,
  chroniclesMostWoundedAlly,
  chroniclesParalysisTurns,
  chroniclesSpellDamage,
  chroniclesSpendSp,
} from './chronicles/chroniclesMagic.js';
import {
  CHRONICLES_CONSUMABLES,
  chroniclesConsumableCount,
  chroniclesConsumableTarget,
} from './chronicles/chroniclesConsumables.js';
import {
  chroniclesMM3AttackHits,
  chroniclesMM3EnemyArmorClass,
  chroniclesMM3EnemyToHit,
  chroniclesMM3Roll,
} from './chronicles/chroniclesMM3Rules.js';
import { chroniclesAdvanceLostKingIntro } from './chronicles/chroniclesLostKingIntro.js';
import { chroniclesArriveOnTransition } from './chronicles/chroniclesArrival.js';
import { CHRONICLES_SWORDHAVEN_RETURN_PORTAL_ID, chroniclesSwordhavenReturnAvailable } from './chronicles/chroniclesSwordhavenReturnPortal.js';
import { chroniclesIsOverworldTravelExit } from './chronicles/chroniclesWorldReturnLinks.js';
import { chroniclesDeployPartyForCombat } from './chroniclesPartyFootprint.js';

const DEFAULT_MAP = chroniclesMapById(DEFAULT_CHRONICLES_MAP_ID);

export const CHRONICLES_MAP = DEFAULT_MAP.grid;

export const CHRONICLES_DIRECTIONS = Object.freeze([
  Object.freeze({ key: 'north', dx: 0, dy: -1, label: 'N' }),
  Object.freeze({ key: 'east', dx: 1, dy: 0, label: 'E' }),
  Object.freeze({ key: 'south', dx: 0, dy: 1, label: 'S' }),
  Object.freeze({ key: 'west', dx: -1, dy: 0, label: 'O' }),
]);

export const CHRONICLES_PARTY = Object.freeze([
  Object.freeze({ id: 'matthias', name: 'Matthias', role: 'Peón cronista', glyph: '♟', maxHp: 7, agility: 4, row: 'front', lane: 'left', attackName: 'Estocada', damage: 1, reach: 1 }),
  Object.freeze({ id: 'rook', name: 'Hildegard', role: 'Torre guardiana', glyph: '♜', maxHp: 10, agility: 2, row: 'front', lane: 'right', attackName: 'Embestida', damage: 2, reach: 1 }),
  Object.freeze({ id: 'bishop', name: 'Aziz', role: 'Alfil del farol', glyph: '♝', maxHp: 6, agility: 3, row: 'back', lane: 'left', attackName: 'Rayo diagonal', damage: 1, reach: 2 }),
  Object.freeze({ id: 'knight', name: 'Faust', role: 'Caballo logístico', glyph: '♞', maxHp: 8, agility: 5, row: 'back', lane: 'right', attackName: 'Salto brutal', damage: 1, reach: 2 }),
]);

export const CHRONICLES_ENEMIES = DEFAULT_MAP.enemies;

const INITIAL_JOURNAL = DEFAULT_MAP.initialJournal;

const FIRST_PERSON_ADJACENT_INTERACTION_KINDS = new Set([
  'lever',
  'button',
  'lore',
  'merchant',
  'service',
  'quest',
  'relic-socket',
  'secret-door',
]);

function enemiesFor(state) {
  return chroniclesMapForState(state).enemies;
}

function partyState(characterBuild = null, rules = null) {
  return resolveChroniclesCharacterParty(CHRONICLES_PARTY, characterBuild, { rules })
    .map((member) => ({
      ...member,
      hp: member.maxHp,
      ...(rules === 'mm3' ? {
        role: member.mm3?.classLabel || member.role,
        attackName: 'Golpe desarmado',
      } : {}),
    }));
}

function appendJournal(state, entry) {
  const journal = Array.isArray(state.journal) ? state.journal : [chroniclesMapForState(state).initialJournal];
  if (journal.some((item) => item.id === entry.id)) return state;
  return { ...state, journal: [...journal, entry] };
}

export function chroniclesJournalEntries(state) {
  const initialJournal = chroniclesMapForState(state).initialJournal || INITIAL_JOURNAL;
  return Array.isArray(state?.journal) && state.journal.length ? state.journal : [initialJournal];
}

// `rules: 'mm3'` turns on the first-person MM3 sheet and combat (class HP,
// Might damage, to-hit vs AC, Speed, Luck). Tactics keeps its own profiles.
export function createChroniclesState(mapId = null, characterBuild = null, { rules = null } = {}) {
  const buildOnly = mapId && typeof mapId === 'object' && !Array.isArray(mapId);
  const requestedMapId = buildOnly ? null : mapId;
  const requestedBuild = buildOnly ? mapId : characterBuild;
  const map = chroniclesMapById(requestedMapId || chroniclesRuntimeEntryMapId());
  return {
    mapId: map.id,
    x: map.partyStart.x,
    y: map.partyStart.y,
    direction: map.partyStart.direction,
    ...chroniclesMapInitialEnemyState(map.id),
    ...map.initialFlags,
    phase: 'explore',
    party: partyState(requestedBuild, rules),
    ...(rules === 'mm3' ? { combatRules: 'mm3' } : {}),
    turns: 0,
    journal: [map.initialJournal],
    message: map.introMessage,
  };
}

export function chroniclesTileAt(x, y, stateOrMapId = null) {
  const map = typeof stateOrMapId === 'string'
    ? chroniclesMapById(stateOrMapId)
    : stateOrMapId
      ? chroniclesMapForState(stateOrMapId)
      : DEFAULT_MAP;
  return chroniclesMapTileAt(map, x, y);
}

export function chroniclesEnemyIsActive(state, enemy) {
  if (Array.isArray(enemy.activationWhen)) return chroniclesRequirementsMet(state, enemy.activationWhen);
  return (enemy.activation || 'always') === 'always';
}

function enemyAlive(state, enemy) {
  return chroniclesEnemyIsActive(state, enemy) && Number(state[enemy.hpKey] || 0) > 0;
}

export function chroniclesEnemyAlive(state) {
  return enemiesFor(state).some((enemy) => enemyAlive(state, enemy));
}

export function chroniclesActiveEnemies(state) {
  return enemiesFor(state).filter((enemy) => enemyAlive(state, enemy));
}

export function chroniclesEnemyPosition(state, enemy) {
  const runtime = state?.enemyPositions?.[enemy.id];
  if (runtime && Number.isFinite(runtime.x) && Number.isFinite(runtime.y)) return runtime;
  const keyed = enemy.positionKey && enemy.positions ? enemy.positions[state?.[enemy.positionKey]] : null;
  return keyed || { x: enemy.x, y: enemy.y };
}

function chroniclesEnemyAt(state, x, y) {
  return enemiesFor(state).find((enemy) => {
    if (!enemyAlive(state, enemy)) return false;
    const position = chroniclesEnemyPosition(state, enemy);
    return position.x === x && position.y === y;
  }) || null;
}

export function chroniclesFrontCell(state) {
  const direction = CHRONICLES_DIRECTIONS[state.direction];
  return { x: state.x + direction.dx, y: state.y + direction.dy };
}

export function chroniclesEnemyTargetAhead(state, maxReach = 2) {
  const direction = CHRONICLES_DIRECTIONS[state.direction];
  for (let distance = 1; distance <= maxReach; distance += 1) {
    const x = state.x + direction.dx * distance;
    const y = state.y + direction.dy * distance;
    if (chroniclesTileAt(x, y, state) === '#') return null;
    const enemy = chroniclesEnemyAt(state, x, y);
    if (enemy) return { enemy, distance };
  }
  return null;
}

export function chroniclesEnemyDistanceAhead(state, maxReach = 2) {
  return chroniclesEnemyTargetAhead(state, maxReach)?.distance ?? null;
}

function withMessage(state, message) {
  return { ...state, message, turns: state.turns + 1 };
}

function contentEntryAt(state, group, x, y) {
  const map = chroniclesMapForState(state);
  return (map?.[group] || []).find((entry) => {
    const position = chroniclesMapContentPosition(map, entry);
    return position?.x === x && position?.y === y;
  }) || null;
}

function explorationAction(entry, effects = entry?.action?.effects || []) {
  return {
    effects,
    message: entry?.explorationMessage,
    journal: entry?.explorationJournal,
  };
}

function enterTile(state, x, y) {
  let next = { ...state, x, y, turns: state.turns + 1 };
  const trigger = contentEntryAt(state, 'triggers', x, y);
  if (trigger && chroniclesRequirementsMet(state, trigger.when)) {
    next = chroniclesApplyContentAction(next, explorationAction(trigger), { appendJournal });
  }

  const exit = contentEntryAt(state, 'exits', x, y);
  if (exit && chroniclesRequirementsMet(state, exit.requirements)) {
    const currentMap = chroniclesMapForState(state);
    // Authored settlement gates genuinely enter the next region. Keep the
    // historical dungeon-end contract untouched, so legacy runs/checkpoints
    // do not suddenly switch map or terminal behaviour.
    const route = chroniclesIsOverworldTravelExit(currentMap, exit);
    next = chroniclesApplyContentAction(
      next,
      route ? exit.action : explorationAction(exit, [{ type: 'set', key: 'phase', value: 'escaped' }]),
      { appendJournal },
    );
  }
  return next;
}


export function chroniclesContextualContentAction(state) {
  if (!state || state.phase === 'escaped' || state.phase === 'defeated') return null;
  if (chroniclesSwordhavenReturnAvailable(state)) {
    return { id: CHRONICLES_SWORDHAVEN_RETURN_PORTAL_ID, kind: 'exit', label: 'Regresar a Swordhaven' };
  }
  const map = chroniclesMapForState(state);
  let interaction = chroniclesContentInteractions(
    state,
    map,
    (x, y) => chroniclesTileAt(x, y, state),
  ).find((entry) => !['trigger', 'trap'].includes(entry.kind)
    && (entry.kind !== 'exit' || entry.requiresReturn === true));

  // In towns the street square outside a building is the authored entrance.
  // Facing its doorway must take priority over unrelated content underfoot,
  // such as Swordhaven's sealed letter directly opposite the weaponsmith.
  const front = chroniclesFrontCell(state);
  if (!explorationCellBlocker(state, front.x, front.y)) {
    const definition = (map?.interactables || []).find((entry) => {
      if (!FIRST_PERSON_ADJACENT_INTERACTION_KINDS.has(entry.kind)) return false;
      if (!chroniclesRequirementsMet(state, entry.when)) return false;
      const position = chroniclesMapContentPosition(map, entry);
      return position?.x === front.x && position?.y === front.y;
    });
    const here = chroniclesContentDefinition(map, interaction?.id);
    const facingBuilding = String(definition?.visualType || '').startsWith('building-');
    const standingAtBuilding = String(here?.visualType || '').startsWith('building-');
    if (definition && (!interaction || (facingBuilding && !standingAtBuilding && interaction.kind !== 'exit'))) {
      const locked = !chroniclesRequirementsMet(state, definition.requirements);
      interaction = {
        id: definition.id,
        kind: definition.kind,
        label: locked ? (definition.lockedLabel || definition.label) : definition.label,
        locked,
        x: front.x,
        y: front.y,
      };
    }
  }

  if (!interaction) return null;
  const definition = chroniclesContentDefinition(map, interaction.id);
  if (!definition?.action) return null;
  return {
    id: interaction.id,
    kind: interaction.kind,
    label: interaction.label || definition.label || 'Interactuar',
    locked: interaction.locked === true,
  };
}

function resolveContextualContentAction(state) {
  const contextual = chroniclesContextualContentAction(state);
  if (!contextual) return withMessage(state, 'No hay nada útil que manipular aquí. Matthias lo considera una decepción menor.');
  if (contextual.id === CHRONICLES_SWORDHAVEN_RETURN_PORTAL_ID) {
    const arrived = chroniclesApplyContentEffects(state, [{
      type: 'transition-map',
      mapId: 'swordhaven-square',
      entryExitId: 'swordhaven-south-gate',
    }]);
    return {
      ...arrived,
      turns: state.turns + 1,
      message: 'Las escaleras conducen de nuevo al portón de Swordhaven. Matthias exige una parada en la taberna.',
    };
  }
  const map = chroniclesMapForState(state);
  const definition = chroniclesContentDefinition(map, contextual.id);
  // A merchant with a stock list opens its counter instead of a scripted trade.
  if (definition?.shop && Array.isArray(definition.shop.stock)) return chroniclesOpenShop(state, definition);
  if (definition?.guild && Array.isArray(definition.guild.spells)) return chroniclesOpenGuild(state, definition);
  if (!definition?.action) return state;
  if (contextual.locked) {
    const blocked = chroniclesRequirementFailure(state, definition.requirements);
    return withMessage(state, blocked?.message || 'El paso sigue cerrado.');
  }
  const next = chroniclesApplyContentAction(state, definition.action, { appendJournal });
  return next === state ? state : { ...next, turns: state.turns + 1 };
}

function partyMember(state, memberId) {
  return state.party.find((member) => member.id === memberId) || null;
}

// `mode`: 'melee' (A · atacar, the melee weapon), 'missile' (S · disparar,
// the missile weapon) or 'auto' (the plain attack: melee stats, but the
// longest reach the hero has, so a target in bow range counts as in reach).
export function chroniclesPartyAttackStats(state, memberId, mode = 'auto') {
  const member = partyMember(state, memberId);
  if (!member) return { damage: 0, reach: 0 };
  if (mode === 'auto' && chroniclesUsesMM3Combat(state)) {
    const melee = chroniclesPartyAttackStats(state, memberId, 'melee');
    const missile = chroniclesPartyAttackStats(state, memberId, 'missile');
    return { ...melee, reach: Math.max(melee.reach, missile.reach) };
  }
  const modifiers = state?.rpgModifiers?.[memberId] || {};
  const creator = member.characterBuild?.creatorModifiers || {};
  const persistentDamageBonus = Math.max(
    0,
    Number(modifiers.attackDamageBonus || 0) - Number(creator.attackDamageBonus || 0),
  );
  const persistentReachBonus = Math.max(
    0,
    Number(modifiers.reachBonus || 0) - Number(creator.reachBonus || 0),
  );
  const shooting = mode === 'missile';
  const equipment = chroniclesEquipmentBonuses(state, memberId, { mode: shooting ? 'missile' : 'melee' });
  const weapon = chroniclesEquippedItem(state, memberId, shooting ? 'missile' : 'weapon');
  // Without a missile weapon there is nothing to shoot with.
  if (shooting && chroniclesUsesMM3Combat(state) && !weapon) return { damage: 0, reach: 0, toHit: 0 };
  return {
    damage: Math.max(0, Number(member.damage || 0) + persistentDamageBonus + equipment.attackDamageBonus),
    // MM3 is a weapon-based RPG: melee can strike adjacent enemies, bows
    // reach further. Tactics retains its chess-piece attack reach.
    reach: Math.max(1, Number(
      chroniclesUsesMM3Combat(state) ? (weapon?.reach || 1) : (member.reach || 1),
    ) + persistentReachBonus),
    // MM to-hit: level + Accuracy bonus + weapon (material) to-hit.
    toHit: Math.max(1, Number(modifiers.level || 1))
      + Number(member.mm3?.bonuses?.accuracy || 0)
      + equipment.toHitBonus,
  };
}

// MM armor class: Speed bonus + worn armor (type + material).
export function chroniclesPartyArmorClass(state, memberId) {
  const member = partyMember(state, memberId);
  if (!member) return 0;
  // Escudo de fe holds only while the fight it was cast in lasts.
  const ward = state?.initiative ? Math.max(0, Number(state.combatWard?.armorClass || 0)) : 0;
  return Math.max(0, Number(member.mm3?.bonuses?.speed || 0) + chroniclesEquipmentBonuses(state, memberId).armorClassBonus + ward);
}

export function chroniclesUsesMM3Combat(state) {
  return state?.combatRules === 'mm3';
}

// One enemy swing at one hero under MM rules: d20 + enemy to-hit vs 10 + AC.
// Armor no longer subtracts damage here; it makes the blow miss.
export function chroniclesMM3EnemySwing(state, enemy, targetId, salt = 'enemy') {
  const roll = chroniclesMM3Roll(state, salt, enemy.id, targetId);
  const hit = chroniclesMM3AttackHits(roll, chroniclesMM3EnemyToHit(enemy), chroniclesPartyArmorClass(state, targetId));
  return { roll, hit, damage: hit ? Math.max(1, Number(enemy.retaliation || 1)) : 0 };
}

function partyDefeated(state) {
  return state.party.length > 0 && state.party.every((member) => member.hp <= 0);
}

function markPartyDefeated(state) {
  if (!partyDefeated(state)) return state;
  return {
    ...state,
    phase: 'defeated',
    message: 'La compañía cae. La cripta, con notable falta de deportividad, permanece en pie.',
  };
}

function retaliationTargetId(state, attacker) {
  if (attacker.row === 'front' && attacker.hp > 0) return attacker.id;
  const matchingFront = state.party.find((member) => member.row === 'front' && member.lane === attacker.lane && member.hp > 0);
  if (matchingFront) return matchingFront.id;
  return state.party.find((member) => member.row === 'front' && member.hp > 0)?.id || attacker.id;
}

function renderCombatTemplate(template, attacker, enemy) {
  if (typeof template !== 'string' || !template) return '';
  const values = {
    attacker: attacker.name,
    attack: attacker.attackName.toLowerCase(),
    enemy: enemy.name,
  };
  return Object.entries(values).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(value),
    template,
  );
}

function defeatMessage(attacker, enemy) {
  const authored = renderCombatTemplate(enemy.onDefeat?.message, attacker, enemy);
  if (authored) return authored;
  return `${attacker.name} derrota ${chroniclesToName(enemy.name)} con ${attacker.attackName.toLowerCase()}. La expedición continúa.`;
}

function rangedHitMessage(attacker, enemy) {
  const authored = renderCombatTemplate(enemy.rangedHitMessage, attacker, enemy);
  if (authored) return authored;
  return `${attacker.name} alcanza ${chroniclesToName(enemy.name)} desde la retaguardia con ${attacker.attackName.toLowerCase()}. El objetivo queda demasiado lejos para devolver el golpe.`;
}

// Ordinary foes carry a few coins and, now and then, a potion. Named foes
// keep their authored rewards. The roll comes from the run seed, so a
// reload never changes what fell.
export function chroniclesCommonLoot(state, enemy) {
  if (!enemy || enemy.defeatedFlag || enemy.onDefeat?.effects?.length) return null;
  const roll = chroniclesMM3Roll(state, 'loot', enemy.id);
  const gold = Math.max(1, Math.round(Number(enemy.maxHp || 1) / 2)) + (roll % 4);
  const potion = roll >= 18;
  return { gold, potion };
}

function rewardForDefeat(state, enemy) {
  const rewarded = chroniclesApplyContentEffects(state, enemy.onDefeat?.effects);
  const loot = chroniclesCommonLoot(state, enemy);
  if (!loot) return rewarded;
  const effects = [{ type: 'grant-gold', amount: loot.gold }];
  if (loot.potion) {
    effects.push({ type: 'grant-item', itemId: 'healing-potion', name: 'Poción de curación', description: 'Cura 15 PV a un héroe.', quantity: 1 });
  }
  const looted = chroniclesApplyContentEffects(rewarded, effects);
  const found = loot.potion ? `${loot.gold} monedas y una poción de curación` : `${loot.gold} monedas`;
  return { ...looted, message: `${looted.message || ''} Lleva encima ${found}.`.trim() };
}

function journalForDefeat(state, attacker, enemy) {
  const authored = enemy.onDefeat?.journal;
  if (!authored) {
    return appendJournal(state, {
      id: `${enemy.id}-falls`,
      title: `${enemy.name[0].toUpperCase()}${enemy.name.slice(1)} cae`,
      body: `${attacker.name} firma la baja. La expedición continúa con una criatura menos y exactamente la misma mala idea de fondo.`,
      sigil: '†',
    });
  }
  return appendJournal(state, {
    ...authored,
    title: renderCombatTemplate(authored.title, attacker, enemy),
    body: renderCombatTemplate(authored.body, attacker, enemy),
  });
}

function evadeAfterHit(state, enemy) {
  if (!enemy.evadesOnHit || !enemy.positionKey || !enemy.positions) return state;
  const positionKeys = Object.keys(enemy.positions);
  if (positionKeys.length < 2) return state;
  const currentIndex = Math.max(0, positionKeys.indexOf(state[enemy.positionKey]));
  const nextPosition = positionKeys[(currentIndex + 1) % positionKeys.length];
  return {
    ...state,
    [enemy.positionKey]: nextPosition,
    message: `${state.message} ${enemy.name[0].toUpperCase()}${enemy.name.slice(1)} se escabulle hacia otra posición del mapa.`,
  };
}
// `spell` turns the swing into an offensive spell: its own reach and damage
// (after the target's elemental resistance), no to-hit roll, SP already paid.
// Outside initiative MM3 fires as one company: each living hero with a
// class-legal missile weapon contributes exactly one shot. Lock the target
// before resolving damage; arrows cannot retarget another foe mid-salvo.
export function chroniclesOpeningVolleyShooters(state) {
  if (!chroniclesUsesMM3Combat(state) || state?.initiative) return [];
  return (state?.party || []).filter((member) => (
    member.hp > 0 && Boolean(chroniclesEquippedItem(state, member.id, 'missile'))
  ));
}

export function chroniclesOpeningVolleyShots(state) {
  const shooters = chroniclesOpeningVolleyShooters(state);
  const armed = shooters.map((member) => ({
    member,
    stats: chroniclesPartyAttackStats(state, member.id, 'missile'),
  }));
  const maxReach = Math.max(0, ...armed.map(({ stats }) => stats.reach));
  const sighted = maxReach > 0 ? chroniclesEnemyTargetAhead(state, maxReach) : null;
  if (!sighted) return { target: null, shooters, shots: [], remainingHp: null };
  const { enemy } = sighted;
  let remainingHp = Math.max(0, Number(state[enemy.hpKey] || 0));
  const shots = armed.filter(({ stats }) => (
    chroniclesEnemyTargetAhead(state, stats.reach)?.enemy.id === enemy.id
  )).map(({ member, stats }) => {
    const roll = chroniclesMM3Roll(state, 'opening-volley', member.id, enemy.id);
    const hit = chroniclesMM3AttackHits(roll, stats.toHit, chroniclesMM3EnemyArmorClass(enemy));
    const damage = hit ? Math.min(remainingHp, stats.damage) : 0;
    remainingHp -= damage;
    return { memberId: member.id, name: member.name, roll, hit, damage };
  });
  return { target: enemy, shooters, shots, remainingHp };
}

function resolveOpeningVolley(state) {
  if (!chroniclesUsesMM3Combat(state) || state.initiative) return state;
  const { target, shooters, shots, remainingHp } = chroniclesOpeningVolleyShots(state);
  if (!shooters.length) {
    return withMessage(state, 'Salva imposible: nadie lleva un arma de proyectiles equipada que su clase pueda usar.');
  }
  if (!target || !shots.length) {
    // Firing into empty air costs a turn but is not a narrative event.
    // Visual missile FX and audio are selected separately by the UI.
    return withMessage(state, '');
  }
  const damage = shots.reduce((total, shot) => total + shot.damage, 0);
  const report = shots.map((shot) => `${shot.name}: ${shot.hit ? 'acierta' : 'falla'}`).join(' · ');
  const message = `Salva de ${shots.length} proyectil${shots.length === 1 ? '' : 'es'}: ${report}. ${target.name} recibe ${damage} de daño.`;
  const next = { ...state, [target.hpKey]: remainingHp, turns: state.turns + 1, message };
  if (remainingHp === 0 && Number(state[target.hpKey] || 0) > 0) {
    const rewarded = rewardForDefeat(next, target);
    return journalForDefeat(rewarded, { name: 'La compañía', attackName: 'salva de proyectiles' }, target);
  }
  return damage > 0 ? evadeAfterHit(next, target) : next;
}

// MM3's plain attack: melee when something is adjacent, otherwise shoot if
// the hero carries a missile weapon and the target is within its range.
export function chroniclesAttackMode(state, memberId) {
  if (!chroniclesUsesMM3Combat(state)) return 'melee';
  const melee = chroniclesPartyAttackStats(state, memberId, 'melee');
  if (chroniclesEnemyTargetAhead(state, melee.reach)) return 'melee';
  const missile = chroniclesPartyAttackStats(state, memberId, 'missile');
  return chroniclesEquippedItem(state, memberId, 'missile') && chroniclesEnemyTargetAhead(state, missile.reach) ? 'missile' : 'melee';
}

function resolveAttack(state, memberId, spell = null, requestedMode = 'auto') {
  const member = partyMember(state, memberId);
  if (!member) return state;
  if (member.hp <= 0) return withMessage(state, `${member.name} está fuera de combate. Incluso la épica tiene límites médicos.`);
  const mm3 = chroniclesUsesMM3Combat(state);
  const mode = spell || !mm3 ? 'melee' : requestedMode === 'auto' ? chroniclesAttackMode(state, member.id) : requestedMode;
  if (mode === 'missile' && !chroniclesEquippedItem(state, member.id, 'missile')) {
    return withMessage(state, `${member.name} no lleva arma de proyectiles. Un arco, una ballesta o una honda, en el hueco de proyectil.`);
  }
  const attacker = spell
    ? { ...member, attackName: spell.name }
    : mm3
      ? {
        ...member,
        attackName: mode === 'missile'
          ? chroniclesEquippedItem(state, member.id, 'missile').name
          : chroniclesEquippedItem(state, member.id, 'weapon')?.name || 'golpe desarmado',
      }
      : member;

  const weaponStats = chroniclesPartyAttackStats(state, attacker.id, mm3 ? mode : 'auto');
  const attackStats = spell ? { ...weaponStats, reach: spell.reach } : weaponStats;
  const target = chroniclesEnemyTargetAhead(state, attackStats.reach);
  if (!target) {
    if (mode === 'missile') return withMessage(state, `${attacker.name} tensa ${attacker.attackName.toLowerCase()}, pero no hay nada a tiro (alcance ${attackStats.reach}).`);
    return withMessage(state, `${attacker.name} ejecuta ${attacker.attackName.toLowerCase()} contra absolutamente nada. La nada resiste.`);
  }

  const { enemy, distance } = target;
  if (spell) {
    attackStats.damage = chroniclesSpellDamage(spell, enemy);
    state = chroniclesSpendSp(state, attacker.id, spell.cost);
  } else if (chroniclesUsesMM3Combat(state)) {
    const roll = chroniclesMM3Roll(state, 'party', attacker.id, enemy.id);
    if (!chroniclesMM3AttackHits(roll, attackStats.toHit, chroniclesMM3EnemyArmorClass(enemy))) {
      return {
        ...state,
        turns: state.turns + 1,
        message: `${attacker.name} lanza ${attacker.attackName.toLowerCase()} y falla. ${enemy.name[0].toUpperCase()}${enemy.name.slice(1)} esquiva (d20: ${roll}).`,
      };
    }
  }
  const nextHp = Math.max(0, Number(state[enemy.hpKey] || 0) - attackStats.damage);
  if (nextHp === 0) {
    const defeated = rewardForDefeat({ ...state, [enemy.hpKey]: 0, turns: state.turns + 1, message: defeatMessage(attacker, enemy) }, enemy);
    return journalForDefeat(defeated, attacker, enemy);
  }

  if (state.initiative) {
    return evadeAfterHit({
      ...state,
      [enemy.hpKey]: nextHp,
      turns: state.turns + 1,
      message: `${attacker.name} impacta con ${attacker.attackName.toLowerCase()}. ${enemy.name[0].toUpperCase()}${enemy.name.slice(1)} queda en ${nextHp}/${enemy.maxHp} HP.`,
    }, enemy);
  }

  const retaliationReach = Number(enemy.retaliationReach ?? enemy.ai?.attackReach ?? 1);
  if (distance > retaliationReach) {
    return evadeAfterHit({ ...state, [enemy.hpKey]: nextHp, turns: state.turns + 1, message: rangedHitMessage(attacker, enemy) }, enemy);
  }

  const targetId = retaliationTargetId(state, attacker);
  const previousTarget = state.party.find((member) => member.id === targetId);
  const swing = chroniclesUsesMM3Combat(state) && targetId
    ? chroniclesMM3EnemySwing(state, enemy, targetId, 'retaliation')
    : null;
  const retaliationDamage = (member) => (swing
    ? swing.damage
    : Math.max(0, enemy.retaliation - chroniclesEquipmentBonuses(state, member.id).damageReduction));
  const party = targetId
    ? state.party.map((member) => member.id === targetId
      ? { ...member, hp: Math.max(0, member.hp - retaliationDamage(member)) }
      : member)
    : state.party;
  const retaliationTarget = party.find((member) => member.id === targetId);
  let nextState = {
    ...state,
    [enemy.hpKey]: nextHp,
    party,
    turns: state.turns + 1,
    message: swing && !swing.hit
      ? `${attacker.name} impacta con ${attacker.attackName.toLowerCase()}. ${enemy.name[0].toUpperCase()}${enemy.name.slice(1)} responde, pero ${retaliationTarget?.name || 'su objetivo'} desvía el golpe.`
      : `${attacker.name} impacta con ${attacker.attackName.toLowerCase()}. ${enemy.name[0].toUpperCase()}${enemy.name.slice(1)} responde${retaliationTarget ? ` y alcanza a ${retaliationTarget.name}` : ''}.`,
  };
  if (previousTarget?.hp > 0 && retaliationTarget?.hp === 0) {
    nextState = appendJournal(nextState, {
      id: `down-${retaliationTarget.id}`,
      title: `${retaliationTarget.name} cae`,
      body: `${retaliationTarget.name} queda fuera de combate. Matthias deja un espacio en el margen para comentarios médicamente inapropiados.`,
      sigil: '†',
    });
  }
  return markPartyDefeated(evadeAfterHit(nextState, enemy));
}

// The other living enemies within `radius` cells (any direction) of the one
// an area spell bursts on.
function splashTargets(state, primary, radius) {
  const center = chroniclesEnemyPosition(state, primary);
  return chroniclesActiveEnemies(state).filter((enemy) => {
    if (enemy.id === primary.id) return false;
    const position = chroniclesEnemyPosition(state, enemy);
    return Math.max(Math.abs(position.x - center.x), Math.abs(position.y - center.y)) <= radius;
  });
}

function applySplash(state, caster, spell, enemies) {
  let next = state;
  const notes = [];
  enemies.forEach((enemy) => {
    if (!enemyAlive(next, enemy)) return;
    const hp = Math.max(0, Number(next[enemy.hpKey] || 0) - chroniclesSpellDamage(spell, enemy));
    const name = `${enemy.name[0].toUpperCase()}${enemy.name.slice(1)}`;
    next = { ...next, [enemy.hpKey]: hp };
    if (hp === 0) {
      next = journalForDefeat(rewardForDefeat(next, enemy), { ...caster, attackName: spell.name }, enemy);
      notes.push(`${name} cae`);
    } else {
      notes.push(`${name} ${hp}/${enemy.maxHp}`);
    }
  });
  return notes.length ? { ...next, message: `${next.message} La explosión alcanza: ${notes.join(', ')}.` } : next;
}

// A potion, the revive draught or a scroll from the shared pack. Using one is
// the user's action (a turn in combat); a refusal costs nothing.
function resolveUseItem(state, memberId, itemId, targetId = null) {
  const refuse = (message) => ({ ...state, message });
  const user = partyMember(state, memberId);
  const item = CHRONICLES_CONSUMABLES[itemId];
  if (!user || !item) return state;
  if (chroniclesConsumableCount(state, itemId) < 1) return refuse(`No queda ningún ${item.name.toLowerCase()} en la mochila.`);
  if (user.hp <= 0) return refuse(`${user.name} está fuera de combate y no puede usar objetos.`);
  const consume = (next) => chroniclesApplyContentEffects(next, [{ type: 'consume-item', itemId, quantity: 1 }]);
  if (item.kind === 'scroll') {
    const { spell } = item;
    const ahead = chroniclesEnemyTargetAhead(state, spell.reach);
    if (!ahead) return refuse(`${user.name} desenrolla ${item.name}, pero no hay ningún enemigo a ${spell.reach} casillas.`);
    const next = resolveAttack(state, memberId, spell);
    if (next === state) return state;
    return { ...consume(next), message: `${next.message} (${item.name}, ${CHRONICLES_ELEMENT_LABELS[spell.element]})` };
  }
  const target = chroniclesConsumableTarget(state, item, targetId);
  if (!target) {
    return refuse({
      heal: `${user.name} destapa ${item.name}, pero nadie de la compañía está herido.`,
      mana: `${user.name} mira ${item.name}: nadie necesita recuperar puntos de hechizo.`,
      revive: `${user.name} guarda ${item.name}: no hay nadie caído.`,
    }[item.kind] || `${item.name} no sirve de nada ahora.`);
  }
  const who = target.id === user.id ? `${user.name} bebe ${item.name}` : `${user.name} da ${item.name} a ${target.name}`;
  if (item.kind === 'heal') {
    const hp = Math.min(target.maxHp, target.hp + item.amount);
    return {
      ...consume(state),
      party: state.party.map((member) => (member.id === target.id ? { ...member, hp } : member)),
      turns: state.turns + 1,
      message: `${who}: ${target.hp} → ${hp} PV.`,
    };
  }
  if (item.kind === 'mana') {
    const before = chroniclesMemberSp(state, target);
    const sp = Math.min(chroniclesMemberMaxSp(state, target), before + item.amount);
    return {
      ...consume(state),
      spellPoints: { ...(state.spellPoints || {}), [target.id]: sp },
      turns: state.turns + 1,
      message: `${who}: ${before} → ${sp} PH.`,
    };
  }
  if (item.kind === 'revive') {
    const hp = Math.max(1, Math.ceil(target.maxHp * item.fraction));
    return {
      ...consume(state),
      party: state.party.map((member) => (member.id === target.id ? { ...member, hp } : member)),
      turns: state.turns + 1,
      message: `${user.name} vierte ${item.name} en los labios de ${target.name}, que vuelve en sí con ${hp} PV.`,
    };
  }
  return state;
}

function resolveCast(state, memberId, spellId) {
  // A refused cast costs no turn: MM3 simply tells you why.
  const refuse = (message) => ({ ...state, message });
  const caster = partyMember(state, memberId);
  const spell = CHRONICLES_SPELLS[spellId];
  if (!caster || !spell) return state;
  if (caster.hp <= 0) return refuse(`${caster.name} está fuera de combate y no puede conjurar.`);
  if (!chroniclesMemberKnowsSpell(state, caster, spellId)) return refuse(`${caster.name} no conoce ${spell.name}.`);
  if (chroniclesMemberSp(state, caster) < spell.cost) {
    return refuse(`${caster.name} no tiene puntos de hechizo para ${spell.name} (${spell.cost} PH). Descansa en una posada.`);
  }
  if (spell.kind === 'attack') {
    if (!chroniclesEnemyTargetAhead(state, spell.reach)) {
      return refuse(`${caster.name} prepara ${spell.name}, pero no hay ningún enemigo a ${spell.reach} casillas.`);
    }
    const splash = spell.area ? splashTargets(state, chroniclesEnemyTargetAhead(state, spell.reach).enemy, spell.area) : [];
    let next = resolveAttack(state, memberId, spell);
    if (next === state) return state;
    if (splash.length) next = applySplash(next, caster, spell, splash);
    const element = CHRONICLES_ELEMENT_LABELS[spell.element];
    return { ...next, message: `${next.message} (${spell.name}, ${element}: ${spell.cost} PH)` };
  }
  if (spell.kind === 'heal' && spell.everyone) {
    const wounded = state.party.filter((member) => member.hp > 0 && member.hp < member.maxHp);
    if (!wounded.length) return refuse(`${caster.name} repasa ${spell.name}, pero nadie de la compañía está herido.`);
    return {
      ...chroniclesSpendSp(state, caster.id, spell.cost),
      party: state.party.map((member) => (member.hp > 0
        ? { ...member, hp: Math.min(member.maxHp, member.hp + spell.amount) }
        : member)),
      turns: state.turns + 1,
      message: `${caster.name} conjura ${spell.name}: ${wounded.map((member) => member.name).join(', ')} recuperan hasta ${spell.amount} PV.`,
    };
  }
  if (spell.kind === 'paralyze') {
    const target = chroniclesEnemyTargetAhead(state, spell.reach);
    if (!target) return refuse(`${caster.name} prepara ${spell.name}, pero no hay ningún enemigo a ${spell.reach} casillas.`);
    const { enemy } = target;
    const turns = chroniclesParalysisTurns(spell, enemy);
    const name = `${enemy.name[0].toUpperCase()}${enemy.name.slice(1)}`;
    return {
      ...chroniclesSpendSp(state, caster.id, spell.cost),
      enemyStatus: { ...(state.enemyStatus || {}), [enemy.id]: { ...(state.enemyStatus?.[enemy.id] || {}), paralyzed: turns } },
      turns: state.turns + 1,
      message: `${caster.name} conjura ${spell.name}. ${name} queda rígido: pierde ${turns === 1 ? 'su próxima acción' : `sus ${turns} próximas acciones`}.`,
    };
  }
  if (spell.kind === 'ward') {
    if (!state.initiative) return refuse(`${caster.name} recita ${spell.name}, pero la fe sólo se sostiene en combate.`);
    if (state.combatWard) return refuse(`${spell.name} ya protege a la compañía en este combate.`);
    return {
      ...chroniclesSpendSp(state, caster.id, spell.cost),
      combatWard: { armorClass: spell.armorClass, by: caster.id },
      turns: state.turns + 1,
      message: `${caster.name} conjura ${spell.name}: la compañía gana +${spell.armorClass} de armadura hasta el final del combate.`,
    };
  }
  if (spell.kind === 'heal') {
    const patient = chroniclesMostWoundedAlly(state);
    if (!patient) return refuse(`${caster.name} repasa ${spell.name}, pero nadie de la compañía está herido.`);
    const healed = Math.min(patient.maxHp, patient.hp + spell.amount);
    return {
      ...chroniclesSpendSp(state, caster.id, spell.cost),
      party: state.party.map((member) => member.id === patient.id ? { ...member, hp: healed } : member),
      turns: state.turns + 1,
      message: `${caster.name} conjura ${spell.name} sobre ${patient.name}: ${patient.hp} → ${healed} PV.`,
    };
  }
  if (spell.kind === 'detect') {
    const map = chroniclesMapForState(state);
    // Magic senses treasure still sealed, even behind its guardians: a chest
    // counts as opened once the flag its own action sets is already set.
    const opened = (entry) => (entry.action?.effects || [])
      .some((effect) => effect.type === 'set' && state[effect.key] === effect.value);
    const treasures = (map.treasures || [])
      .filter((entry) => (entry.action?.effects || []).some((effect) => effect.type === 'set')
        ? !opened(entry)
        : chroniclesContentVisible(state, entry))
      .map((entry) => chroniclesMapContentPosition(map, entry))
      .filter(Boolean);
    return {
      ...chroniclesSpendSp(state, caster.id, spell.cost),
      turns: state.turns + 1,
      message: chroniclesDetectMagicMessage(caster, treasures, state),
    };
  }
  return state;
}

// MM3-style doors: a town building is a solid block of '#' cells and its
// authored entries (`visualType: building-*`) stand on the street cell in
// front of the door. Walking into that door enters, like interacting; walking
// into any other part of the facade says where the door is.
const wallBlocksByMap = new WeakMap();

function wallBlocks(map) {
  if (wallBlocksByMap.has(map)) return wallBlocksByMap.get(map);
  const grid = map?.grid || [];
  const blockOf = new Map();
  let next = 0;
  grid.forEach((row, y) => [...row].forEach((tile, x) => {
    if (tile !== '#' || blockOf.has(`${x},${y}`)) return;
    const id = next++;
    const queue = [[x, y]];
    const cells = [];
    let touchesEdge = false;
    blockOf.set(`${x},${y}`, id);
    while (queue.length) {
      const [cx, cy] = queue.pop();
      cells.push([cx, cy]);
      if (cx === 0 || cy === 0 || cy === grid.length - 1 || cx === grid[cy].length - 1) touchesEdge = true;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const key = `${cx + dx},${cy + dy}`;
        if (grid[cy + dy]?.[cx + dx] === '#' && !blockOf.has(key)) {
          blockOf.set(key, id);
          queue.push([cx + dx, cy + dy]);
        }
      });
    }
    // The town wall is not a building.
    if (touchesEdge) cells.forEach(([cx, cy]) => blockOf.set(`${cx},${cy}`, -1));
  }));
  wallBlocksByMap.set(map, blockOf);
  return blockOf;
}

function buildingDoorsFor(map, x, y) {
  const block = wallBlocks(map).get(`${x},${y}`);
  if (block === undefined || block < 0) return [];
  return (map.interactables || []).filter((entry) => {
    if (!String(entry.visualType || '').startsWith('building-')) return false;
    return [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .some(([dx, dy]) => wallBlocks(map).get(`${entry.x + dx},${entry.y + dy}`) === block);
  });
}

function buildingName(entry) {
  return String(entry?.label || 'el edificio').split(' · ')[0];
}

function stepsWord(count) {
  return count === 1 ? 'un paso' : `${count} pasos`;
}

// The town house (as the renderer draws it) whose footprint contains `cell`,
// with its single door cell and the building content standing at that door.
const renderedTownHouses = new WeakMap();
function renderedTownHouseAt(map, cell) {
  if (!map?.grid) return null;
  if (!renderedTownHouses.has(map)) {
    const grid = map.grid;
    const width = Math.max(...grid.map((row) => row.length));
    const center = { x: (width - 1) / 2, y: (grid.length - 1) / 2 };
    renderedTownHouses.set(map, settlementHouseBlocks(grid, width, grid.length).map((block) => {
      const { door } = settlementHouseFacing(block, grid, center);
      const entries = (map.interactables || []).filter((entry) => entry.x === door.x && entry.y === door.y
        && String(entry.visualType || '').startsWith('building-'));
      return { block, door, entries };
    }).filter((house) => house.entries.length));
  }
  return renderedTownHouses.get(map).find(({ block }) => block.cells.some(({ x, y }) => x === cell.x && y === cell.y)) || null;
}

// Standing anywhere along the facade that carries the door (and facing in)
// counts as walking through that door, as in MM3: the counter opens.
function onDoorFacade(state, { block, door }) {
  const horizontal = door.y === block.minY - 1 || door.y === block.maxY + 1;
  return horizontal
    ? state.y === door.y && state.x >= block.minX && state.x <= block.maxX
    : state.x === door.x && state.y >= block.minY && state.y <= block.maxY;
}

function enterBuildingAt(state, entryCell, label) {
  const atDoor = { ...state, x: entryCell.x, y: entryCell.y };
  if (chroniclesContextualContentAction(atDoor)) {
    return chroniclesArriveOnTransition(atDoor, chroniclesAdvanceLostKingIntro(atDoor, resolveContextualContentAction(atDoor)));
  }
  return withMessage(state, `${label}: no hay nadie que te atienda ahora mismo.`);
}

function pointToDoor(state, door, name) {
  const direction = CHRONICLES_DIRECTIONS[state.direction];
  const dx = door.x - state.x;
  const dy = door.y - state.y;
  const lateral = dx * -direction.dy + dy * direction.dx;
  const ahead = dx * direction.dx + dy * direction.dy;
  if (lateral !== 0 && ahead === 0) {
    return withMessage(state, `La puerta de ${name} está ${stepsWord(Math.abs(lateral))} a tu ${lateral > 0 ? 'derecha' : 'izquierda'}.`);
  }
  return withMessage(state, `Es la pared de ${name}. La puerta da a otra calle: rodea el edificio.`);
}

// The state standing on the door of the town house the party is walking
// into from its door facade (null otherwise). The UI uses it to open an
// NPC audience exactly as if the party were at the door.
export function chroniclesBuildingEntryState(state) {
  if (!state || state.phase !== 'explore' || state.initiative) return null;
  const direction = CHRONICLES_DIRECTIONS[state.direction];
  if (!direction) return null;
  const front = { x: state.x + direction.dx, y: state.y + direction.dy };
  const house = renderedTownHouseAt(chroniclesMapForState(state), front);
  if (!house || !onDoorFacade(state, house)) return null;
  return { ...state, x: house.door.x, y: house.door.y };
}

function bumpIntoBuilding(state, front) {
  const map = chroniclesMapForState(state);
  // Towns drawn as houses: the door is where the renderer puts it.
  const house = renderedTownHouseAt(map, front);
  if (house) {
    const name = buildingName(house.entries[0]);
    if (onDoorFacade(state, house)) return enterBuildingAt(state, house.door, name);
    return pointToDoor(state, house.door, name);
  }
  // Other authored maps: any building entry touching the bumped block.
  const doors = buildingDoorsFor(map, front.x, front.y);
  if (!doors.length) return null;
  const here = doors.find((entry) => entry.x === state.x && entry.y === state.y);
  if (here) return enterBuildingAt(state, here, buildingName(here));
  return pointToDoor(state, doors[0], buildingName(doors[0]));
}

function blockingEnemyMessage(enemy) {
  if (enemy.blockingMessage) return enemy.blockingMessage;
  return `${enemy.name[0].toUpperCase()}${enemy.name.slice(1)} bloquea el paso. Convéncelo con violencia reglamentaria.`;
}

function explorationCellBlocker(state, x, y) {
  const tile = chroniclesTileAt(x, y, state);
  if (tile === '#') {
    return { message: 'Hay una pared. Incluso Matthias concede que atravesarla sería excesivo.' };
  }
  const blockingEnemy = chroniclesEnemyAt(state, x, y);
  if (blockingEnemy) return { message: blockingEnemyMessage(blockingEnemy) };
  const exit = contentEntryAt(state, 'exits', x, y);
  const exitFailure = exit ? chroniclesRequirementFailure(state, exit.requirements) : null;
  if (exitFailure) {
    return {
      message: exitFailure.explorationMessage || exitFailure.message || 'El paso sigue cerrado.',
    };
  }
  return null;
}

// Which active quest the OBJETIVO line follows. Choosing costs no turn;
// following a quest that is not active (or `null`) goes back to automatic.
export function chroniclesTrackQuest(state, questId) {
  const active = chroniclesQuestEntries(state, 'active').some((quest) => quest.id === questId);
  if (!active) {
    if (!state.trackedQuestId) return state;
    const { trackedQuestId: _dropped, ...rest } = state;
    return rest;
  }
  if (state.trackedQuestId === questId) return state;
  const quest = chroniclesQuestEntries(state, 'active').find((entry) => entry.id === questId);
  return { ...state, trackedQuestId: questId, message: `Sigues: ${quest.title}.` };
}

export function chroniclesReduce(state, action) {
  if (!state || state.phase === 'escaped' || state.phase === 'defeated') return state;
  const actionType = typeof action === 'string' ? action : action?.type;
  if (actionType === 'admin') return chroniclesAdminReduce(state, action);
  if (actionType === 'shop-buy') return chroniclesShopBuy(state, chroniclesMapForState(state), action.itemId);
  if (actionType === 'shop-sell') return chroniclesShopSell(state, chroniclesMapForState(state), action.itemId);
  if (actionType === 'shop-close') return chroniclesCloseShop(state);
  if (actionType === 'guild-join') return chroniclesGuildJoin(state, chroniclesMapForState(state));
  if (actionType === 'guild-learn') {
    return chroniclesGuildLearn(state, chroniclesMapForState(state), action.memberId, action.spellId);
  }
  if (actionType === 'guild-close') return chroniclesCloseGuild(state);
  if (actionType === 'track-quest') return chroniclesTrackQuest(state, action.questId);
  // Any other action (moving, turning, fighting) walks away from the counter.
  if ((state.shop || state.guild) && actionType !== 'equip-item' && actionType !== 'unequip-item') {
    return chroniclesReduce(chroniclesCloseGuild(chroniclesCloseShop(state)), action);
  }
  if (actionType === 'equip-item') return chroniclesEquipItem(state, action.memberId, action.itemId);
  if (actionType === 'unequip-item') return chroniclesUnequipItem(state, action.memberId, action.slot);
  if (actionType === 'volley') return resolveOpeningVolley(state);
  if (actionType === 'turn-left') return { ...state, direction: (state.direction + 3) % 4, turns: state.turns + 1 };
  if (actionType === 'turn-right') return { ...state, direction: (state.direction + 1) % 4, turns: state.turns + 1 };
  if (actionType === 'attack') {
    const mode = typeof action === 'object' && ['melee', 'missile'].includes(action.mode) ? action.mode : 'auto';
    return resolveAttack(state, typeof action === 'object' ? action.memberId : 'matthias', null, mode);
  }
  if (actionType === 'cast') return resolveCast(state, action.memberId, action.spellId);
  if (actionType === 'use-item') return resolveUseItem(state, action.memberId, action.itemId, action.targetId || null);
  if (actionType === 'interact') return chroniclesArriveOnTransition(state, chroniclesAdvanceLostKingIntro(state, resolveContextualContentAction(state)));

  const direction = CHRONICLES_DIRECTIONS[state.direction];
  // Lateral steps share the exact same collision, trigger and checkpoint path
  // as forward/backward movement. Strafe never rotates the camera.
  const displacement = {
    forward: [direction.dx, direction.dy],
    backward: [-direction.dx, -direction.dy],
    'strafe-left': [direction.dy, -direction.dx],
    'strafe-right': [-direction.dy, direction.dx],
  }[actionType];
  if (!displacement) return state;
  const x = state.x + displacement[0];
  const y = state.y + displacement[1];
  const blocker = explorationCellBlocker(state, x, y);
  if (blocker && actionType === 'forward') {
    const entered = bumpIntoBuilding(state, { x, y });
    if (entered) return entered;
  }
  if (blocker) return withMessage(state, blocker.message);
  const moved = chroniclesArriveOnTransition(state, chroniclesAdvanceLostKingIntro(state, enterTile(state, x, y)));
  // In combat the heroes stand on their own cells around the camera. A step
  // moves the whole company: redeploy it around the new position instead of
  // leaving the heroes behind (enemies would walk into the camera's cell).
  if (state.initiative && moved.mapId === state.mapId && moved.partyPositions && Object.keys(moved.partyPositions).length) {
    return chroniclesDeployPartyForCombat({ ...moved, partyPositions: {} });
  }
  return moved;
}

export function chroniclesObjective(state) {
  const map = chroniclesMapForState(state);
  if (state.phase === 'defeated') return 'La expedición ha caído';
  if (state.phase === 'escaped') return map.explorationCompleteLabel || 'Exploración completada';

  const requiredEnemy = (map.enemies || []).find((enemy) => !enemy.optional && enemyAlive(state, enemy));
  if (requiredEnemy) return requiredEnemy.explorationObjective || `Derrota ${chroniclesToName(requiredEnemy.name)}`;

  const pendingTrigger = (map.triggers || []).find((entry) => chroniclesRequirementsMet(state, entry.when));
  if (pendingTrigger) return pendingTrigger.explorationObjective || pendingTrigger.label || 'Activa el siguiente evento';

  const exit = (map.exits || [])[0];
  const exitFailure = exit ? chroniclesRequirementFailure(state, exit.requirements) : null;
  if (exitFailure) {
    const content = [
      ...(map.interactables || []),
      ...(map.treasures || []),
    ];
    const satisfies = (entry, requirement, sourceState = state) => {
      if (!entry?.action?.effects?.length || chroniclesRequirementMet(sourceState, requirement)) return false;
      const simulated = chroniclesApplyContentEffects(sourceState, entry.action.effects);
      return chroniclesRequirementMet(simulated, requirement);
    };
    const available = (entry) => chroniclesRequirementsMet(state, entry.when);

    let pendingInteraction = content.find((entry) => available(entry) && satisfies(entry, exitFailure));

    if (!pendingInteraction) {
      const blockedTargets = content.filter((entry) => satisfies(entry, exitFailure));
      for (const target of blockedTargets) {
        const unmetTargetRequirement = (target.when || []).find(
          (requirement) => !chroniclesRequirementMet(state, requirement),
        );
        if (!unmetTargetRequirement) continue;
        pendingInteraction = content.find(
          (entry) => available(entry) && satisfies(entry, unmetTargetRequirement),
        );
        if (pendingInteraction) break;
      }
    }

    if (pendingInteraction) {
      return pendingInteraction.explorationObjective
        || pendingInteraction.label
        || (pendingInteraction.kind === 'pickup' ? 'Recoge el objeto' : 'Interactúa con el entorno');
    }
  }

  // In the open world the party follows its quests, not the nearest gate.
  // A quest with content on this map wins; otherwise the story thread. An
  // exit objective a designer wrote by hand (legacy Swordhaven's «encuentra
  // la salida») only speaks when no quest does: it used to hide the quest,
  // which then showed only inside the Crónica.
  const campaignArea = ['settlement', 'wilderness'].includes(map.regionKind)
    || (map.regionKind === 'dungeon' && exit?.requiresReturn === true);
  if (campaignArea) {
    const active = chroniclesQuestEntries(state, 'active').filter((quest) => quest.objective);
    const localQuestIds = new Set((map.interactables || []).flatMap((entry) => (
      (entry.when || []).map((requirement) => requirement?.questId).filter(Boolean)
    )));
    // A quest the player chose to follow (Crónica → «Seguir») comes first.
    const tracked = active.find((quest) => quest.id === state.trackedQuestId)
      || active.find((quest) => localQuestIds.has(quest.id)) || active[0];
    if (tracked) return tracked.objective;
  }
  if (campaignArea && !exit?.explorationObjective) {
    // Nothing tracked yet: point at whoever here hands out work.
    const questGiver = (map.interactables || []).find((entry) => chroniclesRequirementsMet(state, entry.when)
      && (entry.action?.effects || []).some((effect) => effect.type === 'start-quest'));
    if (questGiver?.label) return questGiver.label;
  }

  if (exit) return exit.explorationObjective || exit.openLabel || 'Busca una salida';
  return map.explorationIdleObjective || 'Explora la zona';
}
