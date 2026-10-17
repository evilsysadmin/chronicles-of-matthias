import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import { chroniclesMapById, chroniclesMapIds } from './chroniclesMapCatalog.js';

// The campaign bot found no way back for a fallen hero: every healer only
// tended the living. Temples (and Ilse's altar in Swordhaven) raise them.
describe('Chronicles temples', () => {
  it('raise the fallen before tending the wounds', () => {
    const state = createChroniclesState();
    const fallen = { ...state, party: state.party.map((member, index) => ({ ...member, hp: index === 0 ? 0 : 1 })) };
    const raised = chroniclesApplyContentEffects(fallen, [{ type: 'revive-party' }, { type: 'heal-party', amount: 3 }]);
    expect(raised.party[0].hp).toBe(Math.min(raised.party[0].maxHp, 4));
    raised.party.slice(1).forEach((member) => expect(member.hp).toBe(Math.min(member.maxHp, 4)));
  });

  it('are offered in every town that heals, Swordhaven included', () => {
    const heals = (map) => (map.interactables || []).some((entry) => entry.kind === 'service'
      && (entry.action?.effects || []).some((effect) => effect.type === 'heal-party'));
    const towns = chroniclesMapIds().map((id) => chroniclesMapById(id))
      .filter((map) => map.regionKind === 'settlement' && heals(map));
    expect(towns.map((town) => town.id)).toContain('swordhaven-first-book');
    expect(towns.length).toBeGreaterThan(5);
    towns.forEach((town) => {
      const revives = (town.interactables || []).some((entry) => (entry.action?.effects || []).some((effect) => effect.type === 'revive-party'));
      expect(revives, town.id).toBe(true);
    });
  });
});
