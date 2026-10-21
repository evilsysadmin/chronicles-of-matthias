import { describe, expect, it } from 'vitest';
import {
  CHRONICLES_PORTRAIT_GALLERY,
  chroniclesPortraitKnown,
  chroniclesPortraitCompatibleWithSex,
  chroniclesNormalizePortraitId,
} from './chroniclesPortraitCatalog.js';

describe('Chronicles avatar IDs', () => {
  it('has ten unique stable IDs per gender and preserves canonical IDs', () => {
    expect(CHRONICLES_PORTRAIT_GALLERY.filter((p) => p.sex === 'male')).toHaveLength(10);
    expect(CHRONICLES_PORTRAIT_GALLERY.filter((p) => p.sex === 'female')).toHaveLength(10);
    expect(new Set(CHRONICLES_PORTRAIT_GALLERY.map((p) => p.id)).size).toBe(20);
    expect(chroniclesPortraitKnown('rook')).toBe(true);
    expect(chroniclesPortraitKnown('male-10')).toBe(true);
    expect(chroniclesPortraitKnown('female-10')).toBe(true);
    expect(chroniclesPortraitKnown('female-11')).toBe(false);
  });
  it('filters options for the chosen sex while allowing unspecified', () => {
    expect(chroniclesPortraitCompatibleWithSex('rook','female')).toBe(true);
    expect(chroniclesPortraitCompatibleWithSex('rook','male')).toBe(false);
    expect(chroniclesPortraitCompatibleWithSex('female-06','male')).toBe(false);
    expect(chroniclesPortraitCompatibleWithSex('female-06','unspecified')).toBe(true);
    expect(chroniclesNormalizePortraitId('unknown','bishop')).toBe('bishop');
    expect(chroniclesNormalizePortraitId('male-01','bishop')).toBe('male-01');
  });
});
