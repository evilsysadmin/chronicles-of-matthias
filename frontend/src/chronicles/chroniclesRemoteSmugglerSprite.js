// Sewer smuggler / road bandit: user-reviewable 8-frame painted atlas.
// The existing local road-bandit sheet stays fully functional until R2 has
// delivered and decoded an exact, hash-addressed replacement.
import * as THREE from 'three';

export const CHRONICLES_SMUGGLER_R2_URL =
  'https://assets.chronicles.shadowops.dpdns.org/sprites/sewer-smuggler-f90352c98469f3b3.webp';
export const CHRONICLES_SMUGGLER_FRAMES = Object.freeze([
  'idle-a', 'idle-b', 'walk-a', 'walk-b', 'walk-c', 'attack', 'hurt', 'dead',
]);
export const CHRONICLES_SMUGGLER_FRAME_PX = 320;

export function chroniclesSmugglerR2Url(candidate) {
  if (typeof candidate !== 'string' || !candidate.trim()) return null;
  try {
    const url = new URL(candidate.trim());
    return url.protocol === 'https:'
      && url.hostname === 'assets.chronicles.shadowops.dpdns.org'
      && /^\/sprites\/sewer-smuggler-[0-9a-f]{16}\.webp$/.test(url.pathname)
      && !url.username && !url.password && !url.search && !url.hash
      ? url.href : null;
  } catch {
    return null;
  }
}

export function chroniclesSmugglerAtlasValid(image) {
  return image?.width === 2560 && image?.height === CHRONICLES_SMUGGLER_FRAME_PX;
}

export function chroniclesSmugglerFrameIndex({
  time = 0, moving = false, attacking = false, hurt = false,
  dead = false, reducedMotion = false,
} = {}) {
  if (dead) return 7;
  if (hurt) return 6;
  if (attacking) return 5;
  if (reducedMotion) return 0;
  if (moving) return 2 + (Math.floor(Math.max(0, time) * 9) % 3);
  return Math.floor(Math.max(0, time) * 1.7) % 2;
}

// One decoded source and fetch shared between all bandits in the same tab.
// Each scene actor clones the texture for independent UV frame changes.
const cache = new Map();
function withSmugglerAtlas(url, callback) {
  const found = cache.get(url);
  if (found) {
    if (found.status === 'loaded') callback(found.texture);
    else if (found.status === 'loading') found.callbacks.push(callback);
    return;
  }
  const entry = { status: 'loading', texture: null, callbacks: [callback] };
  cache.set(url, entry);
  new THREE.TextureLoader().load(url, source => {
    if (!chroniclesSmugglerAtlasValid(source.image)) {
      source.dispose();
      entry.status = 'failed';
      entry.callbacks.length = 0;
      return;
    }
    source.colorSpace = THREE.SRGBColorSpace;
    source.magFilter = THREE.LinearFilter;
    source.minFilter = THREE.LinearMipmapLinearFilter;
    entry.status = 'loaded';
    entry.texture = source;
    entry.callbacks.splice(0).forEach(fn => fn(source));
  }, undefined, () => {
    entry.status = 'failed';
    entry.callbacks.length = 0;
  });
}

export function buildChroniclesRemoteSmugglerBillboard(fallback) {
  const group = new THREE.Group();
  group.name = 'chronicles-billboard-road-bandit-premium';
  group.add(fallback);
  const material = new THREE.SpriteMaterial({
    transparent: true, alphaTest: 0.06, depthWrite: false, fog: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = 'chronicles-road-bandit-premium';
  sprite.center.set(0.5, 0.03);
  sprite.scale.set(2.65, 2.65, 1);
  sprite.visible = false;
  group.add(sprite);
  let texture = null;
  let lastIndex = -1;
  let disposed = false;
  let lastTime = 0;
  let lastCues = {};
  group.userData.chroniclesBillboard = {
    visualType: 'road-bandit', sprite, frames: CHRONICLES_SMUGGLER_FRAMES,
  };
  group.userData.updateChroniclesSprite = (time, cues = {}) => {
    lastTime = time;
    lastCues = cues;
    if (!texture) {
      fallback.userData.updateChroniclesSprite?.(time, cues);
      return;
    }
    const next = chroniclesSmugglerFrameIndex({ time, ...cues });
    if (next === lastIndex) return;
    lastIndex = next;
    texture.offset.set(next / CHRONICLES_SMUGGLER_FRAMES.length, 0);
  };
  group.userData.setChroniclesSpriteOpacity = opacity => {
    const clamped = Math.max(0, Math.min(1, opacity));
    material.opacity = clamped;
    fallback.userData.setChroniclesSpriteOpacity?.(clamped);
  };
  group.userData.chroniclesDispose = () => {
    disposed = true;
    texture?.dispose();
    material.dispose();
    fallback.userData.chroniclesDispose?.();
  };

  const url = chroniclesSmugglerR2Url(
    import.meta.env.VITE_CHRONICLES_SMUGGLER_URL || CHRONICLES_SMUGGLER_R2_URL,
  );
  if (url && typeof document !== 'undefined') withSmugglerAtlas(url, source => {
    if (disposed) return;
    const local = source.clone();
    local.repeat.set(1 / CHRONICLES_SMUGGLER_FRAMES.length, 1);
    local.needsUpdate = true;
    texture = local;
    material.map = local;
    material.needsUpdate = true;
    group.userData.updateChroniclesSprite(lastTime, lastCues);
    sprite.visible = true;
    fallback.visible = false;
    group.userData.onChroniclesSpriteAtlasReady?.();
  });
  return group;
}
