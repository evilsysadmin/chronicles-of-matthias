import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import ChroniclesWorldStatChoice from './ChroniclesWorldStatChoice.jsx';

describe('World crystal beneficiary choice', () => {
  it('lists every hero, disables the fallen, and provides an accessible cancel action', () => {
    const html = renderToStaticMarkup(createElement(ChroniclesWorldStatChoice, {
      offer: { id: 'swordhaven-endurance-crystal', stat: 'endurance' },
      party: [
        { id: 'rook', name: 'Hildegard', hp: 9, maxHp: 10 },
        { id: 'bishop', name: 'Aziz', hp: 0, maxHp: 5 },
      ],
      onSelect: () => {},
      onClose: () => {},
    }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Elegir beneficiario');
    expect(html).toContain('Hildegard');
    expect(html).toContain('Aziz');
    expect(html).toMatch(/disabled=""[^>]*><strong>Aziz/);
    expect(html).toContain('Ahora no');
    expect(html).toContain('+1 Resistencia');
    expect(html).not.toContain('Mejoras');
  });
});
