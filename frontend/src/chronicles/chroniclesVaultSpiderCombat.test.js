import { describe, expect, it } from 'vitest';
import { chroniclesActiveEnemies, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesResolveEnemyActor } from '../chroniclesOfMatthiasTurns.js';

const ID = 'vault-spider';
function encounter(distance = 1) {
  const base = createChroniclesState('ash-vault', null, { rules: 'mm3' });
  const foes = chroniclesActiveEnemies(base);
  return {
    ...base,
    ...Object.fromEntries(foes.filter(enemy => enemy.id !== ID).map(enemy => [enemy.hpKey, 0])),
    x: 6 - distance, y: 5, direction: 1, phase: 'combat', turnPhase: 'enemy',
    enemyPositions: { [ID]: { x: 6, y: 5 } },
    initiative: { round: 1, cursor: 0, order: [{ kind: 'enemy', id: ID }, { kind: 'party', id: 'matthias' }] },
  };
}

describe('Ash Vault spider authored attack pattern', () => {
  it('uses two independent one-point strikes in one adjacent action', () => {
    const before = encounter();
    const spider = chroniclesActiveEnemies(before).find(enemy => enemy.id === ID);
    expect(spider.attacks).toEqual(['Mordisco', 'Zarpazo']);
    expect(spider.retaliation).toBe(1);
    const after = chroniclesResolveEnemyActor(before, ID);
    const events = after.enemyTurnEvents;
    expect(events.map(event => event.type)).toEqual(['attack', 'attack']);
    expect(events.map(event => event.attackName)).toEqual(spider.attacks);
    expect(events.map(event => event.attackIndex)).toEqual([0, 1]);
    expect(events.every(event => event.attackCount === 2 && Number.isInteger(event.roll) && event.roll >= 1 && event.roll <= 20)).toBe(true);
    expect(events.every(event => event.damage >= 0 && event.damage <= 1)).toBe(true);
    const lost = before.party.reduce((sum, hero) => sum + hero.hp, 0)
      - after.party.reduce((sum, hero) => sum + hero.hp, 0);
    expect(lost).toBe(events.reduce((sum, event) => sum + event.fromHp - event.toHp, 0));
    expect(lost).toBeLessThanOrEqual(2);
    expect(after.initiative).toEqual(before.initiative);
    expect(after.direction).toBe(before.direction);
  });

  it('cannot combine movement or paralysis with either strike', () => {
    const distant = encounter(2);
    const approached = chroniclesResolveEnemyActor(distant, ID);
    expect(approached.enemyTurnEvents.map(event => event.type)).toEqual(['move']);
    expect(approached.party).toEqual(distant.party);
    const held = { ...encounter(), enemyStatus: { [ID]: { paralyzed: 1 } } };
    const after = chroniclesResolveEnemyActor(held, ID);
    expect(after.enemyTurnEvents.map(event => event.type)).toEqual(['paralyzed']);
    expect(after.party).toEqual(held.party);
  });
});
