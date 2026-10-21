import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { setStorageItem, STORAGE_SESSION } from '../safeStorage.js';
import ChroniclesFirstThreatCue, {
  chroniclesFirstThreatDetails, chroniclesFirstThreatDismissed,
} from './ChroniclesFirstThreatCue.jsx';

const road = { mapId: 'banner-road-first-book', phase: 'explore', initiative: null };
const actualSightline = { enemy: { id: 'banner-road-deserter', name: 'Desertor de la carretera' }, distance: 3 };
function render(state = road, target = actualSightline, props = {}) {
  return renderToStaticMarkup(
    <ChroniclesFirstThreatCue state={state} target={target} shooterCount={2}
      runId="first-threat-test" {...props} />,
  );
}

describe('Chronicles first true road encounter', () => {
  beforeEach(() => sessionStorage.clear());

  it('shows only a real forward sighting in the first-book road, not a scripted spawn', () => {
    expect(chroniclesFirstThreatDetails(road, actualSightline, 2)).toEqual({
      name: 'Desertor de la carretera', distance: 3, shooterCount: 2,
    });
    expect(render()).toContain('MATTHIAS · PRIMER PELIGRO');
    expect(render()).toContain('Desertor de la carretera');
    expect(render()).toContain('a 3 casillas');
    expect(render()).toContain('2 tiradores listos');
    expect(render()).toContain('S dispara una salva');
    expect(render()).toContain('A ataca cuerpo a cuerpo');

    expect(chroniclesFirstThreatDetails(road, null, 2)).toBeNull();
    expect(render(road, null)).toBe('');
    expect(render({ ...road, mapId: 'swordhaven-first-book' })).toBe('');
    expect(render({ ...road, mapId: 'banner-road' })).toBe('');
    expect(render({ ...road, initiative: { order: [] }, phase: 'combat' })).toBe('');
    expect(render({ ...road, phase: 'defeated' })).toBe('');
    expect(render(road, { enemy: null, distance: 3 })).toBe('');
  });

  it('is honest about unavailable equipment and never claims a hit or reward', () => {
    const html = render(road, { ...actualSightline, distance: 1 }, { shooterCount: 0 });
    expect(html).toContain('a 1 casilla');
    expect(html).toContain('No hay tiradores listos');
    expect(html).not.toContain('S dispara una salva');
    expect(html).not.toContain('impacto');
    expect(html).not.toContain('oro');
    expect(html).not.toContain('experiencia');
  });

  it('is silent behind overlays and stays dismissed only for this run', () => {
    expect(render(road, actualSightline, { suspended: true })).toBe('');
    expect(render(road, actualSightline, { runId: '' })).toBe('');
    setStorageItem(STORAGE_SESSION, 'chronicles-first-threat-dismissed-v1:first-threat-test', '1');
    expect(chroniclesFirstThreatDismissed('first-threat-test')).toBe(true);
    expect(chroniclesFirstThreatDismissed('other-run')).toBe(false);
    expect(render()).toBe('');
    expect(render(road, actualSightline, { runId: 'other-run' }))
      .toContain('MATTHIAS · PRIMER PELIGRO');
  });
});
