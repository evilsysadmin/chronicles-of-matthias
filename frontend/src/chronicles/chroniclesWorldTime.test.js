import { describe, expect, it } from 'vitest';
import { createChroniclesState, chroniclesActiveEnemies, chroniclesReduce } from '../chroniclesOfMatthias.js';
import { chroniclesRunCheckpointPayload, chroniclesApplyRunCheckpoint } from './chroniclesRunCheckpoint.js';
import {
  CHRONICLES_WORLD_START_MINUTES,
  chroniclesWorldCalendar,
  chroniclesWorldMinutes,
  chroniclesSeasonalSunTimes,
  chroniclesAdvanceWorldTimeOnTurn,
} from './chroniclesWorldTime.js';

const initial = () => createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });

describe('MM3 world clock', () => {
  it('starts at 08:00 in year 500 and never reads wall-clock time', () => {
    const state = initial();
    expect(state.worldMinutes).toBe(CHRONICLES_WORLD_START_MINUTES);
    expect(chroniclesWorldCalendar(state.worldMinutes)).toMatchObject({
      time: '08:00', weekday: 'Lunes', dayOfYear: 1, month: 1,
      dayOfMonth: 1, year: 500, season: 'Primavera', daylightPhase: 'day',
    });
    expect(createChroniclesState('swordhaven-sewers').worldMinutes).toBeUndefined();
  });

  it('advances only accepted MM3 turns; no movement during initiative', () => {
    const start = initial();
    expect(chroniclesReduce(start, 'not-an-action')).toBe(start);
    const turned = chroniclesReduce(start, 'turn-left');
    expect(turned.turns).toBe(start.turns + 1);
    expect(turned.worldMinutes).toBe(CHRONICLES_WORLD_START_MINUTES);
    expect(turned.direction).toBe((start.direction + 3) % 4);
    const turnedBack = chroniclesReduce(turned, 'turn-right');
    expect(turnedBack.turns).toBe(start.turns + 2);
    expect(turnedBack.direction).toBe(start.direction);
    expect(turnedBack.worldMinutes).toBe(CHRONICLES_WORLD_START_MINUTES);
    const blocked = { ...turned, phase: 'combat', initiative: { order: [], cursor: 0 } };
    expect(chroniclesReduce(blocked, 'turn-right')).toBe(blocked);
    const tactics = createChroniclesState('swordhaven-sewers');
    expect(chroniclesReduce(tactics, 'turn-right').worldMinutes).toBeUndefined();
  });

  it('a full rotation does not advance time or cross midnight; a real step does', () => {
    const start = { ...initial(), worldMinutes: 23 * 60 + 50 };
    let turning = start;
    for (const action of ['turn-right', 'turn-right', 'turn-right', 'turn-right', 'turn-left']) {
      const next = chroniclesReduce(turning, action);
      expect(next.turns).toBe(turning.turns + 1); // keep the existing pursuit contract
      expect(next.x).toBe(start.x);
      expect(next.y).toBe(start.y);
      expect(next.worldMinutes).toBe(start.worldMinutes);
      turning = next;
    }
    expect(chroniclesWorldCalendar(turning.worldMinutes).time).toBe('23:50');
    const stepped = chroniclesAdvanceWorldTimeOnTurn(turning, {
      ...turning, x: turning.x + 1, turns: turning.turns + 1,
    }, 'forward');
    expect(chroniclesWorldCalendar(stepped.worldMinutes)).toMatchObject({
      time: '00:00', dayOfYear: 2,
    });
    // Object-shaped dispatches and Tactics retain the same distinction.
    const objectTurn = chroniclesAdvanceWorldTimeOnTurn(turning,
      { ...turning, direction: (turning.direction + 1) % 4, turns: turning.turns + 1 },
      { type: 'turn-right' });
    expect(objectTurn.worldMinutes).toBe(turning.worldMinutes);
  });

  it('supports rolling past midnight, seasons and years', () => {
    const midnight = chroniclesWorldCalendar(23 * 60 + 50 + 20);
    expect(midnight).toMatchObject({ time: '00:10', dayOfYear: 2, weekday: 'Martes', daylightPhase: 'night' });
    expect(chroniclesWorldCalendar(84 * 1440)).toMatchObject({ season: 'Verano', month: 4 });
    expect(chroniclesWorldCalendar(336 * 1440)).toMatchObject({
      year: 501, month: 1, dayOfYear: 1, weekday: 'Lunes',
    });
    expect(chroniclesWorldMinutes('480')).toBe(CHRONICLES_WORLD_START_MINUTES);
    expect(chroniclesWorldCalendar(NaN).time).toBe('08:00');
  });

  it('lengthens summer days and shortens winter ones, with calendar and sky sharing sunrise/sunset', () => {
    const spring = chroniclesSeasonalSunTimes(0);
    const summerMinute = 84 * 1440;
    const autumnMinute = 168 * 1440;
    const winterMinute = 252 * 1440;
    const summer = chroniclesSeasonalSunTimes(summerMinute);
    const autumn = chroniclesSeasonalSunTimes(autumnMinute);
    const winter = chroniclesSeasonalSunTimes(winterMinute);
    expect(spring.daylightHours).toBeCloseTo(12);
    expect(summer.daylightHours).toBeCloseTo(14.5);
    expect(autumn.daylightHours).toBeCloseTo(12);
    expect(winter.daylightHours).toBeCloseTo(9.5);
    expect(summer.sunrise).toBeLessThan(spring.sunrise);
    expect(summer.sunset).toBeGreaterThan(spring.sunset);
    expect(winter.sunrise).toBeGreaterThan(spring.sunrise);
    expect(winter.sunset).toBeLessThan(spring.sunset);
    // Seasonal day/night phases in I match the actual outdoor sun, including
    // the same evening hour being light in summer but dark in winter.
    expect(chroniclesWorldCalendar(summerMinute + 18 * 60).daylightPhase).toBe('day');
    expect(chroniclesWorldCalendar(winterMinute + 18 * 60).daylightPhase).toBe('night');
    expect(chroniclesWorldCalendar(summerMinute + 5 * 60).daylightPhase).toBe('dawn');
    expect(chroniclesWorldCalendar(winterMinute + 5 * 60).daylightPhase).toBe('night');
    expect(chroniclesSeasonalSunTimes(summerMinute + 1440 * 336)).toEqual(summer);
  });

  it('spends eight hours for a safe camp rest, and for accepted inn rests', () => {
    const base = initial();
    const wounded = {
      ...base,
      party: base.party.map((member) => ({ ...member, hp: Math.max(1, member.hp - 1) })),
      inventory: { ...base.inventory, 'road-rations': { id: 'road-rations', quantity: 4 } },
    };
    const safe = {
      ...wounded,
      ...Object.fromEntries(chroniclesActiveEnemies(wounded).map((enemy) => [enemy.hpKey, 0])),
    };
    const rested = chroniclesReduce(safe, 'camp-rest');
    expect(rested.turns).toBe(safe.turns + 1);
    expect(rested.worldMinutes).toBe(safe.worldMinutes + 480);
    expect(chroniclesAdvanceWorldTimeOnTurn(safe, { ...safe, turns: safe.turns + 1 }, 'inn-rest').worldMinutes)
      .toBe(safe.worldMinutes + 480);
    expect(chroniclesAdvanceWorldTimeOnTurn(safe, safe, 'inn-rest')).toBe(safe);
    // A blocked step is a legacy turn for pursuit, but not a clock advance.
    const wallBump = { ...safe, turns: safe.turns + 1 };
    expect(chroniclesAdvanceWorldTimeOnTurn(safe, wallBump, 'forward')).toBe(wallBump);
  });

  it('persists elapsed minutes in real run flags and restores legacy and corrupt saves safely', () => {
    const after = chroniclesReduce(initial(), 'turn-right');
    const payload = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(after, 1)));
    expect(payload.worldFlags['__chrRuntime.worldMinutes']).toBe(480);
    const recovered = chroniclesApplyRunCheckpoint(initial(), payload);
    expect(recovered.worldMinutes).toBe(480);
    expect(recovered.direction).toBe(after.direction);
    const legacy = structuredClone(payload);
    delete legacy.worldFlags['__chrRuntime.worldMinutes'];
    expect(chroniclesApplyRunCheckpoint(initial(), legacy).worldMinutes).toBe(480);
    legacy.worldFlags['__chrRuntime.worldMinutes'] = -123;
    expect(chroniclesApplyRunCheckpoint(initial(), legacy).worldMinutes).toBe(480);
  });
});
