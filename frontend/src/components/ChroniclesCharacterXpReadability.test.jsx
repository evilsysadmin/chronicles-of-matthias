import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChroniclesCharacterSheet from './ChroniclesCharacterSheet.jsx';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import {
  CHRONICLES_MAX_LEVEL,
  chroniclesXpThresholdForLevel,
  createChroniclesProgression,
} from '../chroniclesOfMatthiasProgression.js';

function renderSheet(xp, mode = 'mm3') {
  const state = createChroniclesState('swordhaven-first-book', null, { rules: mode === 'mm3' ? 'mm3' : null });
  const base = createChroniclesProgression();
  const progression = {
    ...base,
    heroes: { ...base.heroes, matthias: { ...base.heroes.matthias, xp } },
  };
  return renderToStaticMarkup(
    <ChroniclesCharacterSheet
      state={state}
      progression={progression}
      member={state.party[0]}
      mode={mode}
      onClose={() => {}}
    />,
  );
}

describe('MM3 character XP legibility', () => {
  it('leads with the real XP left to the next level, not the cumulative total', () => {
    const html = renderSheet(15);
    expect(html).toMatch(/data-chronicles-xp-remaining[^>]*>25 XP para subir<\/b>/);
    expect(html).toContain('15 XP acumulados / 40');
    expect(html).toContain('aria-valuenow="38"');
    expect(html).toContain('aria-valuetext="25 XP para el siguiente nivel"');
  });

  it('describes the reached maximum without implying another level', () => {
    const totalXp = chroniclesXpThresholdForLevel(CHRONICLES_MAX_LEVEL);
    const html = renderSheet(totalXp);
    expect(html).toMatch(/data-chronicles-xp-remaining[^>]*>Nivel máximo<\/b>/);
    expect(html).toContain(`${totalXp} XP acumulados`);
    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain('aria-valuetext="Nivel máximo"');
    expect(html).not.toContain('XP para subir');
  });

  it('keeps the separate Tactics progression presentation intact', () => {
    const html = renderSheet(15, 'tactics');
    expect(html).not.toContain('data-chronicles-xp-remaining');
    expect(html).toContain('15/40 XP');
    expect(html).toContain('25 XP para el siguiente nivel');
  });
});
