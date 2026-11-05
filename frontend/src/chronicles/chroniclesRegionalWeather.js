import { chroniclesWorldCalendar, chroniclesWorldMinutes } from './chroniclesWorldTime.js';

// Regional weather is derived entirely from the saved Terra clock and authored
// map identity. No Date.now(), storage migration, per-turn RNG or frame timer.
// A weather cell lasts six hours and is stable across save/load and re-entry.
export const CHRONICLES_WEATHER_PERIOD_MINUTES = 6 * 60;
const LABELS = Object.freeze({
  clear: 'Despejado',
  cloudy: 'Nublado',
  rain: 'Lluvia',
  fog: 'Niebla',
  snow: 'Nieve',
});
const METRICS = Object.freeze({
  clear: Object.freeze({ clouds: 0.04, fog: 0 }),
  cloudy: Object.freeze({ clouds: 0.58, fog: 0.12 }),
  rain: Object.freeze({ clouds: 0.84, fog: 0.32 }),
  fog: Object.freeze({ clouds: 0.63, fog: 0.87 }),
  snow: Object.freeze({ clouds: 0.82, fog: 0.55 }),
});
const WEATHER_TABLES = Object.freeze({
  mild: ['clear', 'clear', 'clear', 'cloudy', 'cloudy', 'rain', 'fog'],
  cold: ['clear', 'cloudy', 'cloudy', 'fog', 'snow', 'snow', 'snow', 'snow'],
  wet: ['clear', 'cloudy', 'rain', 'rain', 'rain', 'fog', 'fog'],
  coastal: ['clear', 'clear', 'cloudy', 'cloudy', 'rain', 'fog'],
  dry: ['clear', 'clear', 'clear', 'cloudy', 'cloudy', 'fog'],
});

// Wind is a two-dimensional map-world vector: positive east/south means
// positive X/Z in Three.js. The camera projects it into the viewport later.
const WIND_DIRECTIONS = Object.freeze([
  Object.freeze([1, 0]), Object.freeze([0.7071, 0.7071]),
  Object.freeze([0, 1]), Object.freeze([-0.7071, 0.7071]),
  Object.freeze([-1, 0]), Object.freeze([-0.7071, -0.7071]),
  Object.freeze([0, -1]), Object.freeze([0.7071, -0.7071]),
]);

function hashWeather(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function weatherTable(biome, season) {
  if (biome === 'snow' || ((biome === 'hills' || biome === 'plains') && season === 'Invierno')) {
    return WEATHER_TABLES.cold;
  }
  if (biome === 'marsh' || biome === 'forest') return WEATHER_TABLES.wet;
  if (biome === 'coast') return WEATHER_TABLES.coastal;
  if (biome === 'ash') return WEATHER_TABLES.dry;
  return WEATHER_TABLES.mild;
}

// Return null for dungeons and unknown content rather than claiming outdoor
// precipitation for maps without an exterior sky.
export function chroniclesRegionalWeather({
  mapId, biome = null, regionKind = null, worldMinutes,
} = {}) {
  if (typeof mapId !== 'string' || !mapId.trim()
    || !['settlement', 'wilderness', 'outdoor'].includes(regionKind)) return null;
  const elapsed = chroniclesWorldMinutes(worldMinutes);
  const period = Math.floor(elapsed / CHRONICLES_WEATHER_PERIOD_MINUTES);
  const season = chroniclesWorldCalendar(elapsed).season;
  const table = weatherTable(biome, season);
  const kind = table[hashWeather(mapId + ':' + period + ':' + season) % table.length];
  const metrics = METRICS[kind];
  return Object.freeze({
    kind, label: LABELS[kind], clouds: metrics.clouds, fog: metrics.fog,
    period, season, untilWorldMinutes: (period + 1) * CHRONICLES_WEATHER_PERIOD_MINUTES,
  });
}

// Deterministic regional wind, derived from the same six-hour Terra cell.
// Hills, coast and snowfields are more exposed than sheltered forests.
// No mutable RNG, clock, persistence schema or frame updates.
export function chroniclesRegionalWind({ mapId, biome = null, regionKind = null, worldMinutes } = {}) {
  if (typeof mapId !== 'string' || !mapId.trim()
    || !['settlement', 'wilderness', 'outdoor'].includes(regionKind)) return null;
  const elapsed = chroniclesWorldMinutes(worldMinutes);
  const period = Math.floor(elapsed / CHRONICLES_WEATHER_PERIOD_MINUTES);
  const season = chroniclesWorldCalendar(elapsed).season;
  const h = hashWeather('wind:' + mapId + ':' + period + ':' + season);
  const direction = WIND_DIRECTIONS[h % WIND_DIRECTIONS.length];
  const exposure = biome === 'forest' ? 0.65
    : biome === 'coast' || biome === 'snow' || biome === 'hills' ? 1 : 0.8;
  const magnitude = (0.18 + ((h >>> 8) % 4) * 0.19) * exposure;
  return Object.freeze({
    east: direction[0] * magnitude,
    south: direction[1] * magnitude,
  });
}

// Visual atmosphere only: the six-hour *reported* weather kind remains fixed.
// During the first 40 in-world minutes after a boundary, blend from the
// preceding cell. This is pure and works when a saved game is reloaded or
// its clock moves backwards; no ticks or additional persisted fields.
export const CHRONICLES_WEATHER_BLEND_MINUTES = 40;

function precipitationKind(weather) {
  return weather?.kind === 'rain' || weather?.kind === 'snow' ? weather.kind : null;
}

export function chroniclesRegionalWeatherTransition({ worldMinutes, ...region } = {}) {
  const elapsed = chroniclesWorldMinutes(worldMinutes);
  const current = chroniclesRegionalWeather({ ...region, worldMinutes: elapsed });
  if (!current) return null;
  const offset = elapsed % CHRONICLES_WEATHER_PERIOD_MINUTES;
  const previous = elapsed >= CHRONICLES_WEATHER_PERIOD_MINUTES
    ? chroniclesRegionalWeather({ ...region, worldMinutes: elapsed - offset - 1 })
    : current;
  const from = previous || current;
  const x = Math.min(1, offset / CHRONICLES_WEATHER_BLEND_MINUTES);
  const windProgress = x * x * (3 - 2 * x);
  const progress = from.kind === current.kind ? 1 : windProgress;
  const currentWind = chroniclesRegionalWind({ ...region, worldMinutes: elapsed });
  const previousWind = elapsed >= CHRONICLES_WEATHER_PERIOD_MINUTES
    ? chroniclesRegionalWind({ ...region, worldMinutes: elapsed - offset - 1 })
    : currentWind;
  // Wind can shift even between equally cloudy blocks: interpolate its two
  // map-world components regardless of changes to the official condition.
  const wind = Object.freeze({
    east: previousWind.east + (currentWind.east - previousWind.east) * windProgress,
    south: previousWind.south + (currentWind.south - previousWind.south) * windProgress,
  });
  const oldPrecip = precipitationKind(from);
  const newPrecip = precipitationKind(current);
  let precipitation = newPrecip;
  let strength = newPrecip ? 1 : 0;
  if (oldPrecip !== newPrecip && progress < 1) {
    if (oldPrecip && newPrecip) {
      // Swap rain for snow via a brief lull; never double particle budgets.
      precipitation = progress < 0.5 ? oldPrecip : newPrecip;
      strength = progress < 0.5 ? 1 - 2 * progress : 2 * progress - 1;
    } else if (oldPrecip) {
      precipitation = oldPrecip;
      strength = 1 - progress;
    } else {
      strength = progress;
    }
  }
  // Zero intensity means no DOM particles at all, including a clean onset.
  if (strength <= 0) precipitation = null;
  return Object.freeze({
    kind: current.kind,
    clouds: from.clouds + (current.clouds - from.clouds) * progress,
    fog: from.fog + (current.fog - from.fog) * progress,
    precipitation,
    precipitationStrength: strength,
    wind,
    progress,
  });
}
