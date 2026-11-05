import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ChroniclesWorldInfo from './ChroniclesWorldInfo.jsx';
import { chroniclesWorldCalendar } from '../chronicles/chroniclesWorldTime.js';
import { chroniclesRegionalWeather } from '../chronicles/chroniclesRegionalWeather.js';

const render = (minutes) => renderToStaticMarkup(createElement(ChroniclesWorldInfo, {
  calendar: chroniclesWorldCalendar(minutes), onClose: () => {},
}));

describe('MM3 information folio', () => {
  it('presents the saved calendar once, with a clear clock and compact date cells', () => {
    const calendar = chroniclesWorldCalendar(8 * 60);
    const before = JSON.stringify(calendar);
    const html = render(8 * 60);
    expect(html).toContain('INFORMACIÓN DEL JUEGO');
    expect(html).toContain('TERRA · CRÓNICA DEL VIAJE');
    expect(html).toContain('data-chronicles-world-info-time');
    expect(html).toContain('08:00');
    expect(html).toContain('500');
    expect(html).toContain('Lunes');
    expect(html).toContain('Primavera');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('data-daylight-phase="day"');
    expect(html).toContain('chronicles-world-info__calendar');
    expect(html).toContain('Consultar no consume turno');
    expect(html).not.toContain('Día 1 del mes');
    expect(JSON.stringify(calendar)).toBe(before);
  });
  it('uses the actual saved day/night phase, not made-up weather', () => {
    const night = render(22 * 60);
    expect(night).toContain('data-daylight-phase="night"');
    expect(night).toContain('Noche');
    expect(night).toContain('22:00');
    expect(night).not.toMatch(/Lluvia|Nieve|Despejado/);
  });
  it('displays only observed regional weather without inventing dungeon conditions', () => {
    const weather = chroniclesRegionalWeather({
      mapId: 'swordhaven-first-book', regionKind: 'settlement', worldMinutes: 480,
    });
    const html = renderToStaticMarkup(createElement(ChroniclesWorldInfo, {
      calendar: chroniclesWorldCalendar(480), weather, onClose: () => {},
    }));
    expect(html).toContain('CLIMA REGIONAL');
    expect(html).toContain(weather.label);
    expect(html).toContain('data-chronicles-world-weather="' + weather.kind + '"');
    expect(render(480)).not.toContain('CLIMA REGIONAL');
  });
  it('renders nothing while closed', () => {
    expect(renderToStaticMarkup(createElement(ChroniclesWorldInfo, {
      calendar: null, onClose: () => {},
    }))).toBe('');
  });
});
