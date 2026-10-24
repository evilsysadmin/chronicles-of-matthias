import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesMemberSpells } from '../chronicles/chroniclesMagic.js';
import ChroniclesSpellMenu, { ChroniclesHealTargetPicker, ChroniclesReviveTargetPicker, ChroniclesSpellTargetBanner, ChroniclesSpellTargetCancel, ChroniclesSpellTargetQuestion, chroniclesSpellMenuKind, chroniclesSpellMenuPageShortcut } from './ChroniclesSpellMenu.jsx';

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
  it('switches C/I folio keys, and closes on the same page key', () => {
    const pageKey = (key, tab, hasSpells = true, extra = {}) =>
      chroniclesSpellMenuPageShortcut({ key, ...extra }, { tab, hasSpells });
    expect(pageKey('i', 'spells')).toBe('items');
    expect(pageKey('I', 'items')).toBe('close');
    expect(pageKey('c', 'items')).toBe('spells');
    expect(pageKey('C', 'spells')).toBe('close');
    expect(pageKey('c', 'items', false)).toBe(null);
    expect(pageKey('i', 'spells', true, { ctrlKey: true })).toBe(null);
    expect(pageKey('i', 'spells', true, { shiftKey: true })).toBe(null);
    expect(pageKey('i', 'spells', true, { repeat: true })).toBe(null);
    expect(pageKey('c', 'items', true, { isComposing: true })).toBe(null);
    expect(pageKey('i', 'spells', true, {
      target: { closest: () => ({ tagName: 'INPUT' }) },
    })).toBe(null);
  });

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
    expect(html).toContain('aria-keyshortcuts="C"');
    expect(html).toContain('aria-keyshortcuts="I"');
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
  it('shows an MM3 ¿A quién? question with 1–4 and Escape before any cast', () => {
    const html = renderToStaticMarkup(createElement(ChroniclesSpellTargetQuestion, {
      spellId: 'first-aid',
    }));
    expect(html).toContain('data-chronicles-spell-target-question="first-aid"');
    expect(html).toContain('role="status"');
    expect(html).toContain('¿A quién?');
    expect(html).toContain('1–4 · elige compañero');
    expect(html).toContain('Esc cancela');
    expect(renderToStaticMarkup(createElement(ChroniclesSpellTargetQuestion, {
      spellId: 'first-aid', notice: 'A 0 PV necesita resurrección, no curación.',
    }))).toContain('A 0 PV necesita resurrección');
  });

  it('places the target question and accessible Cancel together outside every portrait button', () => {
    const html = renderToStaticMarkup(createElement(ChroniclesSpellTargetBanner, {
      spellId: 'first-aid', notice: 'Selecciona un compañero herido', onCancel: () => {},
    }));
    expect(html).toContain('data-chronicles-spell-target-banner="first-aid"');
    expect(html).toContain('data-chronicles-spell-target-question="first-aid"');
    expect(html).toContain('data-chronicles-spell-target-cancel="true"');
    expect(html).toContain('Selecciona un compañero herido');
    expect(html).not.toContain('chronicles-party-member');
    expect(html.indexOf('chronicles-spell-target-question')).toBeLessThan(html.indexOf('chronicles-spell-target-cancel'));
  });

  it('renders touch cancellation as a separate accessible action, not a nested portrait button', () => {
    const markup = renderToStaticMarkup(createElement(ChroniclesSpellTargetCancel, {
      onCancel: () => {},
    }));
    expect(markup).toContain('type="button"');
    expect(markup).toContain('data-chronicles-spell-target-cancel="true"');
    expect(markup).toContain('aria-label="Cancelar selección de destinatario del hechizo"');
    expect(markup).toContain('Cancelar');
    expect(markup).not.toContain('chronicles-party-member');
  });

  it('exposes explicit healing targets and explains why a fallen companion cannot be healed', () => {
    const original = makeState();
    const state = { ...original, party: original.party.map((hero) => (
      hero.id === 'rook' ? { ...hero, hp: 0 }
        : hero.id === 'matthias' ? { ...hero, hp: 3 } : hero
    )) };
    const spell = chroniclesMemberSpells(state, caster(state)).find((entry) => entry.id === 'first-aid');
    const html = renderToStaticMarkup(createElement(ChroniclesHealTargetPicker, {
      state, spell, onSelect: () => {}, onBack: () => {},
    }));
    expect(html).toContain('data-chronicles-heal-target="rook"');
    expect(html).toContain('data-chronicles-heal-target="matthias"');
    expect(html).toMatch(/data-chronicles-heal-target="rook"[^>]*disabled=""/);
    expect(html).not.toMatch(/data-chronicles-heal-target="matthias"[^>]*disabled=""/);
    expect(html).toContain('No llevas ningún Elixir de retorno');
    expect(html).not.toContain('data-chronicles-open-revive');
    expect(html).toContain('CAÍDO · REVIVIR');
    expect(html).toContain('3 / ');
  });
  it('offers a direct revival route only when the party actually carries an elixir', () => {
    const base = makeState();
    const party = base.party.map((hero) => (
      hero.id === 'rook' ? { ...hero, hp: 0 } : hero
    ));
    const state = {
      ...base,
      party,
      inventory: { 'revive-draught': { id: 'revive-draught', quantity: 1 } },
    };
    const spell = chroniclesMemberSpells(state, caster(state)).find((entry) => entry.id === 'first-aid');
    const html = renderToStaticMarkup(createElement(ChroniclesHealTargetPicker, {
      state, spell, onSelect: () => {}, onBack: () => {}, onOpenRevive: () => {},
    }));
    expect(html).toContain('data-chronicles-open-revive');
    expect(html).toContain('Llevas 1 Elixir de retorno');
    const empty = renderToStaticMarkup(createElement(ChroniclesHealTargetPicker, {
      state: { ...state, inventory: {} }, spell,
      onSelect: () => {}, onBack: () => {}, onOpenRevive: () => {},
    }));
    expect(empty).toContain('No llevas ningún Elixir de retorno');
    expect(empty).not.toContain('data-chronicles-open-revive');
  });

  it('shows explicit revive choices for fallen allies and does not offer the elixir to living heroes', () => {
    const original = makeState();
    const state = {
      ...original,
      party: original.party.map((hero) => (
        hero.id === 'rook' ? { ...hero, hp: 0 } : hero
      )),
      inventory: { 'revive-draught': { id: 'revive-draught', quantity: 1 } },
    };
    const item = { id: 'revive-draught', name: 'Elixir de retorno' };
    const html = renderToStaticMarkup(createElement(ChroniclesReviveTargetPicker, {
      state, item, onSelect: () => {}, onBack: () => {},
    }));
    expect(html).toContain('data-chronicles-revive-picker="revive-draught"');
    expect(html).toContain('data-chronicles-revive-target="rook"');
    expect(html).not.toMatch(/data-chronicles-revive-target="rook"[^>]*disabled=""/);
    expect(html).toMatch(/data-chronicles-revive-target="matthias"[^>]*disabled=""/);
    expect(html).toContain('Confirmar consume un elixir');
    expect(html).toContain('0 / ');
    const allHealthy = { ...state, party: state.party.map((hero) => ({ ...hero, hp: hero.maxHp })) };
    expect(renderToStaticMarkup(createElement(ChroniclesReviveTargetPicker, {
      state: allHealthy, item, onSelect: () => {}, onBack: () => {},
    }))).toContain('Nadie está caído');
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
  it('keeps spell and item buttons disabled while an enemy is acting', () => {
    const state = makeState();
    const member = caster(state);
    const enemyTurn = {
      ...state,
      initiative: { round: 1, cursor: 0, order: [{ kind: 'enemy', id: 'test-enemy' }] },
      inventory: { 'healing-potion': { id: 'healing-potion', quantity: 1 } },
    };
    const html = render(enemyTurn, member, { onOpenSheet: () => {} });
    expect(html).toContain('1–4 · FICHAS');
    expect(html).toContain('Es el turno de otro combatiente');
    expect(html).toMatch(/data-chronicles-cast="[^"]+"[^>]*disabled=""/);
    const items = render(enemyTurn, member, { initialTab: 'items' });
    expect(items).toMatch(/data-chronicles-use-item="healing-potion"[^>]*disabled=""/);
  });
  it('does not grant a non-active hero another party member’s turn', () => {
    const state = makeState();
    const member = caster(state);
    const other = state.party.find((hero) => hero.id !== member.id);
    const turn = { ...state, initiative: {
      round: 1, cursor: 0, order: [{ kind: 'party', id: other.id }],
    } };
    expect(render(turn, member)).toMatch(/data-chronicles-cast="[^"]+"[^>]*disabled=""/);
    expect(render(turn, other)).not.toContain('Es el turno de otro combatiente');
  });
  it('labels attack, healing, utility and scroll types without adding gameplay', () => {
    expect(chroniclesSpellMenuKind('attack').label).toBe('Ataque');
    expect(chroniclesSpellMenuKind('heal').label).toBe('Curación');
    expect(chroniclesSpellMenuKind('detect').label).toBe('Exploración');
    expect(chroniclesSpellMenuKind('scroll').label).toBe('Pergamino');
    expect(chroniclesSpellMenuKind('unknown').label).toBe('Objeto');
  });
});
