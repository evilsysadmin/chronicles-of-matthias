import { chroniclesRegionalWeather } from './chroniclesRegionalWeather.js';
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
  const drift = snow ? -36 + fraction(index, 43) * 72 : -44 - fraction(index, 79) * 54;
  const opacity = snow ? 0.42 + fraction(index, 317) * 0.38 : 0.28 + fraction(index, 317) * 0.4;
  return Object.freeze({
    x, size, duration, drift, opacity,
    delay: -fraction(index, 213) * duration,
    depth: index % 3 === 0 ? 'far' : 'near',
  });
}

// Outdoor-only. Invoked on game-state/time changes and visibility/viewport
// changes, NEVER in requestAnimationFrame or from a setInterval.
export function createChroniclesPrecipitationOverlay(host, region, {
  coarse = false, reducedMotion = false,
} = {}) {
  const layer = document.createElement('div');
  layer.className = 'chronicles-precipitation-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.hidden = true;
  host.appendChild(layer);
  let kind = null;
  let visible = true;
  let disposed = false;

  function resize() {
    if (disposed) return;
    layer.style.setProperty('--precipitation-travel', `${Math.max(120, host.clientHeight + 55)}px`);
  }

  function sync(worldMinutes) {
    if (disposed) return false;
    const nextKind = chroniclesPrecipitationKind(
      chroniclesRegionalWeather({ ...region, worldMinutes }),
    );
    if (nextKind === kind) return false;
    kind = nextKind;
    layer.replaceChildren();
    if (kind) {
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
    } else {
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
