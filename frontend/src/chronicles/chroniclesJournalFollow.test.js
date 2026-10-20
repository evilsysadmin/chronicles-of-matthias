import { describe, expect, it } from 'vitest';
import { chroniclesReduce, chroniclesTrackQuest, createChroniclesState } from '../chroniclesOfMatthias.js';

const campaign = () => ({
  ...createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
  quests: {
    'banner-contract': { id: 'banner-contract', status: 'active', title: 'El estandarte perdido', objective: 'Busca el estandarte.' },
    'names-in-wood': { id: 'names-in-wood', status: 'active', title: 'Los nombres del bosque', objective: 'Busca las placas.' },
    'road-bandits': { id: 'road-bandits', status: 'completed', title: 'Bandidos del Camino' },
  },
});

describe('journal quest following uses canonical campaign tracking', () => {
  it('follows, replaces and restores automatic tracking via the existing reducer', () => {
    const initial = campaign();
    const banner = chroniclesReduce(initial, { type: 'track-quest', questId: 'banner-contract' });
    expect(banner.trackedQuestId).toBe('banner-contract');
    expect(banner.message).toContain('El estandarte perdido');
    const forest = chroniclesReduce(banner, { type: 'track-quest', questId: 'names-in-wood' });
    expect(forest.trackedQuestId).toBe('names-in-wood');
    const restored = chroniclesReduce(forest, { type: 'track-quest', questId: null });
    expect(restored).not.toHaveProperty('trackedQuestId');
    expect(initial).not.toHaveProperty('trackedQuestId');
    expect(forest.quests).toBe(initial.quests);
    expect(restored.turns).toBe(initial.turns);
  });

  it('cannot prioritize completed or unknown contracts and avoids redundant updates', () => {
    const initial = campaign();
    expect(chroniclesTrackQuest(initial, 'road-bandits')).toBe(initial);
    expect(chroniclesTrackQuest(initial, 'nonexistent-quest')).toBe(initial);
    const followed = chroniclesTrackQuest(initial, 'banner-contract');
    expect(chroniclesTrackQuest(followed, 'banner-contract')).toBe(followed);
    expect(chroniclesTrackQuest(followed, 'road-bandits')).not.toHaveProperty('trackedQuestId');
  });
});
