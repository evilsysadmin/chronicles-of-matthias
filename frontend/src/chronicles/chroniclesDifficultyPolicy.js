import {
  CHRONICLES_MAX_LEVEL,
  chroniclesHeroProgress,
  normalizeChroniclesProgression,
} from '../chroniclesOfMatthiasProgression.js';

const HERO_IDS = Object.freeze(['matthias', 'rook', 'bishop', 'knight']);
const DEPTH_PRESSURE_CAP = 6;
const ABOVE_PARTY_CAP = 1;

function boundedInteger(value, min, max, fallback = min) {
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
  if (typeof currentMapId !== 'string' || !currentMapId) return 0;
  const index = areas.findIndex((area) => area?.mapId === currentMapId);
  if (index < 0) return 0;
  // Malformed legacy route entries must not count as dungeon floors.
  // Valid old routes still use their ordered dungeon stops as before.
  const visited = areas.slice(0, index + 1).filter((area) =>
    typeof area?.mapId === 'string' && area.mapId.length > 0);
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


export function chroniclesResolvedDifficultyBand(
  authoritativeRun,
  mapId,
  fallback = {},
) {
  // A malformed legacy save may contain a non-array `areas` value.
  // Do not let its shape crash the local difficulty fallback.
  const areas = Array.isArray(authoritativeRun?.areas) ? authoritativeRun.areas : [];
  const authoritative = areas.find((area) => area?.mapId === mapId)?.difficulty;
  if (authoritative && typeof authoritative === 'object') return authoritative;
  return chroniclesDifficultyBand(fallback);
}
