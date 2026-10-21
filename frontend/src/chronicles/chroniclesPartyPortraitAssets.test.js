import { describe, expect, it } from 'vitest';
import {
  CHRONICLES_PARTY_PORTRAITS,
  CHRONICLES_GALLERY_PORTRAITS,
  chroniclesPartyPortraitUrl,
} from './chroniclesPartyPortraitAssets.js';

describe('Chronicles canonical party portraits', () => {
  it('defines a stable authored portrait for every party member', () => {
    expect(Object.keys(CHRONICLES_PARTY_PORTRAITS).sort()).toEqual([
      'bishop',
      'knight',
      'matthias',
      'rook',
    ]);
    for (const id of ['matthias', 'rook', 'bishop', 'knight']) {
      expect(chroniclesPartyPortraitUrl(id)).toMatch(/chronicles|canonical|webp/i);
    }
  });

  it('uses the dedicated Chronicles portrait for Matthias and unknown ids', () => {
    expect(chroniclesPartyPortraitUrl('matthias')).toBe(CHRONICLES_PARTY_PORTRAITS.matthias);
    expect(chroniclesPartyPortraitUrl('missing')).toBe(CHRONICLES_PARTY_PORTRAITS.matthias);
  });
});

describe('Custom Chronicles portrait assets', () => {
  it('includes the 20 individually cropped portraits', () => {
    expect(Object.keys(CHRONICLES_GALLERY_PORTRAITS)).toHaveLength(20);
    for (const sex of ['male', 'female']) {
      for (let n = 1; n <= 10; n += 1) {
        const id = `${sex}-${String(n).padStart(2, '0')}`;
        expect(chroniclesPartyPortraitUrl({ portraitId: id })).toMatch(/webp/i);
      }
    }
  });
  it('uses resolved member preferences and safely falls back to its canonical slot', () => {
    expect(chroniclesPartyPortraitUrl({ slotId: 'rook', portraitId: 'female-04' }))
      .toBe(CHRONICLES_GALLERY_PORTRAITS['female-04']);
    expect(chroniclesPartyPortraitUrl({ id: 'bishop', characterBuild: { portraitId: 'male-06' } }))
      .toBe(CHRONICLES_GALLERY_PORTRAITS['male-06']);
    expect(chroniclesPartyPortraitUrl({ slotId: 'rook', portraitId: 'unknown' }))
      .toBe(CHRONICLES_PARTY_PORTRAITS.rook);
  });
});
