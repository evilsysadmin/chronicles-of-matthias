// Premium 2.5D overworld creatures. R2 is an enhancement, not a dependency:
// retain the local sprite until an exact-sized remote atlas has decoded.
import * as THREE from 'three';

export const CHRONICLES_OVERWORLD_FRAME_PX = 320;
export const CHRONICLES_OVERWORLD_FRAMES = Object.freeze([
  'idle-a', 'idle-b', 'walk-a', 'walk-b', 'walk-c', 'attack', 'hurt', 'dead',
]);

const ASSET_HOST = 'assets.chronicles.shadowops.dpdns.org';
const ASSETS = Object.freeze({
  'dire-wolf': Object.freeze({
    url: 'https://assets.chronicles.shadowops.dpdns.org/sprites/dire-wolf-801e6d33ddbec52f.webp',
    worldHeight: 2.7,
  }),
  'bandit-archer': Object.freeze({
    url: 'https://assets.chronicles.shadowops.dpdns.org/sprites/bandit-archer-21ac68ee50536c53.webp',
    worldHeight: 2.65,
  }),
  'harpy': Object.freeze({
    url: 'https://assets.chronicles.shadowops.dpdns.org/sprites/harpy-5bb6e2c854cc9477.webp',
    worldHeight: 2.85,
  }),
  'troll': Object.freeze({
    url: 'https://assets.chronicles.shadowops.dpdns.org/sprites/troll-70685b89d7e8b264.webp',
    worldHeight: 3.65,
  }),
  'skeleton': Object.freeze({
    url: 'https://assets.chronicles.shadowops.dpdns.org/sprites/skeleton-a393c5251b4bcd4f.webp',
    worldHeight: 2.9,
  }),
  'ghoul': Object.freeze({
    url: 'https://assets.chronicles.shadowops.dpdns.org/sprites/ghoul-3bc9ee598b9a92f0.webp',
    worldHeight: 2.6,
  }),
  'silent-acolyte': Object.freeze({
    url: 'https://assets.chronicles.shadowops.dpdns.org/sprites/silent-acolyte-a4ea19664dff0fc0.webp',
    worldHeight: 3,
  }),
  'orc-raider': Object.freeze({
    url: 'https://assets.chronicles.shadowops.dpdns.org/sprites/orc-raider-9bb642b3c535be6e.webp',
    worldHeight: 3.2,
  }),
});

export function chroniclesOverworldSpriteSpec(visualType) {
  return ASSETS[visualType] || null;
}

export function chroniclesOverworldSpriteR2Url(visualType, candidate) {
  const spec = chroniclesOverworldSpriteSpec(visualType);
  if (!spec || typeof candidate !== 'string') return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' || parsed.hostname !== ASSET_HOST
      || parsed.username || parsed.password || parsed.search || parsed.hash
      || parsed.href !== spec.url) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function chroniclesOverworldAtlasValid(image) {
  return image?.width === CHRONICLES_OVERWORLD_FRAME_PX * CHRONICLES_OVERWORLD_FRAMES.length
    && image?.height === CHRONICLES_OVERWORLD_FRAME_PX;
}

export function chroniclesOverworldFrameIndex({
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

// One HTTP request/decode per URL per tab, with independent per-actor UVs.
// Cache failures too, preventing repeated requests from large enemy groups.
const atlasCache = new Map();
function loadAtlas(url, notify) {
  let entry = atlasCache.get(url);
  if (entry) {
    if (entry.status === 'loaded') notify(entry.texture);
    else if (entry.status === 'loading') entry.listeners.push(notify);
    return;
  }
  entry = { status: 'loading', texture: null, listeners: [notify] };
  atlasCache.set(url, entry);
  new THREE.TextureLoader().load(url, source => {
    if (!chroniclesOverworldAtlasValid(source.image)) {
      source.dispose();
      entry.status = 'failed';
      entry.listeners.length = 0;
      return;
    }
    source.colorSpace = THREE.SRGBColorSpace;
    source.magFilter = THREE.LinearFilter;
    source.minFilter = THREE.LinearMipmapLinearFilter;
    entry.texture = source;
    entry.status = 'loaded';
    entry.listeners.splice(0).forEach(fn => fn(source));
  }, undefined, () => {
    entry.status = 'failed';
    entry.listeners.length = 0;
  });
}

export function buildChroniclesRemoteOverworldBillboard(visualType, fallback) {
  const spec = chroniclesOverworldSpriteSpec(visualType);
  if (!spec) return null;
  const group = new THREE.Group();
  group.name = `chronicles-billboard-${visualType}-premium`;
  group.add(fallback);

  const material = new THREE.SpriteMaterial({
    transparent: true, alphaTest: 0.06, depthWrite: false, fog: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = `chronicles-${visualType}-premium`;
  sprite.center.set(0.5, 0.03);
  sprite.scale.set(spec.worldHeight, spec.worldHeight, 1);
  sprite.renderOrder = 2;
  sprite.visible = false;
  group.add(sprite);

  let localTexture = null;
  let currentIndex = -1;
  let disposed = false;
  let lastTime = 0;
  let lastCues = {};
  group.userData.chroniclesBillboard = {
    visualType, frames: CHRONICLES_OVERWORLD_FRAMES, sprite,
  };
  group.userData.updateChroniclesSprite = (time, cues = {}) => {
    lastTime = time;
    lastCues = cues;
    if (!localTexture) {
      fallback.userData.updateChroniclesSprite?.(time, cues);
      return;
    }
    const index = chroniclesOverworldFrameIndex({ time, ...cues });
    if (index === currentIndex) return;
    currentIndex = index;
    localTexture.offset.set(index / CHRONICLES_OVERWORLD_FRAMES.length, 0);
  };
  group.userData.setChroniclesSpriteOpacity = opacity => {
    const value = Math.max(0, Math.min(1, opacity));
    material.opacity = value;
    fallback.userData.setChroniclesSpriteOpacity?.(value);
  };
  group.userData.chroniclesDispose = () => {
    disposed = true;
    localTexture?.dispose();
    material.dispose();
    fallback.userData.chroniclesDispose?.();
  };

  const url = chroniclesOverworldSpriteR2Url(visualType, spec.url);
  if (url && typeof document !== 'undefined') loadAtlas(url, source => {
    if (disposed) return;
    localTexture = source.clone();
    localTexture.repeat.set(1 / CHRONICLES_OVERWORLD_FRAMES.length, 1);
    localTexture.needsUpdate = true;
    material.map = localTexture;
    material.needsUpdate = true;
    group.userData.updateChroniclesSprite(lastTime, lastCues);
    // Atomic reveal: offline, 404, bad CORS or wrong size retains local art.
    sprite.visible = true;
    fallback.visible = false;
    group.userData.onChroniclesSpriteAtlasReady?.();
  });
  return group;
}
