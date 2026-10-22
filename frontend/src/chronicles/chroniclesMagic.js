// Might and Magic III magic for first-person Chronicles.
//
// The manual: «All spells were forged through the mysteries of Cosmonium,
// Esoterica and Gaiam, and only those classes devoted to their study can
// cast them». Sorcerer and Archer serve Cosmonium, Cleric and Paladin serve
// Esoterica, Druid and Ranger serve Gaiam. Spell points come from the
// class's casting stat (Intellect or Personality) and grow with level; the
// hybrids get half. New incantations are bought at a guild once the company
// holds its membership, and resting at the inn restores every spell point.
//
// State: `spellPoints[memberId]` (missing = full) and `spellbook[memberId]`
// (missing = the school's starting spells). Both persist in the checkpoint.
import { chroniclesMM3MaxSpellPoints } from './chroniclesMM3Rules.js';

export const CHRONICLES_SPELL_SCHOOLS = Object.freeze({
  cosmonium: Object.freeze({ id: 'cosmonium', label: 'Cosmonium', summary: 'Los elementos: magia arcana.' }),
  esoterica: Object.freeze({ id: 'esoterica', label: 'Esoterica', summary: 'Mente, cuerpo y curación: magia clerical.' }),
  gaiam: Object.freeze({ id: 'gaiam', label: 'Gaiam', summary: 'La naturaleza: magia druídica.' }),
});

const CLASS_SCHOOL = Object.freeze({
  sorcerer: 'cosmonium', archer: 'cosmonium',
  cleric: 'esoterica', paladin: 'esoterica',
  druid: 'gaiam', ranger: 'gaiam',
});
function spell(spec) {
  return Object.freeze({ ...spec, schools: Object.freeze([...spec.schools]) });
}

// Novice spells from the MM3 manual that have a system to act on today.
// Light and Awaken arrive with dark dungeons and the sleep condition.
export const CHRONICLES_SPELLS = Object.freeze({
  'first-aid': spell({
    id: 'first-aid', name: 'Primeros auxilios', schools: ['esoterica', 'gaiam'], cost: 1, price: 8,
    kind: 'heal', amount: 6,
    description: 'Cura 6 PV al compañero herido que elijas. Sirve en combate y fuera de él.',
  }),
  'flying-fist': spell({
    id: 'flying-fist', name: 'Puño volador', schools: ['esoterica'], cost: 2, price: 12,
    kind: 'attack', damage: 6, reach: 2, element: 'energy',
    description: 'Un guantelete encantado golpea a un enemigo a dos casillas. No falla.',
  }),
  'elemental-arrow': spell({
    id: 'elemental-arrow', name: 'Flecha elemental', schools: ['cosmonium', 'gaiam'], cost: 2, price: 15,
    kind: 'attack', damage: 8, reach: 3, element: 'fire',
    description: 'Un dardo de fuego a tres casillas. No falla.',
  }),
  'detect-magic': spell({
    id: 'detect-magic', name: 'Detectar magia', schools: ['cosmonium'], cost: 1, price: 8,
    kind: 'detect',
    description: 'Revela cuántos tesoros quedan sin abrir en esta zona y hacia dónde.',
  }),
  // Adept spells, sold by the guilds of Terra's second wave.
  'cold-ray': spell({
    id: 'cold-ray', name: 'Rayo gélido', schools: ['cosmonium', 'gaiam'], cost: 3, price: 22,
    kind: 'attack', damage: 10, reach: 3, element: 'cold',
    description: 'Un haz de escarcha a tres casillas. No falla.',
  }),
  'poison-cloud': spell({
    id: 'poison-cloud', name: 'Nube venenosa', schools: ['gaiam'], cost: 3, price: 24,
    kind: 'attack', damage: 11, reach: 2, element: 'poison',
    description: 'Una nube verde envuelve a un enemigo a dos casillas. No falla.',
  }),
  'holy-strike': spell({
    id: 'holy-strike', name: 'Golpe sagrado', schools: ['esoterica'], cost: 4, price: 32,
    kind: 'attack', damage: 13, reach: 2, element: 'magic',
    description: 'La fe golpea a un enemigo a dos casillas. No falla.',
  }),
  'lightning-bolt': spell({
    id: 'lightning-bolt', name: 'Relámpago', schools: ['cosmonium'], cost: 4, price: 34,
    kind: 'attack', damage: 15, reach: 3, element: 'electricity',
    description: 'Un rayo a tres casillas. No falla, y deja olor a tormenta.',
  }),
  'heal-wounds': spell({
    id: 'heal-wounds', name: 'Curar heridas', schools: ['esoterica', 'gaiam'], cost: 3, price: 25,
    kind: 'heal', amount: 15,
    description: 'Cura 15 PV al compañero herido que elijas.',
  }),
  // Master spells, sold by the guilds of Terra's third wave: the first ones
  // that shape a whole fight instead of a single blow.
  fireball: spell({
    id: 'fireball', name: 'Bola de fuego', schools: ['cosmonium'], cost: 5, price: 45,
    kind: 'attack', damage: 12, reach: 3, element: 'fire', area: 1,
    description: 'Estalla sobre un enemigo a tres casillas y quema también a los que tiene al lado. No falla.',
  }),
  paralyze: spell({
    id: 'paralyze', name: 'Paralizar', schools: ['esoterica', 'gaiam'], cost: 4, price: 38,
    kind: 'paralyze', reach: 3, turns: 2,
    description: 'Un enemigo a tres casillas pierde sus dos próximas acciones (los jefes, una).',
  }),
  'mass-heal': spell({
    id: 'mass-heal', name: 'Sanación en grupo', schools: ['esoterica', 'gaiam'], cost: 6, price: 50,
    kind: 'heal', amount: 10, everyone: true,
    description: 'Cura 10 PV a toda la compañía en pie.',
  }),
  'faith-ward': spell({
    id: 'faith-ward', name: 'Escudo de fe', schools: ['esoterica'], cost: 4, price: 36,
    kind: 'ward', armorClass: 3,
    description: 'La compañía gana +3 de armadura hasta que acabe el combate. Sólo en combate.',
  }),
});

// How long Paralizar holds an enemy: bosses (and anything as tough) shake it
// off sooner.
export function chroniclesParalysisTurns(definition, enemy) {
  const tough = /-foe-9$/.test(String(enemy?.id || '')) || Number(enemy?.maxHp || 0) >= 30;
  return tough ? Math.max(1, definition.turns - 1) : definition.turns;
}

export const CHRONICLES_ELEMENT_LABELS = Object.freeze({
  fire: 'fuego', electricity: 'electricidad', cold: 'frío', poison: 'veneno', energy: 'energía', magic: 'magia',
});

const STARTING_SPELLS = Object.freeze({
  cosmonium: Object.freeze(['detect-magic']),
  esoterica: Object.freeze(['first-aid']),
  gaiam: Object.freeze(['first-aid']),
});

function classIdOf(member) {
  return member?.mm3?.classId || null;
}

export function chroniclesMemberSchool(member) {
  return CLASS_SCHOOL[classIdOf(member)] || null;
}

export function chroniclesMemberLevel(state, memberId) {
  return Math.max(1, Math.floor(Number(state?.rpgModifiers?.[memberId]?.level) || 1));
}

// MM3: spell points per level = 3 + casting-stat bonus (at least 1);
// Paladin, Archer and Ranger get half, rounded down, never below one.
export function chroniclesMemberMaxSp(state, member) {
  const school = chroniclesMemberSchool(member);
  if (!school) return 0;
  return chroniclesMM3MaxSpellPoints(
    classIdOf(member), member.mm3?.stats, member.mm3?.raceId,
    chroniclesMemberLevel(state, member.id),
  );
}

export function chroniclesMemberSp(state, member) {
  const max = chroniclesMemberMaxSp(state, member);
  const stored = state?.spellPoints?.[member?.id];
  if (!Number.isInteger(stored)) return max;
  return Math.max(0, Math.min(max, stored));
}

export function chroniclesSpellAvailableTo(member, spellId) {
  const definition = CHRONICLES_SPELLS[spellId];
  const school = chroniclesMemberSchool(member);
  return Boolean(definition && school && definition.schools.includes(school));
}

export function chroniclesMemberSpells(state, member) {
  const school = chroniclesMemberSchool(member);
  if (!school) return [];
  const stored = state?.spellbook?.[member.id];
  const ids = Array.isArray(stored) ? stored : STARTING_SPELLS[school];
  return ids.filter((id) => chroniclesSpellAvailableTo(member, id)).map((id) => CHRONICLES_SPELLS[id]);
}

export function chroniclesMemberKnowsSpell(state, member, spellId) {
  return chroniclesMemberSpells(state, member).some((entry) => entry.id === spellId);
}

export function chroniclesSpendSp(state, memberId, amount) {
  const member = state.party.find((entry) => entry.id === memberId);
  return {
    ...state,
    spellPoints: { ...state.spellPoints, [memberId]: chroniclesMemberSp(state, member) - amount },
  };
}

// Resting at the inn: every caster back to full.
export function chroniclesRestoreSpellPoints(state) {
  if (!state?.spellPoints) return state;
  const { spellPoints: _spent, ...rested } = state;
  return rested;
}

export function chroniclesLearnSpell(state, memberId, spellId) {
  const member = state.party.find((entry) => entry.id === memberId);
  if (!member || !chroniclesSpellAvailableTo(member, spellId) || chroniclesMemberKnowsSpell(state, member, spellId)) {
    return state;
  }
  const known = chroniclesMemberSpells(state, member).map((entry) => entry.id);
  return { ...state, spellbook: { ...state.spellbook, [memberId]: [...known, spellId] } };
}

// Share the exact heal-target legality between the grimoire and reducer.
// Zero PV is incapacitation, not an ordinary wound: healing never revives.
export function chroniclesHealTargetStatus(member) {
  if (!member || member.hp <= 0) return 'fallen';
  return member.hp >= member.maxHp ? 'healthy' : 'wounded';
}

// Selection is keyboard-first, with an exact 1–4 mapping to the visible
// party order. It never acts for modifiers/repeats or without a member.
export function chroniclesSpellTargetHotkey(event, party) {
  if (!event || event.repeat || event.isComposing || event.ctrlKey || event.altKey
    || event.metaKey || event.shiftKey || !/^[1-4]$/.test(String(event.key))) return null;
  return Array.isArray(party) ? party[Number(event.key) - 1]?.id || null : null;
}

// The ally a healing spell should land on: lowest HP share among the living.
export function chroniclesMostWoundedAlly(state) {
  return (state.party || [])
    .filter((member) => member.hp > 0 && member.hp < member.maxHp)
    .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0] || null;
}

// Damage after the target's resistance to the spell's element (percent).
export function chroniclesSpellDamage(definition, enemy) {
  const resistance = Math.max(0, Math.min(100, Number(enemy?.resistances?.[definition.element] || 0)));
  return Math.max(0, Math.round(definition.damage * (100 - resistance) / 100));
}

const DIRECTION_WORDS = Object.freeze({ n: 'norte', s: 'sur', e: 'este', o: 'oeste' });

export function chroniclesDetectMagicMessage(caster, treasures, state) {
  if (!treasures.length) {
    return `${caster.name} conjura Detectar magia. Nada vibra en esta zona: no quedan tesoros por abrir.`;
  }
  const nearest = [...treasures].sort((a, b) => (
    (Math.abs(a.x - state.x) + Math.abs(a.y - state.y)) - (Math.abs(b.x - state.x) + Math.abs(b.y - state.y))
  ))[0];
  const dx = nearest.x - state.x;
  const dy = nearest.y - state.y;
  const heading = [dy < 0 ? 'n' : dy > 0 ? 's' : '', dx > 0 ? 'e' : dx < 0 ? 'o' : '']
    .filter(Boolean).map((key) => DIRECTION_WORDS[key]).join(' y ') || 'bajo tus pies';
  const count = treasures.length === 1 ? 'Queda un tesoro' : `Quedan ${treasures.length} tesoros`;
  return `${caster.name} conjura Detectar magia. ${count} sin abrir en esta zona; el más cercano, hacia el ${heading}.`
    .replace('hacia el bajo tus pies', 'bajo tus pies');
}
