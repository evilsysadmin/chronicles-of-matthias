import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chroniclesPortraitLevelUpEvents } from '../chronicles/chroniclesProgressionFeedback.js';
import ChroniclesPortraitLevelUp from './ChroniclesPortraitLevelUp.jsx';

const css = readFileSync(new URL('./ChroniclesPortraitLevelUp.css', import.meta.url), 'utf8');
const party = [{ id: 'matthias' }, { id: 'bishop' }, { id: 'knight' }];

describe('Chronicles real level-up portrait feedback', () => {
  it('only responds to actual transitions, not routine XP, saves or malformed events', () => {
    expect(chroniclesPortraitLevelUpEvents({ awards: [{ memberId: 'matthias', xp: 12 }] }, party)).toEqual([]);
    expect(chroniclesPortraitLevelUpEvents(null, party)).toEqual([]);
    expect(chroniclesPortraitLevelUpEvents({ levelUps: [{ memberId: 'matthias', from: 2, to: 2 }] }, party)).toEqual([]);
    expect(chroniclesPortraitLevelUpEvents({ levelUps: [{ memberId: 'not-in-party', from: 1, to: 2 }] }, party)).toEqual([]);
  });
  it('collapses multiple levels for each hero, supports simultaneous hero cues', () => {
    expect(chroniclesPortraitLevelUpEvents({ levelUps: [
      { memberId: 'matthias', from: 1, to: 2 },
      { memberId: 'matthias', from: 2, to: 3 },
      { memberId: 'bishop', from: 5, to: 6 },
    ] }, party)).toEqual([
      { memberId: 'matthias', fromLevel: 1, toLevel: 3 },
      { memberId: 'bishop', fromLevel: 5, toLevel: 6 },
    ]);
  });
  it('has a compact announced label and a no-motion preference that preserves visibility', () => {
    const html = renderToStaticMarkup(createElement(ChroniclesPortraitLevelUp, {
      heroName: 'Matthias', toLevel: 3,
    }));
    expect(html).toContain('LEVEL UP!');
    expect(html).toContain('Nv 3');
    expect(html).toContain('aria-label="Matthias sube al nivel 3"');
    expect(html).toContain('role="status"');
    expect(css).toContain('pointer-events: none');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation: chronicles-levelup-still');
  });
});
