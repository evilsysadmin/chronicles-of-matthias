import { describe, expect, it } from 'vitest';
import {
  chroniclesObjective,
  chroniclesPartyArmorClass,
  chroniclesPartyAttackStats,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesResolveEnemyActor } from '../chroniclesOfMatthiasTurns.js';
import { chroniclesApplyContentEffects, chroniclesGoldBalance } from './chroniclesContentRuntime.js';
import { CHRONICLES_EQUIPMENT, chroniclesMemberCanEquip } from './chroniclesEquipment.js';
import { CHRONICLES_CONSUMABLES, chroniclesCarriedConsumables } from './chroniclesConsumables.js';
import { CHRONICLES_SPELLS, chroniclesMemberSp } from './chroniclesMagic.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';
import { chroniclesShopSellable, chroniclesShopStock } from './chroniclesShops.js';
import { chroniclesAdvanceCombatInitiative } from './chroniclesInitiative.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';

const member = (state, id) => state.party.find((entry) => entry.id === id);
const grant = (state, itemId, quantity = 1) => chroniclesApplyContentEffects(state, [{
  type: 'grant-item', itemId, name: CHRONICLES_CONSUMABLES[itemId].name, quantity,
}]);
const wound = (state, id, hp) => ({ ...state, party: state.party.map((entry) => (entry.id === id ? { ...entry, hp } : entry)) });

function road() {
  // Two cells south of the deserter (11,5), facing north; the captain is
  // moved next to it so area spells have a second body to hit.
  const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
  return {
    ...base, x: 11, y: 7, direction: 0,
    enemyPositions: { 'banner-road-bandit-captain': { x: 12, y: 5 } },
  };
}

describe('Chronicles · potions, scrolls and the botica', () => {
  it('heals the most wounded ally with a potion and spends one', () => {
    let state = grant(wound(createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }), 'rook', 2), 'healing-potion', 2);
    state = chroniclesReduce(state, { type: 'use-item', memberId: 'matthias', itemId: 'healing-potion' });
    expect(member(state, 'rook').hp).toBe(Math.min(member(state, 'rook').maxHp, 17));
    expect(state.inventory['healing-potion'].quantity).toBe(1);
    expect(state.message).toMatch(/Matthias da Poción de curación a Hildegard/);
    // Nobody hurt: refused, nothing spent, no turn.
    const full = { ...state, party: state.party.map((entry) => ({ ...entry, hp: entry.maxHp })) };
    const refused = chroniclesReduce(full, { type: 'use-item', memberId: 'matthias', itemId: 'healing-potion' });
    expect(refused.turns).toBe(full.turns);
    expect(refused.inventory['healing-potion'].quantity).toBe(1);
  });

  it('restores spell points, revives the fallen and refuses what the pack lacks', () => {
    let state = grant(grant(createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }), 'mana-potion'), 'revive-draught');
    state = { ...state, spellPoints: { bishop: 0 } };
    state = chroniclesReduce(state, { type: 'use-item', memberId: 'matthias', itemId: 'mana-potion' });
    expect(chroniclesMemberSp(state, member(state, 'bishop'))).toBe(5);
    state = wound(state, 'rook', 0);
    state = chroniclesReduce(state, { type: 'use-item', memberId: 'matthias', itemId: 'revive-draught' });
    expect(member(state, 'rook').hp).toBe(Math.ceil(member(state, 'rook').maxHp / 3));
    expect(chroniclesCarriedConsumables(state)).toEqual([]);
    const empty = chroniclesReduce(state, { type: 'use-item', memberId: 'matthias', itemId: 'revive-draught' });
    expect(empty.message).toMatch(/No queda/);
    expect(empty.turns).toBe(state.turns);
  });

  it('lets the player choose which fallen ally receives an elixir, refusing invalid targets without spending it', () => {
    const base = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    let state = grant(base, 'revive-draught', 2);
    state = wound(wound(state, 'rook', 0), 'knight', 0);
    const refused = chroniclesReduce(state, {
      type: 'use-item', memberId: 'matthias', itemId: 'revive-draught', targetId: 'matthias',
    });
    expect(refused.turns).toBe(state.turns);
    expect(refused.inventory['revive-draught'].quantity).toBe(2);
    expect(refused.message).toMatch(/sigue en pie/);

    const next = chroniclesReduce(state, {
      type: 'use-item', memberId: 'matthias', itemId: 'revive-draught', targetId: 'rook',
    });
    expect(member(next, 'rook').hp).toBe(Math.ceil(member(state, 'rook').maxHp / 3));
    expect(member(next, 'knight').hp).toBe(0);
    expect(next.inventory['revive-draught'].quantity).toBe(1);
    expect(next.turns).toBe(state.turns + 1);
    const ghost = chroniclesReduce(state, {
      type: 'use-item', memberId: 'matthias', itemId: 'revive-draught', targetId: 'ghost',
    });
    expect(ghost.inventory['revive-draught'].quantity).toBe(2);
    expect(ghost.turns).toBe(state.turns);
    expect(ghost.message).toMatch(/No existe/);
  });

  it('reads a scroll at its own reach without spell points', () => {
    let state = grant(road(), 'fire-scroll');
    state = chroniclesReduce(state, { type: 'use-item', memberId: 'matthias', itemId: 'fire-scroll' });
    expect(state.bannerRoadDeserterHp).toBe(0);
    expect(state.inventory['fire-scroll']).toBeUndefined();
    expect(state.message).toMatch(/Pergamino de llamas/);
  });

  it('sells consumables at the Swordhaven botica and buys them back', () => {
    const map = chroniclesMapById('swordhaven-first-book');
    const entry = map.interactables.find((item) => item.id === 'first-book-apothecary');
    expect(chroniclesShopStock(entry).map((item) => item.id)).toEqual(['healing-potion', 'mana-potion', 'fire-scroll']);
    let state = { ...chroniclesApplyContentEffects(createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }), [{ type: 'grant-gold', amount: 40 }]), x: 3, y: 4, direction: 0 };
    state = chroniclesReduce(state, 'interact');
    expect(state.shop?.id).toBe('first-book-apothecary');
    state = chroniclesReduce(state, { type: 'shop-buy', itemId: 'healing-potion' });
    expect(state.inventory['healing-potion'].quantity).toBe(1);
    expect(state.inventory['crown-gold'].quantity).toBe(25);
    expect(chroniclesShopSellable(state, entry).map((offer) => offer.item.id)).toContain('healing-potion');
    state = chroniclesReduce(state, { type: 'shop-sell', itemId: 'healing-potion' });
    expect(state.inventory['healing-potion']).toBeUndefined();
    // The weaponsmith does not deal in potions.
    const smith = map.interactables.find((item) => item.id === 'first-book-weaponsmith');
    expect(chroniclesShopSellable(grant(state, 'healing-potion'), smith)).toEqual([]);
  });
});

describe('Chronicles · ranged arms', () => {
  it('keeps the class and equipment distinctions without limiting MM3 sight-range shots', () => {
    const state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    const archer = member(state, 'knight');
    const cleric = member(state, 'bishop');
    expect(CHRONICLES_EQUIPMENT['iron-longbow'].reach).toBe(4);
    expect(CHRONICLES_EQUIPMENT['iron-crossbow'].reach).toBe(3);
    expect(CHRONICLES_EQUIPMENT['iron-sling'].twoHanded).toBe(false);
    expect(chroniclesMemberCanEquip(archer, CHRONICLES_EQUIPMENT['steel-longbow'])).toBe(true);
    expect(chroniclesMemberCanEquip(cleric, CHRONICLES_EQUIPMENT['steel-longbow'])).toBe(false);
    const armed = { ...state, equipment: { knight: { weapon: 'iron-longbow' } } };
    expect(chroniclesPartyAttackStats(armed, 'knight').reach).toBeGreaterThan(4);
  });
});

describe('Chronicles · master spells', () => {
  it('Bola de fuego burns the target and whoever stands next to it', () => {
    let state = { ...road(), rpgModifiers: { knight: { level: 5 } }, spellbook: { knight: ['fireball'] } };
    state = chroniclesReduce(state, { type: 'cast', memberId: 'knight', spellId: 'fireball' });
    expect(state.bannerRoadDeserterHp).toBe(0);
    expect(state.bannerRoadCaptainHp).toBe(0);
    expect(state.message).toMatch(/La explosión alcanza/);
  });

  it('Paralizar costs the enemy its next actions, and the hold wears off', () => {
    let state = { ...road(), rpgModifiers: { bishop: { level: 3 } }, spellbook: { bishop: ['paralyze'] } };
    state = chroniclesReduce(state, { type: 'cast', memberId: 'bishop', spellId: 'paralyze' });
    expect(state.enemyStatus['banner-road-deserter'].paralyzed).toBe(2);
    const held = chroniclesResolveEnemyActor({ ...state, y: 6 }, 'banner-road-deserter');
    expect(held.party).toEqual(state.party);
    expect(held.enemyStatus['banner-road-deserter'].paralyzed).toBe(1);
    expect(held.message).toMatch(/sigue paralizado/);
    const freed = chroniclesResolveEnemyActor(held, 'banner-road-deserter');
    expect(freed.enemyStatus).toBeUndefined();
  });

  it('Sanación en grupo heals everyone standing; Escudo de fe holds only through the fight', () => {
    let state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    state = { ...wound(wound(state, 'rook', 2), 'matthias', 3), rpgModifiers: { bishop: { level: 3 } }, spellbook: { bishop: ['mass-heal', 'faith-ward'] } };
    state = chroniclesReduce(state, { type: 'cast', memberId: 'bishop', spellId: 'mass-heal' });
    expect(member(state, 'rook').hp).toBe(Math.min(member(state, 'rook').maxHp, 12));
    expect(member(state, 'matthias').hp).toBe(Math.min(member(state, 'matthias').maxHp, 13));
    // Out of combat the ward is refused.
    const refused = chroniclesReduce(state, { type: 'cast', memberId: 'bishop', spellId: 'faith-ward' });
    expect(refused.combatWard).toBeUndefined();
    const fighting = { ...state, initiative: { order: [{ kind: 'party', id: 'bishop' }], cursor: 0, round: 1 } };
    const before = chroniclesPartyArmorClass(fighting, 'matthias');
    const warded = chroniclesReduce(fighting, { type: 'cast', memberId: 'bishop', spellId: 'faith-ward' });
    expect(chroniclesPartyArmorClass(warded, 'matthias')).toBe(before + 3);
    // The fight ends (no enemy left in the order): the ward goes with it.
    const after = chroniclesAdvanceCombatInitiative(warded, []);
    expect(after.combatWard).toBeUndefined();
    expect(chroniclesPartyArmorClass({ ...after, combatWard: warded.combatWard }, 'matthias')).toBe(before);
  });
});

describe('Chronicles · following a quest', () => {
  it('lets the player choose which active quest the objective follows, and saves it', () => {
    let state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    state = chroniclesApplyContentEffects(state, [
      { type: 'start-quest', questId: 'quest-a', title: 'Primera', objective: 'Haz lo primero.' },
      { type: 'start-quest', questId: 'quest-b', title: 'Segunda', objective: 'Haz lo segundo.' },
    ]);
    const automatic = chroniclesObjective(state);
    state = chroniclesReduce(state, { type: 'track-quest', questId: 'quest-b' });
    expect(state.trackedQuestId).toBe('quest-b');
    expect(chroniclesObjective(state)).toBe('Haz lo segundo.');
    expect(state.turns).toBe(0);
    const restored = chroniclesApplyRunCheckpoint(
      createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
      chroniclesRunCheckpointPayload(state, 4),
    );
    expect(restored.trackedQuestId).toBe('quest-b');
    state = chroniclesReduce(state, { type: 'track-quest', questId: null });
    expect(state.trackedQuestId).toBeUndefined();
    expect(chroniclesObjective(state)).toBe(automatic);
  });
});

describe('Chronicles · Terra catalog integrity', () => {
  it('every shop and guild in every map sells things the game knows', async () => {
    const { chroniclesMapIds } = await import('./chroniclesMapCatalog.js');
    const { chroniclesShopItem } = await import('./chroniclesConsumables.js');
    const { CHRONICLES_SPELLS } = await import('./chroniclesMagic.js');
    const unknown = [];
    let boticas = 0;
    chroniclesMapIds().forEach((id) => {
      const map = chroniclesMapById(id);
      (map.interactables || []).forEach((entry) => {
        (entry.shop?.stock || []).forEach((itemId) => { if (!chroniclesShopItem(itemId)) unknown.push(`${id}:${itemId}`); });
        (entry.guild?.spells || []).forEach((spellId) => { if (!CHRONICLES_SPELLS[spellId]) unknown.push(`${id}:${spellId}`); });
        if (entry.visualType === 'building-apothecary') boticas += 1;
      });
    });
    expect(unknown).toEqual([]);
    // Swordhaven's campaign botica, its restored legacy-square shop,
    // and the eight generated towns.
    expect(boticas).toBe(10);
  });
});

describe('Chronicles · objective over legacy exits', () => {
  it('shows the active quest in classic Swordhaven instead of «encuentra la salida»', () => {
    let state = createChroniclesState('swordhaven-square', null, { rules: 'mm3' });
    expect(chroniclesObjective(state)).toBe('Explora Swordhaven y encuentra la salida');
    state = chroniclesApplyContentEffects(state, [
      { type: 'start-quest', questId: 'lost-king-prologue', title: 'El rey desaparecido', objective: 'Investiga el antiguo sello de la Cripta de las Ocho Casillas.' },
    ]);
    expect(chroniclesObjective(state)).toBe('Investiga el antiguo sello de la Cripta de las Ocho Casillas.');
  });
});

describe('Chronicles · early magic', () => {
  it('Aldric pays enough to learn both early spells at the guild, but teaches none', () => {
    const map = chroniclesMapById('swordhaven-first-book');
    const report = map.interactables.find((entry) => entry.id === 'swordhaven-mayor-sewers');
    const guild = map.interactables.find((entry) => entry.id === 'first-book-guild').guild;
    let state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    state = { ...state, swordhavenMayorMet: true, sewersSluiceClosed: true, sewersSmugglerDefeated: true };
    const before = chroniclesGoldBalance(state);
    state = chroniclesApplyContentEffects(state, report.action.effects);
    for (const id of ['bishop', 'rook', 'knight', 'matthias']) {
      expect(state.spellbook?.[id] || []).not.toContain('flying-fist');
      expect(state.spellbook?.[id] || []).not.toContain('elemental-arrow');
    }
    expect(guild.spells).toEqual(expect.arrayContaining(['flying-fist', 'elemental-arrow']));
    const membershipAndBoth = guild.membership + CHRONICLES_SPELLS['flying-fist'].price + CHRONICLES_SPELLS['elemental-arrow'].price;
    expect(chroniclesGoldBalance(state) - before).toBeGreaterThanOrEqual(membershipAndBoth);
    // Claimed once: a second report pays nothing.
    const again = chroniclesApplyContentEffects(state, report.action.effects);
    expect(chroniclesGoldBalance(again)).toBe(chroniclesGoldBalance(state));
  });
});
