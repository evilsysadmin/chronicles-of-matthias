import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesApplyArrival } from '../chronicles/chroniclesArrival.js';
import { setStorageItem, STORAGE_SESSION } from '../safeStorage.js';
import ChroniclesFirstSteps, {
  chroniclesShouldOfferFirstSteps,
  chroniclesFirstStepsStory,
  chroniclesFirstStepsDismissed,
} from './ChroniclesFirstSteps.jsx';

function newSwordhaven() {
  return chroniclesApplyArrival(createChroniclesState('swordhaven-first-book'));
}
function render(state, options = {}) {
  return renderToStaticMarkup(
    <ChroniclesFirstSteps state={state} runId="test-first-steps" {...options} />,
  );
}

describe('Chronicles · first Swordhaven steps', () => {
  beforeEach(() => sessionStorage.clear());

  it('is offered only during the genuine authored first-minute commission', () => {
    const fresh = newSwordhaven();
    expect(chroniclesShouldOfferFirstSteps(fresh)).toBe(true);
    expect(chroniclesFirstStepsStory(fresh)).toBe('first-book');
    expect(chroniclesFirstStepsStory(createChroniclesState('crypt-eight-squares'))).toBeNull();
    expect(chroniclesShouldOfferFirstSteps({ ...fresh, turns: 3 })).toBe(false);
    expect(chroniclesShouldOfferFirstSteps({ ...fresh, mapId: 'crypt-eight-squares' })).toBe(false);
    expect(chroniclesShouldOfferFirstSteps({ ...fresh, quests: {} })).toBe(false);
    expect(chroniclesShouldOfferFirstSteps(createChroniclesState('swordhaven-first-book'))).toBe(false);
  });

  it('explains actual keys without obstructing or inventing progress', () => {
    const html = render(newSwordhaven());
    expect(html).toContain('MATTHIAS · PRIMEROS PASOS');
    expect(html).toContain('alcalde Aldric');
    expect(html).toContain('sureste');
    expect(html).toContain('tejado rojo');
    expect(html).toContain('cúpula de piedra');
    expect(html).not.toContain('nos envía tras el Rey');
    expect(html).toContain('cuerpo a cuerpo');
    expect(html).toContain('Ver encargo');
    expect(html).toContain('chronicles-first-steps__keyboard-hint');
    expect(html).toContain('chronicles-first-steps__touch-hint');
    expect(html).toContain('Toca el minimapa');
    expect(html).toContain('flechas de pantalla');
    expect(html).toContain('Cerrar primeros pasos');
    expect(html).not.toContain('Has encontrado');
  });

  it('keeps a dismissal scoped to this run in session storage but allows manual reopening', () => {
    setStorageItem(STORAGE_SESSION, 'chronicles-first-steps-dismissed-v1:test-first-steps', '1');
    expect(chroniclesFirstStepsDismissed('test-first-steps')).toBe(true);
    expect(chroniclesFirstStepsDismissed('another-run')).toBe(false);
    expect(render(newSwordhaven())).not.toContain('MATTHIAS · PRIMEROS PASOS');
    expect(render(newSwordhaven(), { open: true })).toContain('MATTHIAS · PRIMEROS PASOS');
  });

  it('never displays over an active menu unless the player explicitly asks', () => {
    const fresh = newSwordhaven();
    expect(render(fresh, { suspended: true })).not.toContain('MATTHIAS · PRIMEROS PASOS');
    expect(render(fresh, { suspended: true, open: true })).toContain('MATTHIAS · PRIMEROS PASOS');
    expect(render({ ...fresh, turns: 7 })).not.toContain('MATTHIAS · PRIMEROS PASOS');
  });
});
