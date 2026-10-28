// Approved sewer-spider painting: immutable R2 atlas produced entirely by
// warping the SAME original illustration, not synthesized replacement art.
// The source stays out of the bundle; old 3D creature remains visible until
// the 8-frame WebP has actually loaded and passed the size contract.
import * as THREE from 'three';

export const CHRONICLES_SEWER_SPIDER_R2_URL =
  'https://assets.chronicles.shadowops.dpdns.org/sprites/sewer-spider-4e1324b3827c789a.webp';
export const CHRONICLES_SEWER_SPIDER_FRAMES = Object.freeze([
  'idle-a', 'idle-b', 'walk-a', 'walk-b', 'walk-c', 'attack', 'hurt', 'dead',
]);
export const CHRONICLES_SEWER_SPIDER_FRAME_PX = 320;

export function chroniclesSpiderR2Url(candidate) {
  if (typeof candidate !== 'string' || !candidate.trim()) return null;
  try {
    const url = new URL(candidate.trim());
    if (url.protocol !== 'https:' || url.hostname !== 'assets.chronicles.shadowops.dpdns.org'
      || !/^\/sprites\/sewer-spider-[a-f0-9]{16}\.webp$/.test(url.pathname)
      || url.username || url.password || url.search || url.hash) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function chroniclesSpiderAtlasValid(image) {
  return image?.width === CHRONICLES_SEWER_SPIDER_FRAME_PX * CHRONICLES_SEWER_SPIDER_FRAMES.length
    && image?.height === CHRONICLES_SEWER_SPIDER_FRAME_PX;
}

export function chroniclesSpiderFrameIndex({
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

// One network fetch + decode per URL per tab, shared by all spiders; the
// per-enemy texture clones keep UV offsets independent. Cache failures to
// avoid a repeated request storm when R2 is inaccessible.
const atlasCache = new Map();
function withSpiderAtlas(url, callback) {
  let record = atlasCache.get(url);
  if (record) {
    if (record.state === 'loaded') callback(record.texture);
    else if (record.state === 'loading') record.listeners.push(callback);
    return;
  }
  record = { state: 'loading', texture: null, listeners: [callback] };
  atlasCache.set(url, record);
  new THREE.TextureLoader().load(url, source => {
    if (!chroniclesSpiderAtlasValid(source.image)) {
      source.dispose();
      record.state = 'failed';
      record.listeners.length = 0;
      return;
    }
    source.colorSpace = THREE.SRGBColorSpace;
    source.magFilter = THREE.LinearFilter;
    source.minFilter = THREE.LinearMipmapLinearFilter;
    record.texture = source;
    record.state = 'loaded';
    record.listeners.splice(0).forEach(fn => fn(source));
  }, undefined, () => {
    record.state = 'failed';
    record.listeners.length = 0;
  });
}

export function buildChroniclesRemoteSpiderBillboard(fallback) {
  const group = new THREE.Group();
  group.name = 'chronicles-billboard-crypt-spider';
  group.add(fallback);
  const material = new THREE.SpriteMaterial({
    transparent: true, alphaTest: 0.06, depthWrite: false, fog: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = 'chronicles-sewer-spider-premium';
  sprite.center.set(0.5, 0.03);
  sprite.scale.set(3.05, 2.7, 1);
  sprite.visible = false;
  group.add(sprite);

  let currentTexture = null;
  let disposed = false;
  let currentIndex = -1;
  let lastTime = 0;
  let lastCues = {};
  group.userData.chroniclesBillboard = {
    visualType: 'crypt-spider', frames: CHRONICLES_SEWER_SPIDER_FRAMES, sprite,
  };
  group.userData.updateChroniclesSprite = (time, cues = {}) => {
    lastTime = time;
    lastCues = cues;
    if (!currentTexture) return;
    const next = chroniclesSpiderFrameIndex({ ...cues, time });
    if (next === currentIndex) return;
    currentIndex = next;
    currentTexture.offset.set(next / CHRONICLES_SEWER_SPIDER_FRAMES.length, 0);
  };
  group.userData.setChroniclesSpriteOpacity = opacity => {
    material.opacity = Math.max(0, Math.min(1, opacity));
  };
  group.userData.chroniclesDispose = () => {
    disposed = true;
    currentTexture?.dispose();
    material.dispose();
    // The scene's standard disposeObject traverses the existing 3D fallback.
  };

  const url = chroniclesSpiderR2Url(
    import.meta.env.VITE_CHRONICLES_SEWER_SPIDER_URL || CHRONICLES_SEWER_SPIDER_R2_URL,
  );
  if (url && typeof document !== 'undefined') withSpiderAtlas(url, source => {
    if (disposed) return;
    const local = source.clone();
    local.repeat.set(1 / CHRONICLES_SEWER_SPIDER_FRAMES.length, 1);
    local.needsUpdate = true;
    currentTexture = local;
    material.map = local;
    material.needsUpdate = true;
    group.userData.updateChroniclesSprite(lastTime, lastCues);
    // Atomic switch: no transparent spider on slow, bad or offline R2.
    sprite.visible = true;
    fallback.visible = false;
  });
  return group;
}
