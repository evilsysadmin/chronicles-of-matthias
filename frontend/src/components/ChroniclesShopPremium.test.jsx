import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import ChroniclesShop from './ChroniclesShop.jsx';

function render(shopId = 'first-book-weaponsmith', inventory = null) {
  const state = {
    ...createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
    shop: { id: shopId },
    ...(inventory ? { inventory } : {}),
  };
  return renderToStaticMarkup(createElement(ChroniclesShop, {
    state, onAction: () => {}, onClose: () => {},
  }));
}

describe('Chronicles premium shop UI', () => {
  it('uses the real merchant room and foreground modal outside the world stacking context', () => {
    const html = render();
    expect(html).toContain('data-chronicles-shop="first-book-weaponsmith"');
    expect(html).toContain('data-chronicles-shop-room="brunna-armory"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Salir de la tienda"');
    expect(html).toContain('chronicles-shop__catalog');
    expect(html).toContain('chronicles-shop__detail');
    expect(html).toContain('Bastón de madera');
    expect(html).toContain('Comparar con mi equipo');
    expect(html).toContain('type="search"');
    expect(html).toContain('Precio: menor primero');
  });

  it('keeps one explicit checkout button in the detail, not one purchase trigger per list row', () => {
    const html = render();
    expect(html).toContain('chronicles-shop__primary');
    expect((html.match(/class="chronicles-shop__primary"/g) || []).length).toBe(1);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-label="Operación comercial"');
  });

  it('supports guild consumables without showing nonexistent equipment comparisons', () => {
    const html = render('first-book-guild');
    expect(html).toContain('data-chronicles-shop-room="guild-sanctum"');
    expect(html).toContain('Comprar');
    expect(html).toContain('chronicles-shop__detail-empty');
    expect(html).toContain('0 de 0');
  });

  it('preserves full viewport layout, mobile inventory and accessible focus containment', () => {
    const js = readFileSync(new URL('./ChroniclesShop.jsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('./ChroniclesShop.css', import.meta.url), 'utf8');
    expect(js).toContain('createPortal(shop, document.body)');
    expect(js).toContain("document.body.style.overflow = 'hidden'");
    expect(js).toContain('previousFocus.focus()');
    expect(css).toMatch(/height: 100dvh;/);
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('@media (max-width: 430px)');
    expect(css).toContain('overscroll-behavior: contain');
  });
});
