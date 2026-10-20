import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import ChroniclesShop from './ChroniclesShop.jsx';

describe('Chronicles shop fullscreen experience', () => {
  it('keeps the real merchant, equipment, tabs and prices in the room', () => {
    const state = {
      ...createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
      shop: { id: 'first-book-weaponsmith' },
    };
    const html = renderToStaticMarkup(createElement(ChroniclesShop, {
      state, onAction: () => {}, onClose: () => {},
    }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('data-chronicles-shop="first-book-weaponsmith"');
    expect(html).toContain('data-chronicles-shop-room="brunna-armory"');
    expect(html).toContain('aria-label="Salir de la tienda"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('Comprar');
    expect(html).toContain('Bastón de madera');
    expect(html).toContain('Comparar');
  });

  it('portals the entire counter outside transformed game parents and traps focus', () => {
    const code = readFileSync(new URL('./ChroniclesShop.jsx', import.meta.url), 'utf8');
    expect(code).toContain('createPortal(shop, document.body)');
    expect(code).toContain("document.body.style.overflow = 'hidden'");
    expect(code).toContain('document.body.style.overflow = previousOverflow');
    expect(code).toContain("event.key === 'Escape'");
    expect(code).toContain("event.key !== 'Tab'");
    expect(code).toContain('previousFocus.focus()');
  });

  it('covers the viewport without showing the game at desktop or phone widths', () => {
    const css = readFileSync(new URL('./ChroniclesShop.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.chronicles-shop__backdrop\s*\{[^}]*background: #100b08;/s);
    expect(css).toMatch(/\.chronicles-shop\s*\{[^}]*height: 100dvh;[^}]*overflow: hidden;/s);
    expect(css).toContain("@media (max-width: 900px)");
    expect(css).toContain("'scene'");
    expect(css).toContain("'list'");
  });
});
