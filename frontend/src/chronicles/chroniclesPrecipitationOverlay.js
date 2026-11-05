import { chroniclesRegionalWeatherTransition } from './chroniclesRegionalWeather.js';
import './chroniclesPrecipitationOverlay.css';

// Screen-space rainfall/snowfall is a tiny compositor layer above the idle
// canvas. It never asks Three.js for frames or constructs GPU particle geometry.
export function chroniclesPrecipitationKind(weather) {
  return weather?.kind === 'rain' || weather?.kind === 'snow' ? weather.kind : null;
}

export function chroniclesPrecipitationBudget(kind, coarse = false, reducedMotion = false) {
  if (!chroniclesPrecipitationKind({ kind })) return 0;
  if (reducedMotion) return coarse ? 4 : 6;
  if (kind === 'snow') return coarse ? 12 : 24;
  return coarse ? 16 : 36;
}

// A stable integer mix, no Math.random, no wall-clock, no mutable game state.
function fraction(index, seed) {
  let h = Math.imul((index + 1) ^ seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

export function chroniclesPrecipitationParticle(index, kind) {
  const snow = kind === 'snow';
  const x = 2 + fraction(index, 171) * 96;
  const size = snow ? 3 + fraction(index, 423) * 3.4 : 0.8 + fraction(index, 37) * 0.9;
  const duration = snow ? 5.5 + fraction(index, 173) * 4.8 : 0.75 + fraction(index, 91) * 0.65;
  // A nearly vertical default fall: the regional wind, not an old
  // always-left particle bias, determines the dominant rain slant.
  const drift = snow ? -36 + fraction(index, 43) * 72 : -11 + fraction(index, 79) * 22;
  const opacity = snow ? 0.42 + fraction(index, 317) * 0.38 : 0.28 + fraction(index, 317) * 0.4;
  return Object.freeze({
    x, size, duration, drift, opacity,
    delay: -fraction(index, 213) * duration,
    depth: index % 3 === 0 ? 'far' : 'near',
  });
}

// Facing order follows the four canonical party directions: N, E, S, W.
// Camera-right in world coordinates is +east, +south, -east, -south.
// Reversing facing reverses apparent lateral travel; zero GPU work.
export function chroniclesPrecipitationWindDrift(wind, facing = 0, kind = null) {
  if (!chroniclesPrecipitationKind({ kind }) || !wind) return 0;
  const direction = Number.isInteger(facing) ? ((facing % 4) + 4) % 4 : 0;
  const projection = [wind.east, wind.south, -wind.east, -wind.south][direction];
  if (!Number.isFinite(projection)) return 0;
  return Math.round(Math.max(-1, Math.min(1, projection))
    * (kind === 'snow' ? 140 : 94)) || 0;
}

// Outdoor-only. Invoked on game-state/time changes and visibility/viewport
// changes only; no autonomous frame loop or timer is allocated.
export function createChroniclesPrecipitationOverlay(host, region, {
  coarse = false, reducedMotion = false,
} = {}) {
  const layer = document.createElement('div');
  layer.className = 'chronicles-precipitation-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.hidden = true;
  host.appendChild(layer);
  let kind = null;
  let strength = 0;
  let windDrift = 0;
  let visible = true;
  let disposed = false;

  function resize() {
    if (disposed) return;
    layer.style.setProperty('--precipitation-travel', `${Math.max(120, host.clientHeight + 55)}px`);
  }

  function sync(worldMinutes, facing = 0) {
    if (disposed) return false;
    const weather = chroniclesRegionalWeatherTransition({ ...region, worldMinutes });
    const nextKind = chroniclesPrecipitationKind({ kind: weather?.precipitation });
    const nextStrength = nextKind ? weather.precipitationStrength : 0;
    const nextWindDrift = chroniclesPrecipitationWindDrift(weather?.wind, facing, nextKind);
    if (nextKind === kind && Math.abs(nextStrength - strength) < 0.00001
      && windDrift === nextWindDrift) return false;
    const changedKind = nextKind !== kind;
    kind = nextKind;
    strength = nextStrength;
    windDrift = nextWindDrift;
    layer.style.setProperty('--precipitation-strength', strength.toFixed(3));
    layer.style.setProperty('--wind-drift', windDrift + 'px');
    // Rebuild only when swapping precipitation type; changing its strength
    // merely updates the opacity of the existing CSS compositor layer.
    if (changedKind) layer.replaceChildren();
    if (changedKind && kind) {
      layer.dataset.kind = kind;
      const budget = chroniclesPrecipitationBudget(kind, coarse, reducedMotion);
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < budget; i += 1) {
        const p = chroniclesPrecipitationParticle(i, kind);
        const drop = document.createElement('span');
        drop.className = 'chronicles-precipitation-particle';
        drop.dataset.depth = p.depth;
        drop.style.setProperty('--p-x', `${p.x.toFixed(2)}%`);
        drop.style.setProperty('--p-size', `${p.size.toFixed(2)}px`);
        drop.style.setProperty('--p-duration', `${p.duration.toFixed(2)}s`);
        drop.style.setProperty('--p-delay', `${p.delay.toFixed(2)}s`);
        drop.style.setProperty('--p-drift', `${p.drift.toFixed(2)}px`);
        drop.style.setProperty('--p-alpha', `${p.opacity.toFixed(2)}`);
        fragment.appendChild(drop);
      }
      layer.appendChild(fragment);
    } else if (changedKind) {
      delete layer.dataset.kind;
    }
    layer.hidden = !visible || !kind;
    return true;
  }

  function setVisible(nextVisible) {
    if (disposed) return;
    visible = Boolean(nextVisible);
    layer.hidden = !visible || !kind;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    layer.remove();
  }

  resize();
  return { sync, resize, setVisible, dispose };
}
