// Terra's calendar is a game-world clock, never local wall-clock time.
// Each in-game year has twelve 28-day months, four three-month seasons.
const MINUTES_PER_DAY = 24 * 60;
const DAYS_PER_MONTH = 28;
const MONTHS_PER_YEAR = 12;
const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR;
const WEEKDAYS = Object.freeze(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);
const SEASONS = Object.freeze(['Primavera', 'Verano', 'Otoño', 'Invierno']);

export const CHRONICLES_WORLD_START_YEAR = 500;
export const CHRONICLES_WORLD_START_MINUTES = 8 * 60;
export const CHRONICLES_WORLD_ACTION_MINUTES = 10;
export const CHRONICLES_WORLD_REST_MINUTES = 8 * 60;

// Explicit elapsed minutes let rests/travel advance by different durations;
// deriving date from turns would silently lose the duration of a rest.
export function chroniclesWorldMinutes(value) {
  return Number.isSafeInteger(value) && value >= 0
    ? value : CHRONICLES_WORLD_START_MINUTES;
}

// Terra's northern-hemisphere-like year has a smoothly changing photoperiod:
// 12 hours at spring/autumn equinox, 14.5 in midsummer and 9.5 in midwinter.
// Both the sky and the Information folio use this one persisted-time function.
export function chroniclesSeasonalSunTimes(worldMinutes) {
  const day = Math.floor(chroniclesWorldMinutes(worldMinutes) / MINUTES_PER_DAY) % DAYS_PER_YEAR;
  const hours = 12 + 2.5 * Math.sin(day * 2 * Math.PI / DAYS_PER_YEAR);
  return Object.freeze({
    daylightHours: hours,
    sunrise: 12 - hours / 2,
    sunset: 12 + hours / 2,
  });
}

export function chroniclesWorldCalendar(value) {
  const elapsed = chroniclesWorldMinutes(value);
  const daysElapsed = Math.floor(elapsed / MINUTES_PER_DAY);
  const minutesToday = elapsed % MINUTES_PER_DAY;
  const dayIndex = daysElapsed % DAYS_PER_YEAR;
  const monthIndex = Math.floor(dayIndex / DAYS_PER_MONTH);
  const hour = Math.floor(minutesToday / 60);
  const minute = minutesToday % 60;
  const solar = chroniclesSeasonalSunTimes(elapsed);
  const timeOfDay = minutesToday / 60;
  const daylightPhase = timeOfDay < solar.sunrise - 1 || timeOfDay >= solar.sunset + 1
    ? 'night' : timeOfDay < solar.sunrise + 1 ? 'dawn'
      : timeOfDay < solar.sunset - 1 ? 'day' : 'dusk';
  return {
    year: CHRONICLES_WORLD_START_YEAR + Math.floor(daysElapsed / DAYS_PER_YEAR),
    dayOfYear: dayIndex + 1,
    month: monthIndex + 1,
    dayOfMonth: dayIndex % DAYS_PER_MONTH + 1,
    weekday: WEEKDAYS[daysElapsed % WEEKDAYS.length],
    season: SEASONS[Math.floor(monthIndex / 3)],
    hour,
    minute,
    time: String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0'),
    daylightPhase,
  };
}

// Uses the actual accepted turn budget, not button presses or animation frames.
// No time is spent for blocked steps, in-place facing changes, refused actions
// or menu interactions. Resting consumes one tactical turn but eight hours.
// Exploratory turns/pursuit remain separate from the calendar's elapsed minutes.
export function chroniclesAdvanceWorldTimeOnTurn(before, after, action) {
  if (!before || !after || before.combatRules !== 'mm3') return after;
  const spentTurns = Number(after.turns) - Number(before.turns);
  if (!Number.isSafeInteger(spentTurns) || spentTurns <= 0) return after;
  const actionType = typeof action === 'string' ? action : action?.type;
  // Looking around without leaving the same tile never advances Terra's sun
  // or calendar. Preserve the preexisting exploration-turn budget/pursuit:
  // turning may still alert enemies, but not move the in-world clock.
  if (actionType === 'turn-left' || actionType === 'turn-right') return after;
  // The legacy reducer sometimes increments turns for a wall bump. It may
  // still advance enemy awareness, but no journey time passes without a step.
  if (['forward', 'backward', 'strafe-left', 'strafe-right'].includes(actionType)
    && before.mapId === after.mapId && before.x === after.x && before.y === after.y) return after;
  const spentMinutes = actionType === 'camp-rest' || actionType === 'inn-rest'
    ? CHRONICLES_WORLD_REST_MINUTES
    : CHRONICLES_WORLD_ACTION_MINUTES * spentTurns;
  return {
    ...after,
    worldMinutes: Math.min(Number.MAX_SAFE_INTEGER, chroniclesWorldMinutes(before.worldMinutes) + spentMinutes),
  };
}
