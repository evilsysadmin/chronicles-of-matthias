import { describe, expect, it } from 'vitest';
import {
  createChroniclesProgression,
  grantChroniclesXp,
} from '../chroniclesOfMatthiasProgression.js';
import {
  chroniclesDeployedPartyLevel,
  chroniclesDifficultyBand,
  chroniclesResolvedDifficultyBand,
  chroniclesRunDepth,
} from './chroniclesDifficultyPolicy.js';

function leveledParty(level) {
  let progression = createChroniclesProgression();
  const thresholds = { 1: 0, 2: 40, 3: 120, 4: 240, 5: 400, 6: 600, 7: 840, 8: 1120 };
  for (const memberId of ['matthias', 'rook', 'bishop', 'knight']) {
    progression = grantChroniclesXp(
      progression,
      memberId,
      thresholds[level] || 0,
      `difficulty:${memberId}:${level}`,
    ).progression;
  }
  return progression;
}

describe('Chronicles difficulty/progression policy', () => {
  it('measures only the actually deployed party', () => {
    let progression = createChroniclesProgression();
    progression = grantChroniclesXp(progression, 'matthias', 600, 'matthias-veteran').progression;

    expect(chroniclesDeployedPartyLevel(progression, ['matthias'])).toBe(6);
    expect(chroniclesDeployedPartyLevel(progression, ['rook', 'bishop', 'knight'])).toBe(1);
  });

  it('falls back to the default party for malformed saved deployment lists', () => {
    let progression = createChroniclesProgression();
    progression = grantChroniclesXp(progression, 'matthias', 600, 'legacy-roster-veteran').progression;

    // The default four-hero roster averages level 6 with three level-1 allies.
    expect(chroniclesDeployedPartyLevel(progression)).toBe(2);
    expect(chroniclesDeployedPartyLevel(progression, null)).toBe(2);
    expect(chroniclesDeployedPartyLevel(progression, 'matthias')).toBe(2);
    expect(chroniclesDeployedPartyLevel(progression, { 0: 'matthias' })).toBe(2);
    // A valid explicit empty deployment retains its existing level-1 fallback.
    expect(chroniclesDeployedPartyLevel(progression, [])).toBe(1);
    expect(chroniclesDeployedPartyLevel(progression, ['matthias', 'matthias'])).toBe(6);
  });

  it('raises threat with depth without mirroring player levels one-for-one', () => {
    const progression = leveledParty(6);
    const shallow = chroniclesDifficultyBand({ progression, depth: 0 });
    const deep = chroniclesDifficultyBand({ progression, depth: 6 });

    expect(shallow.partyLevel).toBe(6);
    expect(shallow.targetLevel).toBe(3);
    expect(deep.targetLevel).toBe(6);
    expect(deep.maxLevel).toBeLessThanOrEqual(deep.partyLevel + 1);
  });

  it('caps depth pressure and never creates runaway enemy levels', () => {
    const progression = leveledParty(2);
    const absurdDepth = chroniclesDifficultyBand({ progression, depth: 999 });

    expect(absurdDepth.depthPressure).toBe(6);
    expect(absurdDepth.targetLevel).toBeLessThanOrEqual(3);
    expect(absurdDepth.maxLevel).toBeLessThanOrEqual(3);
  });

  it.each([
    ['boolean', true],
    ['numeric array', [4]],
    ['string array', ['4']],
    ['object', { value: 4 }],
  ])('does not invent dungeon depth from a malformed %s', (_label, depth) => {
    const progression = leveledParty(6);
    expect(chroniclesDifficultyBand({ progression, depth }))
      .toEqual(chroniclesDifficultyBand({ progression, depth: 0 }));
  });

  it('preserves numeric-string dungeon depth for legacy saves', () => {
    const progression = leveledParty(6);
    expect(chroniclesDifficultyBand({ progression, depth: '4' }))
      .toEqual(chroniclesDifficultyBand({ progression, depth: 4 }));
  });

  it.each([
    ['fractional decimal', '4.5'],
    ['hexadecimal', '0x10'],
    ['exponential notation', '4e1'],
    ['repeated underscores', '4__0'],
    ['out-of-range int64', '9223372036854775808'],
  ])('rejects %s depth strings rather than inventing extra dungeon floors', (_label, depth) => {
    const progression = leveledParty(6);
    expect(chroniclesDifficultyBand({ progression, depth }))
      .toEqual(chroniclesDifficultyBand({ progression, depth: 0 }));
  });

  it.each([
    ['signed decimal', ' +4 ', 4],
    ['underscored decimal', '4_0', 40],
    ['maximum Go int64', '9223372036854775807', 99],
  ])('accepts %s depth strings supported by the Go director', (_label, depth, expected) => {
    const progression = leveledParty(6);
    expect(chroniclesDifficultyBand({ progression, depth }))
      .toEqual(chroniclesDifficultyBand({ progression, depth: expected }));
  });

  it('rejects float64 depth overflow like the Go director', () => {
    const progression = leveledParty(6);
    expect(chroniclesDifficultyBand({ progression, depth: 1e20 }))
      .toEqual(chroniclesDifficultyBand({ progression, depth: 0 }));
  });

  it('prefers the backend difficulty snapshot over local recomputation', () => {
    const authoritative = Object.freeze({
      partyLevel: 4,
      depth: 2,
      targetLevel: 3,
      minLevel: 2,
      maxLevel: 4,
      depthPressure: 1,
      progressionPressure: 1,
      authoredLevel: 3,
      requestedDelta: 0,
      appliedDelta: 0,
    });
    const run = {
      areas: [
        { mapId: 'archive', difficulty: authoritative },
      ],
    };

    expect(chroniclesResolvedDifficultyBand(run, 'archive', {
      progression: leveledParty(1),
      depth: 0,
    })).toBe(authoritative);
  });

  it.each([
    ['object', { crypt: { difficulty: { targetLevel: 99 } } }],
    ['string', 'corrupt-legacy-areas'],
    ['number', 42],
  ])('falls back safely when saved areas is a %s', (_label, areas) => {
    const fallback = { progression: leveledParty(3), depth: 4 };
    expect(chroniclesResolvedDifficultyBand(
      { areas },
      'crypt',
      fallback,
    )).toEqual(chroniclesDifficultyBand(fallback));
  });

  it.each([
    ['array', []],
    ['partial object', { targetLevel: 5 }],
    ['non-finite level', {
      partyLevel: 4, depth: 2, targetLevel: Infinity, minLevel: 4,
      maxLevel: 5, depthPressure: 1, progressionPressure: 1,
    }],
    ['non-integer depth', {
      partyLevel: 4, depth: 2.5, targetLevel: 5, minLevel: 4,
      maxLevel: 5, depthPressure: 1, progressionPressure: 1,
    }],
    ['inverted level range', {
      partyLevel: 4, depth: 2, targetLevel: 5, minLevel: 6,
      maxLevel: 5, depthPressure: 1, progressionPressure: 1,
    }],
    ['oversized target', {
      partyLevel: 4, depth: 2, targetLevel: 999, minLevel: 4,
      maxLevel: 999, depthPressure: 1, progressionPressure: 1,
    }],
  ])('recomputes difficulty when the saved snapshot is a %s', (_label, difficulty) => {
    const fallback = { progression: leveledParty(3), depth: 4 };
    const run = { areas: [{ mapId: 'crypt', difficulty }] };
    expect(chroniclesResolvedDifficultyBand(run, 'crypt', fallback))
      .toEqual(chroniclesDifficultyBand(fallback));
  });

  it.each([
    ['target above the deployed-party cap', {
      partyLevel: 2, depth: 4, targetLevel: 5, minLevel: 4,
      maxLevel: 5, depthPressure: 2, progressionPressure: 0,
    }],
    ['maximum above the deployed-party cap', {
      partyLevel: 2, depth: 4, targetLevel: 3, minLevel: 2,
      maxLevel: 5, depthPressure: 2, progressionPressure: 0,
    }],
    ['maximum more than one level above target', {
      partyLevel: 6, depth: 4, targetLevel: 3, minLevel: 2,
      maxLevel: 5, depthPressure: 2, progressionPressure: 2,
    }],
    ['minimum more than one level below target', {
      partyLevel: 6, depth: 4, targetLevel: 4, minLevel: 1,
      maxLevel: 5, depthPressure: 2, progressionPressure: 2,
    }],
  ])('rejects an internally inconsistent saved %s', (_label, difficulty) => {
    const fallback = { progression: leveledParty(3), depth: 4 };
    const run = { areas: [{ mapId: 'crypt', difficulty }] };
    expect(chroniclesResolvedDifficultyBand(run, 'crypt', fallback))
      .toEqual(chroniclesDifficultyBand(fallback));
  });

  it.each([
    ['depth pressure', { depthPressure: 0 }],
    ['progression pressure', { progressionPressure: 2 }],
    ['target level', { targetLevel: 4, minLevel: 3 }],
    ['minimum level', { minLevel: 3 }],
    ['maximum level', { maxLevel: 3 }],
  ])('rejects a saved band with inconsistent %s despite valid numeric ranges', (_label, overrides) => {
    // Go computes all seven fields from partyLevel=4 and depth=2.
    const valid = {
      partyLevel: 4, depth: 2, targetLevel: 3, minLevel: 2,
      maxLevel: 4, depthPressure: 1, progressionPressure: 1,
    };
    const fallback = { progression: leveledParty(2), depth: 0 };
    expect(chroniclesResolvedDifficultyBand(
      { areas: [{ mapId: 'crypt', difficulty: { ...valid, ...overrides } }] },
      'crypt', fallback,
    )).toEqual(chroniclesDifficultyBand(fallback));
  });

  it('does not count settlement and wilderness stops as dungeon levels', () => {
    const run = {
      currentMapId: 'crypt',
      areas: [
        { mapId: 'village', map: { regionKind: 'settlement' } },
        { mapId: 'road', regionKind: 'wilderness' },
        { mapId: 'crypt', map: { regionKind: 'dungeon' } },
        { mapId: 'gallery', map: { regionKind: 'dungeon' } },
      ],
    };
    expect(chroniclesRunDepth(run, 'village')).toBe(0);
    expect(chroniclesRunDepth(run, 'road')).toBe(0);
    expect(chroniclesRunDepth(run)).toBe(0);
    expect(chroniclesRunDepth(run, 'gallery')).toBe(1);
    expect(chroniclesRunDepth(run, 'missing')).toBe(0);
  });

  it('ignores malformed legacy route stops when measuring dungeon depth', () => {
    const run = {
      currentMapId: 'crypt',
      areas: [
        { mapId: 'entrance' },
        null,
        {},
        { mapId: 'gallery' },
        'invalid-area',
        { mapId: 'crypt' },
      ],
    };
    expect(chroniclesRunDepth(run)).toBe(2);
    expect(chroniclesRunDepth({ areas: [null, {}] })).toBe(0);
  });

  it('ignores malformed typed route stops without counting towns as floors', () => {
    const run = {
      currentMapId: 'crypt',
      areas: [
        { mapId: 'village', regionKind: 'settlement' },
        null,
        {},
        { mapId: 'entry', regionKind: 'dungeon' },
        42,
        { mapId: 'crypt', regionKind: 'dungeon' },
      ],
    };
    expect(chroniclesRunDepth(run)).toBe(1);
    expect(chroniclesRunDepth(run, 'entry')).toBe(0);
  });

  it('does not turn whitespace-only legacy map ids into extra dungeon floors', () => {
    const legacy = {
      currentMapId: 'crypt',
      areas: [{ mapId: 'entry' }, { mapId: ' \t ' }, { mapId: 'crypt' }],
    };
    expect(chroniclesRunDepth(legacy)).toBe(1);

    const typed = {
      currentMapId: 'crypt',
      areas: [
        { mapId: 'entry', regionKind: 'dungeon' },
        { mapId: ' \t ', regionKind: 'dungeon' },
        { mapId: 'crypt', regionKind: 'dungeon' },
      ],
    };
    expect(chroniclesRunDepth(typed)).toBe(1);
    expect(chroniclesRunDepth(typed, ' \t ')).toBe(0);
    expect(chroniclesRunDepth({ ...typed, currentMapId: '  ' })).toBe(0);
  });

  it('derives run depth from the authoritative route order', () => {
    const run = {
      currentMapId: 'archive',
      areas: [
        { mapId: 'crypt' },
        { mapId: 'gallery' },
        { mapId: 'archive' },
        { mapId: 'foundry' },
      ],
    };
    expect(chroniclesRunDepth(run)).toBe(2);
    expect(chroniclesRunDepth(run, 'foundry')).toBe(3);
    expect(chroniclesRunDepth(run, 'unknown')).toBe(0);
  });
});
