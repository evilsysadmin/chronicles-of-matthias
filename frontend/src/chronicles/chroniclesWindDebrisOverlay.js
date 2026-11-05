import { chroniclesRegionalWeatherTransition } from './chroniclesRegionalWeather.js';
import { chroniclesPrecipitationWindDrift } from './chroniclesPrecipitationOverlay.js';
import './chroniclesWindDebrisOverlay.css';

// Airborne details are decorative. Only explicitly authored outdoor biomes
// get them, and only during dry, visible conditions. No invented climate.
export function chroniclesWindDebrisKind(biome, regionKind, weather) {
  if (regionKind !== 'wilderness' || !weather
    || !['clear', 'cloudy'].includes(weather.kind)
    || weather.precipitation || weather.precipitationStrength > 0) return null;
  if (biome === 'forest') return 'leaf';
  if (biome === 'ash') return 'ash';
  return null;
}

export function chroniclesWindDebrisBudget(kind, coarse = false, reducedMotion = false) {
  if (reducedMotion) return 0; // Avoid moving decorative clutter for accessibility.
  if (kind === 'leaf') return coarse ? 4 : 8;
  if (kind === 'ash') return coarse ? 5 : 10;
  return 0;
}

// Stable positions, speeds and staggered phases; zero runtime randomness.
// Every fleck remains within one shared CSS compositor layer.
function unit(index, salt) {
  let hash = Math.imul((index + 1) ^ salt, 0x9e3779b1);
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  return ((hash ^ (hash >>> 13)) >>> 0) / 4294967296;
}

export function chroniclesWindDebrisParticle(index, kind) {
  const leaf = kind === 'leaf';
  const duration = (leaf ? 9 : 6) + unit(index, 131) * (leaf ? 6 : 5);
  return Object.freeze({
    y: 17 + unit(index, 49) * 62,
    width: (leaf ? 5 : 2) + unit(index, 89) * (leaf ? 5 : 3),
    height: (leaf ? 3 : 2) + unit(index, 177) * (leaf ? 3 : 2),
    float: 12 + unit(index, 93) * 23,
    duration,
    delay: -unit(index, 37) * duration,
    alpha: (leaf ? 0.26 : 0.21) + unit(index, 257) * 0.3,
    variant: index % 3,
  });
}

// The direction is inherited from the same camera-relative wind as rain/snow.
// A headwind has no visible lateral drift; avoid a fictitious leaf storm.
export function chroniclesWindDebrisCrosswind(wind, facing = 0) {
  return chroniclesPrecipitationWindDrift(wind, facing, 'rain');
}

export function createChroniclesWindDebrisOverlay(host, region, {
  coarse = false, reducedMotion = false,
} = {}) {
  const layer = document.createElement('div');
  layer.className = 'chronicles-wind-debris-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.hidden = true;
  host.appendChild(layer);
  let kind = null;
  let drift = 0;
  let visible = document.visibilityState !== 'hidden';
  let disposed = false;

  const resize = () => {
    if (!disposed) layer.style.setProperty('--debris-travel',
      `${Math.max(120, host.clientWidth + 150)}px`);
  };

  const sync = (worldMinutes, facing = 0) => {
    if (disposed) return false;
    const weather = chroniclesRegionalWeatherTransition({ ...region, worldMinutes });
    const potential = chroniclesWindDebrisKind(region.biome, region.regionKind, weather);
    const nextDrift = chroniclesWindDebrisCrosswind(weather?.wind, facing);
    const nextKind = Math.abs(nextDrift) >= 8 && !reducedMotion ? potential : null;
    if (kind === nextKind && drift === nextDrift) return false;
    const changedKind = kind !== nextKind;
    kind = nextKind;
    drift = nextDrift;
    layer.dataset.flow = drift < 0 ? 'left' : 'right';
    if (changedKind) {
      layer.replaceChildren();
      if (kind) {
        layer.dataset.kind = kind;
        const fragment = document.createDocumentFragment();
        for (let index = 0; index < chroniclesWindDebrisBudget(kind, coarse, reducedMotion); index += 1) {
          const p = chroniclesWindDebrisParticle(index, kind);
          const fleck = document.createElement('span');
          fleck.className = 'chronicles-wind-debris-fleck';
          fleck.dataset.variant = String(p.variant);
          fleck.style.setProperty('--debris-y', p.y.toFixed(2) + '%');
          fleck.style.setProperty('--debris-width', p.width.toFixed(2) + 'px');
          fleck.style.setProperty('--debris-height', p.height.toFixed(2) + 'px');
          fleck.style.setProperty('--debris-float', p.float.toFixed(2) + 'px');
          fleck.style.setProperty('--debris-duration', p.duration.toFixed(2) + 's');
          fleck.style.setProperty('--debris-delay', p.delay.toFixed(2) + 's');
          fleck.style.setProperty('--debris-alpha', p.alpha.toFixed(2));
          fragment.appendChild(fleck);
        }
        layer.appendChild(fragment);
      } else delete layer.dataset.kind;
    }
    layer.hidden = !visible || !kind;
    return true;
  };

  const setVisible = (nextVisible) => {
    if (disposed) return;
    visible = Boolean(nextVisible);
    layer.hidden = !visible || !kind;
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    layer.remove();
  };
  resize();
  return { sync, resize, setVisible, dispose };
}
