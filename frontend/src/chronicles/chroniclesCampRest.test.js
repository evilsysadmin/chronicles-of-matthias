import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesCampRestStatus } from './chroniclesCampRest.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import { chroniclesMemberMaxSp, chroniclesMemberSp } from './chroniclesMagic.js';
import { chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

const mapId = 'swordhaven-sewers';
const initial = () => createChroniclesState(mapId, null, { rules: 'mm3' });
const stocked = (state, quantity = 4) => ({
  ...state,
  inventory: {
    ...state.inventory,
    'road-rations': { id: 'road-rations', name: 'Raciones de viaje', quantity },
  },
});
const cleared = (state) => ({
  ...state,
  ...Object.fromEntries(chroniclesActiveEnemies(state).map(({ hpKey }) => [hpKey, 0])),
});
const wounded = (state) => ({
  ...state,
  party: state.party.map((member, index) => ({
    ...member, hp: index === 0 ? 0 : Math.max(1, member.maxHp - 3),
  })),
  spellPoints: { ...state.spellPoints, bishop: 0, matthias: 0 },
});

describe('MM3 field rest · safe expedition resources', () => {
  it('spends one ration per standing hero, heals only the living, and persists after a Go checkpoint', () => {
    const before = wounded(stocked(cleared(initial())));
    expect(chroniclesCampRestStatus(before, chroniclesActiveEnemies(before))).toMatchObject({
      canRest: true, rationsNeeded: 3, rationsAvailable: 4,
    });
    const after = chroniclesReduce(before, { type: 'camp-rest' });
    expect(after.turns).toBe(before.turns + 1);
    expect(after.inventory['road-rations'].quantity).toBe(1);
    expect(after.party[0].hp).toBe(0);
    expect(after.party.slice(1).every((hero) => hero.hp === hero.maxHp)).toBe(true);
    const bishop = after.party.find((hero) => hero.id === 'bishop');
    expect(chroniclesMemberSp(after, bishop)).toBe(chroniclesMemberMaxSp(after, bishop));
    expect(after.spellPoints.matthias).toBe(0); // Fallen companion not restored.
    const saved = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(after, 1)));
    const restored = chroniclesApplyRunCheckpoint(initial(), saved);
    expect(restored.inventory['road-rations'].quantity).toBe(1);
    expect(restored.party.map((hero) => hero.hp)).toEqual(after.party.map((hero) => hero.hp));
    expect(chroniclesMemberSp(restored, restored.party.find((hero) => hero.id === 'bishop')))
      .toBe(chroniclesMemberMaxSp(restored, bishop));
    expect(restored.turns).toBe(after.turns);
    expect(chroniclesReduce(after, 'camp-rest')).toBe(after); // No wasted rations at full health.
  });

  it('refuses insufficient, fractional or absent food atomically without spending time', () => {
    const base = wounded(cleared(initial()));
    for (const state of [base, stocked(base, 2), stocked(base, 2.5)]) {
      expect(chroniclesCampRestStatus(state, []).canRest).toBe(false);
      expect(chroniclesReduce(state, 'camp-rest')).toBe(state);
    }
  });

  it('rejects nearby enemies and any active initiative, including a stale replayed action', () => {
    const base = wounded(stocked(initial()));
    const goblin = chroniclesActiveEnemies(base).find((enemy) => enemy.id === 'sewers-goblin-west');
    expect(goblin).toBeTruthy();
    const position = chroniclesRuntimeEnemyPosition(base, goblin);
    const near = { ...base, x: position.x, y: position.y };
    expect(chroniclesCampRestStatus(near, [goblin]).reason).toContain('enemigos');
    expect(chroniclesReduce(near, 'camp-rest')).toBe(near);
    const fight = chroniclesStartInitiativeCombat(base, [goblin], {
      forceEnemyIds: [goblin.id], random: () => 0,
    });
    expect(fight.initiative).toBeTruthy();
    expect(chroniclesReduce(fight, 'camp-rest')).toBe(fight);
    const stale = { ...base, phase: 'combat' };
    expect(chroniclesReduce(stale, 'camp-rest')).toBe(stale);
  });

  it('never changes the independent Tactics rules or lets a stale inn camp', () => {
    const tactics = stocked(createChroniclesState(mapId));
    expect(chroniclesReduce(tactics, 'camp-rest')).toBe(tactics);
    const inn = { ...wounded(stocked(cleared(initial()))), inn: { id: 'first-book-healer' } };
    expect(chroniclesReduce(inn, 'camp-rest')).toBe(inn);
  });
});
