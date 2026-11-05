import { describe, expect, it } from 'vitest';
import { chroniclesRegionalWeather, CHRONICLES_WEATHER_PERIOD_MINUTES } from './chroniclesRegionalWeather.js';

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
