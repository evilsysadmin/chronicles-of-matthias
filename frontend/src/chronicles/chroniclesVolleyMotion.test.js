import { describe, expect, it } from 'vitest';
import { CHRONICLES_VOLLEY_MAX_DURATION, CHRONICLES_VOLLEY_NOSE_REACH, chroniclesVolleyFlightSample, chroniclesVolleyMatchesLaunchPose, chroniclesVolleyObstacleDistance, chroniclesVolleyVisibleFlight } from './chroniclesVolleyMotion.js';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesMapForState } from './chroniclesMapCatalog.js';

describe('Chronicles · polished projectile flight', () => {
  it('staggers shots without inventing extra projectiles or depending on frames', () => {
    expect(chroniclesVolleyFlightSample(3, 0, 0, 'bow')).not.toBeNull();
    expect(chroniclesVolleyFlightSample(3, 1, 0, 'bow')).toBeNull();
    expect(chroniclesVolleyFlightSample(3, 1, 0.034, 'bow')).not.toBeNull();
    expect(chroniclesVolleyFlightSample(0, 0, 0)).toBeNull();
    expect(chroniclesVolleyFlightSample(1, 1, 0)).toBeNull();
    expect(chroniclesVolleyFlightSample(1, -1, 0)).toBeNull();
    expect(chroniclesVolleyFlightSample(6, 5, CHRONICLES_VOLLEY_MAX_DURATION)).toBeNull();
  });
  it('converges toward the target, with a gentler stone arc and distinct timings', () => {
    const bowStart = chroniclesVolleyFlightSample(3, 0, 0, 'bow');
    const bowMid = chroniclesVolleyFlightSample(3, 0, 0.21, 'bow');
    const bowEnd = chroniclesVolleyFlightSample(3, 0, 0.49, 'bow');
    expect(bowStart.z).toBe(-0.72);
    expect(bowMid.z).toBeLessThan(bowStart.z);
    expect(bowEnd.z).toBeLessThan(bowMid.z);
    expect(Math.abs(bowEnd.x)).toBeLessThan(Math.abs(bowStart.x));
    expect(bowEnd.scale).toBeLessThan(bowStart.scale);
    const stoneMid = chroniclesVolleyFlightSample(3, 0, 0.21, 'sling');
    expect(stoneMid.y).toBeGreaterThan(bowMid.y);
    expect(chroniclesVolleyFlightSample(1, 0, 0.50, 'crossbow')).toBeNull();
    expect(chroniclesVolleyFlightSample(1, 0, 0.50, 'sling')).not.toBeNull();
  });
  it('shows bow and crossbow shafts in a restrained three-quarter flight profile', () => {
    for (const kind of ['bow', 'crossbow']) {
      const first = chroniclesVolleyFlightSample(3, 0, 0.05, kind);
      const middle = chroniclesVolleyFlightSample(3, 1, 0.08, kind);
      expect(Math.abs(first.yaw)).toBeGreaterThan(0.2);
      expect(Math.abs(middle.yaw)).toBeGreaterThan(0.2);
      expect(first.yaw * middle.yaw).toBeLessThan(0);
      expect(first.pitch).toBeLessThan(-0.1);
    }
    // A sling stone spins, without acquiring fake arrow fletching orientation.
    const stone = chroniclesVolleyFlightSample(1, 0, 0.1, 'sling');
    expect(Math.abs(stone.yaw)).toBeLessThan(1e-6);
  });


  it('progressively points physical arrows along the forward flight path', () => {
    for (const kind of ['bow', 'crossbow']) {
      const early = chroniclesVolleyFlightSample(3, 0, 0.05, kind);
      const late = chroniclesVolleyFlightSample(3, 0, 0.35, kind);
      expect(Math.abs(early.yaw)).toBeGreaterThan(0.18);
      expect(Math.abs(late.yaw)).toBeLessThan(Math.abs(early.yaw));
      expect(Math.abs(late.yaw)).toBeLessThan(0.18);
      expect(late.z).toBeLessThan(early.z);
    }
  });

  it('keeps mirror symmetry on left/right start positions and resets on replay', () => {
    const left = chroniclesVolleyFlightSample(4, 0, 0, 'bow');
    const right = chroniclesVolleyFlightSample(4, 3, 3 * 0.034, 'bow');
    expect(left.x + right.x).toBeCloseTo(0);
    expect(chroniclesVolleyFlightSample(3, 0, 0.16, 'bow'))
      .toEqual(chroniclesVolleyFlightSample(3, 0, 0.16, 'bow'));
    expect(chroniclesVolleyFlightSample(1, 0, Number.NaN)).toBeNull();
  });
  it('uses real Swordhaven solid house and shop walls as projectile barriers', () => {
    const state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
    const grid = chroniclesMapForState(state).grid;
    // South-side town lane, directly facing an authored # house block.
    expect(grid[3][1]).toBe('.');
    expect(grid[3][2]).toBe('#');
    const distance = chroniclesVolleyObstacleDistance(grid, { x: 1, y: 3 }, { dx: 1, dy: 0 });
    expect(distance).toBeCloseTo(1.92);
    // Inn/shop door leaves and their stone jambs protrude into the street.
    // A flat-wall stop distance would allow the projectile into that relief.
    const facade = chroniclesVolleyObstacleDistance(
      grid, { x: 1, y: 3 }, { dx: 1, dy: 0 }, 4, 0.55,
    );
    expect(facade).toBeCloseTo(1.45);
    expect(chroniclesVolleyVisibleFlight(1, 0, 0.01, 'bow', facade)).not.toBeNull();
    expect(chroniclesVolleyVisibleFlight(1, 0, 0.05, 'bow', facade)).toBeNull();
    expect(chroniclesVolleyVisibleFlight(1, 0, 0.05, 'bow', distance)).not.toBeNull();
    // Centre alone is not enough: the steel nose reaches the solid before
    // the sampled root would, even with the original flat-wall clearance.
    const nearingWall = chroniclesVolleyFlightSample(1, 0, 0.07, 'bow');
    expect(-nearingWall.z).toBeLessThan(distance);
    expect(chroniclesVolleyVisibleFlight(1, 0, 0.07, 'bow', distance)).toBeNull();
    expect(chroniclesVolleyVisibleFlight(1, 0, 0.05, 'crossbow', facade)).toBeNull();
    expect(chroniclesVolleyVisibleFlight(1, 0, 0.05, 'sling', facade)).not.toBeNull();
    expect(chroniclesVolleyVisibleFlight(1, 0, 0.07, 'sling', facade)).toBeNull();
    expect(chroniclesVolleyVisibleFlight(1, 0, 0, 'bow', distance)).not.toBeNull();
    expect(chroniclesVolleyVisibleFlight(1, 0, 0.3, 'bow', distance)).toBeNull();
    expect(chroniclesVolleyVisibleFlight(1, 0, 0.3, 'crossbow', distance)).toBeNull();
    expect(chroniclesVolleyVisibleFlight(1, 0, 0.3, 'sling', distance)).toBeNull();
    expect(chroniclesVolleyObstacleDistance(grid, { x: 1, y: 3 }, { dx: 0, dy: 1 })).toBe(Infinity);
  });

  it('never lets an already-fired projectile follow a later turn or movement', () => {
    const launch = { x: 7, y: 18, direction: 0 };
    expect(chroniclesVolleyMatchesLaunchPose(launch, { ...launch, turns: 4 })).toBe(true);
    expect(chroniclesVolleyMatchesLaunchPose(launch, { ...launch, direction: 1 })).toBe(false);
    expect(chroniclesVolleyMatchesLaunchPose(launch, { ...launch, x: 8 })).toBe(false);
    expect(chroniclesVolleyMatchesLaunchPose(launch, { ...launch, y: 17 })).toBe(false);
    expect(chroniclesVolleyMatchesLaunchPose(null, launch)).toBe(false);
    expect(chroniclesVolleyMatchesLaunchPose(launch, null)).toBe(false);
    expect(chroniclesVolleyMatchesLaunchPose({ ...launch, direction: NaN }, launch)).toBe(false);
    // A new independent shot can still launch from the new, legal pose.
    expect(chroniclesVolleyMatchesLaunchPose({ ...launch, direction: 1 }, { ...launch, direction: 1 })).toBe(true);
  });

  it('keeps unobstructed arrows and rejects invalid rays conservatively', () => {
    const grid = ['#######', '#.....#', '#.....#', '#.....#', '#######'];
    expect(chroniclesVolleyObstacleDistance(grid, {x: 1,y: 2}, {dx: 1,dy: 0})).toBe(Infinity);
    expect(chroniclesVolleyObstacleDistance(grid, {x: 5,y: 2}, {dx: 1,dy: 0})).toBeCloseTo(1.92);
    expect(chroniclesVolleyObstacleDistance(grid, {x: 1,y: 2}, {dx: 1,dy: 1})).toBe(Infinity);
    expect(chroniclesVolleyObstacleDistance(null, null, null)).toBe(Infinity);
    // Malformed or excessive clearance must not move the impact behind
    // the player or create a false hit through a solid wall.
    expect(chroniclesVolleyObstacleDistance(grid, {x:5,y:2}, {dx:1,dy:0}, 4, Number.NaN)).toBeCloseTo(1.92);
    expect(chroniclesVolleyObstacleDistance(grid, {x:5,y:2}, {dx:1,dy:0}, 4, 100)).toBe(0);
    expect(CHRONICLES_VOLLEY_NOSE_REACH.bow).toBeGreaterThan(CHRONICLES_VOLLEY_NOSE_REACH.crossbow);
    expect(CHRONICLES_VOLLEY_NOSE_REACH.crossbow).toBeGreaterThan(CHRONICLES_VOLLEY_NOSE_REACH.sling);
    // No collider => preserve the exact historical smooth flight sample.
    const mid = chroniclesVolleyFlightSample(1, 0, 0.3, 'bow');
    expect(chroniclesVolleyVisibleFlight(1, 0, 0.3, 'bow')).toEqual(mid);
    expect(chroniclesVolleyVisibleFlight(1, 0, 0.3, 'bow', Infinity)).toEqual(mid);
    expect(chroniclesVolleyVisibleFlight(1, 0, 0.3, 'bow', 1.92)).toBeNull();
    expect(chroniclesVolleyVisibleFlight(0, 0, 0.3, 'bow', 1.92)).toBeNull();
  });

});
