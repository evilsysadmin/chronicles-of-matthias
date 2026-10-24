import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { setStorageItem, STORAGE_SESSION } from '../safeStorage.js';
import {
  chroniclesOpeningVolleyShooters, chroniclesPartyAttackStats, createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects } from '../chronicles/chroniclesContentRuntime.js';
import { chroniclesEquipItem } from '../chronicles/chroniclesEquipment.js';
import { chroniclesTransferBagItem } from '../chronicles/chroniclesPersonalBags.js';
import ChroniclesFirstThreatCue, {
  chroniclesFirstThreatDetails, chroniclesFirstThreatDismissed,
} from './ChroniclesFirstThreatCue.jsx';

const road = { ...createChroniclesState('banner-road-first-book', null, { rules: 'mm3' }), equipment: {} };
const actualSighting = { enemy: { id: 'banner-road-deserter', name: 'Desertor de la carretera' }, distance: 3 };

function armedRoad() {
  const stocked = chroniclesApplyContentEffects(road, [
    { type: 'grant-item', itemId: 'wooden-bow', name: 'Arco corto de madera' },
    { type: 'grant-item', itemId: 'wooden-sling', name: 'Honda de madera' },
  ]);
  const bow = chroniclesEquipItem(stocked, 'matthias', 'wooden-bow');
  const handed = chroniclesTransferBagItem(bow, 'matthias', 'rook', 'wooden-sling');
  return chroniclesEquipItem(handed, 'rook', 'wooden-sling');
}

function render(state = road, target = actualSighting, props = {}) {
  return renderToStaticMarkup(
    <ChroniclesFirstThreatCue state={state} target={target}
      runId="first-threat-test" {...props} />,
  );
}

describe('Chronicles first true road encounter', () => {
  beforeEach(() => sessionStorage.clear());

  it('shows only a real forward sighting in the first-book road, not a scripted spawn', () => {
    expect(chroniclesFirstThreatDetails(road, actualSighting)).toMatchObject({
      name: 'Desertor de la carretera', distance: 3, shooterCount: 0, inRangeShooterCount: 0,
    });
    expect(render()).toContain('MATTHIAS · PRIMER PELIGRO');
    expect(render()).toContain('Desertor de la carretera');
    expect(render()).toContain('a 3 casillas');
    expect(render()).toContain('No hay tiradores listos');
    expect(render()).toContain('A ataca cuerpo a cuerpo');

    expect(chroniclesFirstThreatDetails(road, null)).toBeNull();
    expect(render(road, null)).toBe('');
    expect(render({ ...road, mapId: 'swordhaven-first-book' })).toBe('');
    expect(render({ ...road, mapId: 'banner-road' })).toBe('');
    expect(render({ ...road, initiative: { order: [] }, phase: 'combat' })).toBe('');
    expect(render({ ...road, phase: 'defeated' })).toBe('');
    expect(render(road, { enemy: null, distance: 3 })).toBe('');
  });

  it('respects real bow/sling reach rather than claiming that every equipped shooter can hit', () => {
    const state = armedRoad();
    expect(chroniclesOpeningVolleyShooters(state)).toHaveLength(2);
    expect(chroniclesPartyAttackStats(state, 'matthias', 'missile').reach).toBe(3);
    expect(chroniclesPartyAttackStats(state, 'rook', 'missile').reach).toBe(2);

    expect(chroniclesFirstThreatDetails(state, actualSighting)).toMatchObject({
      shooterCount: 2, inRangeShooterCount: 1,
    });
    expect(render(state)).toContain('1 de 2 tiradores a tiro');
    expect(render(state)).toContain('S dispara una salva');
    expect(render(state)).toContain('chronicles-first-threat__keyboard-hint');
    expect(render(state)).toContain('chronicles-first-threat__touch-hint');
    expect(render(state)).toContain('Pulsa SALVA');
    expect(render(state)).toContain('Usa ATACAR');

    const near = { ...actualSighting, distance: 2 };
    expect(chroniclesFirstThreatDetails(state, near).inRangeShooterCount).toBe(2);
    expect(render(state, near)).toContain('2 tiradores listos');
    const distant = { ...actualSighting, distance: 4 };
    expect(chroniclesFirstThreatDetails(state, distant).inRangeShooterCount).toBe(0);
    expect(render(state, distant)).toContain('fuera de su alcance');
    expect(render(state, distant)).not.toContain('S dispara una salva');
  });

  it('does not claim an attack, hit or reward when no missile can reach', () => {
    const html = render(road, { ...actualSighting, distance: 1 });
    expect(html).toContain('a 1 casilla');
    expect(html).toContain('No hay tiradores listos');
    expect(html).not.toContain('S dispara una salva');
    expect(html).not.toContain('impacto');
    expect(html).not.toContain('oro');
    expect(html).not.toContain('experiencia');
  });

  it('is silent behind overlays and stays dismissed only for this run', () => {
    expect(render(road, actualSighting, { suspended: true })).toBe('');
    expect(render(road, actualSighting, { runId: '' })).toBe('');
    setStorageItem(STORAGE_SESSION, 'chronicles-first-threat-dismissed-v1:first-threat-test', '1');
    expect(chroniclesFirstThreatDismissed('first-threat-test')).toBe(true);
    expect(chroniclesFirstThreatDismissed('other-run')).toBe(false);
    expect(render()).toBe('');
    expect(render(road, actualSighting, { runId: 'other-run' }))
      .toContain('MATTHIAS · PRIMER PELIGRO');
  });
});
