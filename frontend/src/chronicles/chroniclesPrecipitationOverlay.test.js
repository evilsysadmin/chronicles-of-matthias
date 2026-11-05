import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { chroniclesRegionalWeather, chroniclesRegionalWeatherTransition } from './chroniclesRegionalWeather.js';
import {
  chroniclesPrecipitationBudget,
  chroniclesPrecipitationKind,
  chroniclesPrecipitationParticle, chroniclesPrecipitationWindDrift,
  createChroniclesPrecipitationOverlay,
} from './chroniclesPrecipitationOverlay.js';

const region = { mapId: 'terra-demo-wet', regionKind: 'wilderness', biome: 'marsh' };
const snowy = { mapId: 'terra-demo-snow', regionKind: 'wilderness', biome: 'snow' };
function findTime(place, kind) {
  for (let i = 0; i < 120; i += 1) {
    const minute = 480 + i * 360;
    if (chroniclesRegionalWeather({ ...place, worldMinutes: minute })?.kind === kind) return minute;
  }
  throw Error('Weather sample not found: ' + kind);
}

function fakeDocument() {
  function element(name) {
    const node = {
      name, children: [], dataset: {}, hidden: false, parent: null,
      style: { values: {}, setProperty(key, value) { this.values[key] = value; } },
      setAttribute() {},
      appendChild(child) {
        if (child.name === '#fragment') {
          for (const nested of child.children) this.appendChild(nested);
        } else {
          child.parent = this;
          this.children.push(child);
        }
        return child;
      },
      replaceChildren(...nodes) { this.children = []; nodes.forEach((n) => this.appendChild(n)); },
      remove() { if (this.parent) this.parent.children = this.parent.children.filter((n) => n !== this); },
    };
    return node;
  }
  return { createElement: element, createDocumentFragment: () => element('#fragment'), element };
}
afterEach(() => vi.unstubAllGlobals());

describe('Terra cheap CSS precipitation', () => {
  it('only animates real rain and snow, with separate mobile budgets', () => {
    for (const kind of ['clear', 'cloudy', 'fog', null]) {
      expect(chroniclesPrecipitationKind({ kind })).toBeNull();
      expect(chroniclesPrecipitationBudget(kind)).toBe(0);
    }
    expect(chroniclesPrecipitationKind({ kind: 'rain' })).toBe('rain');
    expect(chroniclesPrecipitationBudget('rain')).toBe(36);
    expect(chroniclesPrecipitationBudget('rain', true)).toBe(16);
    expect(chroniclesPrecipitationBudget('snow')).toBe(24);
    expect(chroniclesPrecipitationBudget('snow', true)).toBe(12);
    expect(chroniclesPrecipitationBudget('rain', true, true)).toBe(4);
  });

  it('uses reproducible positions and different rain/snow speeds without RNG', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw Error('No RNG'); });
    try {
      const rain = chroniclesPrecipitationParticle(11, 'rain');
      const snow = chroniclesPrecipitationParticle(11, 'snow');
      expect(rain).toEqual(chroniclesPrecipitationParticle(11, 'rain'));
      expect(Object.isFrozen(rain)).toBe(true);
      expect(rain.x).toBeGreaterThan(0);
      expect(rain.x).toBeLessThan(100);
      expect(rain.duration).toBeLessThan(1.5);
      expect(snow.duration).toBeGreaterThan(5);
      expect(snow.size).toBeGreaterThan(rain.size);
    } finally { random.mockRestore(); }
  });

  it('turning the camera reverses wind without recreating rain or exceeding budgets', () => {
    const wind = { east: 0.6, south: -0.4 };
    expect(chroniclesPrecipitationWindDrift(wind, 0, 'rain')).toBe(56);
    expect(chroniclesPrecipitationWindDrift(wind, 2, 'rain')).toBe(-56);
    expect(chroniclesPrecipitationWindDrift(wind, 1, 'snow')).toBe(-56);
    expect(chroniclesPrecipitationWindDrift(wind, 3, 'snow')).toBe(56);
    expect(chroniclesPrecipitationWindDrift(wind, 0, 'clear')).toBe(0);
    expect(chroniclesPrecipitationWindDrift(null, 0, 'rain')).toBe(0);
    const fake = fakeDocument();
    vi.stubGlobal('document', fake);
    const host = fake.element('host');
    host.clientHeight = 400;
    const fx = createChroniclesPrecipitationOverlay(host, region, { coarse: true });
    const minute = findTime(region, 'rain');
    const regionalWind = chroniclesRegionalWeatherTransition({
      ...region, worldMinutes: minute,
    }).wind;
    const facing = Math.abs(regionalWind.east) > Math.abs(regionalWind.south) ? 0 : 1;
    expect(fx.sync(minute, facing)).toBe(true);
    const layer = host.children[0];
    const firstDrift = Number.parseInt(layer.style.values['--wind-drift'], 10);
    const originalDroplets = [...layer.children];
    expect(firstDrift).not.toBe(0);
    expect(fx.sync(minute, (facing + 2) % 4)).toBe(true);
    const reversed = Number.parseInt(layer.style.values['--wind-drift'], 10);
    expect(reversed).toBe(-firstDrift);
    expect(layer.children).toEqual(originalDroplets);
    expect(layer.children).toHaveLength(16);
    expect(fx.sync(minute, (facing + 2) % 4)).toBe(false);
    fx.dispose();
  });

  it('creates particles only for precipitation, restores clear, suspends and disposes', () => {
    const fake = fakeDocument();
    vi.stubGlobal('document', fake);
    const host = fake.element('host');
    host.clientHeight = 390;
    const effect = createChroniclesPrecipitationOverlay(host, region, { coarse: true });
    const layer = host.children[0];
    expect(layer.hidden).toBe(true);
    expect(layer.style.values['--precipitation-travel']).toBe('445px');
    const rain = findTime(region, 'rain');
    const clear = findTime(region, 'clear');
    expect(effect.sync(rain)).toBe(true);
    expect(layer.hidden).toBe(false);
    expect(layer.children).toHaveLength(16);
    expect(layer.dataset.kind).toBe('rain');
    expect(effect.sync(rain + 10)).toBe(false);
    expect(layer.children).toHaveLength(16);
    effect.setVisible(false);
    expect(layer.hidden).toBe(true);
    effect.setVisible(true);
    expect(layer.hidden).toBe(false);
    host.clientHeight = 600;
    effect.resize();
    expect(layer.style.values['--precipitation-travel']).toBe('655px');
    expect(effect.sync(clear)).toBe(true);
    expect(layer.hidden).toBe(true);
    expect(layer.children).toHaveLength(0);
    const frozen = layer;
    effect.dispose();
    expect(host.children).toHaveLength(0);
    expect(effect.sync(rain)).toBe(false);
    expect(frozen.children).toHaveLength(0);
  });

  it('fades a weather start/end on the same compositor node without recreating droplets', () => {
    const fake = fakeDocument();
    vi.stubGlobal('document', fake);
    const host = fake.element('host');
    host.clientHeight = 400;
    const fx = createChroniclesPrecipitationOverlay(host, region, { coarse: true });
    let enters = null;
    let ends = null;
    for (let i = 1; i < 130; i += 1) {
      const minute = i * 360;
      const before = chroniclesRegionalWeather({ ...region, worldMinutes: minute - 1 }).kind;
      const after = chroniclesRegionalWeather({ ...region, worldMinutes: minute }).kind;
      if (before !== 'rain' && after === 'rain' && enters === null) enters = minute;
      if (before === 'rain' && after !== 'rain' && ends === null) ends = minute;
    }
    expect(enters).not.toBeNull();
    expect(ends).not.toBeNull();
    const layer = host.children[0];
    expect(fx.sync(enters)).toBe(false); // zero opacity: no DOM particles
    expect(layer.hidden).toBe(true);
    expect(fx.sync(enters + 10)).toBe(true);
    expect(layer.children).toHaveLength(16);
    const originalDroplets = [...layer.children];
    expect(Number(layer.style.values['--precipitation-strength'])).toBeGreaterThan(0);
    const mid = chroniclesRegionalWeatherTransition({ ...region, worldMinutes: enters + 20 });
    expect(fx.sync(enters + 20)).toBe(true);
    expect(layer.children[0]).toBe(originalDroplets[0]);
    expect(Number(layer.style.values['--precipitation-strength'])).toBeCloseTo(mid.precipitationStrength, 3);
    expect(fx.sync(enters + 40)).toBe(true);
    expect(layer.style.values['--precipitation-strength']).toBe('1.000');
    expect(fx.sync(enters + 50)).toBe(false);
    expect(fx.sync(ends)).toBe(false); // rain remains fully active
    expect(fx.sync(ends + 20)).toBe(true);
    expect(layer.children[0]).toBe(originalDroplets[0]);
    expect(fx.sync(ends + 40)).toBe(true);
    expect(layer.hidden).toBe(true);
    expect(layer.children).toHaveLength(0);
    fx.dispose();
    expect(host.children).toHaveLength(0);
  });

  it('keeps caves and Tactics without precipitation, and snow respects lower budgets', () => {
    const fake = fakeDocument();
    vi.stubGlobal('document', fake);
    const dungeon = fake.element('host');
    dungeon.clientHeight = 360;
    const fx = createChroniclesPrecipitationOverlay(dungeon, {
      mapId: 'swordhaven-sewers', regionKind: 'dungeon',
    }, { coarse: true });
    expect(fx.sync(findTime(region, 'rain'))).toBe(false);
    expect(dungeon.children[0].hidden).toBe(true);
    fx.dispose();
    const host = fake.element('host');
    host.clientHeight = 400;
    const snowFx = createChroniclesPrecipitationOverlay(host, snowy, { coarse: false });
    expect(snowFx.sync(findTime(snowy, 'snow'))).toBe(true);
    expect(host.children[0].children).toHaveLength(24);
    snowFx.dispose();
  });

  it('disables animation for reduced motion; no timers or WebGL loop', () => {
    const css = readFileSync(new URL('./chroniclesPrecipitationOverlay.css', import.meta.url), 'utf8');
    const js = readFileSync(new URL('./chroniclesPrecipitationOverlay.js', import.meta.url), 'utf8');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toMatch(/animation:\s*none\s*!important/);
    expect(css).toMatch(/pointer-events:\s*none/);
    expect(js).not.toMatch(/requestAnimationFrame|setInterval|setTimeout|new THREE/);
  });
});
