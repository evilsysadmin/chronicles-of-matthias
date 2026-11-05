import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CHRONICLES_WEATHER_PERIOD_MINUTES, chroniclesRegionalWeather } from './chroniclesRegionalWeather.js';
import {
  chroniclesTownRainWetness, chroniclesTownRainPuddleCells, createChroniclesTownRainPuddles,
} from './chroniclesTownRainPavement.js';

const town = { mapId: 'swordhaven-first-book', regionKind: 'settlement' };
function weatherAt(minute) {
  return chroniclesRegionalWeather({ ...town, worldMinutes: minute })?.kind;
}
function findFirstRain() {
  for (let n = 3; n < 400; n++) {
    const minute = n * CHRONICLES_WEATHER_PERIOD_MINUTES;
    if (weatherAt(minute) === 'rain' && weatherAt(minute - 1) !== 'rain'
      && weatherAt(minute - CHRONICLES_WEATHER_PERIOD_MINUTES - 1) !== 'rain') return minute;
  }
  throw Error('No rain cell in first hundred weather blocks');
}
function findRainEnd() {
  for (let n = 1; n < 400; n++) {
    const minute = n * CHRONICLES_WEATHER_PERIOD_MINUTES;
    if (weatherAt(minute - 1) === 'rain' && weatherAt(minute) !== 'rain'
      && weatherAt(minute + CHRONICLES_WEATHER_PERIOD_MINUTES) !== 'rain') return minute;
  }
  throw Error('No rain to dry after');
}
describe('Swordhaven wet cobblestones', () => {
  it('soaks in for 30 in-world minutes and dries over three hours after rain', () => {
    const start = findFirstRain();
    expect(chroniclesTownRainWetness({ ...town, worldMinutes: start })).toBe(0);
    expect(chroniclesTownRainWetness({ ...town, worldMinutes: start + 15 })).toBeCloseTo(.5);
    expect(chroniclesTownRainWetness({ ...town, worldMinutes: start + 30 })).toBe(1);
    const stop = findRainEnd();
    expect(chroniclesTownRainWetness({ ...town, worldMinutes: stop })).toBe(1);
    expect(chroniclesTownRainWetness({ ...town, worldMinutes: stop + 90 })).toBeCloseTo(.5);
    expect(chroniclesTownRainWetness({ ...town, worldMinutes: stop + 135 })).toBeCloseTo(.25);
    expect(chroniclesTownRainWetness({ ...town, worldMinutes: stop + 180 })).toBe(0);
  });
  it('restores precisely from time, never creating rain slicks in wilderness or dungeons', () => {
    const minute = findFirstRain() + 40;
    const a = chroniclesTownRainWetness({ ...town, worldMinutes: minute });
    const b = chroniclesTownRainWetness({ ...town, worldMinutes: minute });
    expect(a).toBe(b);
    expect(chroniclesTownRainWetness({
      ...town, mapId: 'terra-b2', regionKind: 'wilderness', worldMinutes: minute,
    })).toBe(0);
    expect(chroniclesTownRainWetness({
      ...town, mapId: 'swordhaven-sewers', regionKind: 'dungeon', worldMinutes: minute,
    })).toBe(0);
  });
  it('uses one instanced mesh, no collision or lighting, within deterministic road coordinates', () => {
    const cells = Array.from({ length: 28 }, (_, i) => ({ x: i % 7, y: Math.floor(i / 7) }));
    expect(chroniclesTownRainPuddleCells(cells, true)).toEqual(chroniclesTownRainPuddleCells(cells, true));
    const roads = Array.from({ length: 180 }, (_, i) => ({ x: i % 19, y: Math.floor(i / 19) }));
    const make = coarsePointer => createChroniclesTownRainPuddles({
      roadCells: roads, sceneCenter: { x: 9, y: 7 }, coarsePointer,
      gridToWorld: (x, y, center) => [(x - center.x) * 4, (y - center.y) * 4],
    });
    const mobile = make(true);
    const desktop = make(false);
    expect(mobile).toBeInstanceOf(THREE.InstancedMesh);
    expect(mobile.count).toBeGreaterThan(0);
    expect(mobile.count).toBeLessThanOrEqual(12);
    expect(desktop.count).toBeLessThanOrEqual(22);
    expect(mobile.userData.chroniclesDecorativeOnly).toBe(true);
    expect(mobile.castShadow).toBe(false);
    expect(mobile.visible).toBe(false);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < mobile.count; i++) {
      mobile.getMatrixAt(i, matrix);
      const pos = new THREE.Vector3().setFromMatrixPosition(matrix);
      expect(pos.y).toBeCloseTo(.033);
      const x = Math.round(pos.x / 4 + 9);
      const y = Math.round(pos.z / 4 + 7);
      expect(roads.some(c => c.x === x && c.y === y)).toBe(true);
    }
    expect(mobile.material.map.image.data.length).toBe(32 * 32 * 4);
    for (const batch of [mobile, desktop]) {
      batch.geometry.dispose();
      batch.material.map.dispose();
      batch.material.dispose();
    }
  });
});
