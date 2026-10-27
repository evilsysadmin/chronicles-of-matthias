import {
  CHRONICLES_MAX_LEVEL,
  chroniclesHeroProgress,
  normalizeChroniclesProgression,
} from '../chroniclesOfMatthiasProgression.js';

const HERO_IDS = Object.freeze(['matthias', 'rook', 'bishop', 'knight']);
const DEPTH_PRESSURE_CAP = 6;
const ABOVE_PARTY_CAP = 1;

function boundedInteger(value, min, max, fallback = min) {
  // Go's boundedInt rejects booleans and structured values. Number([4]) or
  // Number(true) would otherwise invent dungeon depth in a corrupt save.
  if (typeof value !== 'number' && typeof value !== 'string') return fallback;
  if (typeof value === 'number' && Math.abs(value) >= 2 ** 63) return fallback;
  if (typeof value === 'string') {
    // Go's pyval.Int accepts decimal integer strings (with single underscores),
    // not JS-only numeric coercions like "0x10", "4.5" or "4e1".
    const raw = value.trim();
    if (!/^[+-]?[0-9](?:_?[0-9])*$/.test(raw)) return fallback;
    const magnitude = raw.replace(/^[+-]/, '').replace(/_/g, '').replace(/^0+/, '') || '0';
    // Go parses the unsigned magnitude as a signed int64 before applying sign.
    if (magnitude.length > 19 || (magnitude.length === 19 && magnitude > '9223372036854775807')) {
      return fallback;
    }
    value = Number(raw.replace(/_/g, ''));
  }
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

export function chroniclesDeployedPartyLevel(progression, deployedMemberIds = HERO_IDS) {
  const current = normalizeChroniclesProgression(progression);
  // Legacy or malformed saved deployment data must not crash difficulty setup.
  // The default roster is the only safe fallback for a non-array value.
  const memberIds = Array.isArray(deployedMemberIds) ? deployedMemberIds : HERO_IDS;
  const levels = [...new Set(memberIds)]
    .filter((memberId) => HERO_IDS.includes(memberId))
    .map((memberId) => chroniclesHeroProgress(current, memberId).level);
  if (!levels.length) return 1;
  const average = levels.reduce((sum, level) => sum + level, 0) / levels.length;
  return boundedInteger(Math.round(average), 1, CHRONICLES_MAX_LEVEL, 1);
}

export function chroniclesRunDepth(authoritativeRun, mapId = null) {
  const areas = Array.isArray(authoritativeRun?.areas) ? authoritativeRun.areas : [];
  const currentMapId = mapId || authoritativeRun?.currentMapId;
  if (typeof currentMapId !== 'string' || !currentMapId.trim()) return 0;
  const index = areas.findIndex((area) => area?.mapId === currentMapId);
  if (index < 0) return 0;
  // Malformed legacy route entries must not count as dungeon floors.
  // Valid old routes still use their ordered dungeon stops as before.
  const visited = areas.slice(0, index + 1).filter((area) =>
    typeof area?.mapId === 'string' && area.mapId.trim().length > 0);
  // When an overworld is authored, village and road stops do not add dungeon
  // floors or artificial combat pressure to the first real dungeon.
  const hasRegionKinds = areas.some((area) => area?.regionKind || area?.map?.regionKind);
  if (!hasRegionKinds) return Math.max(0, visited.length - 1);
  const dungeonVisits = visited.filter((area) =>
    (area?.regionKind || area?.map?.regionKind || 'dungeon') === 'dungeon').length;
  return Math.max(0, dungeonVisits - 1);
}

export function chroniclesDifficultyBand({
  progression,
  deployedMemberIds = HERO_IDS,
  depth = 0,
} = {}) {
  const partyLevel = chroniclesDeployedPartyLevel(progression, deployedMemberIds);
  const safeDepth = boundedInteger(depth, 0, 99, 0);

  // Depth always matters, but only half of player progression is mirrored.
  // A level-up therefore keeps real value instead of making enemies track 1:1.
  const depthPressure = Math.min(DEPTH_PRESSURE_CAP, Math.floor(safeDepth / 2));
  const progressionPressure = Math.floor((partyLevel - 1) / 2);
  const uncappedTarget = 1 + depthPressure + progressionPressure;
  const targetLevel = Math.min(
    CHRONICLES_MAX_LEVEL,
    partyLevel + ABOVE_PARTY_CAP,
    uncappedTarget,
  );

  return Object.freeze({
    partyLevel,
    depth: safeDepth,
    targetLevel,
    minLevel: Math.max(1, targetLevel - 1),
    maxLevel: Math.min(CHRONICLES_MAX_LEVEL, partyLevel + ABOVE_PARTY_CAP, targetLevel + 1),
    depthPressure,
    progressionPressure,
  });
}


// The Go API always returns these seven integer fields in a difficulty band.
// Corrupt legacy snapshots must not override a safe local recomputation.
const REQUIRED_DIFFICULTY_FIELDS = [
  'partyLevel', 'depth', 'targetLevel', 'minLevel', 'maxLevel',
  'depthPressure', 'progressionPressure',
];

function isUsableDifficultySnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (!REQUIRED_DIFFICULTY_FIELDS.every((field) => Number.isSafeInteger(value[field]))) return false;
  // These fields form one deterministic band in Go, not seven independent
  // ranges. A saved snapshot can pass every range check yet misstate threat.
  const expectedDepthPressure = Math.min(DEPTH_PRESSURE_CAP, Math.floor(value.depth / 2));
  const expectedProgressionPressure = Math.floor((value.partyLevel - 1) / 2);
  const expectedTarget = Math.min(
    CHRONICLES_MAX_LEVEL,
    value.partyLevel + ABOVE_PARTY_CAP,
    1 + expectedDepthPressure + expectedProgressionPressure,
  );
  return value.partyLevel >= 1 && value.partyLevel <= CHRONICLES_MAX_LEVEL
    && value.depth >= 0 && value.depth <= 99
    && value.targetLevel >= 1 && value.targetLevel <= CHRONICLES_MAX_LEVEL
    // Go difficultyBand caps both the target and the upper encounter range
    // at one level above the deployed party, even on very deep floors.
    && value.targetLevel <= value.partyLevel + ABOVE_PARTY_CAP
    && value.minLevel >= Math.max(1, value.targetLevel - 1)
    && value.minLevel <= value.targetLevel
    && value.maxLevel >= value.targetLevel && value.maxLevel <= CHRONICLES_MAX_LEVEL
    && value.maxLevel <= value.partyLevel + ABOVE_PARTY_CAP
    && value.maxLevel <= value.targetLevel + 1
    && value.depthPressure >= 0 && value.depthPressure <= DEPTH_PRESSURE_CAP
    && value.progressionPressure >= 0
    && value.progressionPressure <= Math.floor((CHRONICLES_MAX_LEVEL - 1) / 2)
    && value.depthPressure === expectedDepthPressure
    && value.progressionPressure === expectedProgressionPressure
    && value.targetLevel === expectedTarget
    && value.minLevel === Math.max(1, expectedTarget - 1)
    && value.maxLevel === Math.min(
      CHRONICLES_MAX_LEVEL, value.partyLevel + ABOVE_PARTY_CAP, expectedTarget + 1,
    );
}

export function chroniclesResolvedDifficultyBand(
  authoritativeRun,
  mapId,
  fallback = {},
) {
  // A malformed legacy save may contain a non-array `areas` value.
  // Do not let its shape crash the local difficulty fallback.
  const areas = Array.isArray(authoritativeRun?.areas) ? authoritativeRun.areas : [];
  const authoritative = areas.find((area) => area?.mapId === mapId)?.difficulty;
  if (isUsableDifficultySnapshot(authoritative)) return authoritative;
  return chroniclesDifficultyBand(fallback);
}
