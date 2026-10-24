import { describe, expect, it } from 'vitest';
import { chroniclesPartyAttackStats, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import { chroniclesEquipItem, chroniclesEquippedItem, chroniclesUnequipItem } from './chroniclesEquipment.js';
import { chroniclesTransferBagItem } from './chroniclesPersonalBags.js';
import { chroniclesTargetReachLabel } from '../components/ChroniclesTacticalMargin.jsx';
import { chroniclesTacticalAttackReach } from './chroniclesTacticalAttackReach.js';

function partyWithOnlyRookSling() {
  let state = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
  for (const member of state.party) state = chroniclesUnequipItem(state, member.id, 'missile');
  state = chroniclesApplyContentEffects(state, [{
    type: 'grant-item', itemId: 'brass-sling', name: 'Honda de latón',
  }]);
  state = chroniclesTransferBagItem(state, 'matthias', 'rook', 'brass-sling');
  state = chroniclesEquipItem(state, 'rook', 'brass-sling');
  expect(chroniclesEquippedItem(state, 'rook', 'missile')?.id).toBe('brass-sling');
  expect(chroniclesEquippedItem(state, 'matthias', 'missile')).toBeNull();
  return state;
}

describe('Tactical margin uses real MM3 attack range', () => {
  it('shows the COMPANY volley even if selected Matthias has no ranged weapon', () => {
    const state = partyWithOnlyRookSling();
    const range = chroniclesTacticalAttackReach(state, 'matthias');
    const slingReach = chroniclesPartyAttackStats(state, 'rook', 'missile').reach;
    expect(slingReach).toBeGreaterThan(1);
    expect(range.missileReach).toBe(slingReach);
    expect(chroniclesTargetReachLabel({ distance: slingReach }, range))
      .toBe('A: FUERA DE ALCANCE · S: A TIRO');
    expect(chroniclesTargetReachLabel({ distance: slingReach + 1 }, range))
      .toBe('FUERA DE ALCANCE · ACÉRCATE PARA ATACAR');
  });

  it('shows no S reach when all four heroes lack a usable projectile weapon', () => {
    let state = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
    for (const member of state.party) state = chroniclesUnequipItem(state, member.id, 'missile');
    expect(chroniclesTacticalAttackReach(state, 'rook').missileReach).toBe(0);
    expect(chroniclesTargetReachLabel({ distance: 2 },
      chroniclesTacticalAttackReach(state, 'rook'))).not.toContain('S: A TIRO');
  });

  it('in initiative uses the actual hero of this turn, not the last selected portrait', () => {
    const state = partyWithOnlyRookSling();
    const combat = { ...state, phase: 'combat',
      initiative: { order: [{ id: 'rook', kind: 'party' }], cursor: 0, round: 1 },
    };
    const rookTurn = chroniclesTacticalAttackReach(combat, 'matthias');
    expect(rookTurn.missileReach).toBe(chroniclesPartyAttackStats(combat, 'rook', 'missile').reach);
    expect(chroniclesTargetReachLabel({ distance: rookTurn.missileReach }, rookTurn))
      .toBe('A: FUERA DE ALCANCE · S: A TIRO');

    const matthiasTurn = {
      ...combat, initiative: { ...combat.initiative, order: [{ id: 'matthias', kind: 'party' }] },
    };
    expect(chroniclesTacticalAttackReach(matthiasTurn, 'rook').missileReach).toBe(0);
    const enemyTurn = {
      ...combat, initiative: { ...combat.initiative, order: [{ id: 'road-foe', kind: 'enemy' }] },
    };
    expect(chroniclesTacticalAttackReach(enemyTurn, 'rook').missileReach).toBe(0);
  });

  it('preserves individual reach in non-MM3 Tactics mode', () => {
    const tactics = createChroniclesState();
    const member = tactics.party[0];
    const range = chroniclesTacticalAttackReach(tactics, member.id);
    expect(range.meleeReach).toBe(chroniclesPartyAttackStats(tactics, member.id, 'melee').reach);
    expect(range.missileReach).toBe(chroniclesPartyAttackStats(tactics, member.id, 'missile').reach);
  });
});
