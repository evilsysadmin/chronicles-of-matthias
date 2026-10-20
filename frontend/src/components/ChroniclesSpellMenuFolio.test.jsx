import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesMemberSpells } from '../chronicles/chroniclesMagic.js';
import ChroniclesSpellMenu, { chroniclesSpellMenuKind } from './ChroniclesSpellMenu.jsx';

const makeState = () => createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
function caster(state) {
  return state.party.find((member) => chroniclesMemberSpells(state, member).length > 0);
}
function render(state, member, props = {}) {
  return renderToStaticMarkup(createElement(ChroniclesSpellMenu, {
    state, member, onCast: () => {}, onUse: () => {}, onClose: () => {}, ...props,
  }));
}

describe('Chronicles · CAST diegetic grimoire', () => {
  it('preserves real spell IDs, costs, tab semantics and dialog focus affordances', () => {
    const state = makeState();
    const member = caster(state);
    expect(member).toBeTruthy();
    const html = render(state, member);
    const first = chroniclesMemberSpells(state, member)[0];
    expect(html).toContain('chronicles-cast-backdrop');
    expect(html).toContain('chronicles-spell-menu--folio');
    expect(html).toMatch(/role="dialog"[^>]*aria-modal="true"/);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('data-chronicles-menu-tab-button="spells"');
    expect(html).toContain('data-chronicles-menu-tab-button="items"');
    expect(html).toContain('data-chronicles-cast="' + first.id + '"');
    expect(html).toContain(first.name);
    expect(html).toContain(first.cost + ' PH');
    expect(html).toContain('aria-label="Cerrar grimorio"');
  });
  it('locks unaffordable spells rather than silently permitting casts', () => {
    const state = makeState();
    const member = caster(state);
    const empty = { ...state, spellPoints: { ...state.spellPoints, [member.id]: 0 } };
    const html = render(empty, member);
    expect(html).toContain('0 / ');
    expect(html).toMatch(/data-chronicles-cast="[^"]+"[^>]*disabled=""/);
    expect(html).toContain('SIN PH');
    const down = { ...state, party: state.party.map((hero) => (
      hero.id === member.id ? { ...hero, hp: 0 } : hero
    )) };
    expect(render(down, down.party.find((hero) => hero.id === member.id))).toContain('disabled=""');
  });
  it('keeps inventory IDs and quantities for the I/Objetos tab', () => {
    const state = makeState();
    const stocked = { ...state, inventory: {
      ...state.inventory,
      'healing-potion': { id: 'healing-potion', quantity: 3 },
      'fire-scroll': { id: 'fire-scroll', quantity: 1 },
    } };
    const html = render(stocked, caster(stocked), { initialTab: 'items' });
    expect(html).toContain('data-chronicles-use-item="healing-potion"');
    expect(html).toContain('data-chronicles-use-item="fire-scroll"');
    expect(html).toContain('×3');
    expect(html).toContain('4 unidades');
    expect(html).not.toContain('data-chronicles-cast=');
  });
  it('labels attack, healing, utility and scroll types without adding gameplay', () => {
    expect(chroniclesSpellMenuKind('attack').label).toBe('Ataque');
    expect(chroniclesSpellMenuKind('heal').label).toBe('Curación');
    expect(chroniclesSpellMenuKind('detect').label).toBe('Exploración');
    expect(chroniclesSpellMenuKind('scroll').label).toBe('Pergamino');
    expect(chroniclesSpellMenuKind('unknown').label).toBe('Objeto');
  });
});
