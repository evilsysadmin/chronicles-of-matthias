// Authored regional quest hints, not guessed coordinates. Content writers add
// stages to quest-region-hints.json; no quest-ID-specific UI logic or save data.
// Stages are matched in order. Missing or unrevealed places stay unknown.
import questRegionHints from './campaign/quest-region-hints.json';
import { chroniclesMapById, chroniclesMapForState } from './chroniclesMapCatalog.js';
import { chroniclesQuestEntries, chroniclesRequirementsMet } from './chroniclesContentRuntime.js';

function stageMatches(stage, quest, state) {
  if (Array.isArray(stage.when) && !chroniclesRequirementsMet(state, stage.when)) return false;
  if (Array.isArray(stage.objectiveIncludes)
    && !stage.objectiveIncludes.every((fragment) => String(quest.objective || '').includes(fragment))) return false;
  return true;
}

export function chroniclesQuestRegionHint(quest, state) {
  if (!quest || quest.status !== 'active') return null;
  const stages = questRegionHints[quest.id];
  if (!Array.isArray(stages)) return null;
  const stage = stages.find((candidate) => stageMatches(candidate, quest, state));
  if (!stage) return null;
  const map = chroniclesMapById(stage.mapId);
  if (!map?.title) return null;
  return {
    mapId: map.id,
    region: String(map.title).split(' · ')[0],
    clue: stage.clue,
    kind: map.regionKind === 'settlement' ? 'Pueblo'
      : map.regionKind === 'wilderness' ? 'Exterior' : 'Mazmorra',
  };
}


/**
 * Relate an already-revealed quest hint to the party's actual map.
 * This never invents walking directions, route lengths or secret coordinates.
 * Maps in the same named region (e.g. Swordhaven square and its town) are
 * nearby in narrative terms, not necessarily on the exact destination tile.
 */
export function chroniclesQuestRegionContext(hint, state) {
  if (!hint?.mapId || !state?.mapId) return null;
  const current = chroniclesMapById(state.mapId);
  if (!current?.title) return null;
  const here = String(current.title).split(' · ')[0];
  if (state.mapId === hint.mapId) {
    return { relation: 'same-map', text: 'Ya estás en el lugar indicado. Sigue la pista del encargo.' };
  }
  if (here === hint.region) {
    return { relation: 'same-region', text: 'Estás en esta región. Puede que aún debas encontrar el acceso adecuado.' };
  }
  return { relation: 'another-region', text: `Desde ${here}, tus notas apuntan a ${hint.region}.` };
}

/**
 * The HUD must not imply an off-map objective is in front of the player.
 * Match the quest that the reducer actually chose for its OBJETIVO line,
 * then reuse only the location explicitly authored for that quest stage.
 * A local tactical objective (enemy/trigger/gate), unknown quest or
 * same-region destination must not acquire a fabricated travel hint.
 */
export function chroniclesHudQuestDestination(state, objective) {
  if (!state?.mapId || !objective) return null;
  const map = chroniclesMapForState(state);
  const campaignArea = ['settlement', 'wilderness'].includes(map.regionKind)
    || (map.regionKind === 'dungeon' && (map.exits || [])[0]?.requiresReturn === true);
  if (!campaignArea) return null;

  const active = chroniclesQuestEntries(state, 'active').filter((quest) => quest.objective);
  const localQuestIds = new Set((map.interactables || []).flatMap((entry) =>
    (entry.when || []).map((rule) => rule?.questId).filter(Boolean)));
  const followed = active.find((quest) => quest.id === state.trackedQuestId)
    || active.find((quest) => localQuestIds.has(quest.id)) || active[0];
  if (!followed || followed.objective !== objective) return null;
  const hint = chroniclesQuestRegionHint(followed, state);
  const context = chroniclesQuestRegionContext(hint, state);
  if (!hint || context?.relation !== 'another-region') return null;
  return Object.freeze({ mapId: hint.mapId, region: hint.region });
}
