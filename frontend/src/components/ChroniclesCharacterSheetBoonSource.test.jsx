import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  applyChroniclesProgressionToTacticsState,
  createChroniclesProgression,
  grantChroniclesMM3TemporaryBoon,
  reconcileChroniclesProgressionInTacticsState,
} from '../chroniclesOfMatthiasProgression.js';
import {
  chroniclesApplyRunCheckpoint,
  chroniclesCheckpointRunProgression,
  chroniclesRunCheckpointPayload,
} from '../chronicles/chroniclesRunCheckpoint.js';
import { chroniclesTemporaryFountainName } from '../chronicles/chroniclesTemporaryFountainBoon.js';
import ChroniclesCharacterSheet from './ChroniclesCharacterSheet.jsx';

function renderRecord(state, progression) {
  return renderToStaticMarkup(createElement(ChroniclesCharacterSheet, {
    state, progression, member: state.party[0], mode: 'chronicles',
    initialFolio: 'record', onClose: () => {},
  }));
}

function withBoon(sourceId, stat, amount, turn = 3) {
  const progression = createChroniclesProgression();
  const base = applyChroniclesProgressionToTacticsState(
    createChroniclesState('terra-b2', progression.characterBuild, { rules: 'mm3' }),
    progression,
  );
  const granted = grantChroniclesMM3TemporaryBoon(
    progression, sourceId, stat, amount, 13,
  );
  expect(granted.granted).toBe(true);
  const state = reconcileChroniclesProgressionInTacticsState(
    { ...base, turns: turn, runProgression: granted.progression }, granted.progression,
  );
  return { state, progression: granted.progression };
}

describe('MM3 character record · temporary fountain provenance', () => {
  it('shows the real source and remaining turns in the individual record, not the main HUD', () => {
    for (const [sourceId, stat, amount, name] of [
      ['terra-b2-shrine', 'luck', 2, 'Fuente de los Lobos'],
      ['terra-e1-shrine', 'speed', 2, 'Fuente de Escarcha'],
      ['terra-a6-shrine', 'accuracy', 3, 'Fuente del Faro'],
      ['terra-f3-shrine', 'might', 4, 'Fuente de Lava Dormida'],
      ['terra-b5-shrine', 'endurance', 4, 'Fuente del Molino'],
      ['terra-e6-shrine', 'personality', 4, 'Pila del Obispo'],
    ]) {
      expect(chroniclesTemporaryFountainName(sourceId)).toBe(name);
      const { state, progression } = withBoon(sourceId, stat, amount);
      const html = renderRecord(state, progression);
      expect(html).toContain(`${name} +${amount} (10 acciones)`);
      expect(html).toContain(`data-stat="${stat}"`);
      expect(html).not.toContain('Bendición +');
    }
  });

  it('resolves its label after checkpoint/reload and hides it when the blessing expires', () => {
    const { state, progression } = withBoon('terra-e6-shrine', 'personality', 4);
    const checkpoint = chroniclesRunCheckpointPayload(state, 6);
    const restoredProgression = chroniclesCheckpointRunProgression(checkpoint);
    const loaded = reconcileChroniclesProgressionInTacticsState(
      chroniclesApplyRunCheckpoint(
        createChroniclesState('terra-b2', progression.characterBuild, { rules: 'mm3' }),
        checkpoint,
      ),
      restoredProgression,
    );
    expect(renderRecord(loaded, restoredProgression)).toContain('Pila del Obispo +4 (10 acciones)');
    const expired = reconcileChroniclesProgressionInTacticsState(
      { ...loaded, turns: 13 }, restoredProgression,
    );
    expect(renderRecord(expired, restoredProgression)).not.toContain('Pila del Obispo +4');
    expect(expired.party[0].mm3.temporaryBoon).toBeNull();
  });

  it('does not print untrusted saved IDs as labels and does not create bonuses in Tactics', () => {
    expect(chroniclesTemporaryFountainName('terra-unknown-<unsafe>')).toBeNull();
    const { state, progression } = withBoon('terra-unknown-<unsafe>', 'luck', 2);
    const html = renderRecord(state, progression);
    expect(html).toContain('Bendición +2 (10 acciones)');
    expect(html).not.toContain('unsafe');

    const tactics = createChroniclesState('terra-b2', null, { rules: null });
    const tacticsHtml = renderRecord(tactics, createChroniclesProgression());
    expect(tacticsHtml).not.toContain('Fuente de los Lobos');
    expect(tacticsHtml).not.toContain('Bendición +');
  });
});
