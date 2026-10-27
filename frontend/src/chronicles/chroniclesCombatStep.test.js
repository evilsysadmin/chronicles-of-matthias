import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import { chroniclesStartInitiativeCombat } from './chroniclesInitiative.js';
import { chroniclesLivingPartyPositions } from '../chroniclesPartyFootprint.js';

// Found by the campaign bot: a step during combat moved the camera but left
// the heroes' cells behind, so a creature could walk into the camera's cell.
describe('Chronicles combat step', () => {
  it('moves the whole company, not only the camera', () => {
    const arrived = chroniclesApplyContentEffects(createChroniclesState(), [{ type: 'transition-map', mapId: 'terra-a3' }]);
    const placed = { ...arrived, x: 10, y: 8, direction: 0, enemyPositions: { 'terra-a3-foe-0': { x: 10, y: 4 } } };
    const combat = chroniclesStartInitiativeCombat(placed, chroniclesActiveEnemies(placed), { forceEnemyIds: ['terra-a3-foe-0'] });
    expect(combat.initiative).toBeTruthy();
    const before = chroniclesLivingPartyPositions(combat);

    const stepped = chroniclesReduce(combat, 'forward');

    expect([stepped.x, stepped.y]).toEqual([10, 7]);
    const after = chroniclesLivingPartyPositions(stepped);
    expect(after).not.toEqual(before);
    const lead = after.find((entry) => entry.memberId === 'matthias').position;
    expect(Math.abs(lead.x - 10) + Math.abs(lead.y - 7)).toBeLessThanOrEqual(1);
    const cells = after.map(({ position }) => `${position.x},${position.y}`);
    expect(new Set(cells).size).toBe(cells.length);
  });
});

describe('MM3 initiative movement lock on an authored combat map', () => {
  it('freezes the company on its encounter cells, leaving enemy movement and facing available', () => {
    const initial = createChroniclesState(null, null, { rules: 'mm3' });
    const arrived = chroniclesApplyContentEffects(initial, [{ type: 'transition-map', mapId: 'terra-a3' }]);
    const placed = { ...arrived, x: 10, y: 8, direction: 0, enemyPositions: { 'terra-a3-foe-0': { x: 10, y: 4 } } };
    const combat = chroniclesStartInitiativeCombat(placed, chroniclesActiveEnemies(placed), { forceEnemyIds: ['terra-a3-foe-0'] });
    expect(combat.initiative?.order.length).toBeGreaterThan(0);
    const before = chroniclesLivingPartyPositions(combat);

    for (const action of ['forward', 'backward', 'strafe-left', 'strafe-right']) {
      const rejected = chroniclesReduce(combat, action);
      expect(rejected).toBe(combat);
      expect([rejected.x, rejected.y, rejected.turns, rejected.direction])
        .toEqual([combat.x, combat.y, combat.turns, combat.direction]);
      expect(chroniclesLivingPartyPositions(rejected)).toEqual(before);
    }
    const rotated = chroniclesReduce(combat, 'turn-left');
    expect(rotated.direction).toBe(3);
    expect([rotated.x, rotated.y]).toEqual([combat.x, combat.y]);
  });
});

describe('Chronicles camera cell', () => {
  it('is never entered by a creature, even when no hero deploys on it', async () => {
    const { chroniclesChooseEnemyStep } = await import('../chroniclesOfMatthiasTurns.js');
    const arrived = chroniclesApplyContentEffects(createChroniclesState(), [{ type: 'transition-map', mapId: 'terra-a3' }]);
    const enemy = chroniclesActiveEnemies(arrived).find((entry) => entry.id === 'terra-a3-foe-0');
    const state = {
      ...arrived,
      x: 10, y: 7, direction: 0,
      enemyPositions: { 'terra-a3-foe-0': { x: 10, y: 6 } },
      initiative: { order: [{ id: 'terra-a3-foe-0', kind: 'enemy' }], cursor: 0, round: 1 },
      partyPositions: { matthias: { x: 10, y: 8 }, rook: { x: 11, y: 8 }, bishop: { x: 10, y: 9 }, knight: { x: 11, y: 9 } },
    };
    const step = chroniclesChooseEnemyStep(state, enemy);
    expect(step && [step.x, step.y]).not.toEqual([10, 7]);
  });
});

describe('Chronicles knight-chasers in corridors', () => {
  it('crawl toward the company when no jump lands closer', async () => {
    const { chroniclesChooseEnemyStep } = await import('../chroniclesOfMatthiasTurns.js');
    const arrived = chroniclesApplyContentEffects(createChroniclesState(), [{ type: 'transition-map', mapId: 'templo-corona-cripta' }]);
    const spider = chroniclesActiveEnemies(arrived).find((entry) => entry.id === 'templo-corona-cripta-spider');
    const state = {
      ...arrived,
      x: 3, y: 4, direction: 2,
      enemyPositions: { [spider.id]: { x: 7, y: 5 } },
      initiative: { order: [{ id: spider.id, kind: 'enemy' }], cursor: 0, round: 3 },
      partyPositions: { matthias: { x: 3, y: 4 }, rook: { x: 4, y: 5 }, knight: { x: 5, y: 5 } },
      party: arrived.party.map((member) => (member.id === 'bishop' ? { ...member, hp: 0 } : member)),
    };
    const step = chroniclesChooseEnemyStep(state, spider);
    expect(step).toEqual({ x: 6, y: 5 });
  });
});

describe('Chronicles combat formation', () => {
  it('never deploys a hero on the far side of a wall', async () => {
    const { chroniclesDeployPartyForCombat } = await import('../chroniclesPartyFootprint.js');
    const arrived = chroniclesApplyContentEffects(createChroniclesState(), [{ type: 'transition-map', mapId: 'templo-corona-cripta' }]);
    // Sir Edric's diary lies on the camera's cell, so nobody can stand on it.
    const slain = Object.fromEntries(chroniclesActiveEnemies(arrived)
      .filter((enemy) => !['templo-corona-cripta-spider', 'templo-corona-cripta-wisp'].includes(enemy.id))
      .map((enemy) => [enemy.hpKey, 0]));
    const state = {
      ...arrived,
      ...slain,
      x: 3, y: 3, direction: 0,
      enemyPositions: { 'templo-corona-cripta-spider': { x: 6, y: 3 }, 'templo-corona-cripta-wisp': { x: 5, y: 9 } },
      partyPositions: {},
      initiative: { order: [{ id: 'matthias', kind: 'party' }], cursor: 0, round: 1 },
    };
    const deployed = chroniclesDeployPartyForCombat(state);
    const cells = Object.values(deployed.partyPositions);
    expect(cells).toHaveLength(4);
    // Column x=1 is a parallel corridor a wall away from (3,3).
    cells.forEach((cell) => expect(cell.x).toBeGreaterThan(2));
  });
});
