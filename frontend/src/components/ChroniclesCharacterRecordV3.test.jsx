import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { createChroniclesProgression } from '../chroniclesOfMatthiasProgression.js';
import ChroniclesCharacterSheet from './ChroniclesCharacterSheet.jsx';
import ChroniclesQuickStatus from './ChroniclesQuickStatus.jsx';
import ChroniclesCharacterStatIcon, { CHRONICLES_CHARACTER_STAT_ICON_IDS } from './ChroniclesCharacterStatIcon.jsx';

const css = readFileSync(new URL('./ChroniclesCharacterRecordV3.css', import.meta.url), 'utf8');
const render = (mode = 'chronicles') => {
  const state = createChroniclesState('swordhaven-first-book', null, { rules: mode === 'chronicles' ? 'mm3' : null });
  return renderToStaticMarkup(createElement(ChroniclesCharacterSheet, {
    state, member: state.party[0], progression: createChroniclesProgression(),
    mode, initialFolio: 'record', onClose: () => {},
  }));
};
// Test true UI rendering with health and modifiers deliberately varied.
// All tones must derive from current hero data, never hardcoded by identity.
const renderHero = (update) => {
  const base = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
  const member = update(base.party[0]);
  const state = { ...base, party: base.party.map((hero) =>
    hero.id === member.id ? member : hero) };
  return renderToStaticMarkup(createElement(ChroniclesCharacterSheet, {
    state, member, progression: createChroniclesProgression(),
    mode: 'chronicles', initialFolio: 'record', onClose: () => {},
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
    expect(html).not.toContain('Bonificador entre paréntesis');
    const ledger = html.split('class="chronicles-character-sheet__mm3-stats"')[1]?.split('data-stat="condition"')[0];
    const condition = html.split('data-stat="condition"')[1]?.split('</div>')[0];
    expect(ledger).toBeTruthy();
    expect(ledger).not.toContain('<small');
    expect(condition).not.toContain('<small');
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
  it('draws eight unique original copper-framed emblems on the real MM3 stat rows only', () => {
    const ids = ['might', 'intellect', 'personality', 'endurance', 'speed',
      'accuracy', 'luck', 'condition'];
    expect(CHRONICLES_CHARACTER_STAT_ICON_IDS).toEqual(ids);
    const sheet = render();
    for (const id of ids) {
      expect(sheet).toContain(`data-stat-icon="${id}"`);
      const markup = renderToStaticMarkup(createElement(ChroniclesCharacterStatIcon, { stat: id }));
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain('<svg');
      expect(markup).toContain('viewBox="0 0 32 32"');
      expect(markup).toContain(`data-stat-icon="${id}"`);
    }
    const drawings = ids.map((id) =>
      renderToStaticMarkup(createElement(ChroniclesCharacterStatIcon, { stat: id })));
    expect(new Set(drawings).size).toBe(8);
    expect((sheet.match(/data-stat-icon="/g) || []).length).toBe(8);
    expect(render('tactics')).not.toContain('data-stat-icon=');
    expect(css).toContain('.chronicles-character-sheet__stat-icon svg');
    expect(css).toContain('grid-column: 1;');
    expect(css).toContain('grid-row: 1;');
  });
  it('colors Sano, Herido and Caído using real PV without adding fake conditions', () => {
    for (const [hp, maxHp, expectedTone, expectedLabel] of [
      [11, 11, 'healthy', 'Sano'],
      [7, 11, 'wounded', 'Herido'],
      [0, 11, 'fallen', 'Caído'],
    ]) {
      const html = renderHero((hero) => ({ ...hero, hp, maxHp }));
      const row = html.split('data-stat="condition"')[1]?.split('</div>')[0];
      expect(row).toBeTruthy();
      expect(row).toContain(`data-condition="${expectedTone}"`);
      expect(row).toContain(`>${expectedLabel}</b>`);
      expect(row).toContain(`${hp}/${maxHp} PV`);
      expect(row).toContain('data-stat-icon="condition"');
    }
    expect(render('tactics')).not.toContain('data-condition=');
    for (const tone of ['healthy', 'wounded', 'fallen']) {
      expect(css).toContain(`[data-condition="${tone}"] > b`);
      expect(css).toContain(`[data-condition="${tone}"] > .chronicles-character-sheet__stat-icon`);
    }
  });
  it('uses the real signed modifier to distinguish benefits, penalties and neutral values', () => {
    const html = renderHero((hero) => ({
      ...hero,
      mm3: {
        ...hero.mm3,
        bonuses: { ...hero.mm3.bonuses, might: 2, intellect: -1, luck: 0 },
      },
    }));
    const findRow = (id, nextId) =>
      html.split(`data-stat="${id}"`)[1]?.split(`data-stat="${nextId}"`)[0];
    expect(findRow('might', 'intellect')).toContain('data-bonus-tone="benefit"');
    expect(findRow('might', 'intellect')).toContain('(+2)');
    expect(findRow('intellect', 'personality')).toContain('data-bonus-tone="penalty"');
    expect(findRow('intellect', 'personality')).toContain('(-1)');
    expect(findRow('luck', 'condition')).toContain('data-bonus-tone="neutral"');
    expect(findRow('luck', 'condition')).toContain('(0)');
    for (const tone of ['benefit', 'penalty', 'neutral']) {
      expect(css).toContain(`em[data-bonus-tone="${tone}"]`);
    }
    expect(render('tactics')).not.toContain('data-bonus-tone=');
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
    expect(css).toContain('grid-template-rows: auto;');
    expect(css).toContain('min-height: 60px;');
    expect(css).toContain('overflow-wrap: break-word;');
  });
  it('reserves readable type for attributes and modifiers in compact rows', () => {
    // The 1909px screenshot showed tiny glyphs in very large desktop cells.
    // Keep large type for the primary attribute/value and readable context.
    expect(css).toContain('font-size: clamp(22px, 1.42vw, 27px);');
    expect(css).toContain('font-size: clamp(30px, 2vw, 38px);');
    expect(css).toContain('font-size: 17px;');
    expect(css).toContain('font-size: 18px;');
    expect(css).toContain('font-size: 27px;');
    expect(css).toContain('min-height: 68px;');
    expect(css).toContain('font-size: clamp(28px, 2.1vw, 36px);');
    expect(css).toContain('@media (min-width: 1900px) and (min-height: 581px)');
    expect(css).toContain('@media (max-width: 850px)');
    expect(css).toContain('@media (max-width: 520px)');
    expect(css).toContain('font-size: 17px;');
    expect(css).toContain('font-size: 25px;');
    expect(css).toContain('font-size: 16px;');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr);');
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
