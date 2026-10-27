import { chroniclesMapForState } from './chroniclesMapCatalog.js';
import { chroniclesQuestEntries, chroniclesRequirementsMet } from './chroniclesContentRuntime.js';

// A notice board is an enduring place, not a one-use loot item. The authored
// start-quest effect is the source of its offer; quests already accepted retain
// their live persisted progress and completed status.
export function chroniclesNoticeBoardEntries(state) {
  const map = state ? chroniclesMapForState(state) : null;
  const posted = (map?.interactables || [])
    .filter((entry) => entry.visualType === 'notice-board')
    .map((entry) => {
      const start = (entry.action?.effects || []).find((effect) => effect.type === 'start-quest');
      if (!start?.questId) return null;
      const saved = state.quests?.[start.questId];
      const status = saved?.status || 'available';
      return {
        id: entry.id,
        questId: start.questId,
        title: saved?.title || start.title,
        description: saved?.description || start.description,
        objective: saved?.objective || start.objective,
        detail: entry.action?.journal?.body || '',
        status,
        canAccept: status === 'available' && chroniclesRequirementsMet(state, entry.requirements),
      };
    }).filter(Boolean);
  const postedIds = new Set(posted.map((offer) => offer.questId));
  const other = chroniclesQuestEntries(state)
    .filter((quest) => !postedIds.has(quest.id))
    .map((quest) => ({
      id: quest.id,
      title: quest.title,
      description: quest.description,
      objective: quest.objective,
      status: quest.status,
    }));
  return { posted, other };
}
