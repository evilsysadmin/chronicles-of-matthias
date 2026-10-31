import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import {
  chroniclesAdvanceCombatInitiative,
  chroniclesCurrentInitiativeActor,
  chroniclesStartInitiativeCombat,
} from './chroniclesInitiative.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

const GOBLIN = 'sewers-goblin-west';
const usePotion = (targetId) => ({
  type: 'use-item', memberId: 'bishop', itemId: 'healing-potion', targetId,
});

function bishopEncounter() {
  const base = createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
  const enemies = chroniclesActiveEnemies(base);
  const goblin = enemies.find(({ id }) => id === GOBLIN);
  expect(goblin).toBeTruthy();
  const prepared = chroniclesApplyContentEffects({
    ...base, x: 1, y: 1, direction: 2,
    ...Object.fromEntries(enemies.filter(({ id }) => id !== GOBLIN).map(({ hpKey }) => [hpKey, 0])),
    enemyPositions: { [GOBLIN]: { x: 1, y: 2 } },
    party: base.party.map((member) => ['rook', 'knight'].includes(member.id)
      ? { ...member, hp: 1 } : member),
    spellPoints: { ...base.spellPoints, bishop: 2 },
  }, [{ type: 'grant-item', itemId: 'healing-potion', quantity: 2 }]);
  const started = chroniclesStartInitiativeCombat(prepared, [goblin], {
    forceEnemyIds: [GOBLIN], random: () => 0,
  });
  expect(started.phase).toBe('combat');
  const cursor = started.initiative.order.findIndex(({ kind, id }) => (
    kind === 'party' && id === 'bishop'
  ));
  expect(cursor).toBeGreaterThanOrEqual(0);
  return { ...started, initiative: { ...started.initiative, cursor } };
}

describe('MM3 initiative · a hero gets exactly one successful action per slot', () => {
  it('rejects a second potion, spell, attack and BLOCK even after a checkpoint', () => {
    const start = bishopEncounter();
    const used = chroniclesReduce(start, usePotion('rook'));
    expect(used.turns).toBe(start.turns + 1);
    expect(used.inventory['healing-potion'].quantity).toBe(1);
    expect(used.combatActionSpent?.bishop).toBe(true);
    const duplicates = [
      usePotion('knight'),
      { type: 'cast', memberId: 'bishop', spellId: 'first-aid', targetId: 'knight' },
      { type: 'attack', memberId: 'bishop', mode: 'melee' },
      { type: 'block', memberId: 'bishop' },
    ];
    for (const action of duplicates) expect(chroniclesReduce(used, action)).toBe(used);

    const payload = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(used, 1)));
    const resumed = chroniclesApplyRunCheckpoint(
      createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' }), payload,
    );
    expect(resumed.combatActionSpent?.bishop).toBe(true);
    expect(resumed.inventory['healing-potion'].quantity).toBe(1);
    for (const action of duplicates) expect(chroniclesReduce(resumed, action)).toBe(resumed);

    let next = resumed;
    for (let step = 0; step < resumed.initiative.order.length; step += 1) {
      next = chroniclesAdvanceCombatInitiative(next, chroniclesActiveEnemies(next));
      if (chroniclesCurrentInitiativeActor(next.initiative)?.id === 'bishop') break;
    }
    expect(chroniclesCurrentInitiativeActor(next.initiative)?.id).toBe('bishop');
    expect(next.combatActionSpent?.bishop).toBeUndefined();
    const second = chroniclesReduce(next, usePotion('knight'));
    expect(second.turns).toBe(next.turns + 1);
    expect(second.inventory['healing-potion']?.quantity ?? 0).toBe(0);
  });

  it('does not let a hero drink a potion after already spending an attack action', () => {
    const start = bishopEncounter();
    const attacked = chroniclesReduce(start, {
      type: 'attack', memberId: 'bishop', mode: 'melee',
    });
    expect(attacked.turns).toBe(start.turns + 1);
    expect(attacked.initiative).toBeTruthy();
    expect(attacked.combatActionSpent?.bishop).toBe(true);
    expect(chroniclesReduce(attacked, usePotion('rook'))).toBe(attacked);
  });
});
