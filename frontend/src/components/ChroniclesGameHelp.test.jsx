import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CHRONICLES_MM3_STATS,
  CHRONICLES_MM3_STAT_EFFECTS,
  CHRONICLES_MM3_STAT_LABELS,
} from '../chronicles/chroniclesMM3Rules.js';
import ChroniclesGameHelp from './ChroniclesGameHelp.jsx';

const render = () => renderToStaticMarkup(createElement(ChroniclesGameHelp, { onBack: () => {} }));

describe('MM3 help after compacting the character Status ledger', () => {
  it('explains every real attribute from the same rules as the character sheet', () => {
    const html = render();
    expect(html).toContain('data-chronicles-mm3-attribute-guide');
    for (const stat of CHRONICLES_MM3_STATS) {
      expect(html).toContain(`data-mm3-stat-help="${stat}"`);
      expect(html).toContain(CHRONICLES_MM3_STAT_LABELS[stat]);
      expect(html).toContain(CHRONICLES_MM3_STAT_EFFECTS[stat]);
    }
    expect((html.match(/data-mm3-stat-help="/g) || [])).toHaveLength(7);
    expect(html).toContain('valor entre paréntesis');
    expect(html).toContain('positivo,');
    expect(html).toContain('Sano, herido o caído');
    expect(html).toContain('PV y PH máximos crecen con el nivel');
  });

  it('keeps the guide navigable and does not claim a nonexistent MM3 reach statistic', () => {
    const html = render();
    expect(html).toContain('id="chronicles-game-help"');
    expect(html).toContain('← Volver al menú');
    expect(html).toContain('<details open="">');
    expect(html).toContain('Equipo, compras y comparaciones');
    expect(html).toContain('Exploración y combate');
    expect(html).toContain('Durante la iniciativa no se puede girar ni reorientar la cámara');
    expect(html).toContain('retrocede sin girarte');
    expect(html).toContain('consume su acción completa');
    expect(html).toContain('<dt>Daño</dt>');
    expect(html).not.toContain('Daño y alcance');
    expect(html).not.toContain('Atributo Alcance');
  });
});
