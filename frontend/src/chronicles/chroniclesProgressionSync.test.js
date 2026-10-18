import { describe, expect, it } from 'vitest';
import { createChroniclesProgression } from '../chroniclesOfMatthiasProgression.js';
import { chroniclesPickProgression } from './chroniclesProgressionSync.js';

const withXp = (xp) => {
  const progression = createChroniclesProgression();
  return { ...progression, heroes: { ...progression.heroes, matthias: { ...progression.heroes.matthias, xp } } };
};

describe('Chronicles progression across devices', () => {
  it('keeps the more advanced progression, whichever device has it', () => {
    expect(chroniclesPickProgression(withXp(10), withXp(200)).from).toBe('remote');
    expect(chroniclesPickProgression(withXp(300), withXp(200)).from).toBe('local');
    expect(chroniclesPickProgression(withXp(300), withXp(200)).progression.heroes.matthias.xp).toBe(300);
  });

  it('prefers the server on a tie and uses the local copy when the server has none', () => {
    expect(chroniclesPickProgression(withXp(50), withXp(50)).from).toBe('remote');
    expect(chroniclesPickProgression(withXp(50), null).from).toBe('local');
  });
});
