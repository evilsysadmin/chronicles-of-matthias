import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState, chroniclesContextualContentAction } from '../chroniclesOfMatthias.js';
import { createChroniclesProgression, applyChroniclesProgressionToTacticsState } from '../chroniclesOfMatthiasProgression.js';
import { chroniclesMapForState } from './chroniclesMapCatalog.js';
import { chroniclesContentVisualStateById } from './chroniclesContentVisualState.js';
import { chroniclesMM3WorldStatOffer, chroniclesClaimMM3WorldStat } from './chroniclesWorldStatDiscovery.js';
import { chroniclesRunCheckpointPayload, chroniclesCheckpointRunProgression, chroniclesApplyRunCheckpoint } from './chroniclesRunCheckpoint.js';
import ChroniclesWorldStatChoice from '../components/ChroniclesWorldStatChoice.jsx';

const SOURCE = 'rookwood-witch-cauldron';
function atCauldron(progression = createChroniclesProgression()) {
  const initial = applyChroniclesProgressionToTacticsState(
    createChroniclesState('rookwood-first-book', progression.characterBuild, { rules: 'mm3' }),
    progression,
  );
  return { ...initial, x: 4, y: 11, direction: 0, runProgression: progression };
}

describe('MM3 witch cauldron in Rookwood', () => {
  it('is a real reachable world prop, not a generic glowing crystal or a Tactics prop', () => {
    const state = atCauldron();
    const map = chroniclesMapForState(state);
    expect(map.grid[11][4]).toBe('.');
    expect(chroniclesContextualContentAction(state)?.id).toBe(SOURCE);
    const offer = chroniclesMM3WorldStatOffer(state);
    expect(offer).toEqual(expect.objectContaining({
      id: SOURCE, stat: 'luck', statLabel: 'Suerte', visualType: 'witch-cauldron',
    }));
    expect(chroniclesContentVisualStateById(state, SOURCE, map)).toMatchObject({
      kind: 'pickup', visualType: 'witch-cauldron', available: true, visible: true,
    });
    const tactics = { ...state, combatRules: null };
    expect(chroniclesMM3WorldStatOffer(tactics)).toBeNull();
    expect(chroniclesContentVisualStateById(tactics, SOURCE, map).visible).toBe(false);
    expect(state.runProgression.claimedWorldStatSources).not.toContain(SOURCE);
    expect(state.rookwoodWitchCauldronUsed).not.toBe(true);
    // Opening the modal is observational: no XP, stats or source receipts are spent.
  });

  it('awards +1 real Luck exactly once to the chosen living hero and leaves an empty cauldron', () => {
    const progression = createChroniclesProgression();
    const state = atCauldron(progression);
    const original = state.party.find((member) => member.id === 'rook');
    expect(chroniclesClaimMM3WorldStat(state, progression, SOURCE, 'missing').granted).toBe(false);
    const awarded = chroniclesClaimMM3WorldStat(state, progression, SOURCE, 'rook');
    expect(awarded.granted).toBe(true);
    const rook = awarded.state.party.find((member) => member.id === 'rook');
    expect(rook.mm3.stats.luck).toBe(original.mm3.stats.luck + 1);
    expect(rook.mm3.worldBonuses.luck).toBe(1);
    expect(rook.characterBuild.stats.luck).toBe(original.characterBuild.stats.luck);
    expect(rook.hp).toBe(original.hp);
    expect(awarded.state.message).toContain('Caldero de la bruja');
    expect(awarded.state.message).toContain('+1 Suerte');
    expect(awarded.progression.claimedWorldStatSources).toEqual([SOURCE]);
    expect(awarded.state.rookwoodWitchCauldronUsed).toBe(true);
    expect(chroniclesContentVisualStateById(awarded.state, SOURCE, mapOf(awarded.state))).toMatchObject({
      available: false, visible: true,
    });
    expect(chroniclesMM3WorldStatOffer(awarded.state)).toBeNull();
    expect(chroniclesClaimMM3WorldStat(awarded.state, awarded.progression, SOURCE, 'matthias').granted).toBe(false);
    expect(chroniclesClaimMM3WorldStat({ ...state, runProgression: awarded.progression },
      awarded.progression, SOURCE, 'matthias').granted).toBe(false);
    const payload = chroniclesRunCheckpointPayload(awarded.state, 0);
    expect(payload.worldFlags.rookwoodWitchCauldronUsed).toBe(true);
    const restored = chroniclesCheckpointRunProgression(payload);
    expect(restored.heroes.rook.mm3WorldBonuses.luck).toBe(1);
    expect(restored.claimedWorldStatSources).toContain(SOURCE);
    const loaded = chroniclesApplyRunCheckpoint(atCauldron(restored), payload);
    expect(loaded.rookwoodWitchCauldronUsed).toBe(true);
    expect(chroniclesMM3WorldStatOffer(loaded)).toBeNull();
  });

  it('offers a potion-specific choice with Cancel and no Resistencia copy', () => {
    const html = renderToStaticMarkup(createElement(ChroniclesWorldStatChoice, {
      offer: { label: 'Caldero de la bruja · +1 Suerte', statLabel: 'Suerte', visualType: 'witch-cauldron' },
      party: [{ id: 'rook', name: 'Hildegard', hp: 9, maxHp: 10 }],
      onSelect: () => {}, onClose: () => {},
    }));
    expect(html).toContain('Caldero de la bruja');
    expect(html).toContain('El brebaje concede +1 Suerte permanente');
    expect(html).toContain('¿Quién lo beberá?');
    expect(html).toContain('Ahora no');
    expect(html).not.toContain('Resistencia');
    expect(html).toContain('aria-modal="true"');
  });
});

function mapOf(state) {
  return chroniclesMapForState(state);
}
