import { describe, expect, it } from 'vitest';
import { createChroniclesState, chroniclesReduce, chroniclesContextualContentAction } from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects, chroniclesGoldBalance } from './chroniclesContentRuntime.js';
import { chroniclesMapById } from './chroniclesMapCatalog.js';
import { CHRONICLES_INN_FOOD, chroniclesInnEntry, chroniclesInnRestPrice, chroniclesInnRumors } from './chroniclesInns.js';
import { CHRONICLES_TAVERN_PREMIUM_ART_KEY, CHRONICLES_TAVERN_PREMIUM_ART_URL } from './chroniclesShopArt.js';
import { chroniclesMemberSp } from './chroniclesMagic.js';

const map = chroniclesMapById('swordhaven-first-book');
const entry = map.interactables.find((item) => item.id === 'first-book-healer');
function atInn(gold = 35) {
  const initial = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
  // Match the authored entrance without faking a shop, UI or save.
  let state = { ...initial, x: entry.x, y: entry.y };
  if (gold > chroniclesGoldBalance(state)) state = chroniclesApplyContentEffects(state, [
    { type: 'grant-gold', amount: gold - chroniclesGoldBalance(state) },
  ]);
  return state;
}
const act = (state, type) => chroniclesReduce(state, { type });

describe('Chronicles · tavern room instead of one-click rest', () => {
  it('uses the exact uploaded tavern panorama on the independent Chronicles R2 origin', () => {
    expect(CHRONICLES_TAVERN_PREMIUM_ART_KEY).toBe('stores/taberna-premium.webp');
    expect(CHRONICLES_TAVERN_PREMIUM_ART_URL)
      .toBe('https://assets.chronicles.shadowops.dpdns.org/stores/taberna-premium.webp');
    expect(CHRONICLES_TAVERN_PREMIUM_ART_URL).not.toContain('dash.cloudflare.com');
    expect(CHRONICLES_TAVERN_PREMIUM_ART_URL).not.toContain('?');
  });

  it('opens La Espada Mellada without paying and exposes all three independent actions', () => {
    const state = atInn();
    const purse = chroniclesGoldBalance(state);
    expect(chroniclesContextualContentAction(state)).toMatchObject({
      id: 'first-book-healer', locked: false,
    });
    const opened = act(state, 'interact');
    expect(opened.inn?.id).toBe('first-book-healer');
    expect(chroniclesGoldBalance(opened)).toBe(purse);
    expect(opened.turns).toBe(state.turns);
    expect(chroniclesInnRestPrice(entry)).toBe(5);
    expect(chroniclesInnRumors(entry)).toHaveLength(3);
  });

  it('rest is explicitly paid, heals standing companions and restores spell points without reviving', () => {
    const opened = act(atInn(), 'interact');
    const damaged = {
      ...opened,
      party: opened.party.map((hero, index) => ({
        ...hero, hp: index === 0 ? 0 : 1,
      })),
      spellPoints: { ...opened.spellPoints, bishop: 0 },
    };
    const purse = chroniclesGoldBalance(damaged);
    const next = act(damaged, 'inn-rest');
    expect(chroniclesGoldBalance(next)).toBe(purse - 5);
    expect(next.party[0].hp).toBe(0);
    expect(next.party.slice(1).every((hero) => hero.hp === hero.maxHp)).toBe(true);
    expect(chroniclesMemberSp(next, next.party.find((hero) => hero.id === 'bishop')))
      .toBeGreaterThan(0);
    expect(next.inn?.id).toBe('first-book-healer');
    expect(next.turns).toBe(damaged.turns + 1);
  });

  it('insufficient gold never prevents entry or silently grants a rest', () => {
    const state = atInn();
    // Keep the actual wallet object but lower the quantity.
    const broke = { ...state, inventory: {
      ...state.inventory, 'crown-gold': {
        ...state.inventory['crown-gold'], quantity: 3,
      },
    }};
    const opened = act(broke, 'interact');
    expect(opened.inn?.id).toBe(entry.id);
    const resting = act(opened, 'inn-rest');
    expect(chroniclesGoldBalance(resting)).toBe(3);
    expect(resting.party).toEqual(opened.party);
    expect(resting.turns).toBe(opened.turns);
    expect(act(opened, 'inn-buy-food').inventory).toEqual(opened.inventory);
  });

  it('rations are an atomic gold-to-inventory exchange, never a free healing consumable', () => {
    const opened = act(atInn(), 'interact');
    const prior = opened.inventory[CHRONICLES_INN_FOOD.id]?.quantity || 0;
    const purse = chroniclesGoldBalance(opened);
    const next = act(opened, 'inn-buy-food');
    expect(chroniclesGoldBalance(next)).toBe(purse - CHRONICLES_INN_FOOD.price);
    expect(next.inventory[CHRONICLES_INN_FOOD.id].quantity).toBe(prior + 1);
    expect(next.party).toEqual(opened.party);
    expect(next.turns).toBe(opened.turns);
  });

  it('rumors are free, cycle through authored Swordhaven hints and do not invent quest progress', () => {
    const opened = act(atInn(), 'interact');
    const purse = chroniclesGoldBalance(opened);
    let read = opened;
    for (let i = 0; i < 4; i += 1) read = act(read, 'inn-rumor');
    expect(read.inn.rumorIndex).toBe(0);
    expect(read.message).toContain('alcalde Aldric');
    expect(read.quests).toEqual(opened.quests);
    expect(read.journal).toEqual(opened.journal);
    expect(chroniclesGoldBalance(read)).toBe(purse);
  });

  it('closed or stale sessions cannot pay, rest or read from afar', () => {
    const opened = act(atInn(), 'interact');
    const left = act(opened, 'inn-close');
    expect(left.inn).toBeUndefined();
    expect(act(left, 'inn-rest')).toBe(left);
    expect(act(left, 'inn-buy-food')).toBe(left);
    expect(act(left, 'inn-rumor')).toBe(left);
    const distant = { ...opened, x: 1, y: 1 };
    expect(chroniclesInnEntry(distant, map)).toBeNull();
    expect(act(distant, 'inn-rest')).toBe(distant);
    expect(act(distant, 'inn-buy-food')).toBe(distant);
    expect(act(distant, 'inn-rumor')).toBe(distant);
    const walked = act(opened, 'turn-left');
    expect(walked.inn).toBeUndefined();
  });
});
