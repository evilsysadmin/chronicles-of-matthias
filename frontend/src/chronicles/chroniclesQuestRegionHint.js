// Authored regional quest hints, not guessed coordinates. Content writers add
// stages to quest-region-hints.json; no quest-ID-specific UI logic or save data.
// Stages are matched in order. Missing or unrevealed places stay unknown.
import questRegionHints from './campaign/quest-region-hints.json';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { chroniclesRequirementsMet } from './chroniclesContentRuntime.js';

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
