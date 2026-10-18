import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import { chroniclesMapById, chroniclesMapIds } from './chroniclesMapCatalog.js';

const inns = chroniclesMapIds()
  .map((id) => chroniclesMapById(id))
  .flatMap((map) => map.interactables
    .filter((entry) => entry.id === 'first-book-healer' || entry.id.endsWith('-inn'))
    .map((entry) => [map.id, entry]));

describe('Chronicles · a night at the inn', () => {
  it('every town has one', () => {
    expect(inns.length).toBeGreaterThanOrEqual(9);
  });

  it.each(inns)('%s: everyone standing wakes at full health; the fallen stay fallen', (_, inn) => {
    const base = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    const hurt = {
      ...base,
      party: base.party.map((member, index) => ({ ...member, maxHp: 60, hp: index === 0 ? 0 : 3 })),
    };
    const rested = chroniclesApplyContentEffects(hurt, inn.action.effects.filter((effect) => effect.type !== 'consume-item'));
    expect(rested.party[0].hp).toBe(0);
    expect(rested.party.slice(1).every((member) => member.hp === 60)).toBe(true);
  });
});
