import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import ChroniclesShop from './ChroniclesShop.jsx';
import { CHRONICLES_EQUIPMENT } from '../chronicles/chroniclesEquipment.js';
import { chroniclesShopItemArt } from '../chronicles/chroniclesShopItemArt.js';

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
    expect(html).toContain('Armas a distancia');
    expect(html).toContain('aria-label="Arma a distancia"');
    expect(html).toContain('pasa el ratón o enfoca un objeto para ver sus efectos y compatibilidad');
    expect(html).not.toContain('chronicles-shop__compare-toggle');
    expect(html).not.toContain('chronicles-shop__comparison-grid');
    expect(html).toContain('type="search"');
    expect(html).toContain('Precio: menor primero');
  });

  it('uses the same progressive comparison layout in Odo and the apothecary', () => {
    const armor = render('first-book-armorer');
    const potion = render('first-book-apothecary');
    expect(armor).toContain('data-chronicles-shop="first-book-armorer"');
    expect(armor).toContain('Coracería de Odo');
    expect(armor).toContain('data-chronicles-shop-room="odo-forge"');
    expect(armor).toContain('odo-armory.svg');
    expect(armor).toContain('pasa el ratón o enfoca');
    expect(potion).toContain('data-chronicles-shop="first-book-apothecary"');
    expect(potion).toContain('Poción de curación');
    expect(potion).toContain('Pergamino de llamas');
    expect(potion).toContain('pasa el ratón o enfoca');
    for (const html of [armor, potion]) {
      expect(html).toContain('chronicles-shop__detail');
      expect(html).not.toContain('chronicles-shop__compare-toggle');
      expect(html).not.toContain('chronicles-shop__comparison-grid');
    }
  });

  it('uses one dedicated portrait for each of Odo’s seven stocked items', () => {
    const html = render('first-book-armorer');
    for (const id of [
      'wooden-shield', 'leather-leather', 'brass-shield', 'brass-ring',
      'brass-scale', 'leather-padded', 'roadwatch-vest',
    ]) {
      expect(html).toContain('data-chronicles-shop-art="' + id + '"');
      expect(html).toContain('data-chronicles-shop-item="' + id + '"');
    }
    expect((html.match(/data-chronicles-shop-item="/g) || []).length).toBe(7);
    expect(html).not.toContain('data-chronicles-shop-glyph=');
    expect(html).not.toContain('<linearGradient');
  });

  it('uses per-item standalone 2D art for the first real weapons, preserving fallback glyphs', () => {
    const bow = chroniclesShopItemArt(CHRONICLES_EQUIPMENT['wooden-longbow']);
    const crossbow = chroniclesShopItemArt(CHRONICLES_EQUIPMENT['brass-crossbow']);
    // Vite can inline small SVGs as data: URIs or emit a local .svg URL.
    expect(bow).toMatch(/^(?:data:image\/svg\+xml|\/[^\\s]+\.svg|\.\/[^\\s]+\.svg)/);
    expect(crossbow).toMatch(/^(?:data:image\/svg\+xml|\/[^\\s]+\.svg|\.\/[^\\s]+\.svg)/);
    expect(bow).not.toBe(crossbow);
    expect(chroniclesShopItemArt(CHRONICLES_EQUIPMENT['steel-longbow'])).toBeNull();
    expect(chroniclesShopItemArt(CHRONICLES_EQUIPMENT['wooden-staff'])).toBeNull();
    const html = render('first-book-weaponsmith');
    expect(html).toContain('data-chronicles-shop-art="wooden-longbow"');
    expect(html).toContain('class="chronicles-shop__item-sprite"');
    expect(html).toContain('data-chronicles-shop-glyph="weapon"');
  });

  it('adds material-specific 2D close-up art for dagger and bronze sword only', () => {
    const dagger = CHRONICLES_EQUIPMENT['brass-dagger'];
    const sword = CHRONICLES_EQUIPMENT['bronze-sword'];
    expect(dagger.materialId).toBe('brass');
    expect(sword.materialId).toBe('bronze');
    expect(dagger.baseItemId).toBe('dagger');
    expect(sword.baseItemId).toBe('sword');
    const dagArt = chroniclesShopItemArt(dagger);
    const swordArt = chroniclesShopItemArt(sword);
    expect(dagArt).toBeTruthy();
    expect(swordArt).toBeTruthy();
    expect(dagArt).not.toBe(swordArt);
    expect(chroniclesShopItemArt(CHRONICLES_EQUIPMENT['steel-sword'])).toBeNull();
    expect(chroniclesShopItemArt(CHRONICLES_EQUIPMENT['iron-dagger'])).toBeNull();
    const html = render();
    expect(html).toContain('data-chronicles-shop-art="brass-dagger"');
    expect(html).toContain('data-chronicles-shop-art="wooden-longbow"');
    expect(html).toContain('class="chronicles-shop__item-sprite"');
  });

  it('shows Odo wood shield and leather cuirass portraits using canonical material IDs', () => {
    const shield = CHRONICLES_EQUIPMENT['wooden-shield'];
    const cuirass = CHRONICLES_EQUIPMENT['leather-leather'];
    expect(shield.slot).toBe('shield');
    expect(shield.materialId).toBe('wooden');
    expect(cuirass.slot).toBe('armor');
    expect(cuirass.materialId).toBe('leather');
    const shieldArt = chroniclesShopItemArt(shield);
    const cuirassArt = chroniclesShopItemArt(cuirass);
    expect(shieldArt).toBeTruthy();
    expect(cuirassArt).toBeTruthy();
    expect(shieldArt).not.toBe(cuirassArt);
    expect(chroniclesShopItemArt(CHRONICLES_EQUIPMENT['brass-shield'])).toBeTruthy();
    expect(chroniclesShopItemArt(CHRONICLES_EQUIPMENT['brass-ring'])).toBeTruthy();
    expect(chroniclesShopItemArt(CHRONICLES_EQUIPMENT['roadwatch-vest'])).toBeTruthy();
    const html = render('first-book-armorer');
    expect(html).toContain('data-chronicles-shop-art="wooden-shield"');
    expect(html).toContain('data-chronicles-shop-art="leather-leather"');
    expect(html).toContain('data-chronicles-shop-art="roadwatch-vest"');
    expect(html).not.toContain('data-chronicles-shop-glyph="shield"');
  });

  it('adds distinct brass shield and ringmail portraits without painting unrelated materials', () => {
    const shield = CHRONICLES_EQUIPMENT['brass-shield'];
    const ringmail = CHRONICLES_EQUIPMENT['brass-ring'];
    expect(shield.slot).toBe('shield');
    expect(ringmail.slot).toBe('armor');
    expect(shield.materialId).toBe('brass');
    expect(ringmail.materialId).toBe('brass');
    expect(shield.baseItemId).toBe('shield');
    expect(ringmail.baseItemId).toBe('ring');
    expect(chroniclesShopItemArt(shield)).toBeTruthy();
    expect(chroniclesShopItemArt(ringmail)).toBeTruthy();
    expect(chroniclesShopItemArt(shield)).not.toBe(chroniclesShopItemArt(ringmail));
    expect(chroniclesShopItemArt(CHRONICLES_EQUIPMENT['roadwatch-vest'])).toBeTruthy();
    const html = render('first-book-armorer');
    expect(html).toContain('data-chronicles-shop-art="brass-shield"');
    expect(html).toContain('data-chronicles-shop-art="brass-ring"');
    expect(html).toContain('data-chronicles-shop-art="roadwatch-vest"');
  });

  it('uses different 2D material treatments for padded leather and brass scales', () => {
    const scales = CHRONICLES_EQUIPMENT['brass-scale'];
    const gambeson = CHRONICLES_EQUIPMENT['leather-padded'];
    expect(scales.slot).toBe('armor');
    expect(gambeson.slot).toBe('armor');
    expect(scales.materialId).toBe('brass');
    expect(gambeson.materialId).toBe('leather');
    expect(scales.baseItemId).toBe('scale');
    expect(gambeson.baseItemId).toBe('padded');
    const scaleArt = chroniclesShopItemArt(scales);
    const paddingArt = chroniclesShopItemArt(gambeson);
    expect(scaleArt).toBeTruthy();
    expect(paddingArt).toBeTruthy();
    expect(scaleArt).not.toBe(paddingArt);
    expect(chroniclesShopItemArt(CHRONICLES_EQUIPMENT['roadwatch-vest'])).toBeTruthy();
    const html = render('first-book-armorer');
    expect(html).toContain('data-chronicles-shop-art="brass-scale"');
    expect(html).toContain('data-chronicles-shop-art="leather-padded"');
    expect(html).toContain('data-chronicles-shop-art="roadwatch-vest"');
  });

  it('distinguishes the named roadwatch guard vest from an ordinary leather cuirass', () => {
    const guard = CHRONICLES_EQUIPMENT['roadwatch-vest'];
    const cuirass = CHRONICLES_EQUIPMENT['leather-leather'];
    expect(guard.slot).toBe('armor');
    expect(guard.baseItemId).toBe('vest');
    expect(guard.materialId).toBe('leather');
    expect(guard.armorType).toBe('leather');
    expect(chroniclesShopItemArt(guard)).toBeTruthy();
    expect(chroniclesShopItemArt(guard)).not.toBe(chroniclesShopItemArt(cuirass));
    expect(chroniclesShopItemArt(CHRONICLES_EQUIPMENT['bronze-leather'])).toBeNull();
    const html = render('first-book-armorer');
    expect(html).toContain('data-chronicles-shop-art="roadwatch-vest"');
    expect(html).toContain('alt="Jubón de cuero de guardia"');
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
