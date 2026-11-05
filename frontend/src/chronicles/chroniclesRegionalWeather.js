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
