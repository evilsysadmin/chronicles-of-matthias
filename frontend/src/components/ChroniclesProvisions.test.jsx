import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState, chroniclesContextualContentAction, chroniclesReduce } from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects, chroniclesGoldBalance } from '../chronicles/chroniclesContentRuntime.js';
import { chroniclesMapById } from '../chronicles/chroniclesMapCatalog.js';
import { CHRONICLES_PROVISIONS_PREMIUM_ART_KEY, CHRONICLES_PROVISIONS_PREMIUM_ART_URL } from '../chronicles/chroniclesShopArt.js';
import ChroniclesProvisions, { CHRONICLES_QUARTERMASTER_ID } from './ChroniclesProvisions.jsx';

const map = chroniclesMapById('swordhaven-first-book');
const entry = map.interactables.find(e => e.id === CHRONICLES_QUARTERMASTER_ID);
function atCounter(gold = 28) {
  let state = createChroniclesState('swordhaven-first-book', null, { rules:'mm3' });
  const have = chroniclesGoldBalance(state);
  if (gold > have) state = chroniclesApplyContentEffects(state,
    [{ type:'grant-gold', amount:gold-have }]);
  else state = { ...state, inventory: {
    ...state.inventory, 'crown-gold': { ...state.inventory['crown-gold'], quantity:gold },
  } };
  const facing = [0,1,2,3].find(direction =>
    chroniclesContextualContentAction({ ...state, x: entry.x, y:entry.y, direction })?.id === entry.id);
  expect(facing).toBeDefined();
  return { ...state, x:entry.x, y:entry.y, direction:facing };
}

describe('Swordhaven premium provisions counter', () => {
  it('pins the user-uploaded clean panorama to the separate Chronicles bucket', () => {
    expect(CHRONICLES_PROVISIONS_PREMIUM_ART_KEY).toBe('stores/tienda-provisiones-premium.webp');
    expect(CHRONICLES_PROVISIONS_PREMIUM_ART_URL).toBe(
      'https://assets.chronicles.shadowops.dpdns.org/stores/tienda-provisiones-premium.webp');
    expect(CHRONICLES_PROVISIONS_PREMIUM_ART_URL).not.toContain('dash.cloudflare.com');
  });
  it('has a reachable authored doorway and preserves its existing exchange action', () => {
    expect(entry.kind).toBe('merchant');
    expect(entry.visualType).toBe('building-store');
    const exchange = entry.action.effects.find(e => e.type === 'exchange-item');
    expect(exchange).toMatchObject({ costItemId:'crown-gold', costQuantity:7,
      itemId:'road-rations', quantity:1 });
    const state = atCounter(28);
    const before = chroniclesGoldBalance(state);
    const originalTurns = state.turns;
    // The modal never mutates game state; only the reducer executes the sale.
    const html = renderToStaticMarkup(createElement(ChroniclesProvisions, {
      state, onBuy:() => { throw Error('Unexpected buy during initial render'); },
      onClose:() => {},
    }));
    expect(chroniclesGoldBalance(state)).toBe(before);
    expect(state.turns).toBe(originalTurns);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('data-chronicles-provisions="open"');
    expect(html).toContain('data-chronicles-shop-art-layer="fallback"');
    expect(html).toContain('data-chronicles-shop-art-layer="premium"');
    expect(html).toContain('data-chronicles-interior-loading');
    expect(html).toContain('Salir durante la carga');
    expect(html).toContain(CHRONICLES_PROVISIONS_PREMIUM_ART_URL);
    expect(html).toContain('Comprar raciones · 7 oro');
    expect(html).toContain('Salir de la tienda de provisiones');
    expect(html).toContain('aria-hidden="true"');
    expect((html.match(/alt="Interior de madera de la tienda de provisiones/g)||[])).toHaveLength(1);
    const next = chroniclesReduce(state, { type:'interact' });
    expect(chroniclesGoldBalance(next)).toBe(before-7);
    expect(next.inventory['road-rations'].quantity)
      .toBe((state.inventory['road-rations']?.quantity || 0)+1);
    expect(next.turns).toBe(state.turns+1);
  });
  it('shows insufficient gold without offering an accidental free trade', () => {
    const state = atCounter(3);
    const html = renderToStaticMarkup(createElement(ChroniclesProvisions, {
      state, onBuy:()=> { throw Error('No purchase while disabled'); }, onClose:()=>{},
    }));
    expect(html).toContain('No tienes suficiente oro.');
    expect(html).toMatch(/data-provisions-buy[^>]*disabled=""/);
    const next = chroniclesReduce(state,{ type:'interact' });
    expect(chroniclesGoldBalance(next)).toBe(3);
    expect(next.inventory['road-rations']?.quantity || 0).toBe(
      state.inventory['road-rations']?.quantity || 0);
    expect(next).toBe(state);
    expect(next.turns).toBe(state.turns); // Rejected purchases are not actions.
  });
  it('does not charge or spend a turn when the ration pack is already full', () => {
    const state = atCounter(28);
    const packed = { ...state, inventory: {
      ...state.inventory,
      'road-rations': { id: 'road-rations', name: 'Raciones de viaje', quantity: 9999 },
    } };
    const next = chroniclesReduce(packed, { type: 'interact' });
    expect(next).toBe(packed);
    expect(chroniclesGoldBalance(next)).toBe(28);
    expect(next.inventory['road-rations'].quantity).toBe(9999);
    expect(next.turns).toBe(packed.turns);
  });
});
