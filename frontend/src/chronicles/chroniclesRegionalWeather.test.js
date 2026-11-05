import { describe, expect, it } from 'vitest';
import {
  chroniclesRegionalWeather, chroniclesRegionalWeatherTransition, chroniclesRegionalWind,
  CHRONICLES_WEATHER_PERIOD_MINUTES, CHRONICLES_WEATHER_BLEND_MINUTES,
} from './chroniclesRegionalWeather.js';

describe('Terra weather by region and stored world time', () => {
  const region = { mapId: 'terra-b2', regionKind: 'wilderness', biome: 'hills' };
  it('is reproducible, persists across day/clock reentry and changes only on six-hour boundaries', () => {
    const a = chroniclesRegionalWeather({ ...region, worldMinutes: 480 });
    const b = chroniclesRegionalWeather({ ...region, worldMinutes: 480 });
    expect(a).toEqual(b);
    expect(Object.isFrozen(a)).toBe(true);
    expect(chroniclesRegionalWeather({ ...region, worldMinutes: 719 })).toMatchObject({
      kind: a.kind, period: a.period,
    });
    const next = chroniclesRegionalWeather({ ...region, worldMinutes: 720 });
    expect(next.period).toBe(a.period + 1);
    expect(CHRONICLES_WEATHER_PERIOD_MINUTES).toBe(360);
    expect(a.untilWorldMinutes).toBe(720);
  });

  it('never renders outdoor weather in a dungeon or an unknown map', () => {
    expect(chroniclesRegionalWeather({
      mapId: 'swordhaven-sewers', regionKind: 'dungeon', worldMinutes: 480,
    })).toBeNull();
    expect(chroniclesRegionalWeather({ mapId: '', regionKind: 'wilderness' })).toBeNull();
    expect(chroniclesRegionalWeather()).toBeNull();
  });

  it('respects biome and season: ash is dry, snowy regions snow, winter hills differ', () => {
    const run = (biome, minute, mapId='terra-example') =>
      Array.from({ length: 80 }, (_, slot) => chroniclesRegionalWeather({
        mapId, regionKind: 'wilderness', biome,
        worldMinutes: minute + slot * CHRONICLES_WEATHER_PERIOD_MINUTES,
      }).kind);
    const ash = run('ash', 480);
    expect(ash).not.toContain('rain');
    expect(ash).not.toContain('snow');
    expect(run('snow', 480)).toContain('snow');
    expect(run('marsh', 480)).toContain('rain');
    expect(run('marsh', 480)).toContain('fog');
    const winter = run('hills', 252 * 1440 + 480);
    expect(winter).toContain('snow');
    expect(winter).not.toContain('rain');
    expect(run('hills', 480)).not.toContain('snow');
  });

  it('smoothly blends clouds and fog while keeping the reported six-hour state stable', () => {
    const wet = { mapId: 'terra-demo-wet', regionKind: 'wilderness', biome: 'marsh' };
    const boundary = Array.from({ length: 100 }, (_, i) => (i + 1) * 360)
      .find(t => chroniclesRegionalWeather({ ...wet, worldMinutes: t - 1 }).kind
        !== chroniclesRegionalWeather({ ...wet, worldMinutes: t }).kind);
    expect(boundary).toBeDefined();
    const before = chroniclesRegionalWeather({ ...wet, worldMinutes: boundary - 1 });
    const after = chroniclesRegionalWeather({ ...wet, worldMinutes: boundary });
    const start = chroniclesRegionalWeatherTransition({ ...wet, worldMinutes: boundary });
    const middle = chroniclesRegionalWeatherTransition({ ...wet, worldMinutes: boundary + 20 });
    const finish = chroniclesRegionalWeatherTransition({ ...wet, worldMinutes: boundary + 40 });
    expect(CHRONICLES_WEATHER_BLEND_MINUTES).toBe(40);
    expect(start.kind).toBe(after.kind);
    expect(start.clouds).toBe(before.clouds);
    expect(start.fog).toBe(before.fog);
    expect(start.progress).toBe(0);
    expect(middle.progress).toBeCloseTo(0.5);
    expect(middle.clouds).toBeCloseTo((before.clouds + after.clouds) / 2);
    expect(middle.fog).toBeCloseTo((before.fog + after.fog) / 2);
    expect(finish.progress).toBe(1);
    expect(finish.clouds).toBe(after.clouds);
    expect(finish.fog).toBe(after.fog);
    expect(chroniclesRegionalWeatherTransition({ ...wet, worldMinutes: boundary + 40 }))
      .toEqual(finish);
    expect(chroniclesRegionalWeatherTransition({ ...wet, worldMinutes: boundary - 1 }).kind)
      .toBe(before.kind);
  });

  it('ramps precipitation at its start and end, and switches rain/snow without doubling budgets', () => {
    const regions = [
      { mapId: 'terra-demo-wet', regionKind: 'wilderness', biome: 'marsh' },
      { mapId: 'terra-demo-snow', regionKind: 'wilderness', biome: 'snow' },
    ];
    for (const place of regions) {
      let entering = null;
      let leaving = null;
      for (let slot = 1; slot < 180; slot += 1) {
        const minute = slot * 360;
        const before = chroniclesRegionalWeather({ ...place, worldMinutes: minute - 1 }).kind;
        const after = chroniclesRegionalWeather({ ...place, worldMinutes: minute }).kind;
        const precip = k => k === 'rain' || k === 'snow';
        if (!precip(before) && precip(after) && entering === null) entering = minute;
        if (precip(before) && !precip(after) && leaving === null) leaving = minute;
      }
      expect(entering).not.toBeNull();
      expect(leaving).not.toBeNull();
      const start = chroniclesRegionalWeatherTransition({ ...place, worldMinutes: entering });
      const halfway = chroniclesRegionalWeatherTransition({ ...place, worldMinutes: entering + 20 });
      const ready = chroniclesRegionalWeatherTransition({ ...place, worldMinutes: entering + 40 });
      expect(start.precipitation).toBeNull();
      expect(start.precipitationStrength).toBe(0);
      expect(halfway.precipitationStrength).toBeCloseTo(0.5);
      expect(ready.precipitationStrength).toBe(1);
      const endStart = chroniclesRegionalWeatherTransition({ ...place, worldMinutes: leaving });
      const endMiddle = chroniclesRegionalWeatherTransition({ ...place, worldMinutes: leaving + 20 });
      const end = chroniclesRegionalWeatherTransition({ ...place, worldMinutes: leaving + 40 });
      expect(endStart.precipitationStrength).toBe(1);
      expect(endMiddle.precipitationStrength).toBeCloseTo(0.5);
      expect(end.precipitation).toBeNull();
      expect(end.precipitationStrength).toBe(0);
    }
    expect(chroniclesRegionalWeatherTransition({
      mapId: 'swordhaven-sewers', regionKind: 'dungeon', worldMinutes: 360,
    })).toBeNull();
  });

  it('reproduces map-world wind and blends it over weather cell boundaries', () => {
    const wet = { mapId: 'terra-demo-wet', regionKind: 'wilderness', biome: 'marsh' };
    const a = chroniclesRegionalWind({ ...wet, worldMinutes: 480 });
    expect(a).toEqual(chroniclesRegionalWind({ ...wet, worldMinutes: 480 }));
    expect(Object.isFrozen(a)).toBe(true);
    expect(chroniclesRegionalWind({ ...wet, worldMinutes: 480 + 100 })).toEqual(a);
    const boundary = Array.from({ length: 120 }, (_, i) => (i + 1) * 360)
      .find(minute => {
        const prev = chroniclesRegionalWind({ ...wet, worldMinutes: minute - 1 });
        const current = chroniclesRegionalWind({ ...wet, worldMinutes: minute });
        return prev.east !== current.east || prev.south !== current.south;
      });
    expect(boundary).toBeDefined();
    const before = chroniclesRegionalWind({ ...wet, worldMinutes: boundary - 1 });
    const after = chroniclesRegionalWind({ ...wet, worldMinutes: boundary });
    const start = chroniclesRegionalWeatherTransition({ ...wet, worldMinutes: boundary });
    const halfway = chroniclesRegionalWeatherTransition({ ...wet, worldMinutes: boundary + 20 });
    const finish = chroniclesRegionalWeatherTransition({ ...wet, worldMinutes: boundary + 40 });
    expect(start.wind).toEqual(before);
    expect(halfway.wind.east).toBeCloseTo((before.east + after.east) / 2);
    expect(halfway.wind.south).toBeCloseTo((before.south + after.south) / 2);
    expect(finish.wind).toEqual(after);
    expect(Object.isFrozen(halfway.wind)).toBe(true);
    expect(chroniclesRegionalWeatherTransition({ ...wet, worldMinutes: boundary }))
      .toEqual(start);
    expect(chroniclesRegionalWind({ mapId: 'crypt', regionKind: 'dungeon', worldMinutes: boundary }))
      .toBeNull();
  });

  it('sheltered forest has weaker wind than open coast at equal map/time', () => {
    for (const minute of [480, 720, 1440, 2160]) {
      const forest = chroniclesRegionalWind({
        mapId: 'terra-sample', regionKind: 'wilderness', biome: 'forest', worldMinutes: minute,
      });
      const coast = chroniclesRegionalWind({
        mapId: 'terra-sample', regionKind: 'wilderness', biome: 'coast', worldMinutes: minute,
      });
      expect(Math.hypot(forest.east, forest.south)).toBeLessThan(Math.hypot(coast.east, coast.south));
    }
  });

  it('does not depend on global random or the real date and is bounded', () => {
    const originalRandom = Math.random;
    Math.random = () => { throw Error('random must never run'); };
    try {
      const a = chroniclesRegionalWeather({ ...region, worldMinutes: 480 });
      const b = chroniclesRegionalWeather({ ...region, worldMinutes: 480 });
      expect(a).toEqual(b);
      expect(a.clouds).toBeGreaterThanOrEqual(0);
      expect(a.clouds).toBeLessThanOrEqual(1);
      expect(a.fog).toBeGreaterThanOrEqual(0);
      expect(a.fog).toBeLessThanOrEqual(1);
    } finally { Math.random = originalRandom; }
  });
});
