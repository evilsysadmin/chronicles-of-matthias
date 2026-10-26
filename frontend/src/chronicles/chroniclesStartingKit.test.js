import { describe, expect, it } from 'vitest';
import { createChroniclesState, chroniclesPartyAttackStats } from '../chroniclesOfMatthias.js';
import { chroniclesGoldBalance } from './chroniclesContentRuntime.js';
import { CHRONICLES_EQUIPMENT, chroniclesEquippedItem, chroniclesUnequipItem } from './chroniclesEquipment.js';
import { chroniclesShopEquipmentComparisons } from './chroniclesShopComparison.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';
import {
  CHRONICLES_STARTING_GOLD,
  CHRONICLES_STARTER_ARMOR_ID,
  CHRONICLES_STARTER_PADDED_ARMOR_ID,
  CHRONICLES_STARTER_WEAPON_BY_CLASS,
  chroniclesApplyStartingKit,
} from './chroniclesStartingKit.js';

const EMPTY_RUN = Object.freeze({
  worldVersion: 0,
  runStatus: 'active',
  worldFlags: {},
  inventory: {},
  quests: {},
  consumedContentIds: [],
  claimedRewards: [],
});

function fresh() {
  return chroniclesApplyRunCheckpoint(
    createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
    EMPTY_RUN,
  );
}

describe('Chronicles · MM3 starting kit', () => {
  it('starts a canonical company with 40 shared gold and conventional class-legal equipped weapons', () => {
    const state = fresh();
    expect(CHRONICLES_STARTING_GOLD).toBe(40);
    expect(chroniclesGoldBalance(state)).toBe(40);
    expect(Object.keys(state.inventory)).toEqual(['crown-gold']);
    expect(Object.keys(state.equipment)).toHaveLength(4);
    expect(state.equipment).toMatchObject({
      matthias: { weapon: 'bronze-sword', armor: 'leather-leather' },
      rook: { weapon: 'bronze-mace', armor: 'leather-leather' },
      bishop: { weapon: 'bronze-mace', armor: 'leather-leather' },
      knight: { weapon: 'bronze-dagger', missile: 'wooden-bow', armor: 'leather-leather' },
    });
    for (const member of state.party) {
      const weapon = chroniclesEquippedItem(state, member.id, 'weapon');
      expect(weapon, member.name).toBeTruthy();
      expect(weapon.id).toBe(CHRONICLES_STARTER_WEAPON_BY_CLASS[member.mm3.classId]);
      expect(chroniclesEquippedItem(state, member.id, 'armor')?.id).toBe(CHRONICLES_STARTER_ARMOR_ID);
      expect(member.role).toBe(member.mm3.classLabel);
      expect(member.attackName).toBe('Golpe desarmado');
    }
    expect(CHRONICLES_EQUIPMENT['wooden-bow'].name).toBe('Arco corto de madera');
    expect(chroniclesPartyAttackStats(state, 'matthias').reach).toBe(1);
    expect(chroniclesPartyAttackStats(state, 'bishop').reach).toBe(1);
    // The archer stabs with the dagger (A) and shoots the bow (S).
    expect(chroniclesPartyAttackStats(state, 'knight', 'melee').reach).toBe(1);
    expect(chroniclesPartyAttackStats(state, 'knight', 'missile').reach).toBeGreaterThan(4);
    expect(chroniclesPartyAttackStats(state, 'knight').reach).toBeGreaterThan(4);
    expect(chroniclesPartyAttackStats(state, 'knight').damage).toBeGreaterThan(0);
  });

  it('keeps the starting kit inside the ordinary checkpoint and restores exactly what was saved', () => {
    let state = fresh();
    state = chroniclesUnequipItem(state, 'matthias', 'weapon');
    const gold = state.inventory['crown-gold'];
    state = { ...state, inventory: { ...state.inventory, 'crown-gold': { ...gold, quantity: 13 } } };
    const checkpoint = chroniclesRunCheckpointPayload(state, 0);
    const resumed = chroniclesApplyRunCheckpoint(
      createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
      {
        worldVersion: 1,
        runStatus: 'active',
        ...checkpoint,
      },
    );
    expect(chroniclesGoldBalance(resumed)).toBe(13);
    expect(chroniclesEquippedItem(resumed, 'matthias', 'weapon')).toBeNull();
    expect(resumed.inventory['bronze-sword'].quantity).toBe(1);
    expect(chroniclesEquippedItem(resumed, 'knight', 'weapon')?.id).toBe('bronze-dagger');
    expect(chroniclesEquippedItem(resumed, 'knight', 'missile')?.id).toBe('wooden-bow');
    expect(chroniclesEquippedItem(resumed, 'matthias', 'armor')?.id).toBe(CHRONICLES_STARTER_ARMOR_ID);
    expect(chroniclesApplyStartingKit(resumed, EMPTY_RUN)).toBe(resumed);
  });

  it('never gives money or weapons to Tactics, established/changed server runs or defeated runs', () => {
    const mm3 = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    const tactics = createChroniclesState('swordhaven-first-book');
    expect(chroniclesApplyStartingKit(tactics, EMPTY_RUN)).toBe(tactics);
    for (const override of [
      { worldVersion: 1 },
      { worldFlags: { 'already-started': true } },
      { inventory: { 'crown-gold': { quantity: 8 } } },
      { consumedContentIds: ['already-claimed'] },
      { runStatus: 'defeated' },
    ]) {
      expect(chroniclesApplyStartingKit(mm3, { ...EMPTY_RUN, ...override })).toBe(mm3);
    }
  });

  it('shows ringmail as a real armor upgrade in the starting merchant, without equipping on purchase', () => {
    const state = fresh();
    const ring = CHRONICLES_EQUIPMENT['brass-ring'];
    expect(CHRONICLES_EQUIPMENT[CHRONICLES_STARTER_ARMOR_ID].armorClassBonus).toBe(2);
    expect(ring.armorClassBonus).toBe(4);
    const preview = chroniclesShopEquipmentComparisons(state, ring);
    const fighter = preview.find((row) => row.memberId === 'matthias');
    expect(fighter.current?.id).toBe(CHRONICLES_STARTER_ARMOR_ID);
    expect(fighter.eligible).toBe(true);
    expect(fighter.alreadyEquipped).toBe(false);
    expect(fighter.stats.find((stat) => stat.key === 'armorClass')?.delta).toBe(2);
    expect(chroniclesEquippedItem(state, 'matthias', 'armor')?.id).toBe(CHRONICLES_STARTER_ARMOR_ID);
    expect(chroniclesGoldBalance(state)).toBe(CHRONICLES_STARTING_GOLD);
    // A class that cannot wear ringmail must still report that fact.
    expect(preview.find((row) => row.memberId === 'knight')?.current?.id).toBe(CHRONICLES_STARTER_ARMOR_ID);
  });

  it('never overwrites old checkpoint armor, including an intentionally empty slot', () => {
    const base = fresh();
    for (const gear of [{ weapon: 'bronze-sword', armor: 'brass-ring' }, { weapon: 'bronze-sword' }]) {
      const checkpoint = chroniclesRunCheckpointPayload({
        ...base,
        equipment: { ...base.equipment, matthias: gear },
      }, 0);
      const restored = chroniclesApplyRunCheckpoint(
        createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
        { ...EMPTY_RUN, worldVersion: 2, ...checkpoint },
      );
      expect(chroniclesEquippedItem(restored, 'matthias', 'armor')?.id || null).toBe(gear.armor || null);
      expect(chroniclesApplyStartingKit(restored, EMPTY_RUN)).toBe(restored);
    }
  });

  it('selects only equipment usable by each of the ten MM3 classes', () => {
    const base = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    for (const classId of Object.keys(CHRONICLES_STARTER_WEAPON_BY_CLASS)) {
      const single = { ...base, party: [{ ...base.party[0], mm3: { ...base.party[0].mm3, classId } }] };
      const state = chroniclesApplyStartingKit(single, EMPTY_RUN);
      expect(chroniclesEquippedItem(state, 'matthias', 'weapon')?.id, classId)
        .toBe(CHRONICLES_STARTER_WEAPON_BY_CLASS[classId]);
      expect(chroniclesEquippedItem(state, 'matthias', 'armor')?.id, classId).toBe(
        classId === 'sorcerer' ? CHRONICLES_STARTER_PADDED_ARMOR_ID : CHRONICLES_STARTER_ARMOR_ID,
      );
    }
  });
});
