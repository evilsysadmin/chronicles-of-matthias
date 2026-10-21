import { describe, expect, it } from 'vitest';
import { createChroniclesState } from './chroniclesOfMatthias.js';
import { chroniclesTacticsUse } from './chroniclesOfMatthiasTactics.js';
import { chroniclesApplyContentEffects, chroniclesGoldBalance } from './chronicles/chroniclesContentRuntime.js';
import { chroniclesMapById } from './chronicles/chroniclesMapCatalog.js';
import { chroniclesEquippedItem, chroniclesEquipItem } from './chronicles/chroniclesEquipment.js';
import { chroniclesPartyBark } from './chroniclesOfMatthiasBarks.js';

describe('chroniclesPartyBark', () => {
  it('permanece en silencio durante acciones ordinarias', () => {
    const previous = createChroniclesState();
    expect(chroniclesPartyBark(previous, { ...previous, turns: 1, x: 2 })).toBeNull();
  });

  it('da voz a Aziz cuando despierta el sello', () => {
    const previous = createChroniclesState();
    const result = chroniclesPartyBark(previous, { ...previous, sigilAwake: true, turns: 1 });
    expect(result).toMatchObject({ speakerId: 'bishop', speaker: 'Aziz', event: 'sigil-awake' });
  });

  it('reacciona a una baja enemiga sin comentar cada golpe', () => {
    const previous = createChroniclesState();
    const result = chroniclesPartyBark(previous, { ...previous, enemyHp: 0, turns: 1 });
    expect(result).toMatchObject({ speakerId: 'rook', event: 'corrupted-pawn-down' });
    expect(chroniclesPartyBark(previous, { ...previous, enemyHp: 5, turns: 1 })).toBeNull();
  });

  it('celebrates actual first-book payment once and proposes the real quartermaster', () => {
    const at = (state, x, y) => ({ ...state, x, y });
    let state = createChroniclesState('swordhaven-first-book');
    state = chroniclesTacticsUse(at(state, 11, 9), 'first-book-missing-board');
    state = chroniclesTacticsUse(at(state, 9, 1), 'to-first-book-banner-road');
    state = chroniclesTacticsUse(at(state, 9, 5), 'first-book-lost-banner');
    state = chroniclesTacticsUse(at(state, 10, 1), 'to-first-book-swordhaven');
    const before = at(state, 11, 9);
    const paid = chroniclesTacticsUse(before, 'first-book-banner-turn-in');
    const delta = chroniclesGoldBalance(paid) - chroniclesGoldBalance(before);
    expect(delta).toBeGreaterThan(0);
    expect(paid.claimedRewards).toContain('swordhaven:banner-contract:v1');
    expect(chroniclesPartyBark(before, paid)).toMatchObject({
      speakerId: 'matthias', event: 'first-book-banner-paid',
      text: expect.stringContaining(`${delta} monedas de oro`),
    });
    expect(chroniclesPartyBark(before, paid).text).toContain('intendencia de Swordhaven');
    expect(chroniclesPartyBark(paid, { ...paid, turns: paid.turns + 1 })).toBeNull();
    expect(chroniclesPartyBark({ ...paid }, paid)).toBeNull();
  });

  it('will never announce gold if there is no actual new authored receipt', () => {
    const state = createChroniclesState('swordhaven-first-book');
    const forged = {
      ...state, claimedRewards: ['swordhaven:banner-contract:v1'],
      quests: { 'banner-contract': { status: 'active' } },
    };
    expect(chroniclesPartyBark(state, forged)).toBeNull();
    expect(chroniclesPartyBark(state, {
      ...forged, claimedRewards: [], quests: { 'banner-contract': { status: 'completed' } },
    })).toBeNull();
  });

  it('explains an actually looted sword after the authored deserter defeat, without granting loot', () => {
    const road = chroniclesMapById('banner-road-first-book');
    const deserter = road.enemies.find((enemy) => enemy.id === 'banner-road-deserter');
    const before = createChroniclesState(road.id);
    expect(Number(before[deserter.hpKey])).toBeGreaterThan(0);
    const killed = { ...before, [deserter.hpKey]: 0 };
    // The game applies these exact authored defeat effects; the bark must not
    // create a second sword, affect health or invent a quest reward.
    const rewarded = chroniclesApplyContentEffects(killed, deserter.onDefeat.effects);
    expect(rewarded.bannerRoadDeserterDefeated).toBe(true);
    expect(rewarded.inventory['bronze-sword'].quantity).toBeGreaterThan(0);
    const inventoryBeforeBark = rewarded.inventory;
    const text = chroniclesPartyBark(before, rewarded);
    expect(text).toMatchObject({
      event: 'first-book-deserter-loot',
      text: expect.stringContaining('espada de bronce'),
    });
    expect(text.text).toContain('ficha de un héroe');
    expect(rewarded.inventory).toBe(inventoryBeforeBark);
    const equipped = chroniclesEquipItem(rewarded, 'matthias', 'bronze-sword');
    expect(chroniclesEquippedItem(equipped, 'matthias', 'weapon')?.id).toBe('bronze-sword');
    expect(chroniclesPartyBark(rewarded, { ...rewarded, turns: rewarded.turns + 1 })).toBeNull();
  });

  it('never suggests a road sword unless this particular real kill added one', () => {
    const before = createChroniclesState('banner-road-first-book');
    const killed = { ...before, bannerRoadDeserterHp: 0, bannerRoadDeserterDefeated: true };
    expect(chroniclesPartyBark(before, killed)).toBeNull();
    const inventory = {
      ...before.inventory,
      'bronze-sword': { id: 'bronze-sword', name: 'Espada de bronce', quantity: 1 },
    };
    expect(chroniclesPartyBark(before, { ...before, inventory })).toBeNull();
    expect(chroniclesPartyBark(before, {
      ...killed, inventory, mapId: 'swordhaven-first-book',
    })).toBeNull();
    expect(chroniclesPartyBark({ ...before, bannerRoadDeserterHp: 0 }, { ...killed, inventory })).toBeNull();
  });

  it('usa un superviviente cuando cae una pieza', () => {
    const previous = createChroniclesState();
    const party = previous.party.map((member) => member.id === 'matthias' ? { ...member, hp: 0 } : member);
    const result = chroniclesPartyBark(previous, { ...previous, party, turns: 1 });
    expect(result).toMatchObject({ speakerId: 'rook', event: 'down:matthias' });
  });
});
