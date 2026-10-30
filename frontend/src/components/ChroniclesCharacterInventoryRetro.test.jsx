import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { createChroniclesProgression } from '../chroniclesOfMatthiasProgression.js';
import ChroniclesCharacterSheet from './ChroniclesCharacterSheet.jsx';
import { chroniclesGearSwapPreview } from '../chronicles/chroniclesGearCompare.js';

const css = readFileSync(new URL('./ChroniclesCharacterInventoryRetro.css', import.meta.url), 'utf8');
const classic = readFileSync(new URL('./ChroniclesCharacterInventoryClassic.css', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('./ChroniclesCharacterEquipmentWorkspace.css', import.meta.url), 'utf8');

function html(mode = 'chronicles', overrides = {}) {
  const state = createChroniclesState('swordhaven-first-book', null, { rules: mode === 'chronicles' ? 'mm3' : null });
  const inventory = { 'brass-dagger': { id: 'brass-dagger', name: 'Daga de latón', quantity: 2 } };
  const owned = { matthias: { 'brass-dagger': 2 } };
  return renderToStaticMarkup(createElement(ChroniclesCharacterSheet, {
    state: { ...state, inventory, bagOwners: owned, ...overrides },
    progression: createChroniclesProgression(),
    member: state.party[0],
    mode,
    initialFolio: 'equipment',
    onClose: () => {},
    onEquipmentAction: () => {},
  }));
}

describe('Chronicles MM3 inventory chapter skin', () => {
  it('retains an actionable, select-first item list and actual equip controls', () => {
    const rendered = html();
    expect(rendered).toContain('data-chronicles-equipment-folio="matthias"');
    expect(rendered).toContain('data-inventory-item="brass-dagger"');
    expect(rendered).toContain('aria-pressed="false"');
    expect(rendered).toContain('Objetos de Matthias');
    expect(rendered).toContain('aria-label="Acciones de inventario"');
    expect(rendered).toContain('aria-label="Equipar Daga de latón"');
    expect(rendered).toContain('Examinar');
    expect(rendered).toContain('E equipar · U quitar · T entregar · D tirar · I información');
    expect(rendered).toContain('aria-keyshortcuts="I"');
    expect(rendered).toContain('Tirar 1 objeto (D)');
    expect(rendered).not.toContain('class="chronicles-character-sheet__classic-recipients"');
    expect(rendered).toContain('alt="" draggable="false"');
    expect(rendered).toContain('Equipar Daga de latón');
    expect(rendered).not.toContain('chronicles-character-sheet__handoff-targets');
    expect(rendered).toContain('Vista previa · selecciónalo para entregarlo');
    expect(rendered).toContain('class="chronicles-character-sheet__item-details" aria-live="polite" hidden=""');
    expect(rendered).not.toContain('chronicles-character-sheet__classic-recipients');
    expect(rendered).not.toContain('chronicles-character-sheet__inventory-hint');
    expect(rendered).not.toContain('data-slot="weapon"');
    expect(rendered).not.toContain('data-slot="missile"');
    expect(rendered).toContain('aria-controls="chronicles-equipment-technical-details"');
  });

  it('fills the desktop ledger even with one item and keeps the inspector genuinely hidden', () => {
    const rendered = html();
    expect(rendered).toContain('class="chronicles-character-sheet__item-details" aria-live="polite" hidden=""');
    expect(workspace).toContain('.chronicles-character-sheet__item-details[hidden]');
    expect(workspace).toContain('display: none !important;');
    expect(workspace).toContain('.chronicles-character-sheet__inventory {\n    flex: 1 1 auto;');
    expect(workspace).not.toContain(':has(> button:nth-child(3))');
    expect(workspace).toContain('max-height: min(36vh, 320px)');
  });

  it('includes real simulated damage and hit chance on the first Examinar view', () => {
    const state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    const preview = chroniclesGearSwapPreview(state, state.party[0].id, 'brass-dagger');
    expect(preview).not.toBeNull();
    const rendered = html();
    expect(rendered).toContain(`data-chronicles-item-stat="damage"><dt>Daño base al equipar</dt><dd>${preview.after.damage}</dd>`);
    expect(rendered).toContain(`data-chronicles-item-stat="hit"><dt>Acierto total al equipar</dt><dd>+${preview.after.toHit}</dd>`);
    expect(rendered).toContain('Daño adicional');
    expect(rendered).toContain('Armadura');
    const sheet = readFileSync(new URL('./ChroniclesCharacterSheet.jsx', import.meta.url), 'utf8');
    expect(sheet).toContain('setExpandItemAttributes(!inspectItem)');
    expect(sheet).toContain('open={expandItemAttributes && inspectItem}');
    expect(html('tactics')).not.toContain('data-chronicles-item-stat="damage"');
  });

  it('always displays every possession without category filters or a searchbox', () => {
    const equipment = { matthias: { weapon: 'bronze-sword', armor: 'leather-leather' } };
    const rendered = html('chronicles', { equipment });
    expect(rendered).toContain('data-ledger-id="worn:weapon"');
    expect(rendered).toContain('data-ledger-id="worn:armor"');
    expect(rendered).toContain('data-ledger-id="bag:brass-dagger"');
    expect(rendered).not.toContain('Filtrar y buscar');
    expect(rendered).not.toContain('backpack-tools');
    expect(rendered).not.toContain('backpack-search');
    expect(rendered).not.toContain('type="search"');
    expect(html('tactics')).not.toContain('Filtrar y buscar');
    const source = readFileSync(new URL('./ChroniclesCharacterSheet.jsx', import.meta.url), 'utf8');
    expect(source).not.toContain('chroniclesFilterBackpack(');
    expect(source).not.toContain('setBackpackSearch');
    expect(source).not.toContain('setBackpackFilter');
  });

  it('makes landscape mobile actions compact without removing desktop commands', () => {
    const mobile = readFileSync(new URL('./ChroniclesCharacterMobileEquipment.css', import.meta.url), 'utf8');
    expect(mobile).toContain('Pocket-first MM3 equipment');
    expect(mobile).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(mobile).toContain(':nth-child(1), :nth-child(2), :nth-child(6)');
    expect(mobile).toContain('min-height: 44px');
    expect(mobile).toContain('white-space: nowrap');
    expect(classic).toContain('grid-template-columns: repeat(6, minmax(0, 1fr))');
  });

  it('lists genuinely equipped objects even when the personal bag is empty', () => {
    const equipment = { matthias: { weapon: 'bronze-sword', armor: 'leather-leather' } };
    const emptyBag = { inventory: {}, bagOwners: { matthias: {} }, equipment };
    const rendered = html('chronicles', emptyBag);
    expect(rendered).toContain('aria-label="Pertenencias de Matthias: equipadas y en mochila"');
    expect(rendered).toContain('data-worn-slot="weapon"');
    expect(rendered).toContain('data-worn-slot="armor"');
    expect(rendered).toContain('data-item-icon="sword"');
    expect(rendered).toContain('data-item-icon="armor"');
    expect(rendered).toContain('Espada de bronce');
    expect(rendered).toContain('Coraza de cuero');
    expect(rendered).toContain('Puesto · Arma');
    expect(rendered).not.toContain('Este personaje no lleva objetos en su mochila.');
    expect(rendered).not.toContain('data-worn-slot="missile"');
    expect(html('tactics', emptyBag)).not.toContain('chronicles-character-sheet__worn-ledger');
    expect(html('chronicles', { ...emptyBag, equipment: { matthias: {} } }))
      .not.toContain('data-worn-slot=');
    expect(classic).toContain('.chronicles-character-sheet__inventory .chronicles-character-sheet__worn-item');
    expect(classic).toContain('min-height: 44px;');
  });

  it('makes worn equipment selectable but keeps the change behind explicit Quitar', () => {
    const equipment = { matthias: { weapon: 'bronze-sword', armor: 'leather-leather' } };
    const rendered = html('chronicles', { equipment });
    expect(rendered).toContain('aria-label="Seleccionar Espada de bronce, equipado en');
    expect(rendered).toContain('data-worn-slot="weapon"');
    expect(rendered).toContain('aria-pressed="false"');
    expect(rendered).not.toContain('data-chronicles-worn-gear="matthias"');
    expect(rendered).not.toContain('Cambiar equipo');
    expect(classic).toContain('.chronicles-character-sheet__worn-item.is-selected');
    expect(classic).toContain('.chronicles-character-sheet__pixel-item-icon');
    const source = readFileSync(new URL('./ChroniclesCharacterSheet.jsx', import.meta.url), 'utf8');
    expect(source).toContain("type: 'unequip-item', slot: selectedWornItem.slot");
    expect(source).toContain('setSelectedBagItem(null)');
    expect(source).toContain('setSelectedWornSlot(null)');
    expect(html('tactics')).not.toContain('data-worn-slot=');
  });

  it('selects direct numeric delivery without rendering the old recipient picker', () => {
    const source = readFileSync(new URL('./ChroniclesCharacterSheet.jsx', import.meta.url), 'utf8');
    expect(source).toContain("activeFolio === 'equipment'");
    expect(source).toContain('chroniclesPartyHotkeyMember(event, state.party)');
    expect(source).toContain("type: 'transfer-item'");
    expect(source).toContain("type: 'transfer-equipped-item'");
    expect(source).toContain('selectedWornItem.name');
    expect(source).toContain('Boolean(transferSelection) && canChangeEquipment');
    expect(source).toContain('data-transfer-target=');
    expect(source).toContain('chronicles-character-sheet__transfer-hint');
    expect(source).not.toContain('showRecipients');
    expect(source).not.toContain('setShowRecipients');
    expect(classic).toContain("button[data-transfer-target='true']");
    expect(classic).toContain('.chronicles-character-sheet__transfer-hint');
  });

  it('keeps the equipment chapter in a cool stone and parchment palette with compact desktop actions', () => {
    expect(classic).toContain(':has([data-chronicles-chapter="equipment"])');
    expect(classic).toContain('--mm3-equipment-stone: #303b3e;');
    expect(classic).toContain('--mm3-equipment-paper: #d9ceb5;');
    expect(classic).toContain('--mm3-equipment-ink: #26312f;');
    expect(classic).toContain('background: var(--mm3-equipment-stone) !important;');
    expect(workspace).toContain('max-width: none;');
    expect(workspace).toContain('flex: 1 1 auto;');
    expect(workspace).toContain('align-content: start;');
    expect(workspace).not.toContain('grid-auto-rows: minmax(54px, auto)');
    expect(workspace).toContain('.chronicles-character-sheet__classic-actions');
    expect(workspace).toContain('@media (min-width: 851px) and (min-height: 581px)');
    expect(workspace).toContain('chronicles-character-sheet__technical-heading');
    expect(classic).toMatch(/__classic-actions > button\s*\{\s*min-height: 48px;/);
    expect(classic).toContain('border-color: #dec98a;');
    expect(html('tactics')).not.toContain('data-chronicles-equipment-folio');
  });

  it('changes only desktop visual treatment; mobile and Tactics do not inherit extra behavior', () => {
    expect(html('tactics')).not.toContain('chronicles-character-sheet--mm3');
    expect(html('tactics')).not.toContain('Acciones de inventario');
    expect(classic).toContain('grid-template-columns: repeat(6, minmax(0, 1fr))');
    expect(classic).toContain('[data-chronicles-chapter="equipment"]');
    expect(classic).toContain('.chronicles-character-sheet__party-dock img');
    expect(css).toContain('@media (min-width: 851px) and (min-height: 581px)');
    expect(css).toContain('[data-chronicles-equipment-folio]');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('text-overflow: ellipsis');
    expect(css).toContain('button:focus-visible');
    // Selected rows must retain dark readable text on the light copper surface.
    expect(css).toMatch(/button\.is-selected\s*\{[^}]*color:\s*#3b250f;/);
    expect(css).not.toMatch(/pointer-events:\s*none|display:\s*none\s*!important/);
    expect(css).not.toContain('content: \'1)\'');
  });
});