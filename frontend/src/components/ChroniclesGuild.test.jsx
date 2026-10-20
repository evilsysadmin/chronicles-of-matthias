import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import ChroniclesGuild from './ChroniclesGuild.jsx';

function renderGuild(member = false) {
  const base = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
  const state = {
    ...base,
    guild: { id: 'first-book-guild' },
    guildMemberships: member ? { 'first-book-guild': true } : {},
  };
  return renderToStaticMarkup(createElement(ChroniclesGuild, {
    state, onAction: () => {}, onClose: () => {},
  }));
}

describe('Chronicles guild full-room experience', () => {
  it('presents a real spell-learning counter, not buy/sell commerce', () => {
    const html = renderGuild();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('data-chronicles-guild="first-book-guild"');
    expect(html).toContain('data-chronicles-shop-room="guild-sanctum"');
    expect(html).toContain('chronicles-guild__membership');
    expect(html).toContain('chronicles-guild__spells');
    expect(html).toContain('data-chronicles-guild-join');
    expect(html).toContain('data-chronicles-guild-spell');
    expect(html).not.toContain('chronicles-shop__tabs');
  });

  it('marks a joined company without showing the membership CTA again', () => {
    const html = renderGuild(true);
    expect(html).toContain('Compañía afiliada');
    expect(html).not.toContain('data-chronicles-guild-join');
    expect(html).toContain('data-chronicles-guild-spell');
  });

  it('has its own responsive stacking with non-intercepting art and keyboard containment', () => {
    const js = readFileSync(new URL('./ChroniclesGuild.jsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('./ChroniclesGuild.css', import.meta.url), 'utf8');
    expect(js).toContain('createPortal(guildScene, document.body)');
    expect(js).toContain("document.body.style.overflow = 'hidden'");
    expect(js).toContain("event.key === 'Escape'");
    expect(js).toContain("event.key !== 'Tab'");
    expect(css).toContain('pointer-events: none');
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('(orientation: landscape)');
  });
});
