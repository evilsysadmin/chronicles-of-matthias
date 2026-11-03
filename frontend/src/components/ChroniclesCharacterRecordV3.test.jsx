import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { createChroniclesProgression } from '../chroniclesOfMatthiasProgression.js';
import ChroniclesCharacterSheet from './ChroniclesCharacterSheet.jsx';
import ChroniclesQuickStatus from './ChroniclesQuickStatus.jsx';

const css = readFileSync(new URL('./ChroniclesCharacterRecordV3.css', import.meta.url), 'utf8');
const render = (mode = 'chronicles') => {
  const state = createChroniclesState('swordhaven-first-book', null, { rules: mode === 'chronicles' ? 'mm3' : null });
  return renderToStaticMarkup(createElement(ChroniclesCharacterSheet, {
    state, member: state.party[0], progression: createChroniclesProgression(),
    mode, initialFolio: 'record', onClose: () => {},
  }));
};
describe('MM3 character Status layout is a real structural redesign', () => {
  it('presents real attributes and battle strip without duplicating equipment', () => {
    const html = render();
    expect(html).toContain('data-chronicles-chapter="record"');
    for(const name of ['might','intellect','personality','endurance','speed','accuracy','luck','condition']) {
      expect(html).toContain(`data-stat="${name}"`);
    }
    expect(html).toContain('Sano');
    expect(html).toContain('Estado general según los puntos de vida actuales');
    expect(html).not.toContain('data-chronicles-worn-gear="matthias"');
    // The top PV and gold badges repeated the real HP strip and Group (G).
    expect(html).not.toContain('data-resource="health"');
    expect(html).not.toContain('data-resource="gold"');
    expect(html).toContain('chronicles-character-sheet__vitals');
    expect(html).toContain('chronicles-character-sheet__party-hp');
    expect(css).toContain('grid-template-areas: "battle" "attributes" "footer"');
    expect(css).toContain('.chronicles-character-sheet__folio-content[data-chronicles-chapter="record"] > .chronicles-character-sheet__section--core-stats');
    expect(css).toContain('grid-column: 1 / -1');
    expect(css).toContain('grid-template-columns: repeat(5, minmax(0,1fr))');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0,1fr));');
  });
  it('fills the record workspace on zoomed desktops and adapts columns for readable type', () => {
    // The legacy folio places statistics in grid column 2; at CSS heights
    // of 581-699px that left half was empty despite ample horizontal space.
    expect(css).toContain('.chronicles-character-sheet__backdrop:has(');
    expect(css).toContain('padding: 6px;');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(css).toContain('grid-template-columns: repeat(5, minmax(0, 1fr));');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0,1fr));');
    expect(css).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));');
    expect(css).toContain('overflow-wrap: break-word;');
  });
  it('reserves full-sized type for attributes, modifiers and explanations', () => {
    // The 1909px screenshot showed tiny glyphs in very large desktop cells.
    // Keep large type for the primary attribute/value and readable context.
    expect(css).toContain('font-size: clamp(1.38rem, 1.42vw, 1.65rem);');
    expect(css).toContain('font-size: clamp(1.875rem, 2vw, 2.25rem);');
    expect(css).toContain('font-size: 1.05rem;');
    expect(css).toContain('font-size: 1.125rem;');
    expect(css).toContain('font-size: 1.65rem;');
    expect(css).toContain('min-height: clamp(120px, 15dvh, 155px);');
    expect(css).toContain('@media (min-width: 1550px) and (min-height: 581px)');
    expect(css).toContain('@media (max-width: 850px)');
    expect(css).toContain('font-size: .9rem;');
  });
  it('keeps company gold in the G group summary rather than individual character headers', () => {
    const status = renderToStaticMarkup(createElement(ChroniclesQuickStatus, {
      open: true, rows: [], gold: 40, onClose: () => {}, onOpenSheet: () => {},
    }));
    expect(status).toContain('ESTADO DEL GRUPO');
    expect(status).toContain('ORO <b>40</b>');
    expect(render()).not.toContain('data-resource="gold"');
  });
  it('keeps non-record chapters and Tactics outside the new layout', () => {
    expect(render('tactics')).not.toContain('data-chronicles-chapter="record"');
    expect(css).toContain('@media (min-width: 851px) and (min-height: 581px)');
    expect(css).toContain('@media (min-width: 1200px) and (min-height: 581px)');
    expect(css).toContain('[data-chronicles-chapter="record"]');
    expect(css).not.toMatch(/pointer-events:\s*none|display:\s*none\s*!important/);
  });
});
