// Presentation-only gate for first-person town actions. Authored quest and
// counter rules remain unchanged; avoid advertising a doorway before the
// party actually stands in front of it.
import { chroniclesMapForState } from './chroniclesMapCatalog.js';

const DIRECTIONS = Object.freeze([[0, -1], [1, 0], [0, 1], [-1, 0]]);

export function chroniclesDoorwayPrompt(state, contextual, npc) {
  if (!state) return { contextual: null, npc: null };
  const map = chroniclesMapForState(state);
  const entryById = (id) => (map?.interactables || []).find((entry) => entry.id === id);
  const available = (entry) => {
    if (!entry) return true; // Portals and other virtual actions have no map entry.
    const building = String(entry.visualType || '').startsWith('building-');
    const doorway = building || Boolean(entry.shop || entry.guild);
    const townShrine = map?.regionKind === 'settlement' && entry.visualType === 'shrine';
    if (!doorway && !townShrine) return true;
    if (entry.x !== state.x || entry.y !== state.y) return false;
    if (!building) return true;
    const dir = DIRECTIONS[state.direction];
    return Boolean(dir && map.grid?.[state.y + dir[1]]?.[state.x + dir[0]] === '#');
  };
  return {
    contextual: contextual && available(entryById(contextual.id)) ? contextual : null,
    npc: npc && available(entryById(npc.id)) ? npc : null,
  };
}
