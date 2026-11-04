import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ChroniclesWorldInfo from './ChroniclesWorldInfo.jsx';
import { chroniclesWorldCalendar } from '../chronicles/chroniclesWorldTime.js';

describe('MM3 world information parchment', () => {
  it('renders saved Terra time and day without changing the clock', () => {
    const calendar = chroniclesWorldCalendar(8 * 60);
    const before = JSON.stringify(calendar);
    const html = renderToStaticMarkup(createElement(ChroniclesWorldInfo, {
      calendar, onClose: () => {},
    }));
    expect(html).toContain('INFORMACIÓN DEL JUEGO');
    expect(html).toContain('08:00');
    expect(html).toContain('500');
    expect(html).toContain('Lunes');
    expect(html).toContain('Primavera');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('data-chronicles-world-info');
    expect(JSON.stringify(calendar)).toBe(before);
  });
  it('does not render the popup when closed', () => {
    expect(renderToStaticMarkup(createElement(ChroniclesWorldInfo, {
      calendar: null, onClose: () => {},
    }))).toBe('');
  });
});
