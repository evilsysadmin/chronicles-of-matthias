import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { chroniclesRegionalWeatherTransition } from './chroniclesRegionalWeather.js';
import {
  chroniclesWindDebrisKind, chroniclesWindDebrisBudget,
  chroniclesWindDebrisParticle, chroniclesWindDebrisCrosswind,
  createChroniclesWindDebrisOverlay,
} from './chroniclesWindDebrisOverlay.js';

const forest = { mapId: 'terra-test-forest', regionKind: 'wilderness', biome: 'forest' };
const ash = { mapId: 'terra-test-ash', regionKind: 'wilderness', biome: 'ash' };

function sample(region, target) {
  for (let slot = 0; slot < 160; slot += 1) {
    const minute = 480 + slot * 360 + 60;
    const weather = chroniclesRegionalWeatherTransition({ ...region, worldMinutes: minute });
    if (target === 'dry' && ['clear', 'cloudy'].includes(weather.kind)) return minute;
    if (weather.kind === target) return minute;
  }
  throw Error('No Terra weather ' + target);
}

function facingCrosswind(wind) {
  return Math.abs(wind.east) >= Math.abs(wind.south) ? 0 : 1;
}

function fakeDocument() {
  function element(name) {
    const el = {
      name, children: [], parent: null, dataset: {}, hidden: false,
      style: { values: {}, setProperty(key, value) { this.values[key] = value; } },
      setAttribute() {},
      appendChild(child) {
        if (child.name === '#fragment') {
          for (const part of child.children) this.appendChild(part);
        } else {
          child.parent = this;
          this.children.push(child);
        }
        return child;
      },
      replaceChildren(...children) { this.children = []; children.forEach(child => this.appendChild(child)); },
      remove() {
        if (this.parent) this.parent.children = this.parent.children.filter(el => el !== this);
      },
    };
    return el;
  }
  return { visibilityState: 'visible', createElement: element,
    createDocumentFragment: () => element('#fragment'), element };
}
afterEach(() => vi.unstubAllGlobals());

describe('Terra decorative wind-borne leaves and ash', () => {
  it('appears only in dry forest/ash wilderness; never lies in rain, caves or towns', () => {
    const clear = { kind: 'clear', precipitation: null, precipitationStrength: 0 };
    expect(chroniclesWindDebrisKind('forest', 'wilderness', clear)).toBe('leaf');
    expect(chroniclesWindDebrisKind('ash', 'wilderness', clear)).toBe('ash');
    expect(chroniclesWindDebrisKind('forest', 'settlement', clear)).toBeNull();
    expect(chroniclesWindDebrisKind('ash', 'dungeon', clear)).toBeNull();
    expect(chroniclesWindDebrisKind('snow', 'wilderness', clear)).toBeNull();
    expect(chroniclesWindDebrisKind('forest', 'wilderness', { ...clear, kind: 'fog' })).toBeNull();
    expect(chroniclesWindDebrisKind('forest', 'wilderness', { ...clear, kind: 'rain' })).toBeNull();
    expect(chroniclesWindDebrisKind('forest', 'wilderness', {
      ...clear, precipitation: 'rain', precipitationStrength: 0.3,
    })).toBeNull();
    expect(chroniclesWindDebrisKind('forest', 'wilderness', null)).toBeNull();
    expect(chroniclesWindDebrisBudget('leaf', true)).toBe(4);
    expect(chroniclesWindDebrisBudget('ash', true)).toBe(5);
    expect(chroniclesWindDebrisBudget('leaf')).toBe(8);
    expect(chroniclesWindDebrisBudget('ash')).toBe(10);
    expect(chroniclesWindDebrisBudget('leaf', true, true)).toBe(0);
  });

  it('has reproducible particle positions and respects wind direction', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw Error('RNG forbidden'); });
    try {
      const leaf = chroniclesWindDebrisParticle(4, 'leaf');
      const dust = chroniclesWindDebrisParticle(4, 'ash');
      expect(chroniclesWindDebrisParticle(4, 'leaf')).toEqual(leaf);
      expect(Object.isFrozen(leaf)).toBe(true);
      expect(leaf.y).toBeGreaterThan(15);
      expect(leaf.y).toBeLessThan(80);
      expect(leaf.width).toBeGreaterThan(dust.width);
      expect(leaf.delay).toBeLessThanOrEqual(0);
      const wind = { east: 0.6, south: -0.4 };
      expect(chroniclesWindDebrisCrosswind(wind, 0)).toBe(56);
      expect(chroniclesWindDebrisCrosswind(wind, 2)).toBe(-56);
    } finally { random.mockRestore(); }
  });

  it('reverses a forest gust without rebuilding nodes or touching the 3D scene', () => {
    const document = fakeDocument();
    vi.stubGlobal('document', document);
    const host = document.element('host');
    host.clientWidth = 390;
    const effect = createChroniclesWindDebrisOverlay(host, forest, { coarse: true });
    const layer = host.children[0];
    expect(layer.hidden).toBe(true);
    expect(layer.style.values['--debris-travel']).toBe('540px');
    expect(layer.style.values['--debris-travel-half']).toBe('270px');
    const minute = sample(forest, 'dry');
    const weather = chroniclesRegionalWeatherTransition({ ...forest, worldMinutes: minute });
    const facing = facingCrosswind(weather.wind);
    expect(effect.sync(minute, facing)).toBe(true);
    expect(layer.hidden).toBe(false);
    expect(layer.dataset.kind).toBe('leaf');
    expect(layer.children).toHaveLength(4);
    const children = [...layer.children];
    const flow = layer.dataset.flow;
    expect(effect.sync(minute, (facing + 2) % 4)).toBe(true);
    expect(layer.children).toEqual(children);
    expect(layer.dataset.flow).not.toBe(flow);
    expect(effect.sync(minute, (facing + 2) % 4)).toBe(false);
    effect.setVisible(false);
    expect(layer.hidden).toBe(true);
    effect.setVisible(true);
    expect(layer.hidden).toBe(false);
    host.clientWidth = 800;
    effect.resize();
    expect(layer.style.values['--debris-travel']).toBe('950px');
    expect(effect.sync(sample(forest, 'rain'), facing)).toBe(true);
    expect(layer.hidden).toBe(true);
    expect(layer.children).toHaveLength(0);
    effect.dispose();
    expect(host.children).toHaveLength(0);
    expect(effect.sync(minute, facing)).toBe(false);
  });

  it('shows sparse ash in dry weather, with zero reduced-motion or dungeon particles', () => {
    const document = fakeDocument();
    vi.stubGlobal('document', document);
    const minute = sample(ash, 'dry');
    const wind = chroniclesRegionalWeatherTransition({ ...ash, worldMinutes: minute }).wind;
    const facing = facingCrosswind(wind);
    const host = document.element('host');
    host.clientWidth = 800;
    const fx = createChroniclesWindDebrisOverlay(host, ash);
    expect(fx.sync(minute, facing)).toBe(true);
    expect(host.children[0].dataset.kind).toBe('ash');
    expect(host.children[0].children).toHaveLength(10);
    const noMotionHost = document.element('host');
    noMotionHost.clientWidth = 360;
    const reduced = createChroniclesWindDebrisOverlay(noMotionHost, ash, {
      coarse: true, reducedMotion: true,
    });
    expect(reduced.sync(minute, facing)).toBe(true); // wind changes, but no debris is created
    expect(noMotionHost.children[0].hidden).toBe(true);
    expect(noMotionHost.children[0].children).toHaveLength(0);
    const dungeonHost = document.element('host');
    dungeonHost.clientWidth = 390;
    const dungeon = createChroniclesWindDebrisOverlay(dungeonHost,
      { mapId: 'crypt', regionKind: 'dungeon', biome: 'ash' }, { coarse: true });
    expect(dungeon.sync(minute, facing)).toBe(false);
    expect(dungeonHost.children[0].children).toHaveLength(0);
    dungeon.dispose();
    reduced.dispose();
    fx.dispose();
  });

  it('is CSS-only, stops on reduced motion and cannot capture controls', () => {
    const css = readFileSync(new URL('./chroniclesWindDebrisOverlay.css', import.meta.url), 'utf8');
    const js = readFileSync(new URL('./chroniclesWindDebrisOverlay.js', import.meta.url), 'utf8');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toMatch(/animation:\s*none\s*!important/);
    expect(css).toMatch(/pointer-events:\s*none/);
    expect(js).not.toMatch(/requestAnimationFrame|setInterval|setTimeout|new THREE/);
  });
});
