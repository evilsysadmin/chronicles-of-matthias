// Admin tools for testing Chronicles content without replaying the
// campaign: travel anywhere, gold, XP, healing, items, flags and a preset
// that opens the final act. Only offered to admins (the API's /auth/me
// isAdmin); the API also refuses an admin-travel checkpoint from anyone else.
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import { chroniclesMapById, chroniclesMapIds } from './chroniclesMapCatalog.js';

// In-memory marker: the next area-change checkpoint asks the API to accept
// a move outside the map's own exits. Never persisted.
export const CHRONICLES_ADMIN_TRAVEL_KEY = 'adminTravelPending';

const GROUPS = Object.freeze([
  Object.freeze({ id: 'settlement', label: 'Pueblos' }),
  Object.freeze({ id: 'dungeon', label: 'Mazmorras' }),
  Object.freeze({ id: 'wilderness', label: 'Terra' }),
]);

// Only map names genuinely repeated in different contexts get a qualifier.
const ADMIN_VARIANTS = Object.freeze({
  'terra-c6': 'exterior',
});

function adminLabel(map) {
  const base = map.areaCode ? `${map.areaCode} · ${map.title}` : map.title;
  return ADMIN_VARIANTS[map.id] ? `${base} (${ADMIN_VARIANTS[map.id]})` : base;
}

export function chroniclesAdminDestinations() {
  const maps = chroniclesMapIds().map((id) => ({ ...chroniclesMapById(id), label: adminLabel(chroniclesMapById(id)) }));
  const seen = new Map();
  for (const map of maps) seen.set(map.label, (seen.get(map.label) || 0) + 1);
  return GROUPS.map((group) => Object.freeze({
    ...group,
    maps: Object.freeze(maps
      .filter((map) => (map.regionKind || 'dungeon') === group.id)
      // Last resort for a new duplicate nobody named yet: show its id.
      .map((map) => Object.freeze({ id: map.id, label: seen.get(map.label) > 1 ? `${map.label} · ${map.id}` : map.label }))
      .sort((left, right) => left.label.localeCompare(right.label, 'es'))),
  }));
}

function message(state, text) {
  return { ...state, message: `[admin] ${text}` };
}

// The final act, ready to play: the fourth act's reports done, the Dama's
// audience given, the oath tablet in hand, the company at the temple door.
const ACT_FIVE = Object.freeze([
  ...['swordhavenRouteReported', 'vadoNelaReported', 'hollinUlricReported', 'ascuafriaHildeReported',
    'vigiliaOsricReported', 'lostKingFinalActOpen']
    .map((key) => Object.freeze({ type: 'set', key, value: true })),
  Object.freeze({ type: 'grant-item', itemId: 'oath-tablet', name: 'Tablilla del juramento', description: 'La tablilla del Primer Pacto.', quantity: 1 }),
  Object.freeze({
    type: 'start-quest', questId: 'lost-king', title: 'El rey desaparecido', description: 'La Dama busca a sus caballeros desaparecidos.',
    objective: 'Entra en el Templo Bajo la Corona (F6), abre el sello de las siete coronas y detén al Canciller Varren.', order: 1,
  }),
]);

function travel(state, mapId) {
  if (!chroniclesMapIds().includes(mapId)) return message(state, `No existe el mapa ${mapId}.`);
  const arrived = chroniclesApplyContentEffects({ ...state, initiative: null }, [{ type: 'transition-map', mapId }]);
  return message({ ...arrived, [CHRONICLES_ADMIN_TRAVEL_KEY]: true }, `Viaje a ${chroniclesMapById(mapId).title}.`);
}

function parseValue(raw) {
  const text = String(raw ?? '').trim();
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text !== '' && Number.isFinite(Number(text))) return Number(text);
  return text;
}

export function chroniclesAdminReduce(state, action) {
  if (!state || !action) return state;
  const adapters = action.adapters || {};
  switch (action.command) {
    case 'travel':
      return travel(state, action.mapId);
    case 'gold':
      return message(chroniclesApplyContentEffects(state, [{ type: 'grant-gold', amount: 500 }]), '+500 de oro.');
    case 'xp':
      return message(chroniclesApplyContentEffects(state, [{
        type: 'award-xp', awardId: `admin:xp:${state.turns || 0}:${(state.xpAwards || []).length}`, amount: 1000,
      }]), '+1000 XP para cada héroe vivo.');
    case 'heal':
      return message(chroniclesApplyContentEffects({
        ...state,
        party: (state.party || []).map((member) => ({ ...member, hp: member.maxHp })),
      }, [{ type: 'restore-spell-points' }, { type: 'refill-class-abilities' }], adapters), 'Compañía curada y descansada.');
    case 'item': {
      const itemId = String(action.itemId || '').trim();
      const quantity = Math.max(1, Math.min(99, Math.floor(Number(action.quantity) || 1)));
      if (!itemId) return message(state, 'Falta el id del objeto.');
      return message(chroniclesApplyContentEffects(state, [{ type: 'grant-item', itemId, quantity }]), `+${quantity} ${itemId}.`);
    }
    case 'flag': {
      const key = String(action.key || '').trim();
      if (!key) return message(state, 'Falta la clave del flag.');
      const value = parseValue(action.value);
      return message({ ...state, [key]: value }, `${key} = ${JSON.stringify(value)}.`);
    }
    case 'act-five':
      return travel(chroniclesApplyContentEffects(state, ACT_FIVE), 'terra-f6');
    default:
      return state;
  }
}
