import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesResolveEnemyActor, chroniclesPreviewEnemyTurn } from '../chroniclesOfMatthiasTurns.js';

const ID = 'cinder-warden';
function encounter(distance = 1) {
  const base = createChroniclesState('ash-vault', null, { rules: 'mm3' });
  return {
    ...base,
    ...Object.fromEntries(chroniclesActiveEnemies(base).filter(enemy => enemy.id !== ID).map(enemy => [enemy.hpKey, 0])),
    x: 4 - distance, y: 3, direction: 1, phase: 'combat', turnPhase: 'enemy',
    enemyPositions: { [ID]: { x: 4, y: 3 } },
    initiative: { round: 1, cursor: 0, order: [{ kind: 'enemy', id: ID }, { kind: 'party', id: 'matthias' }] },
  };
}

describe('Ash Vault warden named heavy strike', () => {
  it('reports one named strike with the existing damage budget', () => {
    const before = encounter();
    const enemy = chroniclesActiveEnemies(before).find(foe => foe.id === ID);
    expect(enemy.attacks).toEqual(['Golpe de escoria']);
    expect(enemy.retaliation).toBe(2);
    const after = chroniclesResolveEnemyActor(before, ID);
    expect(after.enemyTurnEvents).toHaveLength(1);
    const [attack] = after.enemyTurnEvents;
    expect(attack).toMatchObject({ type: 'attack', attackName: 'Golpe de escoria', attackIndex: 0, attackCount: 1 });
    expect([0, 2]).toContain(attack.damage);
    expect(after.message).toContain('Golpe de escoria');
    expect(after.initiative).toEqual(before.initiative);
    expect(after.direction).toBe(before.direction);
    const preview = chroniclesPreviewEnemyTurn(before);
    expect(preview.intents[0]).not.toHaveProperty('strikes');
  });

  it('does not gain a free attack when approaching or while paralysed', () => {
    const distant = encounter(2);
    const moved = chroniclesResolveEnemyActor(distant, ID);
    expect(moved.enemyTurnEvents.map(event => event.type)).toEqual(['move']);
    expect(moved.party).toEqual(distant.party);
    const held = { ...encounter(), enemyStatus: { [ID]: { paralyzed: 1 } } };
    const after = chroniclesResolveEnemyActor(held, ID);
    expect(after.enemyTurnEvents.map(event => event.type)).toEqual(['paralyzed']);
    expect(after.party).toEqual(held.party);
  });
});
