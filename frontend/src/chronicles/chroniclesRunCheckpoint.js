import { CHRONICLES_EQUIPMENT_SLOTS, chroniclesEquippedItem, chroniclesNormalizeMemberEquipment } from './chroniclesEquipment.js';
import { chroniclesApplyStartingKit } from './chroniclesStartingKit.js';
import { chroniclesBagOwnership } from './chroniclesPersonalBags.js';
import { chroniclesSpellAvailableTo } from './chroniclesMagic.js';
import { normalizeChroniclesProgression } from '../chroniclesOfMatthiasProgression.js';
import {
  chroniclesMapById,
  chroniclesMergeSlain,
  chroniclesSlainIndices,
  chroniclesMapIds,
} from './chroniclesMapCatalog.js';

const CONTENT_GROUPS = Object.freeze(['triggers', 'interactables', 'treasures', 'traps', 'exits']);
const RUNTIME_PREFIX = '__chrRuntime.';
const RUNTIME_VERSION = 1;
const RUNTIME_VERSION_KEY = `${RUNTIME_PREFIX}version`;
const PROGRESSION_PART_COUNT = `${RUNTIME_PREFIX}progression.parts`;
const PROGRESSION_PART_PREFIX = `${RUNTIME_PREFIX}progression.part.`;
const PROGRESSION_PART_SIZE = 240;
const PROGRESSION_MAX_PARTS = 192;
const MAP_FLAGS_PART_COUNT = `${RUNTIME_PREFIX}mapFlags.parts`;
const MAP_FLAGS_PART_PREFIX = `${RUNTIME_PREFIX}mapFlags.part.`;
const MAP_FLAGS_PART_SIZE = 240;
const MAP_FLAGS_MAX_PARTS = 128;

// The Go checkpoint API limits ordinary string flags to 256 Unicode runes.
// Chunk the complete run-specific progression (including XP, character build,
// earned/spent points, unlocked skills and claimed-award anti-farming ledger)
// so restoring a saved run never depends on a newer account-wide profile.
function runProgressionFlags(progression) {
  if (!progression) return {};
  const chars = Array.from(JSON.stringify(normalizeChroniclesProgression(progression)));
  const count = Math.ceil(chars.length / PROGRESSION_PART_SIZE);
  if (count < 1 || count > PROGRESSION_MAX_PARTS) {
    throw new Error('Progresión de expedición demasiado grande para guardar.');
  }
  const flags = { [PROGRESSION_PART_COUNT]: count };
  for (let index = 0; index < count; index += 1) {
    flags[`${PROGRESSION_PART_PREFIX}${index}`] = chars
      .slice(index * PROGRESSION_PART_SIZE, (index + 1) * PROGRESSION_PART_SIZE).join('');
  }
  return flags;
}

// A missing snapshot identifies a legacy save: its old account-level
// progression remains the fallback, without rewriting old saved campaigns.
export function chroniclesCheckpointRunProgression(run) {
  const flags = run?.worldFlags;
  if (!flags || typeof flags !== 'object') return null;
  const count = flags[PROGRESSION_PART_COUNT];
  if (!Number.isInteger(count) || count < 1 || count > PROGRESSION_MAX_PARTS) return null;
  const parts = [];
  for (let index = 0; index < count; index += 1) {
    const part = flags[`${PROGRESSION_PART_PREFIX}${index}`];
    if (typeof part !== 'string' || !part.length || Array.from(part).length > PROGRESSION_PART_SIZE) return null;
    parts.push(part);
  }
  try {
    const decoded = JSON.parse(parts.join(''));
    if (!decoded || typeof decoded !== 'object' || !decoded.heroes || !decoded.characterBuild) return null;
    return normalizeChroniclesProgression(decoded);
  } catch {
    return null;
  }
}

function authoredSetKeys(map) {
  // Reward outcomes must survive a checkpoint too: an atomic claim-reward
  // can contain the only durable "set" for a branching world decision.
  const setKeys = (effects) => (effects || []).flatMap((effect) => {
    if (effect?.type === 'set' && typeof effect.key === 'string' && effect.key) return [effect.key];
    if (effect?.type === 'claim-reward') return setKeys(effect.effects);
    return [];
  });
  const content = CONTENT_GROUPS.flatMap((group) => (
    (map?.[group] || []).flatMap((entry) => setKeys(entry?.action?.effects))
  ));
  const defeats = (map?.enemies || []).flatMap((enemy) => setKeys(enemy?.onDefeat?.effects));
  return [...content, ...defeats];
}

// World flags persist for every region; enemy HP only for the current one,
// because entering any other region resets its foes anyway. With dozens of
// Terra areas, keeping every visited map's HP would overflow the checkpoint.
// Durable choices the client makes outside map content (the campaign
// epilogue's "seen" mark) persist like any authored flag.
const CLIENT_DURABLE_KEYS = Object.freeze(['lostKingEpilogueSeen']);

function checkpointFlagKeys(currentMapId) {
  return [...CLIENT_DURABLE_KEYS, ...chroniclesMapIds().flatMap((mapId) => {
    const map = chroniclesMapById(mapId);
    return [
      ...Object.keys(map.initialFlags || {}),
      ...authoredSetKeys(map),
      ...(mapId === currentMapId ? (map.enemies || []).map((enemy) => enemy?.hpKey).filter(Boolean) : []),
    ];
  })];
}

function durableFlagValue(value) {
  return value === null || typeof value === 'boolean' || typeof value === 'string'
    || (typeof value === 'number' && Number.isFinite(value));
}

// Old saves also carry authored flags directly in worldFlags, outside the
// per-floor snapshot. Check their types against the map definitions so a
// legacy "true" string cannot silently open a boolean door on recovery.
// Unknown authored keys remain valid for backward compatibility.
function authoredInitialFlagTypeMatches(key, value) {
  let known = false;
  for (const mapId of chroniclesMapIds()) {
    const initial = chroniclesMapById(mapId).initialFlags || {};
    if (!Object.hasOwn(initial, key)) continue;
    known = true;
    const expected = initial[key];
    if ((expected === null ? value === null : typeof value === typeof expected)
      && durableFlagValue(value)) return true;
  }
  return !known;
}

// Floor-local flags must survive a real API checkpoint, not just an in-memory
// map transition. Save only deviations from authored defaults to stay bounded.
function checkpointMapFlagSnapshots(source) {
  const prior = source.mapFlagsById && typeof source.mapFlagsById === 'object'
    && !Array.isArray(source.mapFlagsById) ? source.mapFlagsById : {};
  const snapshots = {};
  for (const mapId of chroniclesMapIds()) {
    const map = chroniclesMapById(mapId);
    const values = mapId === source.mapId ? source : prior[mapId];
    if (!values || typeof values !== 'object' || Array.isArray(values)) continue;
    const changed = Object.fromEntries(Object.entries(map.initialFlags || {})
      .filter(([key, initial]) => Object.hasOwn(values, key)
        && durableFlagValue(values[key])
        && (initial === null ? values[key] === null : typeof values[key] === typeof initial)
        && values[key] !== initial)
      .map(([key]) => [key, values[key]]));
    if (Object.keys(changed).length) snapshots[mapId] = changed;
  }
  return snapshots;
}

function checkpointMapFlagParts(source) {
  const snapshots = checkpointMapFlagSnapshots(source);
  if (!Object.keys(snapshots).length) return {};
  const chars = Array.from(JSON.stringify(snapshots));
  const count = Math.ceil(chars.length / MAP_FLAGS_PART_SIZE);
  if (count > MAP_FLAGS_MAX_PARTS) {
    throw new Error('Demasiados cambios de mazmorra para guardar la expedición.');
  }
  const parts = { [MAP_FLAGS_PART_COUNT]: count };
  for (let index = 0; index < count; index += 1) {
    parts[`${MAP_FLAGS_PART_PREFIX}${index}`] = chars
      .slice(index * MAP_FLAGS_PART_SIZE, (index + 1) * MAP_FLAGS_PART_SIZE).join('');
  }
  return parts;
}

function restoredMapFlagSnapshots(flags) {
  const count = flags[MAP_FLAGS_PART_COUNT];
  if (!Number.isInteger(count) || count < 1 || count > MAP_FLAGS_MAX_PARTS) return null;
  const parts = [];
  for (let index = 0; index < count; index += 1) {
    const part = flags[`${MAP_FLAGS_PART_PREFIX}${index}`];
    if (typeof part !== 'string' || !part.length
      || Array.from(part).length > MAP_FLAGS_PART_SIZE) return null;
    parts.push(part);
  }
  try {
    const parsed = JSON.parse(parts.join(''));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const snapshots = {};
    for (const mapId of chroniclesMapIds()) {
      const values = parsed[mapId];
      if (!values || typeof values !== 'object' || Array.isArray(values)) continue;
      const initial = chroniclesMapById(mapId).initialFlags || {};
      const changed = Object.fromEntries(Object.keys(initial)
        .filter((key) => Object.hasOwn(values, key) && durableFlagValue(values[key])
          // A malformed save must not turn a boolean door/lever into a truthy string.
          && (initial[key] === null ? values[key] === null : typeof values[key] === typeof initial[key]))
        .map((key) => [key, values[key]]));
      if (Object.keys(changed).length) snapshots[mapId] = changed;
    }
    return snapshots;
  } catch {
    return null;
  }
}

function normalizedLedger(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))];
}

function normalizedInventory(inventory) {
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) return {};
  return Object.fromEntries(
    Object.entries(inventory)
      .filter(([itemId, item]) => typeof itemId === 'string' && itemId && item && typeof item === 'object' && !Array.isArray(item))
      .map(([itemId, item]) => {
        const quantity = integerOrNull(Number(item.quantity), 1, 9999);
        if (quantity === null) return null;
        return [itemId, {
          id: itemId,
          name: typeof item.name === 'string' ? item.name : itemId,
          description: typeof item.description === 'string' ? item.description : '',
          quantity,
        }];
      })
      .filter(Boolean),
  );
}

function normalizedQuests(quests) {
  if (!quests || typeof quests !== 'object' || Array.isArray(quests)) return {};
  return Object.fromEntries(
    Object.entries(quests)
      .filter(([questId, quest]) => typeof questId === 'string' && questId && quest && typeof quest === 'object' && !Array.isArray(quest))
      .filter(([, quest]) => quest.status === 'active' || quest.status === 'completed')
      .map(([questId, quest]) => [questId, {
        id: questId,
        title: typeof quest.title === 'string' ? quest.title : questId,
        description: typeof quest.description === 'string' ? quest.description : '',
        objective: typeof quest.objective === 'string' ? quest.objective : '',
        order: Number.isFinite(Number(quest.order)) ? Number(quest.order) : 0,
        status: quest.status,
      }]),
  );
}

function runtimeKey(...parts) {
  return `${RUNTIME_PREFIX}${parts.join('.')}`;
}

function integerOrNull(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function shortStringOrNull(value, maxLength = 64) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : null;
}

function normalizedInitiative(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.order)) return null;
  // Preserve the current actor's original index when malformed entries are
  // discarded. Otherwise a bad entry before the cursor silently grants the
  // next combatant the saved hero's turn on checkpoint recovery.
  const requestedCursor = integerOrNull(Number(value.cursor), 0, value.order.length - 1) ?? 0;
  const validEntries = value.order
    .slice(0, 64)
    .map((actor, index) => {
      const id = shortStringOrNull(actor?.id, 64);
      const kind = actor?.kind === 'party' || actor?.kind === 'enemy' ? actor.kind : null;
      const name = shortStringOrNull(actor?.name, 80) || id;
      const agility = integerOrNull(Number(actor?.agility), 0, 999);
      const roll = integerOrNull(Number(actor?.roll), 1, 8);
      const initiative = integerOrNull(Number(actor?.initiative), 1, 1007);
      if (!id || !kind || agility === null || roll === null || initiative === null) return null;
      return { index, actor: { id, kind, name, agility, roll, initiative } };
    })
    .filter(Boolean);
  if (!validEntries.length) return null;
  const currentEntry = validEntries.find((entry) => entry.index >= requestedCursor)
    || validEntries[validEntries.length - 1];
  // A damaged checkpoint must never give the same combatant extra turns.
  // Prefer the current occurrence if it is duplicated, so recovery keeps
  // the actor whose turn was actually saved rather than an earlier copy.
  const selected = new Map();
  for (const entry of validEntries) {
    const key = `${entry.actor.kind}:${entry.actor.id}`;
    if (!selected.has(key) || entry === currentEntry) selected.set(key, entry);
  }
  const entries = validEntries.filter((entry) => (
    selected.get(`${entry.actor.kind}:${entry.actor.id}`) === entry
  ));
  const nextCursor = entries.indexOf(currentEntry);
  return {
    version: integerOrNull(Number(value.version), 1, 99) || 1,
    die: value.die === '1d8' ? '1d8' : '1d8',
    round: integerOrNull(Number(value.round), 1, 9999) || 1,
    cursor: nextCursor >= 0 ? nextCursor : entries.length - 1,
    order: entries.map((entry) => entry.actor),
  };
}

function runtimeCheckpointFlags(state) {
  const source = state && typeof state === 'object' ? state : {};
  const flags = { [RUNTIME_VERSION_KEY]: RUNTIME_VERSION };

  const x = integerOrNull(source.x);
  const y = integerOrNull(source.y);
  const direction = integerOrNull(source.direction, 0, 3);
  const turns = integerOrNull(source.turns);
  const round = integerOrNull(source.round);
  const explorationEnemySteps = integerOrNull(source.explorationEnemySteps);
  const phase = shortStringOrNull(source.phase, 32);
  const turnPhase = shortStringOrNull(source.turnPhase, 32);

  if (x !== null) flags[runtimeKey('x')] = x;
  if (y !== null) flags[runtimeKey('y')] = y;
  if (direction !== null) flags[runtimeKey('direction')] = direction;
  if (turns !== null) flags[runtimeKey('turns')] = turns;
  if (round !== null) flags[runtimeKey('round')] = round;
  if (explorationEnemySteps !== null) flags[runtimeKey('explorationEnemySteps')] = explorationEnemySteps;
  if (phase !== null) flags[runtimeKey('phase')] = phase;
  if (turnPhase !== null) flags[runtimeKey('turnPhase')] = turnPhase;
  const initiative = normalizedInitiative(source.initiative);
  if (initiative) flags[runtimeKey('initiative')] = JSON.stringify(initiative);

  (source.party || []).forEach((member) => {
    const memberId = shortStringOrNull(member?.id, 40);
    const hp = integerOrNull(member?.hp);
    if (memberId && hp !== null) flags[runtimeKey('party', memberId, 'hp')] = hp;
    const position = memberId ? source.partyPositions?.[memberId] : null;
    const partyX = integerOrNull(position?.x);
    const partyY = integerOrNull(position?.y);
    if (memberId && partyX !== null && partyY !== null) {
      flags[runtimeKey('party', memberId, 'x')] = partyX;
      flags[runtimeKey('party', memberId, 'y')] = partyY;
    }
  });

  (source.party || []).forEach((member) => {
    for (const slot of CHRONICLES_EQUIPMENT_SLOTS) {
      const equipped = chroniclesEquippedItem(source, member.id, slot);
      if (equipped) flags[runtimeKey('gear', member.id, slot)] = equipped.id;
    }
  });

  // Personal backpacks are allocations of the shared, authoritative
  // inventory. Each bounded numeric flag survives existing Go/Mongo saves
  // without introducing a second, duplicative inventory document.
  if (source.combatRules === 'mm3') {
    const bags = chroniclesBagOwnership(source);
    for (const [memberId, bag] of Object.entries(bags)) {
      const safeMemberId = shortStringOrNull(memberId, 40);
      if (!safeMemberId) continue;
      for (const [itemId, quantity] of Object.entries(bag)) {
        const safeItemId = shortStringOrNull(itemId, 80);
        const amount = integerOrNull(quantity, 1, 9999);
        if (safeItemId && amount !== null) flags[runtimeKey('bag', safeMemberId, safeItemId)] = amount;
      }
    }
  }

  // MM3 magic: spent spell points, each caster's spellbook, guild memberships.
  (source.party || []).forEach((member) => {
    const sp = integerOrNull(source.spellPoints?.[member.id], 0, 999);
    if (sp !== null) flags[runtimeKey('party', member.id, 'sp')] = sp;
    const book = source.spellbook?.[member.id];
    if (Array.isArray(book)) flags[runtimeKey('spells', member.id)] = book.join(',').slice(0, 256);
  });
  Object.entries(source.guildMemberships || {}).forEach(([guildId, joined]) => {
    const safeGuildId = shortStringOrNull(guildId, 64);
    if (safeGuildId && joined === true) flags[runtimeKey('guild', safeGuildId)] = true;
  });

  // The quest OBJETIVO follows, Escudo de fe and paralysed enemies.
  const trackedQuestId = shortStringOrNull(source.trackedQuestId, 64);
  if (trackedQuestId) flags[runtimeKey('trackedQuest')] = trackedQuestId;
  const ward = integerOrNull(source.combatWard?.armorClass, 1, 9);
  if (ward !== null && source.initiative) flags[runtimeKey('ward')] = ward;
  // BLOCK is a per-hero guard until their next initiative slot. Persist only
  // active combat guards so F5 cannot silently remove their defense.
  if (source.phase === 'combat' && initiative) {
    (source.party || []).forEach((member) => {
      const memberId = shortStringOrNull(member?.id, 40);
      if (memberId && member.hp > 0 && source.combatBlock?.[memberId] === true) {
        flags[runtimeKey('block', memberId)] = true;
      }
    });
  }
  Object.entries(source.enemyStatus || {}).forEach(([enemyId, status]) => {
    const safeEnemyId = shortStringOrNull(enemyId, 64);
    const paralyzed = integerOrNull(status?.paralyzed, 1, 9);
    if (safeEnemyId && paralyzed !== null) flags[runtimeKey('enemy', safeEnemyId, 'paralyzed')] = paralyzed;
  });

  Object.entries(source.classAbilityCharges || {}).forEach(([memberId, rawCharges]) => {
    const safeMemberId = shortStringOrNull(memberId, 40);
    const charges = integerOrNull(rawCharges, 0, 99);
    if (safeMemberId && charges !== null) flags[runtimeKey('ability', safeMemberId, 'charges')] = charges;
  });

  const map = source.mapId ? chroniclesMapById(source.mapId) : null;
  (map?.enemies || []).forEach((enemy) => {
    const sighting = source.enemyAwareness?.[enemy.id];
    const seenX = integerOrNull(sighting?.x);
    const seenY = integerOrNull(sighting?.y);
    const seenTick = integerOrNull(sighting?.tick);
    if (sighting?.mapId === source.mapId
      && ['explore', 'combat'].includes(sighting?.phase)
      && seenX !== null && seenY !== null && seenTick !== null
      && validWalkablePosition(map, seenX, seenY)) {
      flags[runtimeKey('enemy', enemy.id, 'seenX')] = seenX;
      flags[runtimeKey('enemy', enemy.id, 'seenY')] = seenY;
      flags[runtimeKey('enemy', enemy.id, 'seenTick')] = seenTick;
      flags[runtimeKey('enemy', enemy.id, 'seenPhase')] = sighting.phase;
    }
    const position = source.enemyPositions?.[enemy.id];
    const enemyX = integerOrNull(position?.x);
    const enemyY = integerOrNull(position?.y);
    if (enemyX === null || enemyY === null) return;
    flags[runtimeKey('enemy', enemy.id, 'x')] = enemyX;
    flags[runtimeKey('enemy', enemy.id, 'y')] = enemyY;
  });

  // Who stays dead where (including the current map), as «0,3,7» per map.
  const currentMap = source.mapId ? chroniclesMapById(source.mapId) : null;
  const slain = chroniclesMergeSlain(source.slainEnemies, currentMap?.id, chroniclesSlainIndices(currentMap, source));
  Object.entries(slain).forEach(([mapId, indices]) => {
    const list = (Array.isArray(indices) ? indices : []).filter((index) => Number.isInteger(index) && index >= 0);
    if (list.length && mapId.length <= 64) flags[runtimeKey('slain', mapId)] = list.join(',').slice(0, 256);
  });

  return { ...flags, ...checkpointMapFlagParts(source), ...runProgressionFlags(source.runProgression) };
}

function slainFromFlags(flags) {
  const prefix = runtimeKey('slain', '');
  const slain = {};
  Object.entries(flags || {}).forEach(([key, value]) => {
    if (!key.startsWith(prefix) || typeof value !== 'string') return;
    const mapId = key.slice(prefix.length);
    let map = null;
    try { map = chroniclesMapById(mapId); } catch { return; }
    if (!map || map.id !== mapId) return;
    // Number('') and Number(' ') both equal 0: malformed trailing CSV
    // separators must never mark the first enemy dead on checkpoint recovery.
    const indices = value.split(',')
      .map((token) => token.trim())
      .filter((token) => /^\d+$/.test(token))
      .map(Number)
      .filter((index) => Number.isInteger(index) && index >= 0 && index < map.enemies.length);
    if (indices.length) slain[mapId] = [...new Set(indices)].sort((a, b) => a - b);
  });
  return slain;
}

// Legacy worldFlags may contain arbitrary primitive keys. They are not
// allowed to replace the reducer's structural state (map, phase, party,
// combat, etc.); those fields have their own validated runtime checkpoint
// representation. Keep unknown legacy *authored* flags for compatibility.
const NON_AUTHORED_WORLD_FLAG_KEYS = new Set([
  'mapId', 'combatRules', 'phase', 'turnPhase', 'initiative',
  'x', 'y', 'direction', 'turns', 'round', 'explorationEnemySteps',
  'party', 'partyPositions', 'enemyPositions', 'enemyAwareness',
  'mapFlagsById', 'slainEnemies', 'equipment', 'inventory', 'quests',
  'consumedContentIds', 'claimedRewards', 'runProgression',
  'spellPoints', 'spellbook', 'bagOwners', 'guildMemberships',
  'classAbilityCharges', 'enemyStatus', 'combatWard', 'combatBlock',
]);

function authoredWorldFlags(flags) {
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) return {};
  return Object.fromEntries(
    Object.entries(flags).filter(([key, value]) => (
      !String(key).startsWith(RUNTIME_PREFIX) && !NON_AUTHORED_WORLD_FLAG_KEYS.has(key)
      && authoredInitialFlagTypeMatches(key, value)
    )),
  );
}

function validWalkablePosition(map, x, y) {
  const row = map?.grid?.[y];
  return typeof row === 'string' && x >= 0 && x < row.length && row[x] !== '#';
}

function applyRuntimeCheckpoint(state, flags) {
  if (!state || !flags || flags[RUNTIME_VERSION_KEY] !== RUNTIME_VERSION) return state;

  const map = chroniclesMapById(state.mapId);
  const x = integerOrNull(flags[runtimeKey('x')]);
  const y = integerOrNull(flags[runtimeKey('y')]);
  const direction = integerOrNull(flags[runtimeKey('direction')], 0, 3);
  const turns = integerOrNull(flags[runtimeKey('turns')]);
  const round = integerOrNull(flags[runtimeKey('round')]);
  const explorationEnemySteps = integerOrNull(flags[runtimeKey('explorationEnemySteps')]);
  // Only reducer-owned phases/turn owners may be restored. A corrupt string
  // must never strand a saved expedition in an unrecognized state.
  const phase = ['explore', 'combat', 'defeated', 'escaped'].includes(flags[runtimeKey('phase')])
    ? flags[runtimeKey('phase')] : null;
  const turnPhase = ['party', 'enemy'].includes(flags[runtimeKey('turnPhase')])
    ? flags[runtimeKey('turnPhase')] : null;

  let next = { ...state };
  const savedMapFlags = restoredMapFlagSnapshots(flags);
  if (savedMapFlags) next.mapFlagsById = savedMapFlags;
  if (x !== null && y !== null && validWalkablePosition(map, x, y)) {
    next.x = x;
    next.y = y;
  }
  if (direction !== null) next.direction = direction;
  if (turns !== null) next.turns = turns;
  if (round !== null) next.round = round;
  if (explorationEnemySteps !== null) next.explorationEnemySteps = explorationEnemySteps;
  if (phase !== null) next.phase = phase;
  if (turnPhase !== null) next.turnPhase = turnPhase;
  const serializedInitiative = flags[runtimeKey('initiative')];
  if (typeof serializedInitiative === 'string' && serializedInitiative.length <= 16384) {
    try {
      next.initiative = normalizedInitiative(JSON.parse(serializedInitiative));
    } catch {
      next.initiative = null;
    }
  }
  // Enemy turns and initiative exist only inside combat. Legacy or damaged
  // checkpoints may disagree; do not freeze exploration behind a ghost turn.
  // Preserve the *absence* of turnPhase on valid older saves: adding "party"
  // changes their checkpoint fingerprint and causes unnecessary writes.
  const invalidTurnOwner = flags[runtimeKey('turnPhase')] !== undefined && turnPhase === null;
  if (next.phase !== 'combat') {
    if (next.turnPhase === 'enemy' || invalidTurnOwner) next.turnPhase = 'party';
    next.initiative = null;
  } else if (invalidTurnOwner || (!next.initiative && next.turnPhase === 'enemy')) {
    next.turnPhase = 'party';
  }

  if (Array.isArray(next.party)) {
    next.party = next.party.map((member) => {
      const hp = integerOrNull(flags[runtimeKey('party', member.id, 'hp')]);
      if (hp === null) return member;
      return { ...member, hp: Math.min(Math.max(0, hp), Math.max(0, Number(member.maxHp) || 0)) };
    });

    const restoredPartyPositions = {};
    next.party.forEach((member) => {
      const partyX = integerOrNull(flags[runtimeKey('party', member.id, 'x')]);
      const partyY = integerOrNull(flags[runtimeKey('party', member.id, 'y')]);
      if (partyX === null || partyY === null || !validWalkablePosition(map, partyX, partyY)) return;
      restoredPartyPositions[member.id] = { x: partyX, y: partyY };
    });
    if (Object.keys(restoredPartyPositions).length) next.partyPositions = restoredPartyPositions;
  }

  const equipment = {};
  (next.party || []).forEach((member) => {
    const stored = Object.fromEntries(CHRONICLES_EQUIPMENT_SLOTS.map((slot) => (
      [slot, shortStringOrNull(flags[runtimeKey('gear', member.id, slot)], 64)]
    )).filter(([, itemId]) => itemId));
    // Saves from before the missile slot kept the bow as the weapon.
    const gear = chroniclesNormalizeMemberEquipment(stored);
    for (const slot of CHRONICLES_EQUIPMENT_SLOTS) {
      const itemId = gear[slot];
      if (!itemId) continue;
      // Validate against the same class/slot catalog as live equip actions.
      const matched = chroniclesEquippedItem({ party: [member], equipment: { [member.id]: { [slot]: itemId } } }, member.id, slot);
      if (!matched) continue;
      equipment[member.id] = { ...equipment[member.id], [slot]: matched.id };
    }
  });
  next.equipment = equipment;

  // Invalid/obsolete bag flag entries never create objects: only surviving
  // item counts in the validated aggregate inventory may be assigned.
  if (next.combatRules === 'mm3') {
    const bagOwners = {};
    for (const member of next.party || []) {
      const bag = {};
      for (const itemId of Object.keys(next.inventory || {})) {
        if (itemId === 'crown-gold' || itemId.length > 80) continue;
        const quantity = integerOrNull(flags[runtimeKey('bag', member.id, itemId)], 1, 9999);
        if (quantity !== null) bag[itemId] = quantity;
      }
      if (Object.keys(bag).length) bagOwners[member.id] = bag;
    }
    next.bagOwners = chroniclesBagOwnership({ ...next, bagOwners });
  }

  const spellPoints = {};
  const spellbook = {};
  (next.party || []).forEach((member) => {
    const sp = integerOrNull(flags[runtimeKey('party', member.id, 'sp')], 0, 999);
    if (sp !== null) spellPoints[member.id] = sp;
    const book = flags[runtimeKey('spells', member.id)];
    if (typeof book === 'string') {
      spellbook[member.id] = [...new Set(book.split(',').filter((id) => chroniclesSpellAvailableTo(member, id)))];
    }
  });
  if (Object.keys(spellPoints).length) next.spellPoints = spellPoints;
  else delete next.spellPoints;
  if (Object.keys(spellbook).length) next.spellbook = spellbook;
  else delete next.spellbook;
  const guildPrefix = runtimeKey('guild', '');
  const guildMemberships = Object.fromEntries(Object.entries(flags)
    .filter(([key, value]) => key.startsWith(guildPrefix) && value === true)
    .map(([key]) => [key.slice(guildPrefix.length), true]));
  if (Object.keys(guildMemberships).length) next.guildMemberships = guildMemberships;
  else delete next.guildMemberships;

  const trackedQuestId = shortStringOrNull(flags[runtimeKey('trackedQuest')], 64);
  if (trackedQuestId) next.trackedQuestId = trackedQuestId;
  const ward = integerOrNull(flags[runtimeKey('ward')], 1, 9);
  if (ward !== null && next.initiative) next.combatWard = { armorClass: ward };
  // Older checkpoints have no BLOCK flags; malformed/foreign IDs are ignored.
  if (next.phase === 'combat' && next.initiative && Array.isArray(next.party)) {
    const guards = Object.fromEntries(next.party
      .filter((member) => member.hp > 0 && flags[runtimeKey('block', member.id)] === true)
      .map((member) => [member.id, true]));
    if (Object.keys(guards).length) next.combatBlock = guards;
  }
  const enemyStatus = {};
  (map?.enemies || []).forEach((enemy) => {
    const paralyzed = integerOrNull(flags[runtimeKey('enemy', enemy.id, 'paralyzed')], 1, 9);
    if (paralyzed !== null) enemyStatus[enemy.id] = { paralyzed };
  });
  if (Object.keys(enemyStatus).length) next.enemyStatus = enemyStatus;

  if (next.classAbilityCharges && typeof next.classAbilityCharges === 'object') {
    const charges = { ...next.classAbilityCharges };
    Object.keys(charges).forEach((memberId) => {
      const restored = integerOrNull(flags[runtimeKey('ability', memberId, 'charges')], 0, 99);
      if (restored !== null) charges[memberId] = restored;
    });
    next.classAbilityCharges = charges;
  }

  const enemyPositions = {
    ...(next.enemyPositions && typeof next.enemyPositions === 'object' ? next.enemyPositions : {}),
  };
  let restoredEnemyPosition = false;
  (map?.enemies || []).forEach((enemy) => {
    const enemyX = integerOrNull(flags[runtimeKey('enemy', enemy.id, 'x')]);
    const enemyY = integerOrNull(flags[runtimeKey('enemy', enemy.id, 'y')]);
    if (enemyX === null || enemyY === null || !validWalkablePosition(map, enemyX, enemyY)) return;
    enemyPositions[enemy.id] = { x: enemyX, y: enemyY };
    restoredEnemyPosition = true;
  });
  if (restoredEnemyPosition) {
    // A stale or malformed checkpoint must not stack living enemies in one
    // cell, including a restored position on another foe's default spawn.
    // Fall back to authored spawns as a group rather than inventing a tile.
    const occupied = new Set();
    const overlaps = (map?.enemies || []).some((enemy) => {
      if (Number(next[enemy.hpKey] ?? enemy.maxHp) <= 0) return false;
      const position = enemyPositions[enemy.id] || { x: enemy.x, y: enemy.y };
      const cell = `${position.x},${position.y}`;
      if (occupied.has(cell)) return true;
      occupied.add(cell);
      return false;
    });
    if (!overlaps) next.enemyPositions = enemyPositions;
  }

  const enemyAwareness = {};
  (map?.enemies || []).forEach((enemy) => {
    const seenX = integerOrNull(flags[runtimeKey('enemy', enemy.id, 'seenX')]);
    const seenY = integerOrNull(flags[runtimeKey('enemy', enemy.id, 'seenY')]);
    const tick = integerOrNull(flags[runtimeKey('enemy', enemy.id, 'seenTick')]);
    const seenPhase = flags[runtimeKey('enemy', enemy.id, 'seenPhase')];
    if (seenX === null || seenY === null || tick === null
      || !validWalkablePosition(map, seenX, seenY)
      || !['explore', 'combat'].includes(seenPhase)) return;
    enemyAwareness[enemy.id] = { x: seenX, y: seenY, tick, phase: seenPhase, mapId: state.mapId };
  });
  next.enemyAwareness = enemyAwareness;
  const slain = slainFromFlags(flags);
  if (Object.keys(slain).length) next.slainEnemies = slain;

  if (
    Array.isArray(next.party)
    && next.party.length > 0
    && next.party.every((member) => Number(member.hp || 0) <= 0)
  ) {
    next.phase = 'defeated';
    next.turnPhase = 'party';
  }

  return next;
}

export function chroniclesRunHasRuntimeCheckpoint(run) {
  return Boolean(
    run?.worldFlags
    && typeof run.worldFlags === 'object'
    && run.worldFlags[RUNTIME_VERSION_KEY] === RUNTIME_VERSION
  );
}

export function chroniclesWorldFlagsForCheckpoint(state) {
  const source = state && typeof state === 'object' ? state : {};
  const authored = Object.fromEntries(
    checkpointFlagKeys(source.mapId)
      .filter((key, index, keys) => keys.indexOf(key) === index)
      .filter((key) => Object.prototype.hasOwnProperty.call(source, key))
      .filter((key) => durableFlagValue(source[key]) && authoredInitialFlagTypeMatches(key, source[key]))
      .map((key) => [key, source[key]]),
  );
  return {
    ...authored,
    ...runtimeCheckpointFlags(source),
  };
}

export function chroniclesRunCheckpointPayload(state, worldVersion, { terminalStatus = null } = {}) {
  if (!state?.mapId) throw new Error('Chronicles checkpoint requires a current map');
  if (!Number.isInteger(worldVersion) || worldVersion < 0) {
    throw new Error('Chronicles checkpoint requires a non-negative worldVersion');
  }
  const requestedTerminalStatus = terminalStatus || (state.phase === 'defeated' ? 'defeated' : null);
  if (requestedTerminalStatus && !['completed', 'defeated'].includes(requestedTerminalStatus)) {
    throw new Error('Chronicles checkpoint terminalStatus is invalid');
  }
  if (requestedTerminalStatus === 'completed' && state.phase !== 'escaped') {
    throw new Error('Chronicles completed checkpoint requires escaped phase');
  }
  if (requestedTerminalStatus === 'defeated' && state.phase !== 'defeated') {
    throw new Error('Chronicles defeated checkpoint requires defeated phase');
  }
  return Object.freeze({
    expectedWorldVersion: worldVersion,
    currentMapId: state.mapId,
    worldFlags: chroniclesWorldFlagsForCheckpoint(state),
    inventory: normalizedInventory(state.inventory),
    quests: normalizedQuests(state.quests),
    consumedContentIds: normalizedLedger(state.consumedContentIds),
    claimedRewards: normalizedLedger(state.claimedRewards),
    ...(requestedTerminalStatus ? { terminalStatus: requestedTerminalStatus } : {}),
  });
}

export function chroniclesApplyRunCheckpoint(state, run) {
  if (!state || !run) return state;
  const worldFlags = run.worldFlags || {};
  const durable = {
    ...state,
    ...authoredWorldFlags(worldFlags),
    ...(run.inventory === undefined ? {} : { inventory: normalizedInventory(run.inventory) }),
    ...(run.quests === undefined ? {} : { quests: normalizedQuests(run.quests) }),
    consumedContentIds: normalizedLedger(run.consumedContentIds),
    claimedRewards: normalizedLedger(run.claimedRewards),
  };
  const restored = chroniclesApplyStartingKit(applyRuntimeCheckpoint(durable, worldFlags), run);
  const savedProgression = chroniclesCheckpointRunProgression(run);
  if (savedProgression) restored.runProgression = savedProgression;
  const runStatus = run.runStatus || run.status || 'active';
  if (runStatus === 'completed') return { ...restored, phase: 'escaped' };
  if (runStatus === 'defeated') return { ...restored, phase: 'defeated', turnPhase: 'party' };
  return restored;
}

export function chroniclesRunCheckpointFingerprint(state) {
  if (!state?.mapId) return '';
  const payload = chroniclesRunCheckpointPayload(state, 0);
  return JSON.stringify({
    currentMapId: payload.currentMapId,
    worldFlags: payload.worldFlags,
    inventory: payload.inventory,
    quests: payload.quests,
    consumedContentIds: payload.consumedContentIds,
    claimedRewards: payload.claimedRewards,
    terminalStatus: payload.terminalStatus || null,
  });
}
